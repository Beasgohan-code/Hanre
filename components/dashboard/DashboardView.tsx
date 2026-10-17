"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BarChart3, Braces, Check, CheckCircle2, CheckSquare,
  ChevronRight, Code2, FileCode2, FolderKanban, FolderPlus, Github, Play, Plus,
  Sparkles, Timer, TriangleAlert, UserRound,
} from "lucide-react";
import type { DashboardData, Task } from "@/lib/types";
import { LANGUAGES } from "@/lib/types";
import { api, errorMessage, relativeTime } from "@/lib/client";
import { EmptyState, StatCard } from "@/components/ui/kit";
import { useToast } from "@/components/studio/providers";
import NewProjectModal from "@/components/projects/NewProjectModal";

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function langTag(language: string) {
  return LANGUAGES.find((entry) => entry.value === language)?.ext?.toUpperCase() ?? language.slice(0, 3).toUpperCase();
}

export default function DashboardView({
  data,
  userName,
  todayLabel,
}: {
  data: DashboardData;
  userName: string;
  todayLabel: string;
}) {
  const { toast } = useToast();
  const [projects] = useState(data.projects);
  const [tasks, setTasks] = useState(data.tasks);
  const [stats, setStats] = useState(data.stats);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);

  const firstName = userName.split(" ")[0] || userName;
  const openTasks = tasks.filter((task) => task.status !== "done");
  const focusTasks = useMemo(() => {
    return [...openTasks]
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
      })
      .slice(0, 5);
  }, [tasks]);

  const chartMax = Math.max(1, ...data.activityByDay.map((day) => day.count));
  const totalFiles = projects.reduce((sum, project) => sum + (project.fileCount ?? 0), 0);
  const todayRuns = data.activityByDay[data.activityByDay.length - 1]?.count ?? 0;
  const doneTasks = tasks.filter((task) => task.status === "done").length;

  async function completeTask(task: Task) {
    if (completing.has(task.id)) return;
    const previousTasks = tasks;
    const previousStats = stats;
    setCompleting((current) => new Set(current).add(task.id));
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, status: "done" } : item)));
    setStats((current) => ({ ...current, openTasks: Math.max(0, current.openTasks - 1) }));
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
      toast("Nice — one less thing to carry.", { tone: "success", title: "Task completed" });
    } catch (error) {
      setTasks(previousTasks);
      setStats(previousStats);
      toast(errorMessage(error), { tone: "error", title: "Could not update task" });
    } finally {
      setCompleting((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">{todayLabel}</div>
          <h1 className="page-title">{greeting}, {firstName}.</h1>
          <p className="page-sub">
            {stats.runsThisWeek > 0
              ? <>Your workspace is warm — <strong style={{ color: "var(--text-2)" }}>{stats.runsThisWeek} runs</strong> this week and {stats.openTasks} open tasks.</>
              : "A fresh, quiet workspace. Start something small — a script, a page, an idea."}
          </p>
        </div>
        <div className="header-actions">
          <Link href="/import" className="btn btn--outline">
            <Github size={15} /> Import
          </Link>
          <button type="button" className="btn btn--primary" onClick={() => setNewProjectOpen(true)}>
            <Plus size={15} /> New project
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          icon={FolderKanban}
          label="Projects"
          value={stats.projects}
          suffix="active"
          foot={<><FileCode2 size={11} /> {totalFiles} files across the workspace</>}
        />
        <StatCard
          icon={Braces}
          label="Snippets"
          value={stats.snippets}
          suffix="saved"
          tone="blue"
          foot={<><Sparkles size={11} /> Reusable pieces, one click away</>}
        />
        <StatCard
          icon={CheckSquare}
          label="Open tasks"
          value={stats.openTasks}
          suffix="to do"
          tone="amber"
          foot={<><CheckCircle2 size={11} /> {doneTasks} completed so far</>}
        />
        <StatCard
          icon={Timer}
          label="Runs this week"
          value={stats.runsThisWeek}
          suffix="runs"
          tone="mint"
          foot={<><BarChart3 size={11} /> {stats.runs ? `${stats.successRate}% success rate` : "No runs yet"}</>}
        />
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <div className="card chart-card">
            <div className="chart-head">
              <div>
                <div className="card__title">Activity</div>
                <div className="card__sub">Runs across the last 7 days</div>
              </div>
              <div className="chart-badge">
                <span className="dot" /> {todayRuns} today
              </div>
            </div>

            <div className="chart" role="img" aria-label="Runs per day for the last seven days">
              {data.activityByDay.map((day, index) => {
                const percent = day.count === 0 ? 4 : Math.max(9, Math.round((day.count / chartMax) * 100));
                const label = new Date(`${day.day}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
                const isToday = index === data.activityByDay.length - 1;
                return (
                  <div className="chart__col" key={day.day}>
                    <div
                      className="chart__track"
                      title={`${day.count} run${day.count === 1 ? "" : "s"} · ${new Date(`${day.day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    >
                      <div
                        className="chart__bar"
                        data-today={isToday}
                        data-zero={day.count === 0}
                        style={{ height: `${percent}%` }}
                      />
                    </div>
                    <span className="chart__label" data-today={isToday}>{isToday ? "Today" : label}</span>
                  </div>
                );
              })}
            </div>

            <div className="chart__foot">
              <span>{stats.runs} total runs · {stats.successRate}% finished cleanly</span>
              <Link href="/runs" className="link-quiet">View history <ArrowRight size={11} /></Link>
            </div>
          </div>

          <section>
            <div className="section-head">
              <div className="section-title">
                <FolderKanban size={14} /> Your projects
                <span className="badge">{projects.length}</span>
              </div>
              <Link href="/projects" className="link-quiet">View all <ChevronRight size={11} /></Link>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                icon={FolderPlus}
                title="No projects yet"
                description="A project is just a folder of files with a run button. Start from a template and make it yours."
                action={
                  <button className="btn btn--primary btn--sm" onClick={() => setNewProjectOpen(true)}>
                    <Plus size={14} /> New project
                  </button>
                }
                secondary={
                  <Link href="/import" className="btn btn--ghost btn--sm">
                    <Github size={14} /> Import from GitHub
                  </Link>
                }
              />
            ) : (
              <div className="project-grid">
                {projects.slice(0, 4).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="project-card"
                    style={{
                      "--tone": project.color,
                      "--tint": `${project.color}2e`,
                    } as React.CSSProperties}
                  >
                    <div className="project-card__head">
                      <span className="project-icon" style={{ "--tone": project.color } as React.CSSProperties}>
                        {langTag(project.language)}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <h3>{project.name}</h3>
                        <span className="project-card__lang">
                          <span className="project-dot" style={{ background: project.color }} />
                          {project.language}
                        </span>
                      </div>
                      <ArrowUpRight size={15} className="project-card__arrow" />
                    </div>
                    <p>{project.description || "No description yet — open it and make something."}</p>
                    <div className="project-card__meta">
                      <span><FileCode2 size={10} /> {project.fileCount} files</span>
                      <span><Play size={10} /> {project.runCount} runs</span>
                      <span style={{ marginLeft: "auto" }}>{relativeTime(project.updatedAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div className="card">
            <div className="card__head">
              <div>
                <div className="card__title"><Play size={13} /> Recent runs</div>
                <div className="card__sub">Every execution is saved, so you can retrace your steps.</div>
              </div>
              <Link href="/runs" className="link-quiet">All runs <ArrowRight size={11} /></Link>
            </div>
            <div className="card__body">
              {data.runs.length === 0 ? (
                <div className="focus-empty" style={{ padding: "18px 0" }}>
                  Nothing has run yet. Open a project and press <span className="kbd">⌘↵</span> to execute a file.
                </div>
              ) : (
                data.runs.slice(0, 5).map((run) => (
                  <div className="mini-run" key={run.id}>
                    <span className="mini-run__icon" data-status={run.status}>
                      {run.status === "success" ? <Check size={11} /> : run.status === "error" ? <TriangleAlert size={11} /> : <Timer size={11} />}
                    </span>
                    <div className="mini-run__body">
                      <div className="mini-run__command">{run.command || run.language}</div>
                      <div className="mini-run__meta">
                        {run.projectName ?? "Scratch"} {run.fileName ? `· ${run.fileName}` : ""} · {run.durationMs}ms
                      </div>
                    </div>
                    <span className="mini-run__time">{relativeTime(run.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="dash-side">
          <div className="card">
            <div className="card__head">
              <div>
                <div className="card__title"><CheckSquare size={13} /> Focus for today</div>
                <div className="card__sub">{openTasks.length} open · {doneTasks} done</div>
              </div>
              <Link href="/tasks" className="link-quiet">Board <ArrowRight size={11} /></Link>
            </div>
            <div className="card__body">
              {focusTasks.length === 0 ? (
                <div className="focus-empty">
                  <CheckCircle2 size={18} style={{ color: "var(--mint)", marginBottom: 6 }} />
                  <div>Everything is clear. Add a task when something new comes up.</div>
                  <Link href="/tasks" className="link-quiet" style={{ marginTop: 8, display: "inline-flex" }}>
                    Open the board <ArrowRight size={11} />
                  </Link>
                </div>
              ) : (
                <div className="focus-list">
                  {focusTasks.map((task) => {
                    const overdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now();
                    const done = task.status === "done";
                    return (
                      <div className="focus-item" key={task.id}>
                        <button
                          type="button"
                          className="focus-check"
                          onClick={() => completeTask(task)}
                          aria-label={`Complete ${task.title}`}
                          disabled={completing.has(task.id) || done}
                        >
                          <Check size={11} />
                        </button>
                        <div className="focus-item__body">
                          <div className="focus-item__title">{task.title}</div>
                          <div className="focus-item__meta">
                            <span className={`priority priority--${task.priority}`}>● {task.priority}</span>
                            {task.dueDate && (
                              <span style={{ color: overdue ? "var(--rose)" : undefined }}>
                                {overdue ? "Overdue" : relativeTime(task.dueDate)}
                              </span>
                            )}
                            {task.projectName && <span>· {task.projectName}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <div>
                <div className="card__title"><Sparkles size={13} /> Recent activity</div>
                <div className="card__sub">The story of this workspace</div>
              </div>
            </div>
            <div className="card__body">
              {data.activity.length === 0 ? (
                <div className="focus-empty" style={{ padding: "14px 0" }}>
                  Your actions will show up here as you build.
                </div>
              ) : (
                <div className="feed">
                  {data.activity.slice(0, 6).map((item) => (
                    <div className="feed-item" key={item.id}>
                      <span className="feed-item__icon" data-kind={item.kind}>
                        {item.kind === "run" ? <Play size={11} />
                          : item.kind === "project" ? <FolderKanban size={11} />
                          : item.kind === "task" ? <CheckSquare size={11} />
                          : item.kind === "snippet" ? <Code2 size={11} />
                          : item.kind === "file" ? <FileCode2 size={11} />
                          : <UserRound size={11} />}
                      </span>
                      <div>
                        <div className="feed-item__message">{item.message}</div>
                        <div className="feed-item__time">{relativeTime(item.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {data.snippets.length > 0 && (
            <div className="card">
              <div className="card__head">
                <div>
                  <div className="card__title"><Braces size={13} /> Snippet shelf</div>
                  <div className="card__sub">Reach for these when you need them</div>
                </div>
                <Link href="/snippets" className="link-quiet">All <ArrowRight size={11} /></Link>
              </div>
              <div className="card__body">
                {data.snippets.map((snippet) => (
                  <Link
                    key={snippet.id}
                    href={`/snippets?edit=${snippet.id}`}
                    className="mini-run"
                    style={{ color: "inherit" }}
                  >
                    <span className="mini-run__icon"><Code2 size={11} /></span>
                    <div className="mini-run__body">
                      <div className="mini-run__command" style={{ fontFamily: "inherit", fontSize: 12 }}>{snippet.title}</div>
                      <div className="mini-run__meta">{snippet.language} · {snippet.tags.slice(0, 2).join(" · ") || "untagged"}</div>
                    </div>
                    <ChevronRight size={13} style={{ color: "var(--faint)" }} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} />
    </div>
  );
}
