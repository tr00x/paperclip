import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { CompanyPortabilityExportResult } from "@paperclipai/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { companiesApi } from "../api/companies";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { MarkdownBody } from "../components/MarkdownBody";
import { cn } from "../lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Info,
  Package,
  Search,
} from "lucide-react";

// ── Tree types ────────────────────────────────────────────────────────

type FileTreeNode = {
  name: string;
  path: string;
  kind: "dir" | "file";
  children: FileTreeNode[];
};

const TREE_BASE_INDENT = 16;
const TREE_STEP_INDENT = 24;
const TREE_ROW_HEIGHT_CLASS = "min-h-9";

// ── Helpers ───────────────────────────────────────────────────────────

function buildFileTree(files: Record<string, string>): FileTreeNode[] {
  const root: FileTreeNode = { name: "", path: "", kind: "dir", children: [] };

  for (const filePath of Object.keys(files)) {
    const segments = filePath.split("/").filter(Boolean);
    let current = root;
    let currentPath = "";
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isLeaf = i === segments.length - 1;
      let next = current.children.find((c) => c.name === segment);
      if (!next) {
        next = {
          name: segment,
          path: currentPath,
          kind: isLeaf ? "file" : "dir",
          children: [],
        };
        current.children.push(next);
      }
      current = next;
    }
  }

  function sortNode(node: FileTreeNode) {
    node.children.sort((a, b) => {
      // Files before directories so PROJECT.md appears above tasks/
      if (a.kind !== b.kind) return a.kind === "file" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNode);
  }

  sortNode(root);
  return root.children;
}

function countFiles(nodes: FileTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === "file") count++;
    else count += countFiles(node.children);
  }
  return count;
}

function collectAllPaths(
  nodes: FileTreeNode[],
  type: "file" | "dir" | "all" = "all",
): Set<string> {
  const paths = new Set<string>();
  for (const node of nodes) {
    if (type === "all" || node.kind === type) paths.add(node.path);
    for (const p of collectAllPaths(node.children, type)) paths.add(p);
  }
  return paths;
}

function fileIcon(name: string) {
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return FileCode2;
  return FileText;
}

/** Returns true if the path looks like a task file (e.g. tasks/slug/TASK.md or projects/x/tasks/slug/TASK.md) */
function isTaskPath(filePath: string): boolean {
  return /(?:^|\/)tasks\//.test(filePath);
}

/** Filter tree nodes whose path (or descendant paths) match a search string */
function filterTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();
  return nodes
    .map((node) => {
      if (node.kind === "file") {
        return node.name.toLowerCase().includes(lower) || node.path.toLowerCase().includes(lower)
          ? node
          : null;
      }
      const filteredChildren = filterTree(node.children, query);
      return filteredChildren.length > 0
        ? { ...node, children: filteredChildren }
        : null;
    })
    .filter((n): n is FileTreeNode => n !== null);
}

/** Sort tree: checked files first, then unchecked */
function sortByChecked(nodes: FileTreeNode[], checkedFiles: Set<string>): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.kind === "dir") {
      return { ...node, children: sortByChecked(node.children, checkedFiles) };
    }
    return node;
  }).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "file" ? -1 : 1;
    if (a.kind === "file" && b.kind === "file") {
      const aChecked = checkedFiles.has(a.path);
      const bChecked = checkedFiles.has(b.path);
      if (aChecked !== bChecked) return aChecked ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// ── Tar helpers (reused from CompanySettings) ─────────────────────────

function createTarArchive(files: Record<string, string>, rootPath: string): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const [relativePath, contents] of Object.entries(files)) {
    const tarPath = `${rootPath}/${relativePath}`.replace(/\\/g, "/");
    const body = encoder.encode(contents);
    chunks.push(buildTarHeader(tarPath, body.length));
    chunks.push(body);
    const remainder = body.length % 512;
    if (remainder > 0) chunks.push(new Uint8Array(512 - remainder));
  }
  chunks.push(new Uint8Array(1024));
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const archive = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    archive.set(chunk, offset);
    offset += chunk.length;
  }
  return archive;
}

function buildTarHeader(pathname: string, size: number): Uint8Array {
  const header = new Uint8Array(512);
  writeTarString(header, 0, 100, pathname);
  writeTarOctal(header, 100, 8, 0o644);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, size);
  writeTarOctal(header, 136, 12, Math.floor(Date.now() / 1000));
  for (let i = 148; i < 156; i++) header[i] = 32;
  header[156] = "0".charCodeAt(0);
  writeTarString(header, 257, 6, "ustar");
  writeTarString(header, 263, 2, "00");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeTarChecksum(header, checksum);
  return header;
}

