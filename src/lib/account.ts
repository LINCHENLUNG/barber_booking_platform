export type AccountKind = "customer" | "shop";
export function accountKind(metadata: Record<string, unknown> | undefined): AccountKind {
  return metadata?.["role"] === "shop" ? "shop" : "customer";
}
export function signupOptions(role: AccountKind, origin: string) {
  return { emailRedirectTo: origin, data: { role } };
}