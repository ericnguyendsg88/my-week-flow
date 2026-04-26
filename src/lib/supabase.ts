import { createClient } from "@supabase/supabase-js";

const url =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://fesuyzvachxnomwtuqxq.supabase.co";
const key =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  "sb_publishable_Nu9arM9jGZSxLVECIhhnhQ_SfxkhdaC";

export const supabaseConfigured = !!(url && key);

export const supabase = createClient(url, key);
