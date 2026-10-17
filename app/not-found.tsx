import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(700px 420px at 50% 0%, rgba(139,123,255,.18), transparent 65%), #07080c",
        color: "#edeff5",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            margin: "0 auto 20px",
            color: "#c4b5fd",
            background: "rgba(139,123,255,.12)",
            border: "1px solid rgba(139,123,255,.35)",
          }}
        >
          <Compass size={22} />
        </div>
        <p style={{ fontSize: 10.5, letterSpacing: ".18em", color: "#7f889b", marginBottom: 10 }}>
          404 · NOT FOUND
        </p>
        <h1 style={{ fontSize: 30, letterSpacing: "-.03em", marginBottom: 10 }}>This page wandered off.</h1>
        <p style={{ color: "#8d95a5", fontSize: 13.5, lineHeight: 1.7, marginBottom: 24 }}>
          The project may have been deleted, or the link is out of date. Your workspace is still exactly
          where you left it.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            height: 38,
            padding: "0 16px",
            borderRadius: 9,
            background: "linear-gradient(180deg, #9c8dff, #7c69f2)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 550,
          }}
        >
          <ArrowLeft size={14} /> Back to the workspace
        </Link>
      </div>
    </div>
  );
}
