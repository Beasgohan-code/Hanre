"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, Database, Download, Keyboard, Laptop, LogOut, Monitor, Moon, Palette,
  ShieldCheck, SlidersHorizontal, TriangleAlert, UserRound,
} from "lucide-react";
import type { User } from "@/lib/types";
import { api, errorMessage, formatDate, initials } from "@/lib/client";
import { Modal, Spinner } from "@/components/ui/kit";
import { usePrefs, useToast } from "@/components/studio/providers";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "editor", label: "Editor", icon: SlidersHorizontal },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "account", label: "Account & data", icon: ShieldCheck },
];

const AVATAR_COLORS = ["#8b7bff", "#5eead4", "#fbbf24", "#60a5fa", "#fb7185", "#a3e635"];
const ACCENTS = [
  { value: "violet", color: "#8b7bff", label: "Violet" },
  { value: "mint", color: "#2dd4bf", label: "Mint" },
  { value: "amber", color: "#f59e0b", label: "Amber" },
  { value: "rose", color: "#fb7185", label: "Rose" },
  { value: "blue", color: "#60a5fa", label: "Blue" },
];

const SHORTCUTS: [string, string][] = [
  ["⌘ / Ctrl + K", "Search everything and run commands"],
  ["⌘ / Ctrl + P", "Go to a file in the editor"],
  ["⌘ / Ctrl + Enter", "Run the open file"],
  ["⌘ / Ctrl + S", "Save the open file"],
  ["⌘ / Ctrl + `", "Toggle the terminal panel"],
  ["⌘ / Ctrl + B", "Toggle the file explorer"],
  ["Esc", "Close dialogs and the palette"],
  ["↑ / ↓", "Navigate the command palette"],
  ["Tab", "Complete file names in the terminal"],
];

