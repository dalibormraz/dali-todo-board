import { supabaseServer } from "./supabase";
import type { Task, Zone } from "./types";

const BOARD_KEY = "main";

async function boardId(): Promise<string> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("boards")
    .select("id")
    .eq("key", BOARD_KEY)
    .single();
  if (error || !data) throw new Error("Nástěnka 'main' nenalezena.");
  return data.id as string;
}

export async function getBoardData(): Promise<{ zones: Zone[]; tasks: Task[] }> {
  const sb = supabaseServer();
  const id = await boardId();
  const [{ data: zones }, { data: tasks }] = await Promise.all([
    sb.from("zones").select("*").eq("board_id", id).order("position"),
    sb.from("tasks").select("*").eq("board_id", id).order("created_at"),
  ]);
  return { zones: (zones ?? []) as Zone[], tasks: (tasks ?? []) as Task[] };
}

export interface CreateTaskInput {
  title?: string;
  color?: string;
  canvas_x?: number;
  canvas_y?: number;
  zone_id?: string | null;
  source?: string;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const sb = supabaseServer();
  const id = await boardId();
  const { data, error } = await sb
    .from("tasks")
    .insert({
      board_id: id,
      title: input.title ?? "Nový úkol",
      color: input.color ?? "yellow",
      canvas_x: input.canvas_x ?? 80,
      canvas_y: input.canvas_y ?? 80,
      zone_id: input.zone_id ?? null,
      source: input.source ?? "web",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Vytvoření selhalo.");
  return data as Task;
}

// Povolená pole pro update (nedovolíme přepsat id/board_id).
const UPDATABLE = new Set([
  "title",
  "body",
  "status",
  "priority",
  "color",
  "canvas_x",
  "canvas_y",
  "w",
  "h",
  "z",
  "zone_id",
  "tags",
  "assignee",
  "result_note",
  "notes_md",
  "home",
]);

export async function updateTask(
  id: string,
  patch: Record<string, unknown>,
): Promise<Task> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (UPDATABLE.has(k)) clean[k] = v;
  }
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("tasks")
    .update(clean)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Úprava selhala.");
  return data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const sb = supabaseServer();
  const { error } = await sb.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Upsert seznamu úkolů (NEDESTRUKTIVNÍ — nikdy nemaže ostatní). Mazání řeš přes deleteTask.
export async function syncTasks(records: Array<Record<string, unknown>>): Promise<void> {
  const sb = supabaseServer();
  const id = await boardId();

  const rows = records.map((r) => ({
    id: r.id as string,
    board_id: id,
    zone_id: (r.zone_id as string | null) ?? null,
    title: (r.title as string) ?? "",
    body: (r.body as string) ?? "",
    status: (r.status as string) ?? "todo",
    priority: (r.priority as string) ?? "normal",
    color: (r.color as string) ?? "yellow",
    canvas_x: (r.canvas_x as number) ?? 0,
    canvas_y: (r.canvas_y as number) ?? 0,
    w: (r.w as number) ?? 200,
    h: (r.h as number) ?? 96,
    z: (r.z as number) ?? 0,
    tags: (r.tags as string[]) ?? [],
    assignee: (r.assignee as string) ?? "me",
    source: (r.source as string) ?? "web",
    result_note: (r.result_note as string) ?? "",
    notes_md: (r.notes_md as string | null) ?? null,
    home: (r.home as unknown) ?? null,
  }));

  if (rows.length > 0) {
    const { error } = await sb.from("tasks").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
}
