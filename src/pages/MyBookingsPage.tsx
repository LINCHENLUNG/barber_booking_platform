import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarX, CreditCard, LoaderCircle, MapPin, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useMyBookings } from "@/hooks/useBuyerData";
import { usePlatformSettings } from "@/hooks/useShopData";
import { ShellHeader } from "@/components/ShellHeader";
import { cancelBooking, startCheckout } from "@/lib/checkout";
import { errMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/shop";
import { DISPLAY_TZ_LABEL, dayKey, fmtDay, fmtTime } from "@/lib/time";

const STATUS: Record<string, { label: string; className: string }> = {
  pending_payment: { label: "Pending payment", className: "status-pending" },
  paid: { label: "Paid", className: "status-paid" },
  cancelled: { label: "Cancelled", className: "status-cancelled" },
};

/** /bookings — the customer's own bookings (RLS: customer_id = auth.uid()), newest start first. */
export default function MyBookingsPage() {
  usePageTitle("My bookings — Barberly");
  const queryClient = useQueryClient();
  const { data: bookings = [], isLoading, error } = useMyBookings();
  const { data: settings } = usePlatformSettings();
  const [cancelling, setCancelling] = useState<string>();
  const [paying, setPaying] = useState<string>();

  async function pay(id: string) {
    setPaying(id);
    try {
      await startCheckout(id); // navigates to Stripe on success
    } catch (e) {
      setPaying(undefined);
      toast.error(errMessage(e, "Could not start payment."));
    }
  }

  async function cancel(id: string, paid: boolean, amount: string) {
    const question = paid
      ? `Cancel this booking? You'll get a full refund of ${amount} to your card, and the time will be released.`
      : "Cancel this booking? The time slots will be released.";
    if (!window.confirm(question)) return;
    setCancelling(id);
    try {
      // Server route: refunds paid bookings through Stripe first, then cancels (frees the slots).
      const { refunded } = await cancelBooking(id);
      toast.success(refunded ? `Booking cancelled — ${amount} refunded` : "Booking cancelled", {
        ...(refunded
          ? { description: "Refunds usually reach your card within 5–10 business days." }
          : {}),
      });
    } catch (e) {
      toast.error(errMessage(e, "Could not cancel the booking."));
    } finally {
      setCancelling(undefined);
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["barber-slots"] });
    }
  }

  return (
    <>
      <ShellHeader />
      <main className="shop-main fade-in">
        <p className="eyebrow">我的預約</p>
        <h1 className="section-heading mt-2">My bookings</h1>
        <p className="text-xs text-muted-foreground mt-2">Times are {DISPLAY_TZ_LABEL}.</p>

        {isLoading && <LoaderCircle className="animate-spin text-muted-foreground mt-8" />}
        {error && (
          <p role="alert" className="text-destructive mt-6">
            {errMessage(error, "We couldn't load your bookings.")}
          </p>
        )}
        {!isLoading && !error && bookings.length === 0 && (
          <div className="shop-card mt-8 text-center">
            <p className="text-muted-foreground">You have no bookings yet.</p>
            <Button variant="pill" className="mt-5" asChild>
              <Link to="/barbers">Find a barber</Link>
            </Button>
          </div>
        )}

        <ul className="space-y-4 mt-8">
          {bookings.map((b) => {
            const refunded = b.status === "cancelled" && !!b.refunded_at;
            const status = refunded
              ? { label: "Refunded", className: "status-refunded" }
              : (STATUS[b.status ?? ""] ?? { label: b.status, className: "" });
            const barber = b.service?.barbers;
            const live = b.status === "pending_payment" || b.status === "paid";
            const amount = formatMoney(
              b.price ?? 0,
              settings?.currency ?? "twd",
              settings?.currency_minor_units ?? 0,
            );
            return (
              <li key={b.id} className="shop-card booking-row">
                <div className="min-w-0">
                  <span className={`status-pill ${status.className}`}>{status.label}</span>
                  <h2 className="font-display text-2xl mt-2">
                    {b.service?.name ?? "Service"}
                    {barber && (
                      <>
                        {" "}
                        <span className="text-muted-foreground">with</span>{" "}
                        <Link
                          to={`/barbers/${barber.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {barber.name}
                        </Link>
                      </>
                    )}
                  </h2>
                  {b.starts_at && b.ends_at ? (
                    <p className="mt-1">
                      {fmtDay(dayKey(b.starts_at))} · {fmtTime(b.starts_at)}–{fmtTime(b.ends_at)}
                    </p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">Time released (cancelled)</p>
                  )}
                  {barber?.address && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin size={13} />
                      {barber.address}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium">{amount}</p>
                  {refunded && (
                    <p className="text-xs text-muted-foreground mt-1">Refunded in full</p>
                  )}
                  {b.status === "pending_payment" && (
                    <Button
                      size="sm"
                      variant="pill"
                      className="mt-3 mr-2"
                      disabled={paying === b.id}
                      onClick={() => void pay(b.id!)}
                    >
                      {paying === b.id ? <LoaderCircle className="animate-spin" /> : <CreditCard />}
                      Pay now
                    </Button>
                  )}
                  {live && (
                    <Button
                      size="sm"
                      variant="chip"
                      className="mt-3"
                      disabled={cancelling === b.id}
                      onClick={() => void cancel(b.id!, b.status === "paid", amount)}
                    >
                      {cancelling === b.id ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <CalendarX />
                      )}
                      Cancel
                    </Button>
                  )}
                  {b.status === "cancelled" && barber && b.service_id && (
                    <Button size="sm" variant="pill" className="mt-3" asChild>
                      <Link to={`/barbers/${barber.id}?book=${b.service_id}`}>
                        <RotateCcw />
                        Re-book
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
