import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShellHeader } from "@/components/ShellHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supabase } from "@/integrations/supabase/client";
import { errMessage } from "@/lib/errors";
import { DISPLAY_TZ_LABEL, dayKey, fmtDay, fmtTime } from "@/lib/time";

const POLL_MS = 1500;
const GIVE_UP_MS = 60_000;

/**
 * /bookings/success?booking_id=… — Stripe sends the customer here after paying.
 * READ-ONLY: it polls the booking (RLS: the customer's own) until the webhook flips it to `paid`.
 * It never marks anything paid — the Stripe webhook is the source of truth.
 */
export default function BookingSuccessPage() {
  usePageTitle("Payment — Barberly");
  const [params] = useSearchParams();
  const bookingId = params.get("booking_id");
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, []);

  const { data: booking, error } = useQuery({
    queryKey: ["booking-status", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings_with_start")
        .select("id, status, starts_at, ends_at")
        .eq("id", bookingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return timedOut || (status && status !== "pending_payment") ? false : POLL_MS;
    },
  });

  const paid = booking?.status === "paid";

  return (
    <>
      <ShellHeader />
      <main className="shop-main fade-in">
        <div className="shop-card text-center max-w-lg mx-auto mt-8">
          {!bookingId || (booking === null && !error) ? (
            <p className="text-muted-foreground">We couldn't find that booking.</p>
          ) : error ? (
            <p role="alert" className="text-destructive">
              {errMessage(error, "We couldn't check your booking.")}
            </p>
          ) : paid ? (
            <div role="status">
              <CircleCheck className="mx-auto text-primary" size={40} />
              <h1 className="section-heading mt-4">You're booked!</h1>
              {booking?.starts_at && booking.ends_at && (
                <p className="mt-3">
                  {fmtDay(dayKey(booking.starts_at))} · {fmtTime(booking.starts_at)}–
                  {fmtTime(booking.ends_at)}{" "}
                  <span className="text-muted-foreground text-sm">({DISPLAY_TZ_LABEL})</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">Payment received. See you soon.</p>
            </div>
          ) : booking?.status === "cancelled" ? (
            <p className="text-muted-foreground">This booking was cancelled.</p>
          ) : (
            <div role="status">
              {!timedOut && <LoaderCircle className="animate-spin mx-auto text-muted-foreground" />}
              <h1 className="section-heading mt-4">Confirming your payment…</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {timedOut
                  ? "This is taking longer than usual. If you paid, your booking will update shortly — check My bookings."
                  : "This usually takes a few seconds."}
              </p>
            </div>
          )}
          <Button variant="pill" className="mt-6" asChild>
            <Link to="/bookings">My bookings</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
