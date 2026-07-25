import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return response({ error: "Function configuration is incomplete" }, 500);
  }

  let bookingId: string;
  try {
    const body = await request.json();
    bookingId = body.bookingId;
  } catch {
    return response({ error: "Invalid request body" }, 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId)) {
    return response({ error: "Invalid booking id" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, buyer_name, buyer_email, scheduled_at, shop_id, services(name, duration_minutes), shops(name, owner_id)",
    )
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return response({ error: "Booking not found" }, 404);
  }

  const shop = booking.shops as unknown as {
    name: string;
    owner_id: string;
  };
  const service = booking.services as unknown as {
    name: string;
    duration_minutes: number;
  };
  const { data: profile } = await admin
    .from("profiles")
    .select("google_provider_token, google_calendar_connected_at")
    .eq("id", shop.owner_id)
    .maybeSingle();

  if (!profile?.google_provider_token || !profile.google_calendar_connected_at) {
    await admin
      .from("bookings")
      .update({ calendar_sync_status: "not_connected", calendar_sync_error: null })
      .eq("id", bookingId);
    return response({ calendarSynced: false, meetUrl: null });
  }

  await admin
    .from("bookings")
    .update({ calendar_sync_status: "pending", calendar_sync_error: null })
    .eq("id", bookingId);

  const start = new Date(booking.scheduled_at);
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);
  const eventResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${profile.google_provider_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `${service.name} · ${booking.buyer_name || "ลูกค้า"}`,
        description: `การจองผ่าน Framelink\nผู้จอง: ${booking.buyer_name || "-"}\nอีเมล: ${booking.buyer_email || "-"}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: booking.buyer_email ? [{ email: booking.buyer_email }] : [],
        conferenceData: {
          createRequest: {
            requestId: booking.id,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    },
  );

  if (!eventResponse.ok) {
    const detail = (await eventResponse.text()).slice(0, 500);
    await admin
      .from("bookings")
      .update({
        calendar_sync_status: "failed",
        calendar_sync_error: `Google Calendar ${eventResponse.status}: ${detail}`,
      })
      .eq("id", bookingId);
    return response({ calendarSynced: false, meetUrl: null });
  }

  const event = await eventResponse.json();
  const meetUrl =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find(
      (entry: { entryPointType?: string }) => entry.entryPointType === "video",
    )?.uri ??
    null;

  await admin
    .from("bookings")
    .update({
      google_calendar_event_id: event.id,
      google_meet_url: meetUrl,
      calendar_sync_status: "synced",
      calendar_sync_error: null,
    })
    .eq("id", bookingId);

  return response({ calendarSynced: true, meetUrl });
});
