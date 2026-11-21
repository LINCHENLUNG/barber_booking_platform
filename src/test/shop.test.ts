import { describe, expect, it } from "vitest";
import { buildDaySlots, formatMoney, isOnboardingComplete, photoPath } from "@/lib/shop";

describe("shop onboarding gate", () => {
  it("requires shop name and both bank fields", () => {
    const full = {
      display_name: "Downtown Cuts",
      bank_account_name: "A",
      bank_account_number: "1",
    };
    expect(isOnboardingComplete(full)).toBe(true);
    expect(isOnboardingComplete({ ...full, display_name: "  " })).toBe(false);
    expect(isOnboardingComplete({ ...full, bank_account_number: null })).toBe(false);
    expect(isOnboardingComplete(undefined)).toBe(false);
  });
});

describe("slots", () => {
  it("builds consecutive slot_minutes windows and drops a partial tail", () => {
    const slots = buildDaySlots("2026-12-01", "10:00", "11:45", 30);
    expect(slots).toHaveLength(3);
    for (const s of slots) {
      expect(new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()).toBe(30 * 60_000);
    }
    expect(slots[1]!.starts_at).toBe(slots[0]!.ends_at);
  });
  it("returns nothing when the end is not after the start", () => {
    expect(buildDaySlots("2026-12-01", "12:00", "10:00", 30)).toEqual([]);
  });
});

describe("photos and money", () => {
  it("stores photos under the barber's folder", () => {
    expect(photoPath("b1", "Fade.JPEG", "u1")).toBe("b1/u1.jpeg");
  });
  it("formats whole-unit prices without multiplying", () => {
    expect(formatMoney(300, "twd", 0)).toMatch(/300/);
    expect(formatMoney(300, "twd", 0)).not.toMatch(/30,000|30000/);
  });
});
