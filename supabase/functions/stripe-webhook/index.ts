import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { reconcileStripeRefund } from "./refunds.ts";
import { createStripeWebhookHandler } from "./handler.ts";

async function invokeFunction(
  supabaseUrl: string,
  serviceRoleKey: string,
  name: string,
  body: Record<string, unknown>,
) {
  return fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!url || !serviceKey || !secret) return new Response("Webhook configuration is incomplete", { status: 500 });
  const admin = createClient(url, serviceKey, { db: { schema: Deno.env.get("BUYKUB_DB_SCHEMA") || "buykub" } });
  return createStripeWebhookHandler({
    secret,
    stripeSecretKey,
    reconcileRefund: (id) => {
      if (!stripeSecretKey) throw new Error("Stripe API key is missing");
      return reconcileStripeRefund(id, stripeSecretKey, (name, args) => admin.rpc(name, args));
    },
    rpc: (name, args) => admin.rpc(name, args),
    dispatch: (name, body) => invokeFunction(url, serviceKey, name, body),
  })(request);
});
