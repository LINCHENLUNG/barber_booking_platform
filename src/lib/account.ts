/** Roles a user can pick at sign-up. `admin` is never self-served (promotion-only migration). */
export type SignupRole = "customer" | "shop";
export type AccountKind = SignupRole | "admin";

/** Normalises a `profiles.role` value. Only an exact "shop" / "admin" unlocks those sides. */
export function accountKind(role: string | null | undefined): AccountKind {
  if (role === "shop") return "shop";
  if (role === "admin") return "admin";
  return "customer";
}

/** Where a signed-in user lands, branched on `profiles.role`. */
export function homePathFor(role: AccountKind): string {
  if (role === "shop") return "/shop";
  if (role === "admin") return "/admin/payouts";
  return "/barbers";
}

/** Only same-origin app paths are allowed as a post-login `?next=` (no `//host` or `/\host`). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return null;
  return next;
}

export function signupOptions(role: SignupRole, origin: string) {
  return { emailRedirectTo: origin + homePathFor(role), data: { role } };
}
