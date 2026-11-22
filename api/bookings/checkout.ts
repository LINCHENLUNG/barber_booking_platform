import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_supabaseAdmin.js";
import { stripeUnitAmount } from "../_money.js";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"]!);

/**
 * POST /api/bookings/checkout  { booking_id }  (Authorization: Bearer <supabase access token>)
 * Creates a dynamic Stripe Checkout Session for the caller's own pending_payment booking and
 * returns { url }. The amount comes from the bookings.price snapshot — never from the client.
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

  // bookings has no barber_id / start_slot_id: the barber is reached via service_id → services.barber_id.
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_id, status, price, services(name, barber_id, barbers(name))")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking || booking.customer_id !== auth.user.id) {
    return res.status(404).json({ error: "booking not found" });
  }
  if (booking.status !== "pending_payment") {
    return res.status(409).json({ error: "this booking is not awaiting payment" });
  }

  const { data: cfg, error: cfgError } = await supabaseAdmin
    .from("platform_settings")
    .select("currency")
    .single();
  if (cfgError || !cfg) return res.status(500).json({ error: "platform settings unavailable" });

  const service = booking.services;
  const barberId = service?.barber_id;
  const origin =
    (req.headers.origin as string | undefined) ??
    `https://${(req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: cfg.currency,
            product_data: {
              name: `${service?.name ?? "Booking"} @ ${service?.barbers?.name ?? "Barberly"}`,
            },
            // TWD is 2-decimal in Stripe → price × 100 (NT$2300 → 230000). Not currency_minor_units.
            unit_amount: stripeUnitAmount(booking.price, cfg.currency),
          },
          quantity: 1,
        },
      ],
      metadata: { booking_id: booking.id, customer_id: booking.customer_id },
      client_reference_id: booking.id,
      ...(auth.user.email ? { customer_email: auth.user.email } : {}),
      success_url: `${origin}/bookings/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: barberId ? `${origin}/barbers/${barberId}` : `${origin}/bookings`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("checkout session create failed", err);
    return res.status(502).json({ error: "could not start payment" });
  }
}
