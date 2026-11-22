import { describe, expect, it } from "vitest";
import { filterOwed, owedForShopMonth, totals } from "@/lib/payouts";

const row = (id: string, shop: string, cust: string, paid_at: string, price: number) => {
  const platform = Math.round(price * 0.2);
  return {
    booking_id: id,
    shop_id: shop,
    customer_id: cust,
    paid_at,
    price,
    platform_cut: platform,
    shop_cut: price - platform,
  };
};
// 2026-11-30T17:00Z is Dec 1 in Taipei (UTC+8)
const rows = [
  row("a", "dd", "c1", "2026-11-22T14:38:00Z", 1500),
  row("b", "zz", "c1", "2026-11-22T14:39:00Z", 3500),
  row("c", "dd", "c2", "2026-11-30T17:00:00Z", 999),
];

describe("payout helpers", () => {
  it("totals sum back to gross (platform + shop = price)", () => {
    const t = totals(rows);
    expect(t).toEqual({
      count: 3,
      gross: 5999,
      platform: 300 + 700 + 200,
      shop: 1200 + 2800 + 799,
    });
    expect(t.platform + t.shop).toBe(t.gross);
  });
  it("filters by shop, customer and Taipei-day range", () => {
    const all = { shopId: "all", customerId: "all", from: "", to: "" };
    expect(filterOwed(rows, { ...all, shopId: "dd" }).map((r) => r.booking_id)).toEqual(["a", "c"]);
    expect(filterOwed(rows, { ...all, customerId: "c2" }).map((r) => r.booking_id)).toEqual(["c"]);
    expect(filterOwed(rows, { ...all, from: "2026-12-01" }).map((r) => r.booking_id)).toEqual([
      "c",
    ]);
    expect(filterOwed(rows, { ...all, to: "2026-11-30" }).map((r) => r.booking_id)).toEqual([
      "a",
      "b",
    ]);
  });
  it("selects one shop's owed bookings for a Taipei month", () => {
    expect(owedForShopMonth(rows, "dd", "2026-11").map((r) => r.booking_id)).toEqual(["a"]);
    expect(owedForShopMonth(rows, "dd", "2026-12").map((r) => r.booking_id)).toEqual(["c"]);
  });
});
