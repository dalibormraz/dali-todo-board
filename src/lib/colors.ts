import type { TaskColor } from "./types";

// Barvy lístečků (tvůj post-it systém).
export const TASK_COLORS: Record<TaskColor, { bg: string; edge: string }> = {
  yellow: { bg: "#fcef9c", edge: "#f4e375" },
  green: { bg: "#c3e79a", edge: "#a9da77" },
  pink: { bg: "#f8b4d2", edge: "#f491bd" },
  sky: { bg: "#a9e0ec", edge: "#83d2e3" },
};

export const TASK_COLOR_ORDER: TaskColor[] = ["yellow", "green", "pink", "sky"];

// Vzhled hotového lístečku (muted, přeškrtnuté).
export const DONE_STYLE = { bg: "#dfe5ea", text: "#6b7280" };

// Barvy rámečků zón.
export const ZONE_ACCENTS: Record<string, { border: string; tint: string }> = {
  red: { border: "#ff7a59", tint: "rgba(255,122,89,0.08)" },
  yellow: { border: "#f4e375", tint: "rgba(252,239,156,0.28)" },
  sky: { border: "#83d2e3", tint: "rgba(131,210,227,0.14)" },
  green: { border: "#a9da77", tint: "rgba(169,218,119,0.16)" },
  violet: { border: "#6b4eff", tint: "rgba(107,78,255,0.07)" },
  slate: { border: "#94a3b8", tint: "rgba(148,163,184,0.12)" },
};

export function zoneAccent(accent: string) {
  return ZONE_ACCENTS[accent] ?? ZONE_ACCENTS.yellow;
}
