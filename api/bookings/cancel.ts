import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_supabaseAdmin.js";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

/**
 * POST /api/bookings/cancel  { booking_id }  (Authorization: Bearer <supabase access token>)
 * Cancels the caller's own booking.
 *  - pending_payment → cancelled (nothing was charged).
 *  - paid → full Stripe refund of the booking's PaymentIntent FIRST, then cancelled + refunded_at.
 * The DB guard stops the browser from cancelling a paid booking directly, so a paid cancel
 * always goes through this refund path. Cancelling frees the slots (trg_free_slots_on_cancel).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "sign in required" });
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return res.status(401).json({ error: "sign in required" });

  const bookingId = (req.body as { booking_id?: unknown } | undefined)?.booking_id;
  if (typeof bookingId !== "string" || !bookingId) {
    return res.status(400).json({ error: "booking_id required" });
  }

  const load = () =>
    supabaseAdmin
      .from("bookings")
      .select("id, customer_id, status, payout_id, stripe_payment_intent_id")
      .eq("id", bookingId)
      .maybeSingle();

  let { data: booking } = await load();
  if (!booking || booking.customer_id !== auth.user.id) {
    return res.status(404).json({ error: "booking not found" });
  }
  if (booking.status === "cancelled") {
    return res.status(409).json({ error: "this booking is already cancelled" });
  }

  if (booking.status === "pending_payment") {
    const { data } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("status", "pending_payment")
      .select("id");
    if (data?.length) return res.status(200).json({ status: "cancelled", refunded: false });
    // Lost a race with the payment webhook — it is paid now; fall through to the refund path.
    ({ data: booking } = await load());
    if (!booking || booking.status !== "paid") {
      return res.status(409).json({ error: "this booking changed — please refresh" });
    }
  }

  // status === 'paid'
  if (booking.payout_id) {
    return res
      .status(409)
      .json({ error: "this booking was already paid out to the shop — please contact support" });
  }
  if (!booking.stripe_payment_intent_id) {
    console.error("cancel: paid booking without a payment intent", bookingId);
    return res.status(409).json({ error: "we couldn't find the payment for this booking" });
  }

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: booking.stripe_payment_intent_id,
        reason: "requested_by_customer",
        metadata: { booking_id: bookingId },
      },
      { idempotencyKey: `refund-booking-${bookingId}` },
    );
  } catch (err) {
    console.error("cancel: stripe refund failed", bookingId, err);
    return res.status(502).json({ error: "the refund could not be issued — please try again" });
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "cancelled",
      refunded_at: new Date().toISOString(),
      stripe_refund_id: refund.id,
    })
    .eq("id", bookingId)
    .eq("status", "paid");
  if (error) {
    // The refund went through; record failure is retried safely (same idempotency key).
    console.error("cancel: refunded but booking update failed", bookingId, refund.id, error);
    return res
      .status(500)
      .json({ error: "refunded, but the booking didn't update — please retry" });
  }
  return res
    .status(200)
    .json({ status: "cancelled", refunded: true, refund_status: refund.status });
}
