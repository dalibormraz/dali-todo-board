import { getBoardData } from "@/lib/tasks";
import { BoardClient } from "@/components/BoardClient";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { zones, tasks } = await getBoardData();

  return (
    <main style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        className="safe"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px",
          borderBottom: "1px solid var(--grid)",
          background: "rgba(244,245,247,0.85)",
          backdropFilter: "blur(8px)",
          zIndex: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--yellow)",
            border: "2px solid var(--yellow-d)",
            display: "grid",
            placeItems: "center",
            transform: "rotate(-6deg)",
          }}
        >
          📌
        </span>
        <strong style={{ fontSize: 17, letterSpacing: "-0.02em", marginRight: "auto" }}>
          DALI TODO
        </strong>
        <LogoutButton />
      </header>

      <BoardClient zones={zones} tasks={tasks} />
    </main>
  );
}
