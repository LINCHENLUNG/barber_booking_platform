import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_supabaseAdmin.js";

// Signature verification needs the RAW bytes — turn off Vercel's body parser.
export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

async function rawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req)
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

/**
 * POST /api/stripe/webhook — the ONLY writer of bookings.status = 'paid'.
 * On checkout.session.completed + payment_status 'paid': flip pending_payment → paid, stamp
 * paid_at + stripe_payment_intent_id. No split / ledger here (that's computed at payout time).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    const buf = await rawBody(req);
    event = stripe.webhooks.constructEvent(
      buf,
      sig as string,
      process.env["STRIPE_WEBHOOK_SECRET"]!,
    );
  } catch {
    return res.status(400).json({ error: "signature verification failed" });
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") {
    return res.status(200).json({ received: true });
  }

  const bookingId = session.metadata?.["booking_id"];
  if (!bookingId) {
    return res.status(400).json({ error: "missing booking_id metadata" });
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Idempotent: the status guard makes a re-delivered event match zero rows.
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntent,
    })
    .eq("id", bookingId)
    .eq("status", "pending_payment")
    .select("id");

  if (error) {
    // 23505 = the UNIQUE(stripe_payment_intent_id) backstop caught a concurrent duplicate: already handled.
    if (error.code === "23505") return res.status(200).json({ received: true, duplicate: true });
    console.error("webhook: booking update failed", bookingId, error);
    return res.status(500).json({ error: "update failed" }); // non-2xx → Stripe retries
  }
  if (!data?.length) {
    console.warn(
      "webhook: no pending_payment booking to flip (already paid or cancelled)",
      bookingId,
    );
  }
  return res.status(200).json({ received: true });
}
