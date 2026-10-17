"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(700px 420px at 50% 0%, rgba(251,113,133,.13), transparent 65%), #07080c",
        color: "#edeff5",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 440 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            margin: "0 auto 20px",
            color: "#fda4af",
            background: "rgba(251,113,133,.1)",
            border: "1px solid rgba(251,113,133,.3)",
          }}
        >
          <TriangleAlert size={22} />
        </div>
        <h1 style={{ fontSize: 28, letterSpacing: "-.03em", marginBottom: 10 }}>Something broke quietly.</h1>
        <p style={{ color: "#8d95a5", fontSize: 13.5, lineHeight: 1.7, marginBottom: 24 }}>
          This one is on us. Try again — your files and runs are stored safely in the workspace.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 16px",
              borderRadius: 9, background: "linear-gradient(180deg, #9c8dff, #7c69f2)",
              color: "#fff", fontSize: 13, fontWeight: 550, border: 0, cursor: "pointer",
            }}
          >
            <RotateCcw size={14} /> Try again
          </button>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex", alignItems: "center", height: 38, padding: "0 16px",
              borderRadius: 9, border: "1px solid rgba(255,255,255,.14)", color: "#b6bdcc", fontSize: 13,
            }}
          >
            Back to workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