function writeTarString(target: Uint8Array, offset: number, length: number, value: string) {
  const encoded = new TextEncoder().encode(value);
  target.set(encoded.slice(0, length), offset);
}

function writeTarOctal(target: Uint8Array, offset: number, length: number, value: number) {
  const stringValue = value.toString(8).padStart(length - 1, "0");
  writeTarString(target, offset, length - 1, stringValue);
  target[offset + length - 1] = 0;
}

function writeTarChecksum(target: Uint8Array, checksum: number) {
  const stringValue = checksum.toString(8).padStart(6, "0");
  writeTarString(target, 148, 6, stringValue);
  target[154] = 0;
  target[155] = 32;
}

function downloadTar(exported: CompanyPortabilityExportResult, selectedFiles: Set<string>) {
  const filteredFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(exported.files)) {
    if (selectedFiles.has(path)) filteredFiles[path] = content;
  }
  const tarBytes = createTarArchive(filteredFiles, exported.rootPath);
  const tarBuffer = new ArrayBuffer(tarBytes.byteLength);
  new Uint8Array(tarBuffer).set(tarBytes);
  const blob = new Blob([tarBuffer], { type: "application/x-tar" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${exported.rootPath}.tar`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── File tree component ───────────────────────────────────────────────

function ExportFileTree({
  nodes,
  selectedFile,
  expandedDirs,
  checkedFiles,
  onToggleDir,
  onSelectFile,
  onToggleCheck,
  depth = 0,
}: {
  nodes: FileTreeNode[];
  selectedFile: string | null;
  expandedDirs: Set<string>;
  checkedFiles: Set<string>;
  onToggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
  onToggleCheck: (path: string, kind: "file" | "dir") => void;
  depth?: number;
}) {
  return (
    <div>
      {nodes.map((node) => {
        const expanded = node.kind === "dir" && expandedDirs.has(node.path);
        if (node.kind === "dir") {
          const childFiles = collectAllPaths(node.children, "file");
          const allChecked = [...childFiles].every((p) => checkedFiles.has(p));
          const someChecked = [...childFiles].some((p) => checkedFiles.has(p));
          return (
            <div key={node.path}>
              <div
                className={cn(
                  "group grid w-full grid-cols-[auto_minmax(0,1fr)_2.25rem] items-center gap-x-1 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  TREE_ROW_HEIGHT_CLASS,
                )}
              >
                <label
                  className="flex items-center pl-2"
                  style={{ paddingLeft: `${TREE_BASE_INDENT + depth * TREE_STEP_INDENT - 8}px` }}
                >
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                    onChange={() => onToggleCheck(node.path, "dir")}
                    className="mr-2 accent-foreground"
                  />
                </label>
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-2 py-1 text-left"
                  onClick={() => onToggleDir(node.path)}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {expanded ? (
                      <FolderOpen className="h-3.5 w-3.5" />
                    ) : (
                      <Folder className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="truncate">{node.name}</span>
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center self-center rounded-sm text-muted-foreground opacity-70 transition-[background-color,color,opacity] hover:bg-accent hover:text-foreground group-hover:opacity-100"
                  onClick={() => onToggleDir(node.path)}
                >
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {expanded && (
                <ExportFileTree
                  nodes={node.children}
                  selectedFile={selectedFile}
                  expandedDirs={expandedDirs}
                  checkedFiles={checkedFiles}
                  onToggleDir={onToggleDir}
                  onSelectFile={onSelectFile}
                  onToggleCheck={onToggleCheck}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

        const FileIcon = fileIcon(node.name);
        const checked = checkedFiles.has(node.path);
        return (
          <div
            key={node.path}
            className={cn(
              "flex w-full items-center gap-2 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground cursor-pointer",
              TREE_ROW_HEIGHT_CLASS,
              node.path === selectedFile && "text-foreground bg-accent/20",
            )}
            style={{
              paddingInlineStart: `${TREE_BASE_INDENT + depth * TREE_STEP_INDENT - 8}px`,
            }}
          >
            <label className="flex items-center pl-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleCheck(node.path, "file")}
                className="mr-2 accent-foreground"
              />
            </label>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
              onClick={() => onSelectFile(node.path)}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                <FileIcon className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">{node.name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Frontmatter helpers ───────────────────────────────────────────────

type FrontmatterData = Record<string, string | string[]>;

function parseFrontmatter(content: string): { data: FrontmatterData; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const data: FrontmatterData = {};
  const rawYaml = match[1];
  const body = match[2];

  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of rawYaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // List item under current key
    if (trimmed.startsWith("- ") && currentKey) {
      if (!currentList) currentList = [];
      currentList.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    // Flush previous list
    if (currentKey && currentList) {
      data[currentKey] = currentList;
      currentList = null;
      currentKey = null;
    }

    const kvMatch = trimmed.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim().replace(/^["']|["']$/g, "");
      // Skip null values
      if (val === "null") {
        currentKey = null;
        continue;
      }
      if (val) {
        data[key] = val;
        currentKey = null;
      } else {
        currentKey = key;
      }
    }
  }

  // Flush trailing list
  if (currentKey && currentList) {
    data[currentKey] = currentList;
  }

  return Object.keys(data).length > 0 ? { data, body } : null;
}

const FRONTMATTER_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  title: "Title",
  kind: "Kind",
  reportsTo: "Reports to",
  skills: "Skills",
  status: "Status",
  description: "Description",
  priority: "Priority",
  assignee: "Assignee",
  project: "Project",
  targetDate: "Target date",
};

function FrontmatterCard({ data }: { data: FrontmatterData }) {
  return (
    <div className="rounded-md border border-border bg-accent/20 px-4 py-3 mb-4">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground whitespace-nowrap py-0.5">
              {FRONTMATTER_FIELD_LABELS[key] ?? key}
            </dt>
            <dd className="py-0.5">
              {Array.isArray(value) ? (
                <div className="flex flex-wrap gap-1.5">
                  {value.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <span>{value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Preview pane ──────────────────────────────────────────────────────

function ExportPreviewPane({
  selectedFile,
  content,
}: {
  selectedFile: string | null;
  content: string | null;
}) {
  if (!selectedFile || content === null) {
    return (
      <EmptyState icon={Package} message="Select a file to preview its contents." />
    );
  }

  const isMarkdown = selectedFile.endsWith(".md");
  const parsed = isMarkdown ? parseFrontmatter(content) : null;

  return (
    <div className="min-w-0">
      <div className="border-b border-border px-5 py-3">
        <div className="truncate font-mono text-sm">{selectedFile}</div>
      </div>
      <div className="min-h-[560px] px-5 py-5">
        {parsed ? (
          <>
            <FrontmatterCard data={parsed.data} />
            {parsed.body.trim() && <MarkdownBody>{parsed.body}</MarkdownBody>}
          </>
        ) : isMarkdown ? (
          <MarkdownBody>{content}</MarkdownBody>
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words border-0 bg-transparent p-0 font-mono text-sm text-foreground">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

export function CompanyExport() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();

  const [exportData, setExportData] = useState<CompanyPortabilityExportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [treeSearch, setTreeSearch] = useState("");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Org Chart", href: "/org" },
      { label: "Export" },
    ]);
  }, [setBreadcrumbs]);

  // Load export data on mount
  const exportMutation = useMutation({
    mutationFn: () =>
      companiesApi.exportBundle(selectedCompanyId!, {
        include: { company: true, agents: true, projects: true, issues: true },
      }),
    onSuccess: (result) => {
      setExportData(result);
      // Check all files EXCEPT tasks by default
      const checked = new Set<string>();
      for (const filePath of Object.keys(result.files)) {
        if (!isTaskPath(filePath)) checked.add(filePath);
      }
      setCheckedFiles(checked);
      // Expand top-level dirs
      const tree = buildFileTree(result.files);
      const topDirs = new Set<string>();
      for (const node of tree) {
        if (node.kind === "dir") topDirs.add(node.path);
      }
      setExpandedDirs(topDirs);
      // Select first file
      const firstFile = Object.keys(result.files)[0];
      if (firstFile) setSelectedFile(firstFile);
    },
    onError: (err) => {
      pushToast({
        tone: "error",
        title: "Export failed",
        body: err instanceof Error ? err.message : "Failed to load export data.",
      });
    },
  });

  useEffect(() => {
    if (selectedCompanyId && !exportData && !exportMutation.isPending) {
      exportMutation.mutate();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  const tree = useMemo(
    () => (exportData ? buildFileTree(exportData.files) : []),
    [exportData],
  );

  const displayTree = useMemo(() => {
    let result = tree;
    if (treeSearch) result = filterTree(result, treeSearch);
    return sortByChecked(result, checkedFiles);
  }, [tree, treeSearch, checkedFiles]);

  const totalFiles = useMemo(() => countFiles(tree), [tree]);
  const selectedCount = checkedFiles.size;

  // Separate info notes (terminated agents) from real warnings
  const { notes, warnings } = useMemo(() => {
    if (!exportData) return { notes: [] as string[], warnings: [] as string[] };
    const notes: string[] = [];
    const warnings: string[] = [];
    for (const w of exportData.warnings) {
      if (/terminated agent/i.test(w)) {
        notes.push(w);
      } else {
        warnings.push(w);
      }
    }
    return { notes, warnings };
  }, [exportData]);

  function handleToggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function handleToggleCheck(path: string, kind: "file" | "dir") {
    if (!exportData) return;
    setCheckedFiles((prev) => {
      const next = new Set(prev);
      if (kind === "file") {
        if (next.has(path)) next.delete(path);
        else next.add(path);
      } else {
        // Find all child file paths under this dir
        const dirTree = buildFileTree(exportData.files);
        const findNode = (nodes: FileTreeNode[], target: string): FileTreeNode | null => {
          for (const n of nodes) {
            if (n.path === target) return n;
            const found = findNode(n.children, target);
            if (found) return found;
          }
          return null;
        };
        const dirNode = findNode(dirTree, path);
        if (dirNode) {
          const childFiles = collectAllPaths(dirNode.children, "file");
          // Add the dir's own file children
          for (const child of dirNode.children) {
            if (child.kind === "file") childFiles.add(child.path);
          }
          const allChecked = [...childFiles].every((p) => next.has(p));
          for (const f of childFiles) {
            if (allChecked) next.delete(f);
            else next.add(f);
          }
        }
      }
      return next;
    });
  }

  function handleDownload() {
    if (!exportData) return;
    downloadTar(exportData, checkedFiles);
    pushToast({
      tone: "success",
      title: "Export downloaded",
      body: `${selectedCount} file${selectedCount === 1 ? "" : "s"} exported as ${exportData.rootPath}.tar`,
    });
  }

  if (!selectedCompanyId) {
    return <EmptyState icon={Package} message="Select a company to export." />;
  }

  if (exportMutation.isPending && !exportData) {
    return <PageSkeleton variant="detail" />;
  }

  if (!exportData) {
    return <EmptyState icon={Package} message="Loading export data..." />;
  }

  const previewContent = selectedFile ? (exportData.files[selectedFile] ?? null) : null;

  return (
    <div>
      {/* Sticky top action bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-background px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">
              {selectedCompany?.name ?? "Company"} export
            </span>
            <span className="text-muted-foreground">
              {selectedCount} / {totalFiles} file{totalFiles === 1 ? "" : "s"} selected
            </span>
            {warnings.length > 0 && (
              <span className="text-amber-500">
                {warnings.length} warning{warnings.length === 1 ? "" : "s"}
              </span>
            )}
            {notes.length > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {notes.length} note{notes.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleDownload}
            disabled={selectedCount === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export {selectedCount} file{selectedCount === 1 ? "" : "s"}
          </Button>
        </div>
      </div>

      {/* Notes (informational, e.g. terminated agents) */}
      {notes.length > 0 && (
        <div className="border-b border-border px-5 py-2 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            {notes.map((n) => (
              <div key={n} className="text-xs text-muted-foreground">{n}</div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-5 py-2">
          {warnings.map((w) => (
            <div key={w} className="text-xs text-amber-500">{w}</div>
          ))}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid h-[calc(100vh-12rem)] gap-0 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="flex flex-col border-r border-border overflow-hidden">
          <div className="border-b border-border px-4 py-3 shrink-0">
            <h2 className="text-base font-semibold">Package files</h2>
            <p className="text-xs text-muted-foreground">
              {totalFiles} file{totalFiles === 1 ? "" : "s"} in {exportData.rootPath}
            </p>
          </div>
          <div className="border-b border-border px-3 py-2 shrink-0">
            <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={treeSearch}
                onChange={(e) => setTreeSearch(e.target.value)}
                placeholder="Search files..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ExportFileTree
              nodes={displayTree}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              checkedFiles={checkedFiles}
              onToggleDir={handleToggleDir}
              onSelectFile={setSelectedFile}
              onToggleCheck={handleToggleCheck}
            />
          </div>
        </aside>
        <div className="min-w-0 overflow-y-auto pl-6">
          <ExportPreviewPane selectedFile={selectedFile} content={previewContent} />
        </div>
      </div>
    </div>
  );
}
