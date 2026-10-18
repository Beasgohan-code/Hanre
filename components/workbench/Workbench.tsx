"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Beaker, ChevronRight, Download, FileArchive, FileCode2, FilePlus2, GitBranch, History,
  Loader2, Menu, MoreVertical, PanelRight, Play, Replace, Save, Search, Settings2, Share2,
  TerminalSquare, Trash2, Upload, X,
} from "lucide-react";
import type { FileVersion, Project, ProjectFile, Share, UserPrefs } from "@/lib/types";
import { languageForPath, LANGUAGES } from "@/lib/types";
import { api, errorMessage, relativeTime } from "@/lib/client";
import { runFile as executeFile, runProjectTests, type RunResult } from "@/lib/runner";
import { usePrefs, useToast } from "@/components/studio/providers";
import { ConfirmDialog, Modal, Spinner } from "@/components/ui/kit";
import CodeEditor from "./CodeEditor";
import FileTree from "./FileTree";
import PreviewPane from "./PreviewPane";
import TerminalPane, { type TerminalHandle } from "./TerminalPane";

type RunStatus = "idle" | "running" | "success" | "error" | "unsupported";

function runCommandFor(file: ProjectFile) {
  switch (file.language) {
    case "javascript":
      return `node ${file.name}`;
    case "typescript":
      return `tsx ${file.name}`;
    case "python":
      return `python ${file.name}`;
    case "html":
    case "css":
    case "markdown":
      return `preview ${file.name}`;
    case "json":
      return `validate ${file.name}`;
    case "sql":
      return `sqlite ${file.name}`;
    case "shell":
      return `sh ${file.name}`;
    default:
      return `run ${file.name}`;
  }
}

function languageMeta(language: string) {
  return LANGUAGES.find((entry) => entry.value === language);
}

