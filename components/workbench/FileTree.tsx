"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown, ChevronRight, FileCode2, FilePlus2, Folder, FolderOpen, Pencil, Trash2,
} from "lucide-react";
import type { ProjectFile } from "@/lib/types";
import { LANGUAGE_COLORS } from "@/lib/types";
import { buildTree, type TreeNode } from "@/lib/filetree";

function collectDirs(nodes: TreeNode[], output: string[] = []) {
  nodes.forEach((node) => {
    if (node.isDir) {
      output.push(node.path);
      collectDirs(node.children, output);
    }
  });
  return output;
}

export default function FileTree({
  files,
  activeId,
  dirtyIds,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  compact,
}: {
  files: ProjectFile[];
  activeId: string | null;
  dirtyIds: Set<string>;
  onOpen: (file: ProjectFile) => void;
  onCreate: () => void;
  onRename: (file: ProjectFile) => void;
  onDelete: (file: ProjectFile) => void;
  compact?: boolean;
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const dirs = collectDirs(tree);
    setExpanded((current) => {
      const next = new Set(current);
      dirs.forEach((dir) => next.add(dir));
      return next;
    });
  }, [tree]);

  const toggle = (path: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path) && !collapsed.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const isOpen = expanded.has(node.path) && !collapsed.has(node.path);
      if (node.isDir) {
        return (
          <div key={node.path}>
            <button
              type="button"
              className="tree-row"
              style={{ paddingLeft: 4 + depth * 12 }}
              onClick={() => toggle(node.path)}
              aria-expanded={isOpen}
            >
              <span className="tree-row__chevron">
                {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </span>
              <span className="tree-row__icon" style={{ color: "var(--muted)" }}>
                {isOpen ? <FolderOpen size={13} /> : <Folder size={13} />}
              </span>
              <span className="tree-row__name">{node.name}</span>
            </button>
            {isOpen && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const file = files.find((item) => item.path === node.path);
      if (!file) return null;
      const color = LANGUAGE_COLORS[file.language] ?? "var(--faint)";
      return (
        <button
          key={node.path}
          type="button"
          className="tree-row"
          data-active={activeId === file.id}
          style={{ paddingLeft: 4 + depth * 12 }}
          onClick={() => onOpen(file)}
          title={file.path}
        >
          <span className="tree-row__chevron" />
          <span className="tree-row__icon" style={{ color }}>
            <FileCode2 size={13} />
          </span>
          <span className="tree-row__name" data-dirty={dirtyIds.has(file.id)}>
            {node.name}
          </span>
          <span className="tree-row__actions">
            <span
              className="tree-action"
              role="button"
              tabIndex={0}
              aria-label={`Rename ${node.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onRename(file);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.stopPropagation();
                  onRename(file);
                }
              }}
            >
              <Pencil size={11} />
            </span>
            <span
              className="tree-action tree-action--danger"
              role="button"
              tabIndex={0}
              aria-label={`Delete ${node.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(file);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.stopPropagation();
                  onDelete(file);
                }
              }}
            >
              <Trash2 size={11} />
            </span>
          </span>
        </button>
      );
    });

  if (!files.length) {
    return (
      <div style={{ padding: "26px 14px", textAlign: "center" }}>
        <p style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.6, marginBottom: 12 }}>
          This project has no files yet.
        </p>
        <button type="button" className="btn btn--sm" onClick={onCreate}>
          <FilePlus2 size={12} /> Create a file
        </button>
      </div>
    );
  }

  return <div className="file-tree">{renderNodes(tree, 0)}</div>;
}
