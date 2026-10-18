"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3, Beaker, BookOpen, Braces, File, Github, Globe, Loader2, Terminal, TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import { api, errorMessage } from "@/lib/client";
import { Modal } from "@/components/ui/kit";
import { useToast } from "@/components/studio/providers";
import type { Project } from "@/lib/types";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  file: File,
  globe: Globe,
  terminal: Terminal,
  braces: Braces,
  chart: BarChart3,
  book: BookOpen,
  beaker: Beaker,
};

const COLORS = ["#8b7bff", "#5eead4", "#fbbf24", "#60a5fa", "#fb7185", "#a3e635"];

export default function NewProjectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("blank");
  const [color, setColor] = useState(COLORS[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setTemplate("blank");
    setColor(COLORS[0]);
    setError("");
    setPending(false);
  }, [open]);

  async function submit() {
    if (pending) return;
    if (!name.trim()) {
      setError("Give your project a name first.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const data = await api<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description, template, color }),
      });
      toast("Your workspace is ready.", { tone: "success", title: "Project created" });
      onClose();
      router.push(`/projects/${data.project.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      subtitle="Start from a template, then shape it into anything."
      wide
      footer={
        <>
          <Link href="/import" className="btn btn--ghost" onClick={onClose}>
            <Github size={14} /> Import instead
          </Link>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={submit} disabled={pending}>
            {pending ? <Loader2 size={14} className="spin" /> : null}
            {pending ? "Creating…" : "Create project"}
          </button>
        </>
      }
    >
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="field">
          <label htmlFor="project-name">Project name</label>
          <input
            id="project-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Aurora Notes"
            maxLength={80}
            disabled={pending}
          />
        </div>

        <div className="field">
          <label htmlFor="project-description">
            Description <span className="field__hint">optional</span>
          </label>
          <input
            id="project-description"
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="One sentence about what you are building"
            maxLength={400}
            disabled={pending}
          />
        </div>

        <div className="field">
          <span className="label">Start from</span>
          <div className="template-grid">
            {TEMPLATES.map((item) => {
              const Icon = TEMPLATE_ICONS[item.icon] ?? File;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="template-option"
                  data-active={template === item.id}
                  onClick={() => setTemplate(item.id)}
                  disabled={pending}
                >
                  <span className="template-option__icon"><Icon size={15} /></span>
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <span className="label">Accent color</span>
          <div className="swatches">
            {COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className="swatch"
                style={{ "--swatch": swatch } as React.CSSProperties}
                data-active={color === swatch}
                onClick={() => setColor(swatch)}
                aria-label={`Use ${swatch}`}
                disabled={pending}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            <TriangleAlert size={14} style={{ flex: "none", marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
