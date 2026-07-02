"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Panel,
  PanOnScrollMode,
  useNodesState,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Task, TaskColor, Zone } from "@/lib/types";
import { TASK_COLORS, zoneAccent } from "@/lib/colors";
import { TaskNode, type TaskFlowNode } from "./TaskNode";
import { ZoneNode, type ZoneFlowNode } from "./ZoneNode";
import { LodContext } from "./lod";
import { noteActions } from "@/lib/noteMeta";
import { renderMarkdown } from "@/lib/markdown";

// Pod tímto zoomem kreslíme lístečky zjednodušeně (LOD) — viz TaskNode.
const LOD_ZOOM = 0.5;

type AppNode = TaskFlowNode | ZoneFlowNode;
const nodeTypes = { task: TaskNode, zone: ZoneNode };

const EDIT_GUARD_MS = 4000; // po lokální úpravě tak dlouho ignoruj serverový stav daného úkolu
const POLL_MS = 2500;

interface Handlers {
  onColor: (id: string, color: TaskColor) => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  onToggleDone: (id: string, done: boolean) => void;
  onEditNotes: (id: string) => void;
}

interface Cmd {
  undo: () => void;
  redo: () => void;
}

function zoneToNode(z: Zone): ZoneFlowNode {
  return {
    id: `zone-${z.id}`,
    type: "zone",
    position: { x: z.x, y: z.y },
    data: { label: z.label, accent: z.accent, w: z.w, h: z.h },
    draggable: false,
    selectable: false,
    deletable: false,
    zIndex: 0,
  };
}

function taskToNode(t: Task, h: Handlers): TaskFlowNode {
  return {
    id: t.id,
    type: "task",
    position: { x: t.canvas_x, y: t.canvas_y },
    zIndex: 1,
    data: {
      title: t.title,
      color: t.color,
      status: t.status,
      assignee: t.assignee,
      notesMd: t.notes_md ?? "",
      home: t.home,
      onColor: h.onColor,
      onDelete: h.onDelete,
      onRename: h.onRename,
      onToggleDone: h.onToggleDone,
      onEditNotes: h.onEditNotes,
    },
  };
}

