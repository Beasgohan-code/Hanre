"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, ChevronDown, Clock3, Loader2, Play, RefreshCw, Timer, Trash2,
  TriangleAlert, TrendingUp, X,
} from "lucide-react";
import type { Run } from "@/lib/types";
import { LANGUAGES } from "@/lib/types";
import { api, errorMessage, formatDate, relativeTime } from "@/lib/client";
import { ConfirmDialog, EmptyState, Modal, StatCard } from "@/components/ui/kit";
import { useToast } from "@/components/studio/providers";

interface Stats {
  total: number;
  success: number;
  successRate: number;
  averageDuration: number;
  thisWeek: number;
}

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All runs" },
  { value: "success", label: "Success" },
  { value: "error", label: "Errors" },
  { value: "unsupported", label: "Skipped" },
];

export default function RunsView({
  initialRuns,
  initialTotal,
  initialStats,
}: {
  initialRuns: Run[];
  initialTotal: number;
  initialStats: Stats;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [runs, setRuns] = useState(initialRuns);
  const [total, setTotal] = useState(initialTotal);
  const [stats, setStats] = useState(initialStats);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Run | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Run | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearPending, setClearPending] = useState(false);

  async function load(status: string, append = false, silent = false) {
    if (append) setLoadingMore(true);
    else if (!silent) setLoading(true);
    try {
      const data = await api<{ runs: Run[]; total: number; stats: Stats }>(
        `/api/runs?limit=25&offset=${append ? runs.length : 0}&status=${status}`,
      );
      setRuns((current) => (append ? [...current, ...data.runs] : data.runs));
      setTotal(data.total);
      setStats(data.stats);
    } catch (error) {
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function changeFilter(next: string) {
    setFilter(next);
    setSelected(null);
    void load(next);
  }

  async function confirmDelete() {
    if (!deleteTarget || deletePending) return;
    const target = deleteTarget;
    const previous = runs;
    setDeletePending(true);
    setRuns((current) => current.filter((run) => run.id !== target.id));
    setTotal((current) => Math.max(0, current - 1));
    setDeleteTarget(null);
    setSelected(null);
    try {
      await api(`/api/runs/${target.id}`, { method: "DELETE" });
      toast("Run removed from history.", { tone: "success" });
      void load(filter, false, true);
      router.refresh();
    } catch (error) {
      setRuns(previous);
      setTotal((current) => current + 1);
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setDeletePending(false);
    }
  }

  async function clearHistory() {
    if (clearPending) return;
    const previousRuns = runs;
    const previousStats = stats;
    setClearPending(true);
    setRuns([]);
    setTotal(0);
    setStats({ total: 0, success: 0, successRate: 0, averageDuration: 0, thisWeek: 0 });
    setClearOpen(false);
    try {
      await api("/api/runs", { method: "DELETE" });
      toast("Run history cleared. A clean page.", { tone: "success" });
      router.refresh();
    } catch (error) {
      setRuns(previousRuns);
      setStats(previousStats);
      setTotal(previousStats.total);
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setClearPending(false);
    }
  }

  const emptyAll = initialTotal === 0 && filter === "all" && runs.length === 0;
  const emptyFiltered = !emptyAll && runs.length === 0 && !loading;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Observability</div>
          <h1 className="page-title">Run history</h1>
          <p className="page-sub">
            Every run is recorded with its output, duration, and status — a quiet logbook for your thinking.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn--ghost" onClick={() => void load(filter)} disabled={loading}>
            {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Refresh
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => setClearOpen(true)}
            disabled={total === 0 && runs.length === 0}
          >
            <Trash2 size={14} /> Clear history
          </button>
        </div>
      </div>

      <div className="runs-summary">
        <StatCard icon={Play} label="Total runs" value={stats.total} suffix="recorded" foot="Every execution, kept" />
        <StatCard
          icon={CheckCircle2}
          label="Success rate"
          value={stats.successRate}
          suffix="%"
          tone="mint"
          foot={`${stats.success} successful runs`}
        />
        <StatCard
          icon={Timer}
          label="Avg duration"
          value={stats.averageDuration}
          suffix="ms"
          tone="amber"
          foot="Excludes skipped files"
        />
        <StatCard
          icon={TrendingUp}
          label="This week"
          value={stats.thisWeek}
          suffix="runs"
          tone="blue"
          foot="Last seven days"
        />
      </div>

      <div className="filter-bar">
        {FILTERS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            className="chip"
            data-active={filter === entry.value}
            onClick={() => changeFilter(entry.value)}
          >
            {entry.value === "success" && <CheckCircle2 size={12} />}
            {entry.value === "error" && <TriangleAlert size={12} />}
            {entry.value === "unsupported" && <Clock3 size={12} />}
            {entry.label}
          </button>
        ))}
        <span className="muted-sm" style={{ marginLeft: "auto" }}>
          {loading ? "Loading…" : `${total} run${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {loading ? (
        <div className="stack gap-8" aria-busy="true">
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="skeleton skeleton-row" key={index} />
          ))}
        </div>
      ) : emptyAll ? (
        <EmptyState
          icon={Play}
          title="No runs yet"
          description="Open a project, pick a file, and press ⌘↵. JavaScript, TypeScript, Python, HTML, CSS, Markdown, JSON, and SQL all execute from the editor."
          action={
            <a className="btn btn--primary" href="/projects">
              <Play size={14} /> Open a project
            </a>
          }
        />
      ) : emptyFiltered ? (
        <EmptyState
          icon={Clock3}
          title={`No ${filter} runs`}
          description="Nothing matches this filter yet. Try another status, or run a file to add a fresh entry."
          action={
            <button className="btn btn--sm" onClick={() => changeFilter("all")}>
              <X size={14} /> Show all runs
            </button>
          }
        />
      ) : (
        <>
          <div className="run-list">
            <div className="run-row run-row--head">
              <span />
              <span>Command</span>
              <span>Project</span>
              <span>Duration</span>
              <span>When</span>
              <span>Status</span>
              <span />
            </div>
            {runs.map((run) => (
              <div
                key={run.id}
                className="run-row"
                onClick={() => setSelected(run)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setSelected(run);
                }}
              >
                <span className="mini-run__icon" data-status={run.status}>
                  {run.status === "success" ? <CheckCircle2 size={11} />
                    : run.status === "error" ? <TriangleAlert size={11} />
                    : <Clock3 size={11} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="run-command">{run.command || "run"}</div>
                  <div className="run-cell">{run.fileName ?? LANGUAGES.find((entry) => entry.value === run.language)?.label ?? run.language}</div>
                </div>
                <span className="run-project">{run.projectName ?? "Scratch"}</span>
                <span className="run-cell run-col-hide">{run.durationMs}ms</span>
                <span className="run-cell run-col-hide">{relativeTime(run.createdAt)}</span>
                <span className="run-status" data-status={run.status}>
                  <span className="dot" /> {run.status}
                </span>
                <button
                  type="button"
                  className="icon-btn run-delete"
                  style={{ width: 26, height: 26 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(run);
                  }}
                  aria-label="Delete run"
                  title="Delete run"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {runs.length < total && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <button
                type="button"
                className="btn"
                onClick={() => void load(filter, true)}
                disabled={loadingMore}
              >
                {loadingMore ? <Loader2 size={14} className="spin" /> : <ChevronDown size={14} />}
                {loadingMore ? "Loading…" : `Load more (${total - runs.length} left)`}
              </button>
            </div>
          )}
        </>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.command || "Run details" : "Run details"}
        subtitle={selected ? new Date(selected.createdAt).toLocaleString() : undefined}
        wide
        footer={
          <>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => selected && setDeleteTarget(selected)}
            >
              <Trash2 size={14} /> Delete run
            </button>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn" onClick={() => setSelected(null)}>
              Close
            </button>
          </>
        }
      >
        {selected && (
          <>
            <div className="run-detail-meta">
              <div>Status<strong style={{ color: selected.status === "error" ? "var(--rose)" : selected.status === "success" ? "var(--mint)" : "var(--amber)" }}>
                {selected.status}
              </strong></div>
              <div>Duration<strong>{selected.durationMs} ms</strong></div>
              <div>Language<strong>{LANGUAGES.find((entry) => entry.value === selected.language)?.label ?? selected.language}</strong></div>
              <div>Project<strong>{selected.projectName ?? "Scratch"}</strong></div>
              <div>File<strong>{selected.fileName ?? "—"}</strong></div>
              <div>Date<strong>{formatDate(selected.createdAt)}</strong></div>
            </div>
            <pre className="run-output">{selected.output || "(no output captured)"}</pre>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this run?"
        description="The stored output and timing will be removed. Future runs are unaffected."
        confirmLabel="Delete run"
        pending={deletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Clear all run history?"
        description="This removes every stored run and its output for your account. Your projects and files stay untouched."
        confirmLabel="Clear everything"
        pending={clearPending}
        onCancel={() => setClearOpen(false)}
        onConfirm={clearHistory}
      />
    </div>
  );
}
