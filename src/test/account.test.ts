import { describe, expect, it } from "vitest";
import { accountKind, homePathFor, signupOptions } from "@/lib/account";

describe("account roles (profiles.role)", () => {
  it("sends customer selection in signup metadata", () => {
    expect(signupOptions("customer", "https://example.com").data.role).toBe("customer");
  });
  it("sends barber selection as shop in signup metadata", () => {
    expect(signupOptions("shop", "https://example.com").data.role).toBe("shop");
  });
  it("redirects the signup email to the role's home", () => {
    expect(signupOptions("shop", "https://x.test").emailRedirectTo).toBe("https://x.test/shop");
    expect(signupOptions("customer", "https://x.test").emailRedirectTo).toBe(
      "https://x.test/barbers",
    );
  });
  it("recognises only exact 'shop' / 'admin' roles", () => {
    expect(accountKind("shop")).toBe("shop");
    expect(accountKind("admin")).toBe("admin");
    expect(accountKind("barber")).toBe("customer");
    expect(accountKind("Admin")).toBe("customer");
    expect(accountKind(undefined)).toBe("customer");
  });
  it("routes each role to its home", () => {
    expect(homePathFor("shop")).toBe("/shop");
    expect(homePathFor("admin")).toBe("/admin/payouts");
    expect(homePathFor("customer")).toBe("/barbers");
  });
});
