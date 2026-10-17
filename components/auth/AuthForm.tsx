"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Check, Eye, EyeOff, Loader2, Play, Sparkles, TriangleAlert, Zap,
} from "lucide-react";
import { api, errorMessage } from "@/lib/client";

type Mode = "login" | "register";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState(false);

  const busy = pending || demoPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "register") {
      if (name.trim().length < 2) {
        setError("Tell us your name — at least 2 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Those passwords do not match.");
        return;
      }
    }
    if (password.length < 8 && mode === "register") {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setPending(true);
    try {
      await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(
          mode === "register" ? { name: name.trim(), email, password } : { email, password },
        ),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  async function handleDemo() {
    setError("");
    setDemoPending(true);
    try {
      await api("/api/auth/demo", { method: "POST" });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setDemoPending(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth__aside">
        <div className="auth__brand">
          <span className="brand-mark">{"</>"}</span>
          <div>
            <div className="brand-name">Hanre</div>
            <div className="brand-sub">Studio</div>
          </div>
        </div>

        <div className="auth__pitch">
          <span className="eyebrow" style={{ color: "#7f889b" }}>A coding workspace for everyone</span>
          <h2>
            The whole workshop.<br />
            <em>None of the setup.</em>
          </h2>
          <p>
            An editor, a terminal, instant runners for Python and JavaScript, and a live preview —
            in one calm workspace that opens in a tab. Built for beginners, tinkerers, and anyone
            with an idea worth running.
          </p>

          <div className="auth__features">
            <div className="auth__feature"><Zap size={13} /> Run JavaScript, TypeScript, Python, and SQL instantly</div>
            <div className="auth__feature"><Play size={13} /> Live HTML and CSS preview on every save</div>
            <div className="auth__feature"><Check size={13} /> Import any public GitHub repository in one step</div>
            <div className="auth__feature"><Check size={13} /> Autosave, versioned runs, snippets, and tasks</div>
          </div>

          <div className="auth__code-card" aria-hidden>
            <div className="auth__code-bar">
              <i /><i /><i />
              <span style={{ marginLeft: 6 }}>workspace.ts</span>
              <span style={{ marginLeft: "auto", color: "#5eead4" }}>● ready</span>
            </div>
            <pre className="auth__code">
<span className="tok-c">{"// open a project, no installs"}</span>{"\n"}
<span className="tok-k">const</span> studio = <span className="tok-k">await</span> <span className="tok-f">hanre</span>.<span className="tok-f">open</span>(<span className="tok-s">"aurora-notes"</span>);{"\n\n"}
<span className="tok-k">const</span> run = studio.<span className="tok-f">run</span>(<span className="tok-s">"cli.js"</span>);{"\n"}
console.<span className="tok-f">log</span>(run.status);   <span className="tok-c">// "success"</span>{"\n"}
console.<span className="tok-f">log</span>(run.duration); <span className="tok-c">// 24ms</span>
            </pre>
          </div>
        </div>

        <div className="auth__aside-foot">Hanre Studio · v1.0 · Runs in your browser</div>
      </aside>

      <main className="auth__main">
        <div className="auth-card">
          <div className="auth-card__eyebrow">{mode === "login" ? "Hanre account" : "Get started · 30 seconds"}</div>
          <h1>{mode === "login" ? "Welcome back." : "Build something."}</h1>
          <p className="auth-card__sub">
            {mode === "login"
              ? "Sign in to pick up exactly where you left off — projects, runs, snippets, and tasks."
              : "Create an account and get a starter project, live preview, and a run button that already works."}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Maya Raman"
                  autoComplete="name"
                  required
                  disabled={busy}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="password">
                Password
                {mode === "register" && <span className="field__hint">8+ characters</span>}
              </label>
              <div className="input-affix">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "login" ? "Your password" : "Create a password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "register" ? 8 : undefined}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="input-affix__button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {mode === "register" && (
              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  required
                  disabled={busy}
                />
              </div>
            )}

            {error && (
              <div className="auth-error" role="alert">
                <TriangleAlert size={14} style={{ flex: "none", marginTop: 2 }} />
                <span>{error}</span>
              </div>
            )}

            <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={busy}>
              {pending ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
              {pending
                ? mode === "login" ? "Signing in…" : "Creating your workspace…"
                : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="auth-divider">or</div>

          <button type="button" className="demo-card" onClick={handleDemo} disabled={busy}>
            <span className="demo-card__icon">
              {demoPending ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            </span>
            <span style={{ flex: 1 }}>
              <strong>Explore the demo workspace</strong>
              <span>5 projects, 14 runs, real files — fully editable, zero setup</span>
            </span>
            <ArrowRight size={15} style={{ color: "#7f889b", flex: "none" }} />
          </button>

          <div className="auth__alt">
            {mode === "login" ? (
              <>New to Hanre? <Link href="/register">Create an account</Link></>
            ) : (
              <>Already have an account? <Link href="/login">Sign in</Link></>
            )}
          </div>

          {mode === "register" && (
            <p className="auth-legal">
              Your work is stored in this Hanre instance. Export everything or delete your account at any time.
            </p>
          )}
          {mode === "login" && (
            <p className="auth-legal">
              Demo access: <span className="mono">demo@hanre.dev</span> · <span className="mono">demo1234</span>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
