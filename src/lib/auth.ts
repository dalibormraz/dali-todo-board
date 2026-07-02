import bcrypt from "bcryptjs";

/**
 * Vrátí bcrypt hash z env. Podporuje base64 (doporučeno — paste-safe, žádná
 * expanze `$` v .env) i přímý `$2b$...` hash (s escapovanými `$`).
 */
function getHash(): string {
  const raw = process.env.APP_PASSWORD_HASH ?? "";
  if (!raw) return "";
  if (raw.startsWith("$2")) return raw; // přímý bcrypt hash
  try {
    return Buffer.from(raw, "base64").toString("utf8");
  } catch {
    return "";
  }
}

/** Ověří heslo proti hashi v env (APP_PASSWORD_HASH). */
export async function verifyPassword(password: string): Promise<boolean> {
  const hash = getHash();
  if (!hash || !password) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// Jednoduchý in-memory rate limiter (per proces). Pro produkci s více instancemi
// nahradíme Upstash Redis (fáze 4). Pro 1 uživatele jako základní ochrana stačí.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minut
const MAX_ATTEMPTS = 8;

/** Vrátí true, pokud je pokus povolen; false při překročení limitu. */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_ATTEMPTS;
}
