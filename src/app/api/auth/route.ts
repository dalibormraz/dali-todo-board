import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { verifyPassword, checkRateLimit } from "@/lib/auth";

// Běží na Node runtime (bcrypt) — výchozí pro Route Handlery.
export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Příliš mnoho pokusů. Zkus to za chvíli." },
      { status: 429 },
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    // ignore – prázdné heslo selže níže
  }

  // Malé umělé zpoždění ztěžuje brute-force.
  await new Promise((r) => setTimeout(r, 300));

  const ok = await verifyPassword(password);
  if (!ok) {
    return NextResponse.json({ error: "Špatné heslo." }, { status: 401 });
  }

  const session = await getSession();
  session.isLoggedIn = true;
  session.loginAt = Date.now();
  await session.save();

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
