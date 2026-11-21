export type AccountKind = "customer" | "shop";

/** Normalises a `profiles.role` value. Only an exact "shop" unlocks the shop side. */
export function accountKind(role: string | null | undefined): AccountKind {
  return role === "shop" ? "shop" : "customer";
}

/** Where a signed-in user lands, branched on `profiles.role` (shop / customer only). */
export function homePathFor(role: AccountKind): string {
  return role === "shop" ? "/shop" : "/barbers";
}

export function signupOptions(role: AccountKind, origin: string) {
  return { emailRedirectTo: origin + homePathFor(role), data: { role } };
}
