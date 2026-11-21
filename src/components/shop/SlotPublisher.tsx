import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformSettings, useSlots, type Slot } from "@/hooks/useShopData";
import { buildDaySlots } from "@/lib/shop";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * B. Publish bookable slots for one barber. A slot is just a `slot_minutes`-long time window
 * (no status column); a longer opening is a run of consecutive slots generated here.
 */
export function SlotPublisher({ barberId }: { barberId: string }) {
  const queryClient = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const { data: slots = [], isLoading } = useSlots(barberId);
  const slotMinutes = settings?.slot_minutes ?? 30;
  const [date, setDate] = useState(today());
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("18:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const preview = useMemo(
    () => buildDaySlots(date, start, end, slotMinutes),
    [date, start, end, slotMinutes],
  );
  const existing = useMemo(
    () => new Set(slots.map((s) => new Date(s.starts_at).getTime())),
    [slots],
  );
  const fresh = preview.filter((s) => !existing.has(new Date(s.starts_at).getTime()));

  const upcoming = slots.filter((s) => new Date(s.ends_at).getTime() > Date.now());
  const byDay = upcoming.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[dayKey(s.starts_at)] ??= []).push(s);
    return acc;
  }, {});

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["slots", barberId] });

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!fresh.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error } = await supabase
      .from("bookable_slots")
      .insert(fresh.map((s) => ({ ...s, barber_id: barberId })));
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNotice(`Published ${fresh.length} slot${fresh.length > 1 ? "s" : ""}.`);
    await refresh();
  }

  async function remove(ids: string[]) {
    setError("");
    setNotice("");
    const { error } = await supabase.from("bookable_slots").delete().in("id", ids);
    if (error) setError(error.message);
    await refresh();
  }

  return (
    <section className="shop-card" aria-labelledby="slots-heading">
      <p className="eyebrow">B · 可預約時段</p>
      <h2 id="slots-heading" className="shop-heading">
        Bookable time slots
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Each slot is {slotMinutes} minutes. Pick a day and opening hours to publish a run of slots.
      </p>

      <form onSubmit={publish} className="barber-panel mt-5">
        <div className="slot-form">
          <label className="block text-sm">
            Date
            <input
              type="date"
              required
              min={today()}
              className="auth-field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            From
            <input
              type="time"
              required
              className="auth-field"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            To
            <input
              type="time"
              required
              className="auth-field"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <p className="field-hint">
          {preview.length === 0
            ? "Choose an end time after the start time."
            : `${preview.length} slot${preview.length > 1 ? "s" : ""}` +
              (preview.length !== fresh.length
                ? ` (${preview.length - fresh.length} already published)`
                : "")}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive mt-3">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted-foreground mt-3">
            {notice}
          </p>
        )}
        <Button variant="pill" className="mt-4" disabled={busy || fresh.length === 0}>
          {busy ? <LoaderCircle className="animate-spin" /> : <CalendarPlus />}
          Publish {fresh.length || ""} slot{fresh.length === 1 ? "" : "s"}
        </Button>
      </form>

      <h3 className="text-sm font-medium mt-7">Published (upcoming)</h3>
      {!isLoading && upcoming.length === 0 && (
        <p className="text-sm text-muted-foreground mt-2">No upcoming slots.</p>
      )}
      <div className="space-y-4 mt-3">
        {Object.entries(byDay).map(([day, list]) => (
          <div key={day} className="barber-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">
                {new Date(`${day}T00:00`).toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <Button
                size="sm"
                variant="chip"
                onClick={() => {
                  if (window.confirm(`Delete all ${list.length} slots on ${day}?`))
                    void remove(list.map((s) => s.id));
                }}
              >
                <Trash2 />
                Clear day
              </Button>
            </div>
            <ul className="slot-chips mt-3">
              {list.map((s) => (
                <li key={s.id}>
                  <span>
                    {time(s.starts_at)}–{time(s.ends_at)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete slot ${time(s.starts_at)}`}
                    onClick={() => void remove([s.id])}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
