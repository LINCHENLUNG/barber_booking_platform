import { describe, expect, it } from "vitest";
import { stripeUnitAmount } from "../../api/_money";

describe("stripeUnitAmount", () => {
  it("treats TWD as 2-decimal in Stripe (×100)", () => {
    expect(stripeUnitAmount(300, "twd")).toBe(30000);
    expect(stripeUnitAmount(2300, "TWD")).toBe(230000);
  });
  it("leaves true zero-decimal currencies unscaled", () => {
    expect(stripeUnitAmount(500, "jpy")).toBe(500);
  });
});
