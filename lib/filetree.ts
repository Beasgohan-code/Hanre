export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: { id: string; language: string };
}

export function buildTree(files: { path: string; id: string; language: string }[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };
  const dirs = new Map<string, TreeNode>([["", root]]);

  const ensureDir = (path: string): TreeNode => {
    if (dirs.has(path)) return dirs.get(path)!;
    const parts = path.split("/");
    const name = parts.pop()!;
    const parentPath = parts.join("/");
    const parent = ensureDir(parentPath);
    const node: TreeNode = { name, path, isDir: true, children: [] };
    parent.children.push(node);
    dirs.set(path, node);
    return node;
  };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    const name = parts.pop()!;
    const parent = ensureDir(parts.join("/"));
    if (files.some((other) => other.path.startsWith(file.path + "/"))) {
      ensureDir(file.path);
      continue;
    }
    parent.children.push({
      name,
      path: file.path,
      isDir: false,
      children: [],
      file: { id: file.id, language: file.language },
    });
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(root.children);
  return root.children;
}

export function flattenTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

export function listDir(files: { path: string }[], cwd: string) {
  const prefix = normalizeDir(cwd) === "/" ? "" : normalizeDir(cwd).slice(1) + "/";
  const entries = new Map<string, { name: string; isDir: boolean; path: string }>();
  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;
    const rest = file.path.slice(prefix.length);
    if (!rest) continue;
    const [name, ...more] = rest.split("/");
    const path = prefix + name;
    entries.set(path, { name, isDir: more.length > 0, path });
  }
  return [...entries.values()].sort((a, b) =>
    a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
  );
}

export function normalizeDir(path: string): string {
  const clean = ("/" + path).replace(/\/+/g, "/");
  return clean.length > 1 && clean.endsWith("/") ? clean.slice(0, -1) : clean;
}

export function resolvePath(cwd: string, target = "."): string {
  if (target.startsWith("/")) return normalizeDir(target);
  if (!target || target === ".") return normalizeDir(cwd);
  const parts = normalizeDir(cwd).split("/").filter(Boolean);
  for (const segment of target.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return "/" + parts.join("/");
}

export function relativePath(from: string, to: string): string {
  const base = normalizeDir(from);
  return to.startsWith(base + "/") ? to.slice(base.length + 1) : to;
}
