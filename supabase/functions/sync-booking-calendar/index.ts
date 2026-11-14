import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createGoogleCalendarEvent } from "./google-auth.ts";

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
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? null;
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? null;
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: Deno.env.get("SUPABASE_DB_SCHEMA") || "public" },
  });
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
    .select(
      "google_provider_token, google_provider_refresh_token, google_calendar_connected_at",
    )
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
  const eventUrl =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all";
  const eventBody = {
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
  };
  const { response: eventResponse, accessToken: refreshedAccessToken } =
    await createGoogleCalendarEvent({
      eventUrl,
      eventBody,
      accessToken: profile.google_provider_token,
      refreshToken: profile.google_provider_refresh_token,
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    });

  if (refreshedAccessToken) {
    await admin
      .from("profiles")
      .update({ google_provider_token: refreshedAccessToken })
      .eq("id", shop.owner_id);
  }

  if (!eventResponse.ok) {
    const detail = (await eventResponse.text()).slice(0, 500);
    if (eventResponse.status === 401 && !refreshedAccessToken) {
      await admin
        .from("profiles")
        .update({
          google_provider_token: null,
          google_calendar_connected_at: null,
        })
        .eq("id", shop.owner_id);
    }
    await admin
      .from("bookings")
      .update({
        calendar_sync_status: "failed",
        calendar_sync_error:
          eventResponse.status === 401
            ? "สิทธิ์ Google Calendar หมดอายุ กรุณาเชื่อมต่อใหม่"
            : `Google Calendar ${eventResponse.status}: ${detail}`,
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
