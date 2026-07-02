"use client";

import { memo, useContext, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { TASK_COLORS, TASK_COLOR_ORDER, DONE_STYLE } from "@/lib/colors";
import type { TaskColor } from "@/lib/types";
import { noteFlags } from "@/lib/noteMeta";
import { LodContext } from "./lod";

export interface TaskData extends Record<string, unknown> {
  title: string;
  color: TaskColor;
  status: string;
  assignee: string;
  notesMd: string;
  home?: { x: number; y: number } | null;
  onColor: (id: string, color: TaskColor) => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onEditNotes: (id: string) => void;
}

// nenápadná „note" glyfa — značí, že lísteček má kontext (MD poznámku)
function NoteGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <line x1="2" y1="3" x2="10" y2="3" />
        <line x1="2" y1="6" x2="10" y2="6" />
        <line x1="2" y1="9" x2="7" y2="9" />
      </g>
    </svg>
  );
}

// obálka — lísteček váže na e-mail / vlákno v Gmailu
function MailGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.3" y="2.7" width="11.4" height="8.6" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.6 3.4 7 7.6l5.4-4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// sluchátko — lísteček má telefonní číslo k zavolání
function PhoneGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 2.2c.5 0 .9.3 1 .8l.5 2c.1.4 0 .8-.3 1l-1 .8a8 8 0 0 0 3 3l.8-1c.2-.3.6-.4 1-.3l2 .5c.5.1.8.5.8 1v1.5c0 .6-.5 1.1-1.1 1A10 10 0 0 1 2 3.3 1 1 0 0 1 3 2.2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type TaskFlowNode = Node<TaskData, "task">;

// deterministická lehká rotace z id (post-it pocit, ať „neposkakuje")
function rot(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % 5) - 2) * 0.8; // ~ -1.6° .. +1.6°
}

