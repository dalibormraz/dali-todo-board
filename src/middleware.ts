import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  const isLoggedIn = Boolean(session.isLoggedIn);

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Nepřihlášený → na login (zbytek appky se mu vůbec nezobrazí).
  if (!isLoggedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Přihlášený na /login → rovnou na nástěnku.
  if (isLoggedIn && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Rolling session: prodluž platnost při aktivitě (login, který vydrží).
  if (isLoggedIn) {
    await session.save();
  }

  return res;
}

export const config = {
  // Chrání vše kromě: login API, _next interních cest a statických souborů
  // (cokoliv s příponou — ikony, manifest, robots…), aby je iOS/PWA stáhlo bez přihlášení.
  matcher: ["/((?!api/auth|_next|.*\\..*).*)"],
};