export default function SettingsView({ initialUser }: { initialUser: User }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, setUser, prefs, setTheme, updatePrefs } = usePrefs();

  const [active, setActive] = useState("profile");
  const [name, setName] = useState(initialUser.name);
  const [email, setEmail] = useState(initialUser.email);
  const [avatarColor, setAvatarColor] = useState(initialUser.avatarColor);
  const [profilePending, setProfilePending] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const isDemo = user.email === "demo@hanre.dev";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: 0 },
    );
    SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  function jump(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveProfile() {
    if (profilePending) return;
    if (name.trim().length < 2) {
      toast("Your name needs at least 2 characters.", { tone: "error" });
      return;
    }
    setProfilePending(true);
    try {
      const data = await api<{ user: User }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), avatarColor }),
      });
      setUser(data.user);
      toast("Profile updated.", { tone: "success" });
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), { tone: "error", title: "Could not save profile" });
    } finally {
      setProfilePending(false);
    }
  }

  async function changePassword() {
    if (passwordPending) return;
    setPasswordError("");
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setPasswordPending(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast("Password changed. Please sign in again.", { tone: "success" });
      window.location.assign("/login");
    } catch (error) {
      setPasswordError(errorMessage(error));
      setPasswordPending(false);
    }
  }

  async function deleteAccount() {
    if (deletePending || !deletePassword) return;
    setDeleteError("");
    setDeletePending(true);
    try {
      await api("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      window.location.assign("/register");
    } catch (error) {
      setDeleteError(errorMessage(error));
      setDeletePending(false);
    }
  }

  async function signOut() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.assign("/login");
    } catch {
      toast("Could not sign out.", { tone: "error" });
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Preferences</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Shape the workspace around the way you like to think.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn--ghost" onClick={signOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div className="settings-grid">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className="settings-link"
              data-active={active === section.id}
              onClick={() => jump(section.id)}
            >
              <section.icon size={14} /> {section.label}
            </button>
          ))}
        </nav>

        <div className="settings-sections">
          <section id="profile" className="card settings-card" style={{ scrollMarginTop: 90 }}>
            <div className="settings-card__head">
              <h2>Profile</h2>
              <p>How you appear in the workspace. Email is used to sign in.</p>
            </div>
            <div className="profile-head">
              <span className="avatar avatar--lg" style={{ background: avatarColor }}>
                {initials(name || user.name)}
              </span>
              <div className="profile-head__meta">
                <strong>{name || user.name}</strong>
                <span>Member since {formatDate(user.createdAt)}{isDemo ? " · demo account" : ""}</span>
                <div className="color-row">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="swatch"
                      style={{ "--swatch": color, width: 20, height: 20 } as React.CSSProperties}
                      data-active={avatarColor === color}
                      onClick={() => setAvatarColor(color)}
                      aria-label={`Avatar color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="input-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="settings-name">Name</label>
                <input
                  id="settings-name"
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="settings-email">Email</label>
                <input
                  id="settings-email"
                  className="input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isDemo}
                />
              </div>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn--primary" type="button" onClick={saveProfile} disabled={profilePending}>
                {profilePending && <Spinner />} Save profile
              </button>
            </div>
          </section>

          <section id="appearance" className="card settings-card" style={{ scrollMarginTop: 90 }}>
            <div className="settings-card__head">
              <h2>Appearance</h2>
              <p>Theme and accent color. Changes save instantly and follow you to every device.</p>
            </div>

            <div className="theme-grid">
              {[
                { mode: "dark", label: "Dark", icon: Moon },
                { mode: "light", label: "Light", icon: Monitor },
                { mode: "system", label: "System", icon: Laptop },
              ].map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  className="theme-option"
                  data-mode={option.mode === "system" ? "dark" : option.mode}
                  data-active={(prefs.theme ?? "dark") === option.mode}
                  onClick={() => setTheme(option.mode as "dark" | "light" | "system")}
                >
                  <div className="theme-option__preview">
                    <i />
                    <i />
                  </div>
                  <span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <option.icon size={11} /> {option.label}
                    </span>
                    {(prefs.theme ?? "dark") === option.mode && <Check size={11} style={{ color: "var(--accent-2)" }} />}
                  </span>
                </button>
              ))}
            </div>

            <div className="settings-row" style={{ marginTop: 18 }}>
              <div className="settings-row__text">
                <strong>Accent color</strong>
                <span>Used by the primary buttons, focus rings, and the sidebar.</span>
              </div>
              <div className="swatches">
                {ACCENTS.map((accent) => (
                  <button
                    key={accent.value}
                    type="button"
                    className="swatch"
                    style={{ "--swatch": accent.color } as React.CSSProperties}
                    data-active={(prefs.accent ?? "violet") === accent.value}
                    onClick={() => updatePrefs({ accent: accent.value })}
                    aria-label={accent.label}
                    title={accent.label}
                  />
                ))}
              </div>
            </div>
          </section>

          <section id="editor" className="card settings-card" style={{ scrollMarginTop: 90 }}>
            <div className="settings-card__head">
              <h2>Editor</h2>
              <p>These preferences apply to every file in every project.</p>
            </div>

            <div className="settings-row">
              <div className="settings-row__text">
                <strong>Font size</strong>
                <span>Comfortable sizes for long sessions.</span>
              </div>
              <div className="range-row">
                <input
                  type="range"
                  min={12}
                  max={20}
                  step={1}
                  value={prefs.editorFontSize ?? 14}
                  onChange={(event) => updatePrefs({ editorFontSize: Number(event.target.value) })}
                  aria-label="Editor font size"
                />
                <span className="badge mono">{prefs.editorFontSize ?? 14}px</span>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row__text">
                <strong>Indentation</strong>
                <span>Spaces used when you press Tab.</span>
              </div>
              <select
                className="select"
                style={{ width: 110 }}
                value={prefs.tabSize ?? 2}
                onChange={(event) => updatePrefs({ tabSize: Number(event.target.value) })}
                aria-label="Tab size"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
                <option value={8}>8 spaces</option>
              </select>
            </div>

            {[
              { key: "autosave" as const, label: "Autosave", hint: "Save silently 900ms after you stop typing." },
              { key: "wordWrap" as const, label: "Word wrap", hint: "Wrap long lines instead of scrolling sideways." },
              { key: "lineNumbers" as const, label: "Line numbers", hint: "Show line numbers and the fold gutter." },
            ].map((option) => (
              <div className="settings-row" key={option.key}>
                <div className="settings-row__text">
                  <strong>{option.label}</strong>
                  <span>{option.hint}</span>
                </div>
                <button
                  type="button"
                  className="switch"
                  data-on={Boolean(prefs[option.key])}
                  aria-pressed={Boolean(prefs[option.key])}
                  aria-label={option.label}
                  onClick={() => updatePrefs({ [option.key]: !prefs[option.key] })}
                />
              </div>
            ))}
          </section>

          <section id="shortcuts" className="card settings-card" style={{ scrollMarginTop: 90 }}>
            <div className="settings-card__head">
              <h2>Keyboard shortcuts</h2>
              <p>The fastest path between an idea and its output.</p>
            </div>
            <div className="stack">
              {SHORTCUTS.map(([keys, description]) => (
                <div className="settings-row" key={keys}>
                  <div className="settings-row__text">
                    <strong>{description}</strong>
                  </div>
                  <span className="kbd mono" style={{ height: 22, padding: "0 8px", fontSize: 10.5 }}>{keys}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="account" className="card settings-card" style={{ scrollMarginTop: 90 }}>
            <div className="settings-card__head">
              <h2>Security</h2>
              <p>
                {isDemo
                  ? "The demo account has a fixed password so everyone can try it. Create your own account to manage a password."
                  : "Change your password. You will be signed out of every session afterwards."}
              </p>
            </div>
            <div className="form-stack">
              <div className="input-row">
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="current-password">Current password</label>
                  <input
                    id="current-password"
                    className="input"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    disabled={isDemo}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    className="input"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={isDemo}
                  />
                </div>
              </div>
              <div className="input-row" style={{ alignItems: "flex-end" }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    className="input"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    disabled={isDemo}
                  />
                </div>
                <button className="btn" type="button" onClick={changePassword} disabled={passwordPending || isDemo}>
                  {passwordPending && <Spinner />} Update password
                </button>
              </div>
              {passwordError && <div className="field-error">{passwordError}</div>}
            </div>
          </section>

          <section className="card settings-card" style={{ scrollMarginTop: 90 }}>
            <div className="settings-card__head">
              <h2>Data & backup</h2>
              <p>Your workspace lives in this Hanre instance. You can take it with you at any time.</p>
            </div>
            <div className="settings-row">
              <div className="settings-row__text">
                <strong>Download a full backup</strong>
                <span>Projects, files, snippets, tasks, and run history as one JSON file.</span>
              </div>
              <a className="btn" href="/api/export">
                <Download size={14} /> Download JSON
              </a>
            </div>
            <div className="settings-row">
              <div className="settings-row__text">
                <strong>Stored locally</strong>
                <span>Data is kept in a SQLite database on the Hanre server, not in third parties.</span>
              </div>
              <span className="badge badge--mint"><Database size={10} /> SQLite</span>
            </div>
          </section>

          <section className="card settings-card danger-zone">
            <div className="settings-card__head">
              <h2>Danger zone</h2>
              <p>Delete your account and every project, file, snippet, task, and run inside it.</p>
            </div>
            <div className="settings-row" style={{ borderTop: 0 }}>
              <div className="settings-row__text">
                <strong>Delete my account</strong>
                <span>
                  {isDemo
                    ? "The demo account cannot be deleted. Create your own account to own your data."
                    : "This is permanent. Download a backup first if you need one."}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--danger"
                disabled={isDemo}
                onClick={() => {
                  setDeletePassword("");
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
              >
                <TriangleAlert size={14} /> Delete account
              </button>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!deletePending) setDeleteOpen(false);
        }}
        title="Delete your account?"
        subtitle="This permanently removes your account and every project, file, snippet, task, and run inside it. There is no undo."
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDeleteOpen(false)} disabled={deletePending}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={deleteAccount}
              disabled={deletePending || !deletePassword}
            >
              {deletePending && <Spinner />} Delete forever
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="delete-password">Confirm with your password</label>
          <input
            id="delete-password"
            className="input"
            type="password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void deleteAccount();
            }}
            autoComplete="current-password"
            placeholder="Your current password"
          />
        </div>
        {deleteError && (
          <div className="auth-error" style={{ marginTop: 12 }} role="alert">
            <TriangleAlert size={14} style={{ flex: "none", marginTop: 2 }} />
            <span>{deleteError}</span>
          </div>
        )}
        <p className="muted-sm" style={{ marginTop: 12 }}>
          Prefer to keep a copy? Download a backup from the top-right menu before deleting.
        </p>
      </Modal>
    </div>
  );
}
