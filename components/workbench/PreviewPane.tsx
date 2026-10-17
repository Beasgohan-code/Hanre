"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Monitor, RefreshCw, X } from "lucide-react";
import type { ProjectFile } from "@/lib/types";
import { buildPreview, type PreviewResult } from "@/lib/preview";

export default function PreviewPane({
  files,
  activeFile,
  open,
  onClose,
  onConsole,
  refreshToken,
}: {
  files: ProjectFile[];
  activeFile: ProjectFile | null;
  open: boolean;
  onClose: () => void;
  onConsole: (level: string, message: string) => void;
  refreshToken: number;
}) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const onConsoleRef = useRef(onConsole);
  onConsoleRef.current = onConsole;

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const result = buildPreview(files, activeFile?.path);
      setPreview(result);
      setErrors([]);
    }, 320);
    return () => clearTimeout(timer);
  }, [files, activeFile?.path, open, refreshToken, reloadKey]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as
        | { __hanre?: boolean; type?: string; message?: string; level?: string }
        | undefined;
      if (!data || !data.__hanre) return;
      if (data.type === "console" && data.message) {
        onConsoleRef.current(data.level ?? "log", data.message);
      }
      if (data.type === "error" && data.message) {
        setErrors((current) => [...current.slice(-19), data.message!]);
        onConsoleRef.current("error", data.message);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  function openExternal() {
    if (!preview) return;
    const blob = new Blob([preview.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return (
    <div className="wb-preview">
      <div className="pane-head">
        <Monitor size={12} />
        <strong>Preview</strong>
        {preview && <span className="pane-chip">{preview.entry}</span>}
        <span className="pane-head__spacer" />
        {errors.length > 0 && (
          <span className="pane-chip" data-error="true" title={errors[0]}>
            <AlertTriangle size={9} /> {errors.length}
          </span>
        )}
        <button
          type="button"
          className="icon-btn"
          style={{ width: 24, height: 24 }}
          onClick={() => setReloadKey((key) => key + 1)}
          title="Refresh preview"
          aria-label="Refresh preview"
        >
          <RefreshCw size={12} />
        </button>
        <button
          type="button"
          className="icon-btn"
          style={{ width: 24, height: 24 }}
          onClick={openExternal}
          title="Open preview in a new tab"
          aria-label="Open preview in a new tab"
          disabled={!preview}
        >
          <ExternalLink size={12} />
        </button>
        <button
          type="button"
          className="icon-btn wb-preview-overlay"
          style={{ width: 24, height: 24 }}
          onClick={onClose}
          title="Close preview"
          aria-label="Close preview"
        >
          <X size={13} />
        </button>
      </div>
      {preview ? (
        <iframe
          key={`${preview.entry}-${reloadKey}-${refreshToken}`}
          title={`Preview of ${preview.title}`}
          srcDoc={preview.html}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
        />
      ) : (
        <div className="editor-empty" style={{ background: "var(--surface)" }}>
          <Monitor size={22} />
          <h3>Nothing to preview yet</h3>
          <p>
            Add or open an HTML, CSS, or Markdown file and it will render here. JavaScript runs
            from the Output tab.
          </p>
        </div>
      )}
    </div>
  );
}