async function api(method: string, body?: unknown, query = "") {
  return fetch(`/api/tasks${query}`, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function Flow({ zones, tasks }: { zones: Zone[]; tasks: Task[] }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const { screenToFlowPosition } = useReactFlow();
  // LOD příznak: mění se jen při překročení prahu zoomu (boolean selektor → žádné
  // překreslení každý frame), takže lístečky zlevníme jen když je opravdu odzoomováno.
  const lowDetail = useStore((s) => s.transform[2] < LOD_ZOOM);
  const nodesRef = useRef<AppNode[]>([]);
  nodesRef.current = nodes;

  const recordsRef = useRef<Map<string, Task>>(new Map());
  const editedRef = useRef<Map<string, number>>(new Map());
  const draggingRef = useRef(false);
  const handlersRef = useRef<Handlers>({} as Handlers);

  // editor MD poznámky (popup) — { id, value } když je otevřený
  const [notesEdit, setNotesEdit] = useState<{ id: string; value: string } | null>(null);
  // režim popupu: "view" = vyrenderovaný markdown + rychlé akce, "edit" = textarea
  const [notesMode, setNotesMode] = useState<"view" | "edit">("view");

  const markEdited = useCallback((id: string) => {
    editedRef.current.set(id, Date.now());
  }, []);

  // ── primitivní operace (zápis do nodes + records + server) ───────────────
  const upsertNode = useCallback(
    (rec: Task) => {
      markEdited(rec.id);
      recordsRef.current.set(rec.id, rec);
      setNodes((ns) => {
        const node = taskToNode(rec, handlersRef.current);
        return ns.some((n) => n.id === rec.id)
          ? ns.map((n) => (n.id === rec.id ? node : n))
          : [...ns, node];
      });
      void api("PUT", { tasks: [rec] }); // nedestruktivní upsert
    },
    [setNodes, markEdited],
  );

  const removeNode = useCallback(
    (id: string) => {
      markEdited(id);
      recordsRef.current.delete(id);
      setNodes((ns) => ns.filter((n) => n.id !== id));
      void api("DELETE", undefined, `?id=${encodeURIComponent(id)}`);
    },
    [setNodes, markEdited],
  );

  const patchNode = useCallback(
    (id: string, patch: Partial<Task>) => {
      markEdited(id);
      const rec = recordsRef.current.get(id);
      if (rec) recordsRef.current.set(id, { ...rec, ...patch });
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id || n.type !== "task") return n;
          const pos =
            patch.canvas_x != null || patch.canvas_y != null
              ? { x: patch.canvas_x ?? n.position.x, y: patch.canvas_y ?? n.position.y }
              : n.position;
          const data = { ...n.data };
          if ("title" in patch) data.title = patch.title as string;
          if ("color" in patch) data.color = patch.color as TaskColor;
          if ("status" in patch) data.status = patch.status as string;
          if ("notes_md" in patch) data.notesMd = (patch.notes_md as string | null) ?? "";
          if ("home" in patch) data.home = (patch.home as Task["home"]) ?? null;
          return { ...n, position: pos, data };
        }),
      );
      void api("PATCH", { id, ...patch });
    },
    [setNodes, markEdited],
  );

  // ── historie (command pattern — bezpečné, nemaže nesouvisející) ───────────
  const undoRef = useRef<Cmd[]>([]);
  const redoRef = useRef<Cmd[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const refreshFlags = useCallback(() => {
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  }, []);
  const pushCmd = useCallback(
    (cmd: Cmd) => {
      undoRef.current.push(cmd);
      if (undoRef.current.length > 80) undoRef.current.shift();
      redoRef.current = [];
      refreshFlags();
    },
    [refreshFlags],
  );
  const undo = useCallback(() => {
    const cmd = undoRef.current.pop();
    if (!cmd) return;
    cmd.undo();
    redoRef.current.push(cmd);
    refreshFlags();
  }, [refreshFlags]);
  const redo = useCallback(() => {
    const cmd = redoRef.current.pop();
    if (!cmd) return;
    cmd.redo();
    undoRef.current.push(cmd);
    refreshFlags();
  }, [refreshFlags]);

  // ── akce uživatele ───────────────────────────────────────────────────────
  const onColor = useCallback(
    (id: string, color: TaskColor) => {
      const rec = recordsRef.current.get(id);
      if (!rec) return;
      const old = rec.color;
      patchNode(id, { color });
      pushCmd({ undo: () => patchNode(id, { color: old }), redo: () => patchNode(id, { color }) });
    },
    [patchNode, pushCmd],
  );

  const onRename = useCallback(
    (id: string) => {
      const rec = recordsRef.current.get(id);
      const old = rec?.title ?? "";
      const next = window.prompt("Název úkolu:", old);
      if (next == null) return;
      patchNode(id, { title: next });
      pushCmd({ undo: () => patchNode(id, { title: old }), redo: () => patchNode(id, { title: next }) });
    },
    [patchNode, pushCmd],
  );

  const onDelete = useCallback(
    (id: string) => {
      const rec = recordsRef.current.get(id);
      if (!rec) return;
      removeNode(id);
      pushCmd({ undo: () => upsertNode(rec), redo: () => removeNode(id) });
    },
    [removeNode, upsertNode, pushCmd],
  );

  // otevři popup s MD poznámkou (kontext lístečku) — s obsahem rovnou náhled, jinak editor
  const onEditNotes = useCallback((id: string) => {
    const rec = recordsRef.current.get(id);
    const value = rec?.notes_md ?? "";
    setNotesEdit({ id, value });
    setNotesMode(value.trim() ? "view" : "edit");
  }, []);

  // ulož poznámku (optimisticky + undo/redo); zápis jen cíleným PATCH
  const saveNotes = useCallback(() => {
    if (!notesEdit) return;
    const { id, value } = notesEdit;
    const old = recordsRef.current.get(id)?.notes_md ?? "";
    setNotesEdit(null);
    if (value === old) return;
    patchNode(id, { notes_md: value });
    pushCmd({
      undo: () => patchNode(id, { notes_md: old }),
      redo: () => patchNode(id, { notes_md: value }),
    });
  }, [notesEdit, patchNode, pushCmd]);

  const onToggleDone = useCallback(
    (id: string, done: boolean) => {
      const rec = recordsRef.current.get(id);
      if (!rec) return;
      const before: Partial<Task> = {
        status: rec.status,
        zone_id: rec.zone_id,
        canvas_x: rec.canvas_x,
        canvas_y: rec.canvas_y,
        home: rec.home,
      };
      let after: Partial<Task>;
      if (done) {
        const hotovo = zones.find((z) => z.label.startsWith("HOTOVO"));
        const doneCount = nodesRef.current.filter(
          (n) => n.type === "task" && (n.data as { status?: string }).status === "done",
        ).length;
        // hotové skládej do mřížky (víc sloupců), ať se jich tam vejde hodně
        const cols = hotovo ? Math.max(1, Math.floor((hotovo.w - 40) / 220)) : 1;
        const col = doneCount % cols;
        const row = Math.floor(doneCount / cols);
        after = {
          status: "done",
          zone_id: hotovo?.id ?? null,
          canvas_x: hotovo ? hotovo.x + 20 + col * 220 : 1180,
          canvas_y: hotovo ? hotovo.y + 55 + row * 110 : 80,
          home: { x: rec.canvas_x, y: rec.canvas_y },
        };
      } else {
        const home = rec.home;
        after = {
          status: "todo",
          zone_id: null,
          canvas_x: home?.x ?? rec.canvas_x,
          canvas_y: home?.y ?? rec.canvas_y,
          home: null,
        };
      }
      patchNode(id, after);
      pushCmd({ undo: () => patchNode(id, before), redo: () => patchNode(id, after) });
    },
    [patchNode, pushCmd, zones],
  );

  handlersRef.current = { onColor, onDelete, onRename, onToggleDone, onEditNotes };

  // počáteční sestavení (jednou)
  useEffect(() => {
    recordsRef.current = new Map(tasks.map((t) => [t.id, t]));
    setNodes([...zones.map(zoneToNode), ...tasks.map((t) => taskToNode(t, handlersRef.current))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // klávesy ⌘Z / ⌘⇧Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Esc zavře popup poznámky (funguje i v režimu náhledu, kde není textarea)
  useEffect(() => {
    if (!notesEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotesEdit(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notesEdit]);

  // ── ŽIVÝ SYNC (mobil ↔ desktop): polling + chytré sloučení ───────────────
  const reconcile = useCallback(
    (serverTasks: Task[]) => {
      if (draggingRef.current) return;
      const now = Date.now();
      const guarded = (id: string) => {
        const t = editedRef.current.get(id);
        return t !== undefined && now - t < EDIT_GUARD_MS;
      };
      const serverById = new Map(serverTasks.map((t) => [t.id, t]));
      const cur = nodesRef.current;
      const zoneNodes = cur.filter((n) => n.type === "zone");
      const taskNodes = cur.filter((n) => n.type === "task") as TaskFlowNode[];
      const currentIds = new Set(taskNodes.map((n) => n.id));
      let changed = false;
      const next: TaskFlowNode[] = [];

      for (const n of taskNodes) {
        if (guarded(n.id)) {
          next.push(n);
          continue;
        }
        const srv = serverById.get(n.id);
        if (!srv) {
          changed = true;
          recordsRef.current.delete(n.id);
          continue;
        }
        const d = n.data;
        const moved =
          Math.round(n.position.x) !== Math.round(srv.canvas_x) ||
          Math.round(n.position.y) !== Math.round(srv.canvas_y);
        const diff =
          d.title !== srv.title ||
          d.color !== srv.color ||
          d.status !== srv.status ||
          d.notesMd !== (srv.notes_md ?? "");
        if (moved || diff) {
          changed = true;
          recordsRef.current.set(srv.id, srv);
          next.push({
            ...n,
            position: { x: srv.canvas_x, y: srv.canvas_y },
            data: {
              ...d,
              title: srv.title,
              color: srv.color,
              status: srv.status,
              notesMd: srv.notes_md ?? "",
              home: srv.home,
            },
          });
        } else {
          next.push(n);
        }
      }
      for (const srv of serverTasks) {
        if (currentIds.has(srv.id) || guarded(srv.id)) continue;
        changed = true;
        recordsRef.current.set(srv.id, srv);
        next.push(taskToNode(srv, handlersRef.current));
      }
      if (changed) setNodes([...zoneNodes, ...next]);
    },
    [setNodes],
  );

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped || draggingRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const res = await api("GET");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.tasks)) reconcile(data.tasks as Task[]);
      } catch {
        /* ignore */
      }
    };
    const iv = setInterval(tick, POLL_MS);
    // při návratu do appky (přepnutí oken / probuzení mobilu) hned dorovnej
    const onWake = () => void tick();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);
    void tick(); // hned při startu
    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
    };
  }, [reconcile]);

  const addTask = useCallback(async () => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const res = await api("POST", {
      title: "Nový úkol",
      canvas_x: Math.round(center.x),
      canvas_y: Math.round(center.y),
    });
    const task = (await res.json()) as Task;
    markEdited(task.id);
    recordsRef.current.set(task.id, task);
    setNodes((ns) => [...ns, taskToNode(task, handlersRef.current)]);
    pushCmd({ undo: () => removeNode(task.id), redo: () => upsertNode(task) });
  }, [screenToFlowPosition, setNodes, markEdited, pushCmd, removeNode, upsertNode]);

  // rychlé akce odvozené z aktuálního textu poznámky (Gmail vlákno / telefon)
  const popupActions = useMemo(
    () => (notesEdit ? noteActions(notesEdit.value) : { gmail: null, phone: null }),
    [notesEdit],
  );

  const btn = (enabled: boolean): React.CSSProperties => ({
    background: "#fff",
    border: "1px solid var(--grid, #e3e5ea)",
    borderRadius: 9,
    width: 38,
    height: 36,
    fontSize: 16,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.4,
    boxShadow: "0 6px 16px rgba(31,36,48,0.16)",
  });

  return (
    <>
    <LodContext.Provider value={lowDetail}>
    <ReactFlow
      nodes={nodes}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      onNodeDragStart={() => {
        draggingRef.current = true;
      }}
      onNodeDragStop={(_, node) => {
        draggingRef.current = false;
        if (node.type !== "task") return;
        const rec = recordsRef.current.get(node.id);
        const oldX = rec?.canvas_x ?? node.position.x;
        const oldY = rec?.canvas_y ?? node.position.y;
        const nx = Math.round(node.position.x);
        const ny = Math.round(node.position.y);
        if (oldX === nx && oldY === ny) return;
        markEdited(node.id);
        if (rec) recordsRef.current.set(node.id, { ...rec, canvas_x: nx, canvas_y: ny });
        void api("PATCH", { id: node.id, canvas_x: nx, canvas_y: ny });
        pushCmd({
          undo: () => patchNode(node.id, { canvas_x: oldX, canvas_y: oldY }),
          redo: () => patchNode(node.id, { canvas_x: nx, canvas_y: ny }),
        });
      }}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.15}
      maxZoom={2}
      panOnScroll
      panOnScrollMode={PanOnScrollMode.Free}
      zoomOnScroll={false}
      zoomOnPinch
      panOnDrag
      proOptions={{ hideAttribution: true }}
    >
      {/* Pozadí (tečky) je staticky na wrapperu — viz BoardClient níž — aby
          při posunu plátna „stálo" a sloužilo jako pevný orientační rastr. */}
      <Controls />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => {
          if (n.type === "zone") return zoneAccent((n.data as { accent: string }).accent).border;
          const color = (n.data as { color?: TaskColor }).color ?? "yellow";
          return TASK_COLORS[color].bg;
        }}
      />
      <Panel position="top-left">
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={undo} disabled={!canUndo} title="Zpět (⌘Z)" aria-label="Zpět" style={btn(canUndo)}>
            ↶
          </button>
          <button onClick={redo} disabled={!canRedo} title="Vpřed (⌘⇧Z)" aria-label="Vpřed" style={btn(canRedo)}>
            ↷
          </button>
          <button
            onClick={() => window.location.reload()}
            title="Aktualizovat (načíst nejnovější)"
            aria-label="Aktualizovat"
            style={{ ...btn(true), marginLeft: 4 }}
          >
            ↻
          </button>
        </div>
      </Panel>
      <Panel position="bottom-center">
        <button
          onClick={addTask}
          style={{
            background: "#6b4eff",
            color: "#fff",
            border: "none",
            borderRadius: 30,
            padding: "11px 20px",
            fontSize: 15,
            fontWeight: 700,
            boxShadow: "0 10px 26px rgba(107,78,255,0.4)",
            cursor: "pointer",
          }}
        >
          + Lísteček
        </button>
      </Panel>
    </ReactFlow>
    </LodContext.Provider>

    {notesEdit && (
      <div
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setNotesEdit(null);
        }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          background: "rgba(31,36,48,0.32)",
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "min(560px, 92vw)",
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 24px 60px rgba(31,36,48,0.34)",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#2a2c20" }}>
              Poznámka lístečku
            </span>
            <span style={{ fontSize: 12, color: "#8a8f98" }}>
              kontext (Markdown)
            </span>
            <button
              onClick={() => setNotesMode((m) => (m === "view" ? "edit" : "view"))}
              style={{
                marginLeft: "auto",
                border: "1px solid var(--grid, #e3e5ea)",
                background: "#fff",
                borderRadius: 8,
                padding: "5px 11px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                color: "#2a2c20",
              }}
            >
              {notesMode === "view" ? "✏️ Upravit" : "👁 Náhled"}
            </button>
          </div>

          {/* rychlé akce: Gmail vlákno + telefon (odvozeno z textu poznámky) */}
          {(popupActions.gmail || popupActions.phone) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {popupActions.gmail && (
                <a
                  href={popupActions.gmail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={popupActions.gmail.detail}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    textDecoration: "none",
                    background: "rgba(107,78,255,0.12)",
                    color: "#5a3ff0",
                    border: "1px solid rgba(107,78,255,0.28)",
                    borderRadius: 999,
                    padding: "7px 13px",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  ✉️ {popupActions.gmail.label}
                  <span style={{ fontWeight: 500, opacity: 0.7 }}>
                    · {popupActions.gmail.detail}
                  </span>
                </a>
              )}
              {popupActions.phone && (
                <a
                  href={popupActions.phone.href}
                  title={`Zavolat ${popupActions.phone.display}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    textDecoration: "none",
                    background: "rgba(47,158,68,0.12)",
                    color: "#2f9e44",
                    border: "1px solid rgba(47,158,68,0.3)",
                    borderRadius: 999,
                    padding: "7px 13px",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  📞 Zavolat <span style={{ fontWeight: 800 }}>{popupActions.phone.display}</span>
                </a>
              )}
            </div>
          )}

          {notesMode === "view" ? (
            <div
              style={{
                minHeight: 200,
                maxHeight: "52vh",
                overflowY: "auto",
                borderRadius: 10,
                border: "1px solid var(--grid, #e3e5ea)",
                background: "#fcfcfd",
                padding: "12px 14px",
                fontSize: 13.5,
                color: "#2a2c20",
                wordBreak: "break-word",
              }}
            >
              {notesEdit.value.trim() ? (
                renderMarkdown(notesEdit.value)
              ) : (
                <span style={{ color: "#8a8f98" }}>
                  Zatím bez poznámky — klikni na „✏️ Upravit".
                </span>
              )}
            </div>
          ) : (
            <textarea
              autoFocus
              value={notesEdit.value}
              onChange={(e) => setNotesEdit({ id: notesEdit.id, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  saveNotes();
                }
              }}
              placeholder={"Sem napiš detaily, odkazy, kontext…\n\nMůžeš použít Markdown. Plnit to budu hlavně já podle toho, co mi zadáš."}
              style={{
                width: "100%",
                minHeight: 240,
                resize: "vertical",
                borderRadius: 10,
                border: "1px solid var(--grid, #e3e5ea)",
                padding: "11px 12px",
                fontSize: 13.5,
                lineHeight: 1.5,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                color: "#2a2c20",
                outline: "none",
              }}
            />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11.5, color: "#8a8f98", marginRight: "auto" }}>
              {notesMode === "edit" ? "⌘↵ uložit · Esc zavřít" : "Esc zavřít"}
            </span>
            {notesMode === "edit" ? (
              <>
                <button
                  onClick={() => setNotesEdit(null)}
                  style={{
                    border: "1px solid var(--grid, #e3e5ea)",
                    background: "#fff",
                    borderRadius: 9,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#2a2c20",
                  }}
                >
                  Zrušit
                </button>
                <button
                  onClick={saveNotes}
                  style={{
                    border: "none",
                    background: "#6b4eff",
                    color: "#fff",
                    borderRadius: 9,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 8px 20px rgba(107,78,255,0.34)",
                  }}
                >
                  Uložit
                </button>
              </>
            ) : (
              <button
                onClick={() => setNotesEdit(null)}
                style={{
                  border: "1px solid var(--grid, #e3e5ea)",
                  background: "#fff",
                  borderRadius: 9,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "#2a2c20",
                }}
              >
                Zavřít
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export function BoardClient({ zones, tasks }: { zones: Zone[]; tasks: Task[] }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        position: "relative",
        // statický tečkovaný rastr (nepanuje/nezoomuje s plátnem → pevná orientace)
        backgroundColor: "var(--paper, #f4f5f7)",
        backgroundImage: "radial-gradient(#d4d7df 1.1px, transparent 1.1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <ReactFlowProvider>
        <Flow zones={zones} tasks={tasks} />
      </ReactFlowProvider>
    </div>
  );
}
