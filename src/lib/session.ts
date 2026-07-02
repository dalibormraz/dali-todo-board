import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isLoggedIn: boolean;
  loginAt?: number;
}

// 90 dní — "login, který vydrží". V kombinaci s rolling obnovou v middleware
// se aktivní uživatel prakticky neodhlásí.
const MAX_AGE = 60 * 60 * 24 * 90;

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: "tb_session",
  ttl: MAX_AGE,
  cookieOptions: {
    httpOnly: true, // klíčové: na httpOnly server-cookie se NEvztahuje 7denní iOS limit
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // ne strict — ať session přežije i spuštění PWA z plochy
    maxAge: MAX_AGE,
    path: "/",
  },
};

/** Session v Server Componentech a Route Handlerech (Node runtime). */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
