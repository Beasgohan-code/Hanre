"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import type { User, UserPrefs } from "@/lib/types";
import { api } from "@/lib/client";

/* ------------------------------------------------------------------ */
/* Preferences + user                                                  */
/* ------------------------------------------------------------------ */

type ThemeMode = "dark" | "light" | "system";

interface PrefsContextValue {
  user: User;
  prefs: UserPrefs;
  theme: "dark" | "light";
  themeMode: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  updatePrefs: (patch: Partial<UserPrefs>) => void;
  setUser: (user: User) => void;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

const ACCENTS: Record<string, { main: string; lift: string; soft: string; line: string }> = {
  violet: { main: "#8b7bff", lift: "#c4b5fd", soft: "rgba(139, 123, 255, 0.14)", line: "rgba(139, 123, 255, 0.38)" },
  mint: { main: "#2dd4bf", lift: "#99f6e4", soft: "rgba(45, 212, 191, 0.14)", line: "rgba(45, 212, 191, 0.36)" },
  amber: { main: "#f59e0b", lift: "#fcd34d", soft: "rgba(245, 158, 11, 0.14)", line: "rgba(245, 158, 11, 0.36)" },
  rose: { main: "#fb7185", lift: "#fda4af", soft: "rgba(251, 113, 133, 0.14)", line: "rgba(251, 113, 133, 0.36)" },
  blue: { main: "#60a5fa", lift: "#bfdbfe", soft: "rgba(96, 165, 250, 0.14)", line: "rgba(96, 165, 250, 0.36)" },
};

function systemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function PrefsProvider({
  user,
  initialPrefs,
  children,
}: {
  user: User;
  initialPrefs: UserPrefs;
  children: ReactNode;
}) {
  const [currentUser, setCurrentUser] = useState(user);
  const [prefs, setPrefs] = useState<UserPrefs>(initialPrefs);
  const [system, setSystem] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setSystem(systemTheme());
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const listener = () => setSystem(query.matches ? "light" : "dark");
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  const themeMode = (prefs.theme ?? "dark") as ThemeMode;
  const theme: "dark" | "light" = themeMode === "system" ? system : themeMode;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const palette = ACCENTS[prefs.accent ?? "violet"] ?? ACCENTS.violet;
    const lift = theme === "light" ? palette.main : palette.lift;
    const targets = [document.documentElement, document.querySelector<HTMLElement>(".app-shell")];
    for (const target of targets) {
      if (!target) continue;
      target.style.setProperty("--accent", palette.main);
      target.style.setProperty("--accent-2", lift);
      target.style.setProperty("--accent-soft", palette.soft);
      target.style.setProperty("--accent-line", palette.line);
    }
  }, [prefs.accent, theme]);

  const persist = useCallback((next: UserPrefs) => {
    api<{ user: User }>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ prefs: next }),
    })
      .then((data) => {
        setCurrentUser(data.user);
      })
      .catch(() => {
        /* preferences are cosmetic — a failed save should not interrupt typing */
      });
  }, []);

  const updatePrefs = useCallback(
    (patch: Partial<UserPrefs>) => {
      setPrefs((current) => {
        const next = { ...current, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      updatePrefs({ theme: mode });
    },
    [updatePrefs],
  );

  const value = useMemo<PrefsContextValue>(
    () => ({
      user: currentUser,
      prefs,
      theme,
      themeMode,
      setTheme,
      updatePrefs,
      setUser: setCurrentUser,
    }),
    [currentUser, prefs, theme, themeMode, setTheme, updatePrefs],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const context = useContext(PrefsContext);
  if (!context) throw new Error("usePrefs must be used inside PrefsProvider");
  return context;
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

type ToastTone = "info" | "success" | "error";

interface ToastItem {
  id: string;
  title?: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (message: string, options?: { title?: string; tone?: ToastTone }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON = {
  info: Info,
  success: CheckCircle2,
  error: TriangleAlert,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: { title?: string; tone?: ToastTone }) => {
      const id = Math.random().toString(36).slice(2, 10);
      setToasts((current) => [
        ...current.slice(-2),
        { id, message, title: options?.title, tone: options?.tone ?? "info" },
      ]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, options?.tone === "error" ? 6500 : 4200);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="toast-stack" aria-live="polite" role="status">
      {toasts.map((item) => {
        const Icon = TONE_ICON[item.tone];
        return (
          <div className={`toast toast--${item.tone}`} key={item.id}>
            <span className="toast__icon">
              <Icon size={15} />
            </span>
            <div className="toast__body">
              {item.title && <strong>{item.title}</strong>}
              <span>{item.message}</span>
            </div>
            <button type="button" className="toast__close" onClick={() => dismiss(item.id)} aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