function TaskNodeInner({ id, data, selected, dragging }: NodeProps<TaskFlowNode>) {
  const lowDetail = useContext(LodContext);
  const isDone = data.status === "done";
  const c = TASK_COLORS[data.color] ?? TASK_COLORS.yellow;
  const bg = isDone ? DONE_STYLE.bg : c.bg;
  const forAgent =
    data.status === "queued_for_agent" || data.status === "agent_working";
  const hasNotes = Boolean(data.notesMd && data.notesMd.trim().length > 0);
  const { hasMail, hasPhone } = useMemo(
    () => (hasNotes ? noteFlags(data.notesMd) : { hasMail: false, hasPhone: false }),
    [hasNotes, data.notesMd],
  );

  // ── LOD: hodně odzoomováno → lehký lísteček (bez stínu/rotace/tlačítek),
  // ať plátno se 100+ uzly neškubá. Plnou verzi ukážeme jen u vybraného lístečku,
  // který se zrovna netáhne — jinak by při tažení odzoomováno karta „cukla"
  // (xyflow při startu tažení označí uzel jako selected).
  if (lowDetail && (!selected || dragging)) {
    return (
      <div
        style={{
          width: 200,
          minHeight: 62,
          background: bg,
          borderRadius: 7,
          border: "1px solid rgba(31,36,48,0.12)",
          padding: "11px 12px",
          fontFamily: "var(--hand, inherit)",
          fontSize: 14,
          fontWeight: 700,
          color: isDone ? DONE_STYLE.text : "#2a2c20",
          lineHeight: 1.3,
          wordBreak: "break-word",
          textDecoration: isDone ? "line-through" : "none",
          opacity: isDone ? 0.92 : 1,
        }}
      >
        {data.title || "—"}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 200,
        background: bg,
        borderRadius: 7,
        boxShadow: selected
          ? "0 14px 30px rgba(31,36,48,0.30)"
          : "0 6px 16px rgba(31,36,48,0.18)",
        padding: "11px 12px",
        transform: `rotate(${selected || isDone ? 0 : rot(id)}deg)`,
        outline: selected ? "2px solid #6b4eff" : "none",
        outlineOffset: 2,
        opacity: isDone ? 0.92 : 1,
        transition: "box-shadow .15s, transform .15s, background .2s",
        position: "relative",
        fontFamily: "var(--hand, inherit)",
      }}
      onDoubleClick={() => data.onRename(id)}
      title="Dvojklik = přejmenovat"
    >
      {/* zaškrtávátko HOTOVO */}
      <button
        className="nodrag"
        aria-label={isDone ? "vrátit jako nehotové" : "označit jako hotové"}
        title={isDone ? "Vrátit zpět" : "Hotovo"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          data.onToggleDone(id, !isDone);
        }}
        style={{
          position: "absolute",
          top: 7,
          right: 7,
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: isDone ? "none" : "2px solid rgba(0,0,0,0.3)",
          background: isDone ? "#2f9e44" : "rgba(255,255,255,0.55)",
          color: "#fff",
          cursor: "pointer",
          padding: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 17,
          lineHeight: 1,
          touchAction: "manipulation",
        }}
      >
        {isDone ? "✓" : ""}
      </button>

      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: isDone ? DONE_STYLE.text : "#2a2c20",
          lineHeight: 1.3,
          wordBreak: "break-word",
          paddingRight: 34,
          textDecoration: isDone ? "line-through" : "none",
        }}
      >
        {data.title || "—"}
      </div>

      {forAgent && (
        <div
          style={{
            marginTop: 7,
            fontSize: 10,
            fontWeight: 700,
            color: "#6b4eff",
            letterSpacing: "0.03em",
          }}
        >
          {data.status === "agent_working" ? "🤖 Claude pracuje…" : "🤖 pro Claude"}
        </div>
      )}

      {/* značky dole vpravo ve VLASTNÍM řádku (v toku → nikdy přes text; karta
          naroste jen o tenhle malý řádek a jen když je co ukázat). Šedá = jen
          poznámka; barevně jen když je odkaz (mail/telefon). */}
      {hasNotes && !selected && (
        <div
          aria-hidden
          title={
            "Lísteček má poznámku (kontext)" +
            (hasMail ? " · váže na e-mail" : "") +
            (hasPhone ? " · obsahuje telefon" : "")
          }
          style={{
            marginTop: 5,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 7,
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "#aeb3bc", display: "grid", placeItems: "center" }}>
            <NoteGlyph size={12} />
          </span>
          {hasMail && (
            <span style={{ color: "#6b4eff", display: "grid", placeItems: "center" }}>
              <MailGlyph size={13} />
            </span>
          )}
          {hasPhone && (
            <span style={{ color: "#2f9e44", display: "grid", placeItems: "center" }}>
              <PhoneGlyph size={13} />
            </span>
          )}
        </div>
      )}

      {selected && (
        <div
          className="nodrag"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px dashed rgba(0,0,0,0.12)",
          }}
        >
          {TASK_COLOR_ORDER.map((col) => (
            <button
              key={col}
              className="nodrag"
              aria-label={`barva ${col}`}
              onClick={(e) => {
                e.stopPropagation();
                data.onColor(id, col);
              }}
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border:
                  data.color === col
                    ? "2px solid #1f2430"
                    : "1px solid rgba(0,0,0,0.2)",
                background: TASK_COLORS[col].bg,
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
          <button
            className="nodrag"
            aria-label="poznámka (kontext)"
            title={hasNotes ? "Otevřít poznámku" : "Přidat poznámku (kontext)"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              data.onEditNotes(id);
            }}
            style={{
              marginLeft: "auto",
              width: 22,
              height: 22,
              borderRadius: 6,
              border: "none",
              background: hasNotes ? "rgba(107,78,255,0.16)" : "rgba(0,0,0,0.06)",
              color: hasNotes ? "#6b4eff" : "#2a2c20",
              opacity: hasNotes ? 1 : 0.5,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <NoteGlyph size={12} />
          </button>
          <button
            className="nodrag"
            aria-label="smazat"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete(id);
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: "none",
              background: "rgba(0,0,0,0.06)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}

export const TaskNode = memo(TaskNodeInner);
