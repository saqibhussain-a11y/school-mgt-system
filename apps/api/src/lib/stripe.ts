import Stripe from "stripe";
import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";

// Built once and reused — Stripe's own docs recommend a single client
// instance per process rather than constructing one per request.
let client: Stripe | null = null;

// Not every school will configure online payments, so this isn't part of
// env.ts's `required()` boot check — instead we fail loudly, but only at
// the moment a request actually needs Stripe, with a message that tells
// whoever's debugging exactly what's missing.
export function getStripeClient(): Stripe {
  if (!env.stripeSecretKey) {
    throw new HttpError(501, "Online fee payment is not configured for this deployment");
  }
  if (!client) {
    client = new Stripe(env.stripeSecretKey);
  }
  return client;
}
