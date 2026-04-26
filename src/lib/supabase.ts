import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

export const supabaseConfigured = !!(url && key);

// If env vars are missing (e.g. Lovable preview), use a placeholder so the
// app still loads — sync just silently does nothing.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-key"
);
