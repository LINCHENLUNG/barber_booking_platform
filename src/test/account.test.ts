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
  it("treats only an exact 'shop' role as a shop", () => {
    expect(accountKind("shop")).toBe("shop");
    expect(accountKind("barber")).toBe("customer");
    expect(accountKind("admin")).toBe("customer");
    expect(accountKind(undefined)).toBe("customer");
  });
  it("routes shop and customer only", () => {
    expect(homePathFor("shop")).toBe("/shop");
    expect(homePathFor("customer")).toBe("/barbers");
  });
});