export default function Workbench({
  initialProject,
  initialFiles,
  initialFileId,
}: {
  initialProject: Project;
  initialFiles: ProjectFile[];
  initialFileId?: string;
}) {
  const router = useRouter();
  const { prefs, theme, setTheme } = usePrefs();
  const { toast } = useToast();

  const [project, setProject] = useState(initialProject);
  const [files, setFiles] = useState(initialFiles);
  const filesRef = useRef(files);
  filesRef.current = files;

  const firstFile =
    initialFiles.find((file) => file.id === initialFileId) ??
    initialFiles.find((file) => file.path === "index.html") ??
    initialFiles[0] ??
    null;
  const [activeId, setActiveId] = useState<string | null>(firstFile?.id ?? null);
  const [openIds, setOpenIds] = useState<string[]>(firstFile ? [firstFile.id] : []);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [editorToken, setEditorToken] = useState(0);

  const [bottomOpen, setBottomOpen] = useState(true);
  const [bottomHeight, setBottomHeight] = useState(240);
  const [bottomTab, setBottomTab] = useState<"output" | "terminal">("output");
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [cwd, setCwd] = useState("/");
  const [output, setOutput] = useState("");
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runNote, setRunNote] = useState("");
  const [runDuration, setRunDuration] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRefresh, setPreviewRefresh] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectMenu, setProjectMenu] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<TerminalHandle>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState("");
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [replaceCaseSensitive, setReplaceCaseSensitive] = useState(false);
  const [replaceRegex, setReplaceRegex] = useState(false);
  const [replacePending, setReplacePending] = useState(false);
  const [replaceSummary, setReplaceSummary] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFile, setHistoryFile] = useState<ProjectFile | null>(null);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<(FileVersion & { content: string }) | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);
  const [restorePending, setRestorePending] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [share, setShare] = useState<Share | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [sharePending, setSharePending] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("hanre-sync");
  const [githubMessage, setGithubMessage] = useState("");
  const [githubCreateRepo, setGithubCreateRepo] = useState(false);
  const [githubPrivate, setGithubPrivate] = useState(true);
  const [githubOpenPr, setGithubOpenPr] = useState(true);
  const [githubReviewed, setGithubReviewed] = useState(false);
  const [githubPending, setGithubPending] = useState(false);
  const [githubResult, setGithubResult] = useState<null | { repositoryUrl: string; branch: string; defaultBranch: string; commitUrl: string; pullRequestUrl: string | null; pullRequestNote: string | null; filesPushed: number; createdRepository: boolean }>(null);

  const [fileModal, setFileModal] = useState<null | { mode: "create" } | { mode: "rename"; file: ProjectFile }>(null);
  const [filePathInput, setFilePathInput] = useState("");
  const [filePending, setFilePending] = useState(false);
  const [fileError, setFileError] = useState("");
  const [deleteFileTarget, setDeleteFileTarget] = useState<ProjectFile | null>(null);
  const [deleteFilePending, setDeleteFilePending] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState(initialProject.name);
  const [settingsDescription, setSettingsDescription] = useState(initialProject.description);
  const [settingsPending, setSettingsPending] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deleteProjectPending, setDeleteProjectPending] = useState(false);

  const activeFile = files.find((file) => file.id === activeId) ?? null;

  useEffect(() => {
    if (initialProject.language === "html" && typeof window !== "undefined" && window.innerWidth > 900) {
      setPreviewOpen(true);
    }
  }, [initialProject.language]);

  useEffect(() => {
    if (!projectMenu) return;
    const handler = (event: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setProjectMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [projectMenu]);

  useEffect(() => {
    if (bottomTab === "terminal") setTerminalMounted(true);
  }, [bottomTab]);

  useEffect(() => {
    if (dirty.size > 0 && activeId && !openIds.includes(activeId)) {
      setOpenIds((current) => [activeId, ...current]);
    }
  }, [activeId, dirty.size, openIds]);

  async function saveFileById(id: string): Promise<boolean> {
    const file = filesRef.current.find((item) => item.id === id);
    if (!file) return true;
    setSaveState("saving");
    try {
      await api(`/api/files/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: file.content }),
      });
      setDirty((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setSaveState("saved");
      return true;
    } catch (error) {
      setSaveState("error");
      toast(errorMessage(error), { tone: "error", title: "Could not save file" });
      return false;
    }
  }

  async function saveDirty(ids?: string[]) {
    const targets = ids ?? [...dirtyRef.current];
    if (!targets.length) return true;
    setSaveState("saving");
    const results = await Promise.all(targets.map((id) => saveFileById(id)));
    if (results.every(Boolean)) setSaveState("saved");
    return results.every(Boolean);
  }

  useEffect(() => {
    if (!prefs.autosave) return;
    if (dirty.size === 0) return;
    const timer = setTimeout(() => {
      void saveDirty([...dirtyRef.current]);
    }, 900);
    return () => clearTimeout(timer);
  }, [dirty, prefs.autosave, files]);

  function openFile(file: ProjectFile) {
    setOpenIds((current) => (current.includes(file.id) ? current : [...current, file.id]));
    setActiveId(file.id);
    setSidebarOpen(false);
  }

  function closeTab(id: string) {
    const index = openIds.indexOf(id);
    const next = openIds.filter((entry) => entry !== id);
    setOpenIds(next);
    if (activeId === id) {
      const fallback = next[Math.min(index, Math.max(0, next.length - 1))] ?? null;
      setActiveId(fallback);
    }
  }

  function updateContent(value: string) {
    if (!activeId) return;
    setFiles((current) => current.map((file) => (file.id === activeId ? { ...file, content: value } : file)));
    setDirty((current) => new Set(current).add(activeId));
    setSaveState((current) => (current === "saving" ? current : "saved"));
  }

  async function persistRun(file: ProjectFile, result: RunResult, command: string) {
    try {
      await api("/api/runs", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          fileId: file.id,
          command,
          language: file.language,
          status: result.status,
          output: result.output.slice(0, 20000),
          durationMs: result.durationMs,
        }),
      });
    } catch {
      /* Run history is best-effort; the output is already visible. */
    }
  }

  async function handleRun() {
    if (!activeFile || running) return;
    setRunning(true);
    setBottomOpen(true);
    setBottomTab("output");
    setRunStatus("running");
    setRunNote("Starting run…");
    setOutput("");
    setRunDuration(null);
    const command = runCommandFor(activeFile);
    try {
      const result = await executeFile(activeFile, filesRef.current, (note) => setRunNote(note));
      setOutput(result.output);
      setRunStatus(result.status);
      setRunDuration(result.durationMs);
      setRunNote("");
      if (result.preview) {
        setPreviewOpen(true);
        setPreviewRefresh((value) => value + 1);
      }
      await persistRun(activeFile, result, command);
    } catch (error) {
      setRunStatus("error");
      setOutput(`✖ ${errorMessage(error)}`);
      setRunNote("");
    } finally {
      setRunning(false);
    }
  }

  async function handleRunTests() {
    if (running || testFileCount === 0) return;
    setRunning(true);
    setBottomOpen(true);
    setBottomTab("output");
    setRunStatus("running");
    setRunNote("Preparing project tests…");
    setOutput("");
    setRunDuration(null);
    try {
      const result = await runProjectTests(filesRef.current, (note) => setRunNote(note));
      setOutput(result.output);
      setRunStatus(result.status);
      setRunDuration(result.durationMs);
      setRunNote("");
      try {
        await api("/api/runs", {
          method: "POST",
          body: JSON.stringify({
            projectId: project.id,
            fileId: null,
            command: "hanre test",
            language: "workspace",
            status: result.status,
            output: result.output.slice(0, 20000),
            durationMs: result.durationMs,
          }),
        });
      } catch {
        /* Test output remains visible even if history is temporarily unavailable. */
      }
    } catch (error) {
      setRunStatus("error");
      setOutput(`✖ ${errorMessage(error)}`);
      setRunNote("");
    } finally {
      setRunning(false);
    }
  }

  function appendConsole(level: string, message: string) {
    setOutput((current) => {
      const line = `[preview:${level}] ${message}`;
      const next = current ? `${current}\n${line}` : line;
      return next.split("\n").slice(-200).join("\n");
    });
  }

  async function createFileInternal(path: string, content = "", quiet = false): Promise<ProjectFile | null> {
    try {
      const data = await api<{ file: ProjectFile }>("/api/files", {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, path, content }),
      });
      setFiles((current) => [...current, data.file]);
      if (!quiet) {
        setOpenIds((current) => [...current, data.file.id]);
        setActiveId(data.file.id);
        toast(`Created ${data.file.path}`, { tone: "success" });
      }
      return data.file;
    } catch (error) {
      if (!quiet) toast(errorMessage(error), { tone: "error", title: "Could not create file" });
      throw error;
    }
  }

  async function writeFileInternal(path: string, content: string, quiet = true): Promise<void> {
    const existing = filesRef.current.find((file) => file.path === path);
    try {
      if (!existing) {
        await createFileInternal(path, content, true);
        return;
      }
      const data = await api<{ file: ProjectFile }>(`/api/files/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      });
      setFiles((current) => current.map((file) => (file.id === existing.id ? { ...file, content } : file)));
      if (existing.id === activeId) setEditorToken((token) => token + 1);
      setDirty((current) => {
        const next = new Set(current);
        next.delete(existing.id);
        return next;
      });
      void data;
      if (!quiet) toast(`Saved ${path}`, { tone: "success" });
    } catch (error) {
      if (!quiet) toast(errorMessage(error), { tone: "error" });
      throw error;
    }
  }

  async function deleteFileInternal(path: string): Promise<void> {
    const file = filesRef.current.find((entry) => entry.path === path);
    if (!file) throw new Error(`No such file: ${path}`);
    await removeFile(file, true);
  }

  async function moveFileInternal(from: string, to: string): Promise<void> {
    const affected = filesRef.current.filter(
      (file) => file.path === from || file.path.startsWith(from + "/"),
    );
    if (!affected.length) throw new Error(`No such file: ${from}`);
    for (const file of affected) {
      const nextPath = file.path === from ? to : to + file.path.slice(from.length);
      const data = await api<{ file: ProjectFile }>(`/api/files/${file.id}`, {
        method: "PATCH",
        body: JSON.stringify({ path: nextPath, content: file.content }),
      });
      setFiles((current) => current.map((entry) => (entry.id === file.id ? data.file : entry)));
      if (file.id === activeId) setEditorToken((token) => token + 1);
    }
  }

  async function runFileFromTerminal(path: string): Promise<string> {
    const file = filesRef.current.find((entry) => entry.path === path);
    if (!file) return `No such file: ${path}`;
    const result = await executeFile(file, filesRef.current, (note) => setRunNote(note));
    setRunNote("");
    await persistRun(file, result, runCommandFor(file));
    return result.output;
  }

  async function removeFile(file: ProjectFile, quiet = false) {
    const previousFiles = filesRef.current;
    const previousOpen = openIds;
    setFiles((current) => current.filter((entry) => entry.id !== file.id));
    setOpenIds((current) => current.filter((entry) => entry !== file.id));
    setDirty((current) => {
      const next = new Set(current);
      next.delete(file.id);
      return next;
    });
    if (activeId === file.id) {
      const remaining = previousOpen.filter((id) => id !== file.id);
      setActiveId(remaining[remaining.length - 1] ?? null);
    }
    try {
      await api(`/api/files/${file.id}`, { method: "DELETE" });
      if (!quiet) toast(`Deleted ${file.path}`, { tone: "success" });
    } catch (error) {
      setFiles(previousFiles);
      setOpenIds(previousOpen);
      toast(errorMessage(error), { tone: "error", title: "Could not delete file" });
      throw error;
    }
  }

  function submitFileModal() {
    if (!filePathInput.trim() || filePending) return;
    const path = filePathInput.trim().replace(/^\/+/, "");
    if (!path || path.includes("..")) {
      setFileError("Use a relative path like src/app.js.");
      return;
    }
    setFileError("");
    setFilePending(true);
    const finish = () => {
      setFilePending(false);
      setFileModal(null);
    };
    if (fileModal?.mode === "rename") {
      const file = fileModal.file;
      const previous = filesRef.current;
      setFiles((current) =>
        current.map((entry) =>
          entry.id === file.id
            ? { ...entry, path, name: path.split("/").pop() ?? path, language: languageForPath(path) }
            : entry,
        ),
      );
      setEditorToken((token) => token + 1);
      finish();
      api(`/api/files/${file.id}`, {
        method: "PATCH",
        body: JSON.stringify({ path, content: file.content }),
      })
        .then(() => toast("File renamed.", { tone: "success" }))
        .catch((error) => {
          setFiles(previous);
          toast(errorMessage(error), { tone: "error", title: "Rename failed" });
        });
      return;
    }
    createFileInternal(path, "", false)
      .then(() => finish())
      .catch((error) => {
        setFilePending(false);
        setFileError(errorMessage(error));
      });
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!list.length) return;
    let imported = 0;
    let skipped = 0;
    for (const file of list.slice(0, 20)) {
      if (file.size > 150_000) {
        skipped += 1;
        continue;
      }
      try {
        const text = await file.text();
        if (text.includes("\u0000")) {
          skipped += 1;
          continue;
        }
        const existing = filesRef.current.find((entry) => entry.path === file.name);
        if (existing) {
          await writeFileInternal(file.name, text, true);
        } else {
          await createFileInternal(file.name, text, true);
        }
        imported += 1;
      } catch {
        skipped += 1;
      }
    }
    if (imported) {
      toast(`${imported} file${imported === 1 ? "" : "s"} uploaded${skipped ? `, ${skipped} skipped` : ""}.`, {
        tone: "success",
        title: "Upload complete",
      });
    } else {
      toast("No readable text files were found.", { tone: "error" });
    }
  }

  async function openHistory() {
    if (!activeFile) return;
    setHistoryFile(activeFile);
    setHistoryOpen(true);
    setVersions([]);
    setSelectedVersion(null);
    setVersionsLoading(true);
    try {
      const data = await api<{ versions: FileVersion[] }>(`/api/files/${activeFile.id}/versions`);
      setVersions(data.versions);
    } catch (error) {
      toast(errorMessage(error), { tone: "error", title: "Could not load history" });
    } finally {
      setVersionsLoading(false);
    }
  }

  async function viewVersion(version: FileVersion) {
    if (!historyFile) return;
    setVersionLoading(true);
    try {
      const data = await api<{ version: FileVersion & { content: string } }>(
        `/api/files/${historyFile.id}/versions?versionId=${encodeURIComponent(version.id)}`,
      );
      setSelectedVersion(data.version);
    } catch (error) {
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setVersionLoading(false);
    }
  }

  async function restoreVersion() {
    if (!historyFile || !selectedVersion || restorePending) return;
    setRestorePending(true);
    try {
      const data = await api<{ file: ProjectFile }>(`/api/files/${historyFile.id}/versions`, {
        method: "POST",
        body: JSON.stringify({ versionId: selectedVersion.id }),
      });
      setFiles((current) => current.map((entry) => (entry.id === data.file.id ? data.file : entry)));
      setDirty((current) => {
        const next = new Set(current);
        next.delete(data.file.id);
        return next;
      });
      setEditorToken((token) => token + 1);
      setHistoryOpen(false);
      toast(`Restored the version from ${relativeTime(selectedVersion.createdAt)}.`, {
        tone: "success",
        title: "Version restored",
      });
    } catch (error) {
      toast(errorMessage(error), { tone: "error", title: "Restore failed" });
    } finally {
      setRestorePending(false);
    }
  }

  async function replaceWorkspaceText() {
    if (replacePending || !replaceQuery || replaceSearch.error || replaceSearch.total === 0) return;
    setReplacePending(true);
    setReplaceSummary("");
    try {
      const saved = await saveDirty();
      if (!saved) throw new Error("Fix the save error before replacing project files.");
      const flags = replaceCaseSensitive ? "g" : "gi";
      const makePattern = () => new RegExp(replaceRegex ? replaceQuery : replaceQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
      const changes: { fileId: string; content: string }[] = [];
      let count = 0;
      for (const file of filesRef.current) {
        if (file.isDir || !file.content) continue;
        const pattern = makePattern();
        const matches = file.content.match(pattern);
        if (!matches?.length) continue;
        count += matches.length;
        changes.push({ fileId: file.id, content: file.content.replace(pattern, replaceWith) });
      }
      if (!changes.length) {
        setReplaceSummary("No matches remain to replace.");
        return;
      }
      await api(`/api/projects/${project.id}/replace`, {
        method: "POST",
        body: JSON.stringify({ changes }),
      });
      const changedIds = new Set(changes.map((change) => change.fileId));
      const nextFiles = filesRef.current.map((file) => {
        const change = changes.find((entry) => entry.fileId === file.id);
        return change ? { ...file, content: change.content } : file;
      });
      setFiles(nextFiles);
      filesRef.current = nextFiles;
      setDirty((current) => {
        const next = new Set(current);
        changedIds.forEach((id) => next.delete(id));
        return next;
      });
      if (activeId && changedIds.has(activeId)) setEditorToken((token) => token + 1);
      setReplaceSummary(`Replaced ${count.toLocaleString()} occurrence${count === 1 ? "" : "s"} across ${changes.length} file${changes.length === 1 ? "" : "s"}. Previous versions were saved to file history.`);
      toast(`Replaced ${count.toLocaleString()} occurrences in ${changes.length} files`, { tone: "success" });
    } catch (error) {
      toast(errorMessage(error), { tone: "error", title: "Could not replace text" });
    } finally {
      setReplacePending(false);
    }
  }

  async function pushToGitHub() {
    if (githubPending) return;
    setGithubPending(true);
    setGithubResult(null);
    try {
      const saved = await saveDirty();
      if (!saved) throw new Error("Fix the save error before syncing to GitHub.");
      const data = await api<NonNullable<typeof githubResult>>("/api/github/push", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          token: githubToken,
          owner: githubOwner,
          repo: githubRepo,
          branch: githubBranch,
          commitMessage: githubMessage || `Sync ${project.name} from Hanre Studio`,
          createIfMissing: githubCreateRepo,
          makePrivate: githubPrivate,
          openPullRequest: githubOpenPr,
        }),
      });
      setGithubResult(data);
      setGithubToken("");
      toast(`Pushed ${data.filesPushed} files to ${githubOwner}/${githubRepo}`, { tone: "success" });
    } catch (error) {
      toast(errorMessage(error), { tone: "error", title: "GitHub sync failed" });
    } finally {
      setGithubPending(false);
    }
  }

  function closeGithub() {
    if (githubPending) return;
    setGithubOpen(false);
    setGithubToken("");
  }

  async function openShare() {
    setShareOpen(true);
    setShareLoading(true);
    try {
      const data = await api<{ share: Share | null }>(`/api/projects/${project.id}/share`);
      setShare(data.share);
    } catch (error) {
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setShareLoading(false);
    }
  }

  async function publishShare() {
    if (sharePending) return;
    setSharePending(true);
    try {
      const data = await api<{ share: Share }>(`/api/projects/${project.id}/share`, { method: "POST" });
      setShare(data.share);
      toast("Anyone with the link can now view this project read-only.", {
        tone: "success",
        title: "Project published",
      });
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setSharePending(false);
    }
  }

  async function unpublishShare() {
    if (sharePending) return;
    setSharePending(true);
    try {
      await api(`/api/projects/${project.id}/share`, { method: "DELETE" });
      setShare(null);
      toast("The public link stopped working.", { tone: "info", title: "Share revoked" });
    } catch (error) {
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setSharePending(false);
    }
  }

  async function copyShareLink() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/s/${share.slug}`);
      toast("Share link copied to your clipboard.", { tone: "success" });
    } catch {
      toast("Copy failed — select the link and copy it manually.", { tone: "error" });
    }
  }

  async function handleZipUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const archive = event.target.files?.[0];
    event.target.value = "";
    if (!archive) return;
    if (archive.size > 8_000_000) {
      toast("Keep zip archives under 8 MB.", { tone: "error" });
      return;
    }
    try {
      const { unzipSync, strFromU8 } = await import("fflate");
      const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));
      const paths = Object.keys(entries)
        .filter((path) => !/(^|\/)(__MACOSX|node_modules|\.git|dist|build)(\/|$)/.test(path))
        .filter((path) => !path.endsWith("/") && !/\.(png|jpe?g|gif|webp|ico|pdf|zip|woff2?|ttf|otf|mp[34]|wasm)$/i.test(path))
        .slice(0, 60);
      let imported = 0;
      let skipped = 0;
      for (const rawPath of paths) {
        const data = entries[rawPath];
        const path = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
        if (!data || data.length > 200_000 || data.slice(0, 800).includes(0) || !path) {
          skipped += 1;
          continue;
        }
        try {
          const text = strFromU8(data);
          const existing = filesRef.current.find((file) => file.path === path);
          if (existing) await writeFileInternal(path, text, true);
          else await createFileInternal(path, text, true);
          imported += 1;
        } catch {
          skipped += 1;
        }
      }
      if (imported) {
        toast(`${imported} file${imported === 1 ? "" : "s"} imported${skipped ? `, ${skipped} skipped` : ""}.`, {
          tone: "success",
          title: "Zip imported",
        });
      } else {
        toast("No readable text files were found in that archive.", { tone: "error" });
      }
    } catch {
      toast("That archive could not be read. Make sure it is a valid .zip file.", { tone: "error" });
    }
  }

  async function saveProjectSettings() {
    if (settingsPending) return;
    setSettingsPending(true);
    try {
      const data = await api<{ project: Project }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: settingsName.trim(), description: settingsDescription.trim() }),
      });
      setProject(data.project);
      setProjectSettingsOpen(false);
      toast("Project details updated.", { tone: "success" });
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setSettingsPending(false);
    }
  }

  async function deleteProject() {
    if (deleteProjectPending) return;
    setDeleteProjectPending(true);
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      toast(`“${project.name}” was deleted.`, { tone: "success" });
      router.push("/projects");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), { tone: "error" });
      setDeleteProjectPending(false);
    }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setReplaceQuery("");
        setReplaceWith("");
        setReplaceSummary("");
        setReplaceOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setQuickQuery("");
        setQuickOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDirty();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !typing) {
        event.preventDefault();
        void handleRun();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "`") {
        event.preventDefault();
        setBottomOpen(true);
        setBottomTab((current) => (current === "terminal" ? "output" : "terminal"));
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function startResize(event: React.PointerEvent) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = bottomHeight;
    const move = (moveEvent: PointerEvent) => {
      const next = startHeight + (startY - moveEvent.clientY);
      setBottomHeight(Math.max(110, Math.min(next, window.innerHeight * 0.7)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const terminalProps = {
    projectName: project.name,
    userName: "you",
    cwd,
    setCwd,
    files,
    dirtyPaths: files.filter((file) => dirty.has(file.id)).map((file) => file.path),
    theme,
    setTheme: (next: "dark" | "light") => setTheme(next),
    openFile: (path: string) => {
      const file = filesRef.current.find((entry) => entry.path === path);
      if (file) openFile(file);
    },
    runFile: runFileFromTerminal,
    createFile: async (path: string, content?: string) => {
      await createFileInternal(path, content ?? "", true);
    },
    writeFile: async (path: string, content: string) => {
      await writeFileInternal(path, content, true);
    },
    deletePath: deleteFileInternal,
    movePath: moveFileInternal,
  };

  const testFileCount = useMemo(
    () => files.filter((file) => !file.isDir && /\.(?:test|spec)\.(?:js|mjs|cjs|ts|py)$/i.test(file.path)).length,
    [files],
  );

  const quickResults = useMemo(() => {
    const needle = quickQuery.trim().toLowerCase();
    return files
      .filter((file) => !needle || file.path.toLowerCase().includes(needle))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 40);
  }, [files, quickQuery]);
  const replaceSearch = useMemo(() => {
    const query = replaceQuery;
    if (!query) return { matches: [] as { file: ProjectFile; line: number; snippet: string; count: number }[], total: 0, matchedFiles: 0, error: "" };
    let expression: RegExp;
    try {
      if (replaceRegex && /\([^)]*(?:[*+?]|\{\d)[^)]*\)(?:[*+?]|\{\d)/.test(query)) {
        throw new Error("Nested repetition patterns are disabled to protect the editor from slow searches.");
      }
      const source = replaceRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expression = new RegExp(source, replaceCaseSensitive ? "g" : "gi");
    } catch (error) {
      return { matches: [] as { file: ProjectFile; line: number; snippet: string; count: number }[], total: 0, matchedFiles: 0, error: error instanceof Error ? error.message : "Invalid regular expression." };
    }
    const matches: { file: ProjectFile; line: number; snippet: string; count: number }[] = [];
    let total = 0;
    let matchedFiles = 0;
    for (const file of files) {
      if (file.isDir || !file.content) continue;
      const lines = file.content.split("\n");
      let fileHasMatch = false;
      for (let index = 0; index < lines.length; index += 1) {
        const count = (lines[index].match(expression) ?? []).length;
        if (count) {
          fileHasMatch = true;
          total += count;
          if (matches.length < 200) matches.push({ file, line: index + 1, snippet: lines[index].trim().slice(0, 180), count });
        }
      }
      if (fileHasMatch) matchedFiles += 1;
    }
    return { matches, total, matchedFiles, error: "" };
  }, [files, replaceQuery, replaceRegex, replaceCaseSensitive]);
  const shareUrl = share ? (typeof window !== "undefined" ? `${window.location.origin}/s/${share.slug}` : `/s/${share.slug}`) : "";
  const outputLines = useMemo(() => output.split("\n"), [output]);
  const meta = activeFile ? languageMeta(activeFile.language) : null;
  const dirtyPathsCount = dirty.size;
  const savedLabel = saveState === "saving" ? "Saving…" : dirtyPathsCount ? "Unsaved changes" : "Saved";

  return (
    <div className="page workbench-page">
      <div className="workbench">
        <div className="wb-head">
          <Link href="/projects" className="wb-back" aria-label="Back to projects">
            <ArrowLeft size={15} />
          </Link>

          <button
            type="button"
            className="icon-btn wb-mobile-toggle"
            onClick={() => setSidebarOpen((current) => !current)}
            aria-label="Toggle file explorer"
          >
            <Menu size={16} />
          </button>

          <div className="wb-head__title">
            <span className="project-dot" style={{ background: project.color, boxShadow: `0 0 10px ${project.color}` }} />
            <h1>{project.name}</h1>
            <span className="badge">{meta?.label ?? project.language}</span>
            <span className="wb-saved" data-state={saveState === "error" ? "error" : dirtyPathsCount === 0 ? "saved" : undefined}>
              {saveState === "saving" ? <Loader2 size={10} className="spin" /> : <span className="dot" />}
              {savedLabel}
            </span>
          </div>

          <div className="wb-head__spacer" />

          <div className="wb-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleRun}
              disabled={!activeFile || running}
              title="Run the open file (⌘↵)"
            >
              {running ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
              <span className="btn-label">{running ? "Running" : "Run"}</span>
            </button>
            <button
              type="button"
              className="btn btn--sm wb-test-action"
              onClick={() => void handleRunTests()}
              disabled={running || testFileCount === 0}
              title={testFileCount ? `Run ${testFileCount} project test file${testFileCount === 1 ? "" : "s"}` : "Add *.test.js, *.spec.ts, or *.test.py files to enable tests"}
            >
              {running ? <Loader2 size={13} className="spin" /> : <Beaker size={13} />}
              <span className="btn-label">Test{testFileCount ? ` · ${testFileCount}` : ""}</span>
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => void saveDirty()}
              disabled={!activeFile}
              title="Save (⌘S)"
            >
              <Save size={13} />
              <span className="btn-label">Save</span>
            </button>
            <button
              type="button"
              className="icon-btn wb-hide-sm"
              onClick={() => {
                setReplaceQuery("");
                setReplaceWith("");
                setReplaceSummary("");
                setReplaceOpen(true);
              }}
              title="Find and replace in project (⌘⇧F)"
              aria-label="Find and replace in project"
            >
              <Replace size={15} />
            </button>
            <button
              type="button"
              className="icon-btn wb-hide-sm"
              onClick={() => {
                setQuickQuery("");
                setQuickOpen(true);
              }}
              title="Go to file (⌘P)"
              aria-label="Go to file"
            >
              <Search size={15} />
            </button>
            <button
              type="button"
              className="icon-btn wb-hide-sm"
              onClick={() => void openHistory()}
              disabled={!activeFile}
              title="File history"
              aria-label="File history"
            >
              <History size={15} />
            </button>
            <button
              type="button"
              className="icon-btn wb-hide-sm"
              onClick={() => {
                setGithubResult(null);
                setGithubReviewed(false);
                setGithubOpen(true);
              }}
              title="Sync to GitHub"
              aria-label="Sync to GitHub"
            >
              <GitBranch size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => void openShare()}
              title="Share this project"
              aria-label="Share this project"
            >
              <Share2 size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              data-active={previewOpen}
              onClick={() => setPreviewOpen((current) => !current)}
              title="Toggle preview"
              aria-label="Toggle preview"
            >
              <PanelRight size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              data-active={bottomOpen}
              onClick={() => {
                setBottomOpen(true);
                setBottomTab("terminal");
              }}
              title="Terminal (⌘`)"
              aria-label="Open terminal"
            >
              <TerminalSquare size={15} />
            </button>
            <a
              className="icon-btn"
              href={`/api/export/${project.id}`}
              title="Download project as .zip"
              aria-label="Download project as zip"
            >
              <Download size={15} />
            </a>
            <div className="dropdown" ref={projectMenuRef}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setProjectMenu((current) => !current)}
                aria-label="Project menu"
              >
                <MoreVertical size={15} />
              </button>
              {projectMenu && (
                <div className="dropdown__panel">
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setSettingsName(project.name);
                      setSettingsDescription(project.description);
                      setProjectSettingsOpen(true);
                      setProjectMenu(false);
                    }}
                  >
                    <Settings2 size={14} /> Project settings
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      uploadRef.current?.click();
                      setProjectMenu(false);
                    }}
                  >
                    <Upload size={14} /> Upload files
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      setFileModal({ mode: "create" });
                      setFilePathInput("");
                      setFileError("");
                      setProjectMenu(false);
                    }}
                  >
                    <FilePlus2 size={14} /> New file
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      zipRef.current?.click();
                      setProjectMenu(false);
                    }}
                  >
                    <FileArchive size={14} /> Import .zip archive
                  </button>
                  <div className="menu-sep" />
                  <button
                    type="button"
                    className="menu-item menu-item--danger"
                    onClick={() => {
                      setDeleteProjectOpen(true);
                      setProjectMenu(false);
                    }}
                  >
                    <Trash2 size={14} /> Delete project
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="wb-body">
          <aside className="wb-side" data-open={sidebarOpen}>
            <div className="wb-side__head">
              <span className="wb-side__label">Explorer</span>
              <div className="wb-side__actions">
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 24, height: 24 }}
                  title="New file"
                  onClick={() => {
                    setFilePathInput("");
                    setFileError("");
                    setFileModal({ mode: "create" });
                  }}
                >
                  <FilePlus2 size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn wb-upload"
                  style={{ width: 24, height: 24 }}
                  title="Upload files"
                  onClick={() => uploadRef.current?.click()}
                >
                  <Upload size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 24, height: 24 }}
                  title="Project menu"
                  onClick={() => setProjectMenu((current) => !current)}
                >
                  <MoreVertical size={13} />
                </button>
              </div>
            </div>

            <FileTree
              files={files}
              activeId={activeId}
              dirtyIds={dirty}
              onOpen={openFile}
              onCreate={() => {
                setFilePathInput("");
                setFileError("");
                setFileModal({ mode: "create" });
              }}
              onRename={(file) => {
                setFilePathInput(file.path);
                setFileError("");
                setFileModal({ mode: "rename", file });
              }}
              onDelete={(file) => setDeleteFileTarget(file)}
            />

            <div className="wb-side__foot">
              <span>⌘S save · ⌘↵ run · ⌘` terminal</span>
            </div>
          </aside>

          {sidebarOpen && (
            <div
              className="wb-side-backdrop"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
          )}

          <div className="wb-main">
            <div className="wb-tabs">
              {openIds.map((id) => {
                const file = files.find((entry) => entry.id === id);
                if (!file) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className="wb-tab"
                    data-active={id === activeId}
                    onClick={() => setActiveId(id)}
                    title={file.path}
                  >
                    {dirty.has(id) && <span className="wb-tab__dot" />}
                    <span>{file.name}</span>
                    <span
                      className="wb-tab__close"
                      role="button"
                      tabIndex={0}
                      aria-label={`Close ${file.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTab(id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.stopPropagation();
                          closeTab(id);
                        }
                      }}
                    >
                      <X size={11} />
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                className="wb-tab-add"
                title="New file"
                onClick={() => {
                  setFilePathInput("");
                  setFileError("");
                  setFileModal({ mode: "create" });
                }}
              >
                <FilePlus2 size={13} />
              </button>
            </div>

            <div className="wb-upper">
              <div className="wb-editor">
                {activeFile ? (
                  <CodeEditor
                    key={`${activeFile.id}-${activeFile.language}`}
                    fileId={activeFile.id}
                    value={activeFile.content}
                    language={activeFile.language}
                    prefs={prefs}
                    theme={theme}
                    reloadToken={editorToken}
                    onChange={updateContent}
                    onCursor={(line, column) => setCursor({ line, column })}
                    onSave={() => void saveDirty()}
                    onRun={() => void handleRun()}
                  />
                ) : (
                  <div className="editor-empty">
                    <FileCode2 size={24} />
                    <h3>No file open</h3>
                    <p>Pick a file from the explorer, or create a new one to start writing.</p>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => {
                        setFilePathInput("");
                        setFileError("");
                        setFileModal({ mode: "create" });
                      }}
                    >
                      <FilePlus2 size={13} /> New file
                    </button>
                  </div>
                )}
              </div>

              {previewOpen && (
                <PreviewPane
                  files={files}
                  activeFile={activeFile}
                  open={previewOpen}
                  onClose={() => setPreviewOpen(false)}
                  onConsole={appendConsole}
                  refreshToken={previewRefresh}
                />
              )}
            </div>

            {bottomOpen && (
              <>
                <div className="wb-resizer" onPointerDown={startResize} role="separator" aria-label="Resize output panel" />
                <div className="wb-bottom" style={{ height: bottomHeight }}>
                  <div className="pane-tabs">
                    <button
                      type="button"
                      className="pane-tab"
                      data-active={bottomTab === "output"}
                      onClick={() => setBottomTab("output")}
                    >
                      <ChevronRight size={11} /> Output
                      {runStatus !== "idle" && runStatus !== "running" && (
                        <span className="pane-tab__count" data-error={runStatus === "error"}>
                          {runStatus === "error" ? "!" : "✓"}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="pane-tab"
                      data-active={bottomTab === "terminal"}
                      onClick={() => setBottomTab("terminal")}
                    >
                      <TerminalSquare size={11} /> Terminal
                    </button>
                    <div style={{ flex: 1 }} />
                    <div className="row gap-6" style={{ padding: "0 8px" }}>
                      {runStatus !== "idle" && (
                        <span className="status-pill" data-status={runStatus}>
                          {runStatus === "running" && <Loader2 size={9} className="spin" />}
                          {runStatus === "running" ? "running" : runStatus}
                          {runDuration !== null && runStatus !== "running" ? ` · ${runDuration}ms` : ""}
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        style={{ height: 24, fontSize: 10.5 }}
                        onClick={() => {
                          if (bottomTab === "terminal") terminalRef.current?.clear();
                          else {
                            setOutput("");
                            setRunStatus("idle");
                            setRunDuration(null);
                          }
                        }}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 22, height: 22 }}
                        onClick={() => setBottomOpen(false)}
                        aria-label="Hide panel"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="pane-body">
                    <div
                      style={{
                        display: bottomTab === "output" ? "flex" : "none",
                        flex: 1,
                        minHeight: 0,
                        flexDirection: "column",
                      }}
                    >
                      <div className="output-head">
                        {runNote ? (
                          <>
                            <Loader2 size={10} className="spin" /> {runNote}
                          </>
                        ) : (
                          <>
                            <span className="dot" style={{ background: runStatus === "error" ? "var(--rose)" : runStatus === "success" ? "var(--mint)" : "var(--faint)" }} />
                            {activeFile ? `${runCommandFor(activeFile)} · ${activeFile.path}` : "No file selected"}
                            {runDuration !== null && <span style={{ marginLeft: "auto" }}>{runDuration}ms</span>}
                          </>
                        )}
                      </div>
                      <div className="output-view">
                        {outputLines.map((line, index) => {
                          let className = "";
                          if (/^(✖|error|\[preview:error\])/i.test(line.trim())) className = "output-line--error";
                          else if (/^(✓|\[x\]|success)/i.test(line.trim())) className = "output-line--success";
                          else if (/^(⚠|warning)/i.test(line.trim())) className = "output-line--warn";
                          else if (/^\[preview:/.test(line.trim())) className = "output-line--muted";
                          else if (index === 0 && !output) className = "output-line--muted";
                          return (
                            <div key={`${index}-${line.slice(0, 12)}`} className={className}>
                              {line || "\u00a0"}
                            </div>
                          );
                        })}
                        {!output && !runNote && (
                          <div className="output-line--muted">
                            {activeFile
                              ? `Ready. Press ⌘↵ (Ctrl+Enter) to run ${activeFile.name}.`
                              : "Open a file to run it. Every run is saved to your history."}
                          </div>
                        )}
                      </div>
                    </div>

                    {terminalMounted && (
                      <div
                        style={{
                          display: bottomTab === "terminal" ? "flex" : "none",
                          flex: 1,
                          minHeight: 0,
                          flexDirection: "column",
                        }}
                      >
                        <TerminalPane ref={terminalRef} {...terminalProps} />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="wb-statusbar">
              <span className="wb-statusbar__item" style={{ color: "var(--mint)" }}>
                <span className="dot" /> main
              </span>
              <span className="wb-statusbar__item">{files.length} files</span>
              <span className="wb-statusbar__item hide-sm">UTF-8</span>
              <span className="wb-statusbar__item hide-sm">Spaces: {prefs.tabSize ?? 2}</span>
              <span className="wb-statusbar__spacer" />
              {activeFile && (
                <>
                  <span className="wb-statusbar__item">{meta?.label ?? activeFile.language}</span>
                  <span className="wb-statusbar__item">Ln {cursor.line}, Col {cursor.column}</span>
                  <span className="wb-statusbar__item" data-accent={dirtyPathsCount === 0}>
                    {dirtyPathsCount ? "● modified" : "✓ saved"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={fileModal !== null}
        onClose={() => !filePending && setFileModal(null)}
        title={fileModal?.mode === "rename" ? "Rename file" : "New file"}
        subtitle={
          fileModal?.mode === "rename"
            ? "Move the file to a new path. Folders are created automatically."
            : "Use a path like src/utils.js — folders are created for you."
        }
        footer={
          <>
            <button className="btn" type="button" onClick={() => setFileModal(null)} disabled={filePending}>
              Cancel
            </button>
            <button className="btn btn--primary" type="button" onClick={submitFileModal} disabled={filePending}>
              {filePending && <Spinner />}
              {fileModal?.mode === "rename" ? "Save path" : "Create file"}
            </button>
          </>
        }
      >
        <div className="form-stack">
          <div className="field">
            <label htmlFor="file-path">File path</label>
            <input
              id="file-path"
              className="input mono"
              value={filePathInput}
              onChange={(event) => setFilePathInput(event.target.value)}
              placeholder="src/components/Button.jsx"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitFileModal();
                }
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="field__hint">
              {filePathInput
                ? `Detected language: ${LANGUAGES.find((entry) => entry.value === languageForPath(filePathInput))?.label ?? "Plain text"}`
                : "Extensions pick the editor mode and the runner."}
            </span>
          </div>
          {fileError && <div className="field-error">{fileError}</div>}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteFileTarget !== null}
        title={`Delete ${deleteFileTarget?.name ?? "file"}?`}
        description={`${deleteFileTarget?.path ?? "This file"} will be removed from the project. This cannot be undone.`}
        confirmLabel="Delete file"
        pending={deleteFilePending}
        onCancel={() => setDeleteFileTarget(null)}
        onConfirm={async () => {
          if (!deleteFileTarget) return;
          setDeleteFilePending(true);
          try {
            await removeFile(deleteFileTarget);
            setDeleteFileTarget(null);
          } finally {
            setDeleteFilePending(false);
          }
        }}
      />

      <Modal
        open={projectSettingsOpen}
        onClose={() => setProjectSettingsOpen(false)}
        title="Project settings"
        subtitle="Rename the project or update the one-line description."
        footer={
          <>
            <button className="btn" type="button" onClick={() => setProjectSettingsOpen(false)}>
              Cancel
            </button>
            <button className="btn btn--primary" type="button" onClick={saveProjectSettings} disabled={settingsPending}>
              {settingsPending && <Spinner />} Save changes
            </button>
          </>
        }
      >
        <div className="form-stack">
          <div className="field">
            <label htmlFor="wb-project-name">Project name</label>
            <input
              id="wb-project-name"
              className="input"
              value={settingsName}
              onChange={(event) => setSettingsName(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="field">
            <label htmlFor="wb-project-desc">Description</label>
            <textarea
              id="wb-project-desc"
              className="textarea"
              rows={3}
              value={settingsDescription}
              onChange={(event) => setSettingsDescription(event.target.value)}
              maxLength={400}
            />
          </div>
          <div className="field__hint">
            Created {relativeTime(project.createdAt)} · {files.length} files · exported as a .zip anytime.
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteProjectOpen}
        title={`Delete “${project.name}”?`}
        description="Every file inside this project will be deleted. Export the project first if you want to keep a copy."
        confirmLabel="Delete project"
        pending={deleteProjectPending}
        onCancel={() => setDeleteProjectOpen(false)}
        onConfirm={deleteProject}
      />

      <Modal
        open={replaceOpen}
        onClose={() => !replacePending && setReplaceOpen(false)}
        title="Find and replace in project"
        subtitle="Search all text files, preview matches, and apply a versioned replace across the workspace."
        footer={
          <>
            <button className="btn" type="button" onClick={() => setReplaceOpen(false)} disabled={replacePending}>Close</button>
            <button className="btn btn--primary" type="button" onClick={() => void replaceWorkspaceText()} disabled={replacePending || !replaceQuery || !!replaceSearch.error || replaceSearch.total === 0 || replaceSearch.matchedFiles > 70}>
              {replacePending && <Spinner />} Replace all {replaceSearch.total ? `(${replaceSearch.total})` : ""}
            </button>
          </>
        }
      >
        <div className="form-stack workspace-replace">
          <div className="field">
            <label htmlFor="workspace-find">Find</label>
            <input id="workspace-find" className="input mono" autoFocus maxLength={250} value={replaceQuery} onChange={(event) => { setReplaceQuery(event.target.value); setReplaceSummary(""); }} placeholder="Search in every file…" />
          </div>
          <div className="field">
            <label htmlFor="workspace-replace">Replace with</label>
            <input id="workspace-replace" className="input mono" value={replaceWith} onChange={(event) => { setReplaceWith(event.target.value); setReplaceSummary(""); }} placeholder="Replacement text" />
          </div>
          <div className="form-grid">
            <label className="check-row"><input type="checkbox" checked={replaceCaseSensitive} onChange={(event) => setReplaceCaseSensitive(event.target.checked)} /> Case sensitive</label>
            <label className="check-row"><input type="checkbox" checked={replaceRegex} onChange={(event) => setReplaceRegex(event.target.checked)} /> Regular expression</label>
          </div>
          {replaceSearch.error ? (
            <p className="replace-error">Invalid pattern: {replaceSearch.error}</p>
          ) : replaceQuery && replaceSearch.matchedFiles > 70 ? (
            <p className="replace-error">Matches span {replaceSearch.matchedFiles} files. Narrow the search to 70 files or fewer before replacing.</p>
          ) : replaceQuery ? (
            <p className="muted-sm">{replaceSearch.total.toLocaleString()} match{replaceSearch.total === 1 ? "" : "es"} in {replaceSearch.matchedFiles} file{replaceSearch.matchedFiles === 1 ? "" : "s"} {replaceSearch.matches.length === 200 && "· showing first 200 matching lines"}</p>
          ) : (
            <p className="muted-sm">Type a search term. Regular expressions are optional; literal search is the default.</p>
          )}
          {replaceSummary && <div className="notice notice--success">{replaceSummary}</div>}
          <div className="replace-results">
            {replaceSearch.matches.length ? replaceSearch.matches.map((match, index) => (
              <button key={`${match.file.id}:${match.line}:${index}`} type="button" className="replace-result" onClick={() => { openFile(match.file); setReplaceOpen(false); }}>
                <span className="replace-result__path">{match.file.path}<small>Line {match.line}{match.count > 1 ? ` · ${match.count} matches` : ""}</small></span>
                <code>{match.snippet || "(blank line)"}</code>
              </button>
            )) : replaceQuery && !replaceSearch.error ? <p className="muted-sm">No matching text in this project.</p> : null}
          </div>
          <p className="muted-sm">⌘⇧F / Ctrl+Shift+F · Each changed file gets a history snapshot before the replace.</p>
        </div>
      </Modal>

      <Modal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        title="Go to file"
        subtitle="Jump to any file by name or path."
      >
        <div className="quick-open">
          <div className="toolbar__search">
            <Search size={14} />
            <input
              className="input"
              value={quickQuery}
              onChange={(event) => setQuickQuery(event.target.value)}
              placeholder="Type a file name…"
              aria-label="Search files"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && quickResults[0]) {
                  event.preventDefault();
                  openFile(quickResults[0]);
                  setQuickOpen(false);
                }
              }}
            />
          </div>
          <div className="quick-open__list">
            {quickResults.length === 0 ? (
              <p className="muted-sm" style={{ padding: "14px 10px" }}>No files match that search.</p>
            ) : (
              quickResults.map((file, index) => (
                <button
                  key={file.id}
                  type="button"
                  className="quick-open__row"
                  data-first={index === 0}
                  onClick={() => {
                    openFile(file);
                    setQuickOpen(false);
                  }}
                >
                  <FileCode2 size={13} style={{ color: LANGUAGES.find((entry) => entry.value === file.language)?.color }} />
                  <span>{file.path}</span>
                  {dirty.has(file.id) && <span className="wb-tab__dot" />}
                </button>
              ))
            )}
          </div>
          <p className="muted-sm quick-open__hint">⌘P anywhere in the editor · Enter opens the first match</p>
        </div>
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`History · ${historyFile?.name ?? "file"}`}
        subtitle="Every save keeps the previous version. Pick one to inspect or restore it."
        footer={
          <>
            <button className="btn" type="button" onClick={() => setHistoryOpen(false)}>Close</button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => void restoreVersion()}
              disabled={!selectedVersion || restorePending}
            >
              {restorePending && <Spinner />} Restore selected
            </button>
          </>
        }
      >
        <div className="history-panel">
          {versionsLoading ? (
            <p className="muted-sm" style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 0" }}>
              <Spinner /> Loading saved versions…
            </p>
          ) : versions.length === 0 ? (
            <p className="muted-sm" style={{ lineHeight: 1.7 }}>
              No earlier versions yet. Once you edit and save this file, the previous content appears here.
            </p>
          ) : (
            <div className="history-list">
              {versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  className="history-row"
                  data-active={selectedVersion?.id === version.id}
                  onClick={() => void viewVersion(version)}
                >
                  <History size={13} />
                  <span className="history-row__time">{relativeTime(version.createdAt)}</span>
                  <span className="history-row__preview">{version.preview || "Empty file"}</span>
                  <span className="history-row__size">{version.size} B</span>
                </button>
              ))}
            </div>
          )}
          {versionLoading && (
            <p className="muted-sm" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Spinner /> Loading version…
            </p>
          )}
          {selectedVersion && !versionLoading && (
            <pre className="history-preview">{selectedVersion.content.slice(0, 4000) || "This version was empty."}</pre>
          )}
        </div>
      </Modal>

      <Modal
        open={githubOpen}
        onClose={closeGithub}
        title="Sync to GitHub"
        subtitle="Push a snapshot of this project, then optionally open a pull request. Your token is used for this request only and is never saved."
        footer={
          <>
            <button className="btn" type="button" onClick={closeGithub} disabled={githubPending}>Close</button>
            <button className="btn btn--primary" type="button" onClick={() => void pushToGitHub()} disabled={githubPending || !githubToken || !githubOwner || !githubRepo || !githubBranch || !githubReviewed}>
              {githubPending && <Spinner />} {githubPending ? "Syncing…" : "Push project"}
            </button>
          </>
        }
      >
        <div className="form-stack">
          {githubResult ? (
            <div className="form-stack">
              <div className="notice notice--success">Synced {githubResult.filesPushed} files to <strong>{githubResult.repositoryUrl.split("/").slice(-2).join("/")}</strong> on <code className="mono">{githubResult.branch}</code>.</div>
              <a className="btn btn--outline" href={githubResult.commitUrl} target="_blank" rel="noreferrer">View commit on GitHub</a>
              {githubResult.pullRequestUrl && <a className="btn btn--outline" href={githubResult.pullRequestUrl} target="_blank" rel="noreferrer">Open pull request</a>}
              {githubResult.pullRequestNote && <p className="muted-sm">{githubResult.pullRequestNote}</p>}
              {githubResult.createdRepository && <p className="muted-sm">A new repository was created on GitHub.</p>}
              <button className="btn" type="button" onClick={() => setGithubResult(null)}>Sync again</button>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="github-token">Personal access token</label>
                <input id="github-token" className="input mono" type="password" autoComplete="off" spellCheck={false} placeholder="github_pat_…" value={githubToken} onChange={(event) => setGithubToken(event.target.value)} />
                <span className="field__hint">For an existing repo, use a fine-grained token scoped to that repo with Contents read/write. Creating a new repo may require a classic token with repo access. <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Create a token ↗</a></span>
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="github-owner">Owner</label><input id="github-owner" className="input" autoComplete="off" placeholder="your-username" value={githubOwner} onChange={(event) => setGithubOwner(event.target.value)} /></div>
                <div className="field"><label htmlFor="github-repo">Repository</label><input id="github-repo" className="input" autoComplete="off" placeholder="my-project" value={githubRepo} onChange={(event) => setGithubRepo(event.target.value)} /></div>
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="github-branch">Push to branch</label><input id="github-branch" className="input mono" value={githubBranch} onChange={(event) => setGithubBranch(event.target.value)} /></div>
                <div className="field"><label htmlFor="github-message">Commit message</label><input id="github-message" className="input" placeholder={`Sync ${project.name} from Hanre Studio`} value={githubMessage} onChange={(event) => setGithubMessage(event.target.value)} /></div>
              </div>
              <label className="check-row"><input type="checkbox" checked={githubCreateRepo} onChange={(event) => setGithubCreateRepo(event.target.checked)} /> Create repository if it does not exist</label>
              {githubCreateRepo && <label className="check-row"><input type="checkbox" checked={githubPrivate} onChange={(event) => setGithubPrivate(event.target.checked)} /> Keep new repository private</label>}
              <label className="check-row"><input type="checkbox" checked={githubOpenPr} onChange={(event) => setGithubOpenPr(event.target.checked)} /> Open a pull request when pushing to a non-default branch</label>
              <p className="muted-sm" style={{ lineHeight: 1.6 }}>This uploads up to 70 text files (2 MB total). It adds or updates files; it does not delete remote files. Review your files first: credentials, API keys, and private data will be uploaded too. Never use a token with more permissions than needed.</p>
              <label className="check-row"><input type="checkbox" checked={githubReviewed} onChange={(event) => setGithubReviewed(event.target.checked)} /> I reviewed the project files and confirmed they are safe to upload</label>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share this project"
        subtitle="Publish a read-only page with the files and live preview. No account needed to view it."
        footer={
          <>
            <button className="btn" type="button" onClick={() => setShareOpen(false)}>Done</button>
            {share ? (
              <button className="btn btn--danger" type="button" onClick={() => void unpublishShare()} disabled={sharePending}>
                {sharePending && <Spinner />} Revoke link
              </button>
            ) : (
              <button className="btn btn--primary" type="button" onClick={() => void publishShare()} disabled={shareLoading || sharePending}>
                {sharePending && <Spinner />} Publish project
              </button>
            )}
          </>
        }
      >
        {shareLoading ? (
          <p className="muted-sm" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Spinner /> Checking share status…
          </p>
        ) : share ? (
          <div className="form-stack">
            <div className="field">
              <label htmlFor="share-url">Public link</label>
              <div className="share-link">
                <input id="share-url" className="input mono" value={shareUrl} readOnly onFocus={(event) => event.target.select()} />
                <button className="btn" type="button" onClick={() => void copyShareLink()}>Copy</button>
              </div>
              <span className="field__hint">
                {share.views.toLocaleString()} view{share.views === 1 ? "" : "s"} since {relativeTime(share.createdAt)}.
              </span>
            </div>
            <a className="btn btn--outline" href={`/s/${share.slug}`} target="_blank" rel="noreferrer">
              Open the public page
            </a>
            <p className="muted-sm" style={{ lineHeight: 1.65 }}>
              Visitors see the current files and preview — never your account, runs, or tasks. Revoking the link
              takes effect immediately.
            </p>
          </div>
        ) : (
          <div className="form-stack">
            <p className="muted-sm" style={{ lineHeight: 1.7 }}>
              This creates a link like <code className="mono">/s/abc123</code> that anyone can open. Edits you make
              later show up automatically, so revoke the link when you are done. Anyone with the link can read
              every file in this project — never publish secrets.
            </p>
          </div>
        )}
      </Modal>

      <input
        ref={uploadRef}
        type="file"
        multiple
        hidden
        onChange={handleUpload}
        aria-label="Upload files"
      />
      <input
        ref={zipRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={handleZipUpload}
        aria-label="Import a zip archive"
      />
    </div>
  );
}
