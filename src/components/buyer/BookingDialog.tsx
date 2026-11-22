import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { slotsForStart, validStarts, type SlotLite } from "@/lib/booking";
import { startCheckout } from "@/lib/checkout";
import { errMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/shop";
import { DISPLAY_TZ_LABEL, dayKey, fmtDay, fmtTime } from "@/lib/time";

export type BookableService = {
  id: string;
  name: string;
  category: string;
  price: number;
  required_slots: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barberId: string;
  barberName: string;
  services: BookableService[];
  slots: SlotLite[];
  initialServiceId?: string | undefined;
  currency: string;
  minorUnits: number;
  slotMinutes: number;
};

/**
 * Book pop-up: service → date → start slot → Confirm. Stays on /barbers/:id.
 * Confirm calls create_booking (1 pending_payment booking + N booking_slots, atomically), then
 * sends the customer to Stripe Checkout. The Stripe webhook — not this page — marks it paid.
 */
export function BookingDialog(props: Props) {
  const { open, onOpenChange, barberId, barberName, services, slots } = props;
  const queryClient = useQueryClient();
  const [serviceId, setServiceId] = useState(props.initialServiceId ?? services[0]?.id ?? "");
  const [day, setDay] = useState("");
  const [startId, setStartId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setServiceId(props.initialServiceId ?? services[0]?.id ?? "");
      setStartId("");
      setError("");
    }
  }, [open, props.initialServiceId, services]);

  const service = services.find((s) => s.id === serviceId);
  const n = service?.required_slots ?? 1;
  const starts = useMemo(() => (service ? validStarts(slots, n) : []), [service, slots, n]);
  const days = useMemo(() => [...new Set(starts.map((s) => dayKey(s.starts_at)))], [starts]);

  useEffect(() => {
    if (!days.includes(day)) setDay(days[0] ?? "");
  }, [days, day]);
  useEffect(() => setStartId(""), [serviceId, day]);

  const dayStarts = starts.filter((s) => dayKey(s.starts_at) === day);
  const range = startId ? slotsForStart(slots, startId, n) : [];
  const rangeIds = new Set(range.map((s) => s.id));
  const daySlots = slots.filter((s) => dayKey(s.starts_at) === day);
  const startIds = new Set(dayStarts.map((s) => s.id));
  const money = (v: number) => formatMoney(v, props.currency, props.minorUnits);

  async function confirm() {
    if (!service || !startId) return;
    setBusy(true);
    setError("");
    const { data: bookingId, error } = await supabase.rpc("create_booking", {
      p_service_id: service.id,
      p_start_slot_id: startId,
    });
    if (error || !bookingId) {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: ["barber-slots", barberId] });
      setError(errMessage(error, "Could not complete the booking."));
      setStartId("");
      return;
    }
    // Booking is held as pending_payment; hand off to Stripe's hosted Checkout.
    // It only becomes `paid` when the Stripe webhook confirms the payment.
    try {
      await startCheckout(bookingId);
    } catch (e) {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: ["barber-slots", barberId] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      onOpenChange(false);
      toast.error("Payment didn't start", {
        description: `${errMessage(e, "Could not start payment.")} Your ${fmtDay(day)} ${fmtTime(range[0]!.starts_at)} booking is held — pay for it from My bookings.`,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="booking-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Book {barberName}</DialogTitle>
          <DialogDescription>Choose a service, a day and a start time.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-medium mb-2">1 · Service</legend>
            <div className="grid gap-2">
              {services.map((s) => (
                <label key={s.id} className={`choice ${s.id === serviceId ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="service"
                    value={s.id}
                    checked={s.id === serviceId}
                    onChange={() => setServiceId(s.id)}
                  />
                  <span className="flex-1">
                    {s.name} <span className="service-chip capitalize ml-1">{s.category}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.required_slots * props.slotMinutes} min
                    </span>
                  </span>
                  <strong>{money(s.price)}</strong>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium mb-2">2 · Day</legend>
            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open times for this service right now — it needs {n} back-to-back free slot
                {n > 1 ? "s" : ""}.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={d === day ? "selected" : "chip"}
                    aria-pressed={d === day}
                    onClick={() => setDay(d)}
                  >
                    {fmtDay(d)}
                  </Button>
                ))}
              </div>
            )}
          </fieldset>

          {day && (
            <fieldset>
              <legend className="text-sm font-medium mb-1">3 · Start time</legend>
              <p className="text-xs text-muted-foreground mb-2">
                {DISPLAY_TZ_LABEL}.{" "}
                {n > 1
                  ? `This service uses ${n} back-to-back slots, so only start times with ${n} free slots in a row are offered.`
                  : "Only free slots are offered."}
              </p>
              <div className="slot-picker">
                {daySlots.map((s) => {
                  const canStart = startIds.has(s.id);
                  const inRange = rangeIds.has(s.id);
                  if (!canStart && !inRange) return null;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!canStart}
                      aria-pressed={s.id === startId}
                      className={[
                        "slot-option",
                        inRange ? "in-range" : "",
                        s.id === startId ? "start" : "",
                      ].join(" ")}
                      onClick={() => setStartId(s.id)}
                    >
                      {fmtTime(s.starts_at)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {service && range.length === n && (
            <div className="booking-summary" role="status">
              <p>
                Your booking: <strong>{fmtDay(day)}</strong>{" "}
                <strong>
                  {fmtTime(range[0]!.starts_at)}–{fmtTime(range[n - 1]!.ends_at)}
                </strong>
                {n > 1 && ` (uses ${n} slots)`}
              </p>
              <p className="mt-1">
                {service.name} · <strong>{money(service.price)}</strong>
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="chip" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="pill"
            disabled={busy || !service || range.length !== n}
            onClick={confirm}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : "Confirm & pay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
