/**
 * Supabase returns a PostgrestError — a plain object {message, details, hint, code}, NOT an Error —
 * so `err instanceof Error` would swallow the real database message. Read `.message` off either.
 */
export function errMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}
