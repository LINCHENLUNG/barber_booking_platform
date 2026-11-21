// Pure helpers for the shop side (M1.1). Kept framework-free so they're unit-testable.

export const SERVICE_CATEGORIES = ["cut", "color", "perm", "beard"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export type PayoutFields = {
  display_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
};

/** Shop onboarding is complete only when shop name + both bank fields are filled. */
export function isOnboardingComplete(p: PayoutFields | null | undefined): boolean {
  return (
    !!p &&
    [p.display_name, p.bank_account_name, p.bank_account_number].every(
      (v) => !!v && v.trim().length > 0,
    )
  );
}

/** Formats a whole-unit price for display, e.g. 300 + "twd" + 0 → "NT$300". */
export function formatMoney(amount: number, currency: string, minorUnits = 0): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: minorUnits,
      maximumFractionDigits: minorUnits,
    }).format(amount);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
}

/** Storage path for a portfolio photo: `<barber_id>/<uuid>.<ext>` (what the Storage policy checks). */
export function photoPath(barberId: string, fileName: string, id: string = crypto.randomUUID()) {
  const ext = (fileName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${barberId}/${id}.${ext}`;
}

/**
 * Consecutive `slotMinutes`-long windows between two local times on a date.
 * Date "2026-12-01", "10:00"→"12:00", 30 → four slots. A trailing partial window is dropped.
 */
export function buildDaySlots(date: string, start: string, end: string, slotMinutes: number) {
  const from = new Date(`${date}T${start}`);
  const to = new Date(`${date}T${end}`);
  const slots: { starts_at: string; ends_at: string }[] = [];
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || slotMinutes <= 0) return slots;
  for (
    let t = from.getTime();
    t + slotMinutes * 60_000 <= to.getTime();
    t += slotMinutes * 60_000
  ) {
    slots.push({
      starts_at: new Date(t).toISOString(),
      ends_at: new Date(t + slotMinutes * 60_000).toISOString(),
    });
  }
  return slots;
}
