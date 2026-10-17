"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Check, Copy, Loader2, TriangleAlert, X } from "lucide-react";
import { useToast } from "@/components/studio/providers";

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`spin ${className ?? ""}`} aria-hidden />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header__copy">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-sub">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName = "card__body",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card ${className ?? ""}`}>
      {(title || action) && (
        <div className="card__head">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {description && <p className="card__sub">{description}</p>}
          </div>
          {action && <div className="card__action">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondary,
  compact,
}: {
  icon: ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;
  title: string;
  description?: string;
  action?: ReactNode;
  secondary?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "empty-state--compact" : ""}`}>
      <span className="empty-state__icon">
        <Icon size={compact ? 16 : 22} strokeWidth={1.6} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {(action || secondary) && (
        <div className="empty-state__action">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
  label,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  label?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]), textarea, select, button:not([data-close])",
      );
      focusable?.focus();
    }, 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === "string" ? title : "Dialog")}
        ref={panelRef}
      >
        {(title || subtitle) && (
          <header className="modal__head">
            <div>
              {title && <h2 className="modal__title">{title}</h2>}
              {subtitle && <p className="modal__sub">{subtitle}</p>}
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" data-close>
              <X size={16} />
            </button>
          </header>
        )}
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onCancel}
      label={title}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === "danger" ? "btn--danger" : "btn--primary"}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending && <Spinner />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm">
        <span className={`confirm__icon ${tone === "danger" ? "confirm__icon--danger" : ""}`}>
          <TriangleAlert size={18} />
        </span>
        <div>
          <h3>{title}</h3>
          <div className="confirm__text">{description}</div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */

export function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  foot,
  tone = "accent",
}: {
  icon: ComponentType<{ size?: number | string; strokeWidth?: number }>;
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  foot?: ReactNode;
  tone?: "accent" | "mint" | "amber" | "rose" | "blue";
}) {
  return (
    <div className="stat-card" data-tone={tone}>
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__icon">
          <Icon size={15} strokeWidth={1.8} />
        </span>
      </div>
      <div className="stat-card__value">
        {value}
        {suffix && <span>{suffix}</span>}
      </div>
      {foot && <div className="stat-card__foot">{foot}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Copy button                                                         */
/* ------------------------------------------------------------------ */

export function CopyButton({
  value,
  label = "Copy",
  className = "btn btn--ghost btn--sm",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast("Copied to clipboard.", { tone: "success" });
    } catch {
      toast("Your browser blocked clipboard access. Select the text instead.", { tone: "error" });
    }
  }

  return (
    <button type="button" className={className} onClick={copy} aria-label={label}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Error hint                                                          */
/* ------------------------------------------------------------------ */

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <div className="auth-error" role="alert">
      <TriangleAlert size={14} style={{ flex: "none", marginTop: 2 }} />
      <span>{children}</span>
    </div>
  );
}
