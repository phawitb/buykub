import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildProductKeyEmail } from "./email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Function configuration is incomplete" }, 500);
  }

  let orderId = "";
  let emailToken = "";
  try {
    const body = await request.json();
    orderId = String(body.orderId ?? "");
    emailToken = String(body.emailToken ?? "");
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!uuidPattern.test(orderId) || !uuidPattern.test(emailToken)) {
    return json({ error: "Invalid delivery reference" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id, shop_id, product_id, buyer_email, fulfilment_email_status, fulfilment_email_attempts, fulfilment_token",
    )
    .eq("id", orderId)
    .eq("fulfilment_token", emailToken)
    .maybeSingle();
  if (orderError || !order?.buyer_email) {
    return json({ error: "Delivery not found" }, 404);
  }
  if (order.fulfilment_email_status === "sent") {
    return json({ emailStatus: "sent" });
  }

  const { data: keyRow } = await admin
    .from("product_keys")
    .select("key_value")
    .eq("assigned_order_id", orderId)
    .eq("status", "assigned")
    .maybeSingle();
  if (!keyRow) return json({ error: "Assigned key not found" }, 404);

  const [{ data: product }, { data: shop }] = await Promise.all([
    admin.from("products").select("name").eq("id", order.product_id).maybeSingle(),
    admin.from("shops").select("name").eq("id", order.shop_id).maybeSingle(),
  ]);
  const email = buildProductKeyEmail({
    shopName: shop?.name ?? "Framelink",
    productName: product?.name ?? "สินค้า",
    orderId,
    keyValue: keyRow.key_value,
  });

  const nextAttempt = Number(order.fulfilment_email_attempts ?? 0) + 1;
  await admin
    .from("orders")
    .update({
      fulfilment_email_status: "pending",
      fulfilment_email_attempts: nextAttempt,
      fulfilment_email_last_error: null,
    })
    .eq("id", orderId);

  if (!resendApiKey || !from) {
    await admin
      .from("orders")
      .update({
        fulfilment_email_status: "failed",
        fulfilment_email_last_error: "Email service is not configured",
      })
      .eq("id", orderId);
    return json({ emailStatus: "failed" }, 503);
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `product-key-${orderId}`,
    },
    body: JSON.stringify({
      from,
      to: [order.buyer_email],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!resendResponse.ok) {
    const detail = (await resendResponse.text()).slice(0, 300);
    await admin
      .from("orders")
      .update({
        fulfilment_email_status: "failed",
        fulfilment_email_last_error: `Resend ${resendResponse.status}: ${detail}`,
      })
      .eq("id", orderId);
    return json({ emailStatus: "failed" }, 502);
  }

  await admin
    .from("orders")
    .update({
      fulfilment_email_status: "sent",
      fulfilment_email_last_error: null,
      fulfilment_email_sent_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  return json({ emailStatus: "sent" });
});
