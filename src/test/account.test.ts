import { describe, expect, it } from "vitest";
import { accountKind, signupOptions } from "@/lib/account";
describe("v1 account personalization", () => {
  it("sends customer selection in signup metadata", () => { expect(signupOptions("customer", "https://example.com").data.role).toBe("customer"); });
  it("sends barber selection as shop in signup metadata", () => { expect(signupOptions("shop", "https://example.com").data.role).toBe("shop"); });
  it("identifies a barber only for exact shop metadata", () => { expect(accountKind({role:"shop"})).toBe("shop"); expect(accountKind({role:"barber"})).toBe("customer"); expect(accountKind({role:"admin"})).toBe("customer"); });
  it("defaults accounts without a selection to customer", () => { expect(accountKind(undefined)).toBe("customer"); });
});