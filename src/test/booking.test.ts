import { describe, expect, it } from "vitest";
import { slotsForStart, validStarts, type SlotLite } from "@/lib/booking";
import { errMessage } from "@/lib/errors";
import { safeNext } from "@/lib/account";
import { dayKey, fmtTime } from "@/lib/time";

const T0 = Date.parse("2030-01-01T02:00:00Z"); // 10:00 Taipei
const slot = (i: number, held = false, gapAfter = 0): SlotLite => ({
  id: `s${i}`,
  starts_at: new Date(T0 + i * 30 * 60_000 + gapAfter).toISOString(),
  ends_at: new Date(T0 + (i + 1) * 30 * 60_000 + gapAfter).toISOString(),
  held,
});
const ids = (s: SlotLite[]) => s.map((x) => x.id);
const NOW = T0 - 60_000;

describe("validStarts (N consecutive free slots)", () => {
  const day = [0, 1, 2, 3, 4].map((i) => slot(i));

  it("offers every free slot for a 1-slot service", () => {
    expect(ids(validStarts(day, 1, NOW))).toEqual(["s0", "s1", "s2", "s3", "s4"]);
  });
  it("only offers starts with N slots left before closing", () => {
    expect(ids(validStarts(day, 3, NOW))).toEqual(["s0", "s1", "s2"]);
  });
  it("skips starts whose run hits a held slot", () => {
    const withHeld = day.map((s) => (s.id === "s2" ? { ...s, held: true } : s));
    expect(ids(validStarts(withHeld, 2, NOW))).toEqual(["s0", "s3"]);
  });
  it("requires back-to-back slots (a gap breaks the run)", () => {
    const gappy = [slot(0), slot(1), slot(2, false, 15 * 60_000)];
    expect(ids(validStarts(gappy, 3, NOW))).toEqual([]);
    expect(ids(validStarts(gappy, 2, NOW))).toEqual(["s0"]);
  });
  it("never offers a start time in the past", () => {
    expect(ids(validStarts(day, 1, T0 + 45 * 60_000))).toEqual(["s2", "s3", "s4"]);
  });
  it("slotsForStart returns the full held range for highlighting", () => {
    expect(ids(slotsForStart(day, "s1", 3))).toEqual(["s1", "s2", "s3"]);
  });
});

describe("helpers", () => {
  it("errMessage reads a PostgrestError-shaped object", () => {
    expect(errMessage({ message: "those times were just taken", code: "P0001" })).toBe(
      "those times were just taken",
    );
    expect(errMessage(new Error("boom"))).toBe("boom");
    expect(errMessage(null, "fallback")).toBe("fallback");
  });
  it("safeNext only allows same-site paths", () => {
    expect(safeNext("/barbers/abc")).toBe("/barbers/abc");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
  it("renders slot times in Taipei time", () => {
    expect(fmtTime("2030-01-01T02:00:00Z")).toBe("10:00");
    expect(dayKey("2030-01-01T17:00:00Z")).toBe("2030-01-02");
  });
});

import { barberWithShop } from "@/lib/shop";

describe("barber · shop label", () => {
  it("joins barber and shop names", () => {
    expect(barberWithShop("Rick", "ZOOM")).toBe("Rick · ZOOM");
  });
  it("falls back to the barber name when the shop has no name", () => {
    expect(barberWithShop("Rick", null)).toBe("Rick");
    expect(barberWithShop("Rick", "  ")).toBe("Rick");
  });
});
