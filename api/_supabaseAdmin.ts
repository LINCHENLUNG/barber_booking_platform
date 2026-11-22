import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types.js";

// SERVER-ONLY service-role client (bypasses RLS). Used by the Stripe checkout + webhook
// functions, because Stripe's webhook carries no user session. Never import this from src/.
// The `_` prefix keeps Vercel from exposing this file as a route.
const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const secret = process.env["SUPABASE_SECRET_KEY"];

if (!url || !secret) {
  throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SECRET_KEY");
}

export const supabaseAdmin = createClient<Database>(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
