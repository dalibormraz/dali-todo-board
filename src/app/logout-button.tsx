"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      style={{
        border: "1px solid var(--grid)",
        background: "#fff",
        borderRadius: 10,
        padding: "8px 14px",
        fontSize: 14,
        fontWeight: 600,
        color: "var(--muted)",
        cursor: "pointer",
        boxShadow: "var(--shadow)",
      }}
    >
      {loading ? "Odhlašuji…" : "Odhlásit"}
    </button>
  );
}
