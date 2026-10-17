"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Check, CheckCircle2, CircleDot, ListTodo, Pencil, Plus,
  Search, Trash2, X,
} from "lucide-react";
import type { Project, Task, TaskPriority, TaskStatus } from "@/lib/types";
import { api, errorMessage, formatDate } from "@/lib/client";
import { ConfirmDialog, EmptyState, Modal, Spinner } from "@/components/ui/kit";
import { useToast } from "@/components/studio/providers";

const COLUMNS: { id: TaskStatus; label: string; tone: string }[] = [
  { id: "backlog", label: "Backlog", tone: "var(--faint)" },
  { id: "in_progress", label: "In progress", tone: "var(--blue)" },
  { id: "review", label: "In review", tone: "var(--amber)" },
  { id: "done", label: "Done", tone: "var(--mint)" },
];

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => a.position - b.position);
}

export default function TasksView({
  initialTasks,
  projects,
  initialTaskId,
}: {
  initialTasks: Task[];
  projects: Project[];
  initialTaskId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState(initialTasks);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dragging, setDragging] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    if (!initialTaskId) return;
    const task = tasks.find((entry) => entry.id === initialTaskId);
    if (task) openEdit(task);
    router.replace("/tasks");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTaskId]);

  function resetForm(task: Task | null, presetStatus: TaskStatus = "backlog") {
    setEditing(task);
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setStatus(task?.status ?? presetStatus);
    setPriority((task?.priority as TaskPriority) ?? "medium");
    setProjectId(task?.projectId ?? "");
    setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : "");
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    resetForm(task);
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks
      .filter((task) => projectFilter === "all" || task.projectId === projectFilter)
      .filter((task) => priorityFilter === "all" || task.priority === priorityFilter)
      .filter((task) => !needle || task.title.toLowerCase().includes(needle) || task.notes.toLowerCase().includes(needle));
  }, [tasks, query, projectFilter, priorityFilter]);

  const openCount = tasks.filter((task) => task.status !== "done").length;
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const overdueCount = tasks.filter(
    (task) => task.status !== "done" && task.dueDate && new Date(task.dueDate).getTime() < Date.now(),
  ).length;

  async function persistReorder(next: Task[], previous: Task[], successMessage?: string) {
    setTasks(next);
    const affectedStatuses = new Set(next.map((task) => task.status));
    const updates = next
      .filter((task) => affectedStatuses.has(task.status))
      .map((task) => ({ id: task.id, status: task.status, position: task.position }));
    try {
      await api("/api/tasks/reorder", {
        method: "POST",
        body: JSON.stringify({ updates }),
      });
      if (successMessage) toast(successMessage, { tone: "success" });
      router.refresh();
    } catch (error) {
      setTasks(previous);
      toast(errorMessage(error), { tone: "error", title: "Could not move task" });
    }
  }

  function moveTask(taskId: string, toStatus: TaskStatus) {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task || task.status === toStatus) return;
    const previous = tasks;
    const now = new Date().toISOString();
    let next = tasks.map((entry) =>
      entry.id === taskId ? { ...entry, status: toStatus, updatedAt: now } : entry,
    );
    const reorder = (list: Task[], columnStatus: TaskStatus) => {
      const column = sortTasks(list.filter((entry) => entry.status === columnStatus));
      return list.map((entry) => {
        const index = column.findIndex((item) => item.id === entry.id);
        return index === -1 ? entry : { ...entry, position: index + 1 };
      });
    };
    next = reorder(reorder(next, task.status), toStatus);
    void persistReorder(
      next,
      previous,
      toStatus === "done" ? "Task completed. Nicely done." : undefined,
    );
  }

  async function saveTask() {
    if (pending) return;
    if (!title.trim()) {
      setFormError("Give the task a title.");
      return;
    }
    setFormError("");
    setPending(true);
    const payload = {
      title: title.trim(),
      notes: notes.trim(),
      status,
      priority,
      projectId: projectId || null,
      dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
    };
    try {
      if (editing) {
        const data = await api<{ task: Task }>(`/api/tasks/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setTasks((current) => current.map((task) => (task.id === editing.id ? data.task : task)));
        toast("Task updated.", { tone: "success" });
      } else {
        const data = await api<{ task: Task }>("/api/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setTasks((current) => [...current, data.task]);
        toast("Task added to the board.", { tone: "success", title: "Task created" });
      }
      setModalOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function quickComplete(task: Task) {
    const previous = tasks;
    setTasks((current) =>
      current.map((entry) => (entry.id === task.id ? { ...entry, status: "done" } : entry)),
    );
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
      toast("Task completed.", { tone: "success" });
      router.refresh();
    } catch (error) {
      setTasks(previous);
      toast(errorMessage(error), { tone: "error" });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deletePending) return;
    const target = deleteTarget;
    const previous = tasks;
    setDeletePending(true);
    setTasks((current) => current.filter((task) => task.id !== target.id));
    setDeleteTarget(null);
    try {
      await api(`/api/tasks/${target.id}`, { method: "DELETE" });
      toast("Task deleted.", { tone: "success" });
      router.refresh();
    } catch (error) {
      setTasks(previous);
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Planning</div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-sub">
            A quiet board for the work around the work. Drag cards between columns — changes save instantly.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn--primary" onClick={() => resetForm(null)}>
            <Plus size={15} /> New task
          </button>
        </div>
      </div>

      <div className="task-summary">
        <span className="summary-pill"><ListTodo size={12} /> <strong>{tasks.length}</strong> total</span>
        <span className="summary-pill"><CircleDot size={12} /> <strong>{openCount}</strong> open</span>
        <span className="summary-pill"><CheckCircle2 size={12} /> <strong>{doneCount}</strong> done</span>
        {overdueCount > 0 && (
          <span className="summary-pill" style={{ color: "var(--rose)" }}>
            <CalendarDays size={12} /> <strong style={{ color: "var(--rose)" }}>{overdueCount}</strong> overdue
          </span>
        )}
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <Search size={14} />
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
          />
        </div>
        <select
          className="select"
          style={{ width: 180, height: 36 }}
          value={projectFilter}
          onChange={(event) => setProjectFilter(event.target.value)}
          aria-label="Filter by project"
        >
          <option value="all">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <select
          className="select"
          style={{ width: 150, height: 36 }}
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          aria-label="Filter by priority"
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>
          ))}
        </select>
        {(query || projectFilter !== "all" || priorityFilter !== "all") && (
          <button
            type="button"
            className="chip"
            style={{ height: 36 }}
            onClick={() => {
              setQuery("");
              setProjectFilter("all");
              setPriorityFilter("all");
            }}
          >
            <X size={12} /> Reset
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nothing on the board yet"
          description="Tasks are for the small steps between ideas. Add one, or let a project's todo list live here."
          action={
            <button className="btn btn--primary" onClick={() => resetForm(null)}>
              <Plus size={15} /> Add your first task
            </button>
          }
        />
      ) : (
        <>
          <p className="board-mobile-hint">Swipe sideways to see every column · drag cards to move them</p>
          <div className="board">
            {COLUMNS.map((column) => {
              const columnTasks = sortTasks(filtered.filter((task) => task.status === column.id));
              return (
                <div
                  key={column.id}
                  className="board-col"
                  data-over={overColumn === column.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setOverColumn(column.id);
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                    setOverColumn((current) => (current === column.id ? null : current));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData("text/plain") || dragging;
                    setOverColumn(null);
                    setDragging(null);
                    if (id) moveTask(id, column.id);
                  }}
                >
                  <div className="board-col__head">
                    <span className="board-col__dot" style={{ background: column.tone, boxShadow: `0 0 8px ${column.tone}` }} />
                    <span className="board-col__name">{column.label}</span>
                    <span className="board-col__count">{columnTasks.length}</span>
                  </div>

                  <div className="board-col__body">
                    {columnTasks.length === 0 && (
                      <div className="board-col__empty">
                        {dragging ? "Drop it here" : "Nothing here yet"}
                      </div>
                    )}
                    {columnTasks.map((task) => {
                      const overdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== "done";
                      return (
                        <div
                          key={task.id}
                          className="task-card"
                          draggable
                          data-dragging={dragging === task.id}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", task.id);
                            event.dataTransfer.effectAllowed = "move";
                            setDragging(task.id);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setOverColumn(null);
                          }}
                          onClick={() => openEdit(task)}
                        >
                          <div className="task-card__title">{task.title}</div>
                          {task.projectName && (
                            <div className="task-card__project">
                              <span className="project-dot" style={{ background: "var(--accent)", width: 5, height: 5 }} />
                              <span>{task.projectName}</span>
                            </div>
                          )}
                          <div className="task-card__foot">
                            <span className={`priority priority--${task.priority}`}>
                              ● {task.priority}
                            </span>
                            {task.dueDate && (
                              <span className="task-due" data-overdue={overdue}>
                                <CalendarDays size={9} /> {overdue ? "overdue" : formatDate(task.dueDate)}
                              </span>
                            )}
                            <div className="task-card__actions" onClick={(event) => event.stopPropagation()}>
                              {task.status !== "done" && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  style={{ width: 22, height: 22 }}
                                  title="Mark complete"
                                  aria-label="Mark complete"
                                  onClick={() => quickComplete(task)}
                                >
                                  <Check size={11} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="icon-btn"
                                style={{ width: 22, height: 22 }}
                                title="Edit task"
                                aria-label="Edit task"
                                onClick={() => openEdit(task)}
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                style={{ width: 22, height: 22 }}
                                title="Delete task"
                                aria-label="Delete task"
                                onClick={() => setDeleteTarget(task)}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="board-col__foot">
                    <button
                      type="button"
                      className="add-task-btn"
                      onClick={() => resetForm(null, column.id)}
                    >
                      <Plus size={12} /> Add task
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !pending && setModalOpen(false)}
        title={editing ? "Edit task" : "New task"}
        subtitle={editing ? "Adjust details, move it, or change the priority." : "Small steps count. Add as little or as much as you like."}
        footer={
          <>
            <button className="btn" type="button" onClick={() => setModalOpen(false)} disabled={pending}>
              Cancel
            </button>
            <button className="btn btn--primary" type="button" onClick={saveTask} disabled={pending}>
              {pending && <Spinner />}
              {editing ? "Save changes" : "Create task"}
            </button>
          </>
        }
      >
        <div className="form-stack">
          <div className="field">
            <label htmlFor="task-title">Title</label>
            <input
              id="task-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ship the empty state"
              maxLength={160}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  saveTask();
                }
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="task-notes">
              Notes <span className="field__hint">optional</span>
            </label>
            <textarea
              id="task-notes"
              className="textarea"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Context, links, or the definition of done."
              maxLength={2000}
            />
          </div>
          <div className="input-row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="task-status">Column</label>
              <select
                id="task-status"
                className="select"
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
              >
                {COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>{column.label}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="task-priority">Priority</label>
              <select
                id="task-priority"
                className="select"
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="input-row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="task-project">Project</label>
              <select
                id="task-project"
                className="select"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="task-due">Due date</label>
              <input
                id="task-due"
                className="input"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
          {formError && <div className="field-error">{formError}</div>}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete “${deleteTarget?.title ?? "task"}”?`}
        description="This task will be removed from the board."
        confirmLabel="Delete task"
        pending={deletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
