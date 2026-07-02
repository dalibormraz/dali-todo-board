import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getBoardData,
  createTask,
  updateTask,
  deleteTask,
  syncTasks,
} from "@/lib/tasks";

async function authed(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session.isLoggedIn);
}

const UNAUTH = NextResponse.json({ error: "Neautorizováno." }, { status: 401 });

export async function GET() {
  if (!(await authed())) return UNAUTH;
  const data = await getBoardData();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!(await authed())) return UNAUTH;
  const body = await req.json().catch(() => ({}));
  const task = await createTask(body);
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest) {
  if (!(await authed())) return UNAUTH;
  const body = await req.json().catch(() => ({}));
  const { id, ...patch } = body ?? {};
  if (!id) return NextResponse.json({ error: "Chybí id." }, { status: 400 });
  const task = await updateTask(id, patch);
  return NextResponse.json(task);
}

export async function PUT(req: NextRequest) {
  if (!(await authed())) return UNAUTH;
  const body = await req.json().catch(() => ({}));
  await syncTasks(Array.isArray(body?.tasks) ? body.tasks : []);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await authed())) return UNAUTH;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Chybí id." }, { status: 400 });
  await deleteTask(id);
  return NextResponse.json({ ok: true });
}
