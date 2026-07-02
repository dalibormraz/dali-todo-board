export type TaskColor = "yellow" | "green" | "pink" | "sky";
export type TaskStatus =
  | "todo"
  | "doing"
  | "done"
  | "queued_for_agent"
  | "agent_working";

export interface Zone {
  id: string;
  board_id: string;
  label: string;
  kind: string;
  accent: string;
  x: number;
  y: number;
  w: number;
  h: number;
  position: number;
  rule: Record<string, unknown>;
}

export interface Task {
  id: string;
  board_id: string;
  zone_id: string | null;
  title: string;
  body: string;
  status: TaskStatus;
  priority: string;
  color: TaskColor;
  canvas_x: number;
  canvas_y: number;
  w: number;
  h: number;
  z: number;
  tags: string[];
  assignee: string;
  source: string;
  result_note: string;
  notes_md: string | null;
  home: { x: number; y: number } | null;
  created_at: string;
  updated_at: string;
}
