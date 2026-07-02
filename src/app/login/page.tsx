"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Nepodařilo se přihlásit.");
      }
    } catch {
      setError("Něco se pokazilo. Zkus to znovu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="safe" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20 }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 340,
          background: "#fff",
          border: "1px solid var(--grid)",
          borderRadius: 20,
          boxShadow: "var(--shadow-lg)",
          padding: 28,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "linear-gradient(145deg, var(--yellow), var(--yellow-d))",
            display: "grid",
            placeItems: "center",
            fontSize: 28,
            transform: "rotate(-6deg)",
            boxShadow: "var(--shadow)",
            margin: "0 auto 16px",
          }}
        >
          📌
        </div>
        <h1 style={{ margin: "0 0 4px", textAlign: "center", fontSize: 22, fontWeight: 800 }}>
          DALI TODO
        </h1>
        <p style={{ margin: "0 0 20px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
          Zadej heslo pro vstup.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Heslo"
          autoFocus
          autoComplete="current-password"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--grid)",
            fontSize: 16,
            outline: "none",
          }}
        />

        {error && (
          <p style={{ color: "#e03131", fontSize: 13, margin: "10px 2px 0" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: loading ? "#9b8bff" : "var(--accent)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Přihlašuji…" : "Vstoupit"}
        </button>
      </form>
    </main>
  );
}
