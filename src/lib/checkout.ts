import { supabase } from "@/integrations/supabase/client";

/**
 * Ask our server (/api/bookings/checkout) for a Stripe Checkout URL for one of the signed-in
 * customer's pending_payment bookings, then send the browser to Stripe's hosted payment page.
 * Resolves only on failure (on success the page navigates away).
 */
export async function startCheckout(bookingId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again to pay.");

  const res = await fetch("/api/bookings/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ booking_id: bookingId }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error ?? "Could not start payment.");
  window.location.assign(body.url);
}
