import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe is not configured");
  }

  stripeClient ??= new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
    timeout: 10000,
    maxNetworkRetries: 1,
  });
  return stripeClient;
}
