function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
) {
  if (!header) return false;
  const fields = header.split(",");
  const timestamp = fields.find((field) => field.startsWith("t="))?.slice(2);
  const signatures = fields
    .filter((field) => field.startsWith("v1="))
    .map((field) => field.slice(3));
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const expected = hex(new Uint8Array(signature));
  return signatures.some((value) => equal(value, expected));
}

type StripeSession = {
  id: string;
  client_reference_id?: string | null;
  metadata?: { checkout_reference?: string; purchase_flow?: string } | null;
  status?: string;
  amount?: number;
  amount_received?: number;
  currency?: string;
  payment_intent?: string | null;
  payment_status?: string;
  customer_details?: { email?: string | null; name?: string | null } | null;
};

type Fulfillment = { kind: string; order_id?: string; email_token?: string | null; booking_id?: string };
type Dependencies = {
  secret: string;
  stripeSecretKey: string | undefined;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: Fulfillment[] | Fulfillment | null; error: unknown }>;
  dispatch: (name: string, body: Record<string, unknown>) => Promise<unknown>;
  reconcileRefund?: (paymentIntentId: string) => Promise<void>;
};
export function createStripeWebhookHandler({ secret, stripeSecretKey, rpc, dispatch, reconcileRefund }: Dependencies) {
  return async (request: Request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
  const payload = await request.text();
  const verified = await verifyStripeSignature(
    payload,
    request.headers.get("stripe-signature"),
    secret,
  );
  if (!verified) return json({ error: "Invalid Stripe signature" }, 400);

  let event: { type?: string; livemode?: boolean; data?: { object?: StripeSession } };
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }
  // Signatures authenticate the sender, not the environment. Fail closed on
  // configuration mistakes before fulfillment, expiration, or refund effects.
  const keyMode = /^(?:sk|rk)_(live|test)_[a-zA-Z0-9]+$/.exec(stripeSecretKey ?? "")?.[1];
  if (!keyMode) return json({ error: "Stripe API key configuration is invalid" }, 500);
  if (typeof event?.livemode !== "boolean" || event.livemode !== (keyMode === "live")) {
    return json({ error: "Stripe event environment does not match configuration" }, 400);
  }
  const session = event.data?.object;
  if (!session?.id) return json({ received: true });
  if (["charge.refunded", "refund.created", "refund.updated", "refund.failed"].includes(event.type ?? "")) {
    if (!session.payment_intent) return json({ received: true });
    if (!reconcileRefund) throw new Error("Refund reconciliation is not configured");
    await reconcileRefund(session.payment_intent);
    return json({ received: true });
  }
  const reference = session.metadata?.checkout_reference ?? session.client_reference_id;

  if (event.type?.startsWith("payment_intent.")) {
    if (session.metadata?.purchase_flow !== "promptpay" || !reference) return json({ received: true });
    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      const { error } = await rpc("expire_promptpay_checkout", { p_checkout_reference: reference, p_payment_intent_id: session.id });
      return error ? json({ error: "Unable to expire payment" }, 500) : json({ received: true });
    }
    if (event.type !== "payment_intent.succeeded" || session.status !== "succeeded" ||
        !Number.isInteger(session.amount) || session.amount_received !== session.amount || session.currency !== "thb") return json({ received: true });
    const { data, error } = await rpc("finalize_promptpay_checkout", {
      p_checkout_reference: reference, p_payment_intent_id: session.id,
      p_amount_cents: session.amount, p_currency: session.currency,
    });
    if (error) return json({ error: "Unable to finalize payment" }, 500);
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.kind === "product" && result.order_id && result.email_token) {
      const delivery = await dispatch("send-product-key", { orderId: result.order_id, emailToken: result.email_token });
      if (delivery instanceof Response && !delivery.ok) throw new Error("Email delivery failed");
    }
    return json({ received: true });
  }

  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const { error } = await rpc("expire_stripe_checkout", { p_stripe_session_id: session.id });
    return error ? json({ error: "Unable to expire checkout" }, 500) : json({ received: true });
  }
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return json({ received: true });
  }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return json({ received: true });
  }
  if (!reference || !session.customer_details?.email) {
    return json({ error: "Checkout is missing buyer details" }, 400);
  }

  const { data, error } = await rpc("finalize_stripe_checkout", {
    p_checkout_reference: reference,
    p_stripe_session_id: session.id,
    p_stripe_payment_intent_id: session.payment_intent ?? null,
    p_buyer_email: session.customer_details.email,
    p_buyer_name: session.customer_details.name ?? null,
  });
  if (error) {
    console.error("Unable to finalize Stripe checkout", error);
    return json({ error: "Unable to finalize checkout" }, 500);
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.kind === "product" && result.order_id && result.email_token) {
    const delivery = await dispatch("send-product-key", {
      orderId: result.order_id,
      emailToken: result.email_token,
    });
    if (delivery instanceof Response && !delivery.ok) throw new Error("Email delivery failed");
  }
  if (result?.kind === "service" && result.booking_id) {
    await dispatch("sync-booking-calendar", {
      bookingId: result.booking_id,
    });
  }
  return json({ received: true });
    } catch {
      return json({ error: "Unable to process checkout" }, 500);
    }
  };
}
