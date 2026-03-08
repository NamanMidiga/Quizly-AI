import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("[Quizly AI] SUPABASE_URL or SUPABASE_SERVICE_KEY not set");
  }

  _supabase = createClient(url, key);
  return _supabase;
}
