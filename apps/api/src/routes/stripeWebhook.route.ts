import express, { Router } from "express";
import type Stripe from "stripe";
import { env } from "../config/env";
import { getStripeClient } from "../lib/stripe";
import { feeInvoiceService } from "../services/feeInvoice.service";
import { logger } from "../lib/logger";

export const stripeWebhookRouter = Router();

// Stripe signs the exact raw bytes of the request body. The rest of this
// app parses JSON globally in index.ts (app.use(express.json())) — by the
// time a request reaches any route mounted under apiRouter, the original
// bytes are gone, which breaks signature verification. So this router is
// mounted directly on `app`, BEFORE express.json() runs, with its own
// express.raw() scoped to just this one route.
stripeWebhookRouter.post("/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  if (!env.stripeWebhookSecret) {
    logger.error("Received a Stripe webhook but STRIPE_WEBHOOK_SECRET is not configured");
    res.status(501).send();
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).send("Missing stripe-signature header");
    return;
  }

  // This is the actual authentication for this endpoint — there's no user
  // JWT here, so verifying Stripe's signature is what proves the request
  // really came from Stripe and wasn't forged by someone hitting this URL
  // directly with a fake "payment succeeded" body.
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(req.body, signature, env.stripeWebhookSecret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).send("Invalid signature");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
    }
    res.status(200).send();
  } catch (err) {
    // A non-2xx tells Stripe to retry this same event with backoff — the
    // right response for a transient failure (e.g. the DB hiccups).
    // recordPayment's idempotencyKey (set to the session id below) means a
    // retry can never record the same payment twice either way.
    logger.error({ err, eventId: event.id }, "Failed to process Stripe webhook");
    res.status(500).send();
  }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const { schoolId, invoiceId, initiatedByUserId } = session.metadata ?? {};
  if (!schoolId || !invoiceId || !initiatedByUserId) {
    // Our own bug (the session was created without the metadata
    // createCheckoutSession always sets), not something a retry can fix —
    // log it loudly and acknowledge so Stripe stops resending it.
    logger.error({ sessionId: session.id }, "Stripe checkout session completed with missing metadata");
    return;
  }

  await feeInvoiceService.recordPayment(schoolId, invoiceId, {
    amountPaid: (session.amount_total ?? 0) / 100,
    paymentMethod: "STRIPE",
    referenceNote: `Paid online via Stripe (session ${session.id})`,
    recordedByUserId: initiatedByUserId,
    idempotencyKey: session.id,
  });
}
