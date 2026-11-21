// Pure booking helpers (M1.2). A slot has NO status: it is "held" when a booking_slots row
// references it. A service needs N = required_slots back-to-back free slots.

export type SlotLite = { id: string; starts_at: string; ends_at: string; held: boolean };

const t = (iso: string) => new Date(iso).getTime();

/** Slots (sorted by start) that can START a booking needing `n` contiguous free slots. */
export function validStarts(slots: SlotLite[], n: number, now = Date.now()): SlotLite[] {
  const sorted = [...slots].sort((a, b) => t(a.starts_at) - t(b.starts_at));
  const out: SlotLite[] = [];
  for (let i = 0; i + n <= sorted.length; i++) {
    const run = sorted.slice(i, i + n);
    if (t(run[0]!.starts_at) <= now) continue;
    const ok = run.every(
      (s, k) => !s.held && (k === 0 || t(s.starts_at) === t(run[k - 1]!.ends_at)),
    );
    if (ok) out.push(sorted[i]!);
  }
  return out;
}

/** The `n` slots a booking starting at `startId` would hold (for highlighting the range). */
export function slotsForStart(slots: SlotLite[], startId: string, n: number): SlotLite[] {
  const sorted = [...slots].sort((a, b) => t(a.starts_at) - t(b.starts_at));
  const i = sorted.findIndex((s) => s.id === startId);
  return i < 0 ? [] : sorted.slice(i, i + n);
}
