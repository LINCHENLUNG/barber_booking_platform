import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarX, CreditCard, LoaderCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useMyBookings } from "@/hooks/useBuyerData";
import { usePlatformSettings } from "@/hooks/useShopData";
import { ShellHeader } from "@/components/ShellHeader";
import { supabase } from "@/integrations/supabase/client";
import { startCheckout } from "@/lib/checkout";
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

  async function cancel(id: string) {
    if (!window.confirm("Cancel this booking? The time slots will be released.")) return;
    setCancelling(id);
    // Only the status changes; the trg_free_slots_on_cancel trigger releases the booking_slots.
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    setCancelling(undefined);
    if (error) {
      toast.error(errMessage(error, "Could not cancel the booking."));
      return;
    }
    toast.success("Booking cancelled");
    await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    await queryClient.invalidateQueries({ queryKey: ["barber-slots"] });
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
            const status = STATUS[b.status ?? ""] ?? { label: b.status, className: "" };
            const barber = b.service?.barbers;
            const live = b.status === "pending_payment" || b.status === "paid";
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
                  <p className="font-medium">
                    {formatMoney(
                      b.price ?? 0,
                      settings?.currency ?? "twd",
                      settings?.currency_minor_units ?? 0,
                    )}
                  </p>
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
                      onClick={() => void cancel(b.id!)}
                    >
                      {cancelling === b.id ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <CalendarX />
                      )}
                      Cancel
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
