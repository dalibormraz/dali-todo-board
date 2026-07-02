"use client";

import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { zoneAccent } from "@/lib/colors";

export interface ZoneData extends Record<string, unknown> {
  label: string;
  accent: string;
  w: number;
  h: number;
}

export type ZoneFlowNode = Node<ZoneData, "zone">;

function ZoneNodeInner({ data }: NodeProps<ZoneFlowNode>) {
  const a = zoneAccent(data.accent);
  return (
    <div
      style={{
        width: data.w,
        height: data.h,
        border: `2px dashed ${a.border}`,
        borderRadius: 18,
        background: a.tint,
        position: "relative",
        pointerEvents: "none", // klikání prochází na lístečky
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -13,
          left: 16,
          background: "#fff",
          borderRadius: 20,
          padding: "3px 12px",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.03em",
          boxShadow: "0 6px 16px rgba(31,36,48,0.16)",
          color: "#1f2430",
        }}
      >
        {data.label}
      </span>
    </div>
  );
}

export const ZoneNode = memo(ZoneNodeInner);
