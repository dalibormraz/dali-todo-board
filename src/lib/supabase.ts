import { createClient } from "@supabase/supabase-js";

// Server-only Supabase klient. Klíč (service_role) držíme jen na serveru,
// nikdy ho neposíláme do prohlížeče. RLS je zapnuté jen jako obrana navíc —
// service_role ho obchází; bezpečnost stojí na hesle + session (viz supabase/schema.sql).
export function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error("Chybí SUPABASE_URL / SUPABASE_KEY v env.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
