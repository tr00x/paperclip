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
  Package,
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
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
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

  return (
    <div className="min-w-0">
      <div className="border-b border-border px-5 py-3">
        <div className="truncate font-mono text-sm">{selectedFile}</div>
      </div>
      <div className="min-h-[560px] px-5 py-5">
        {isMarkdown ? (
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
      // Check all files by default
      const allFiles = new Set(Object.keys(result.files));
      setCheckedFiles(allFiles);
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

  const totalFiles = useMemo(() => countFiles(tree), [tree]);
  const selectedCount = checkedFiles.size;

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
            {exportData.warnings.length > 0 && (
              <span className="text-amber-600">
                {exportData.warnings.length} warning{exportData.warnings.length === 1 ? "" : "s"}
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

      {/* Warnings */}
      {exportData.warnings.length > 0 && (
        <div className="border-b border-amber-300/60 bg-amber-50/60 px-5 py-2">
          {exportData.warnings.map((w) => (
            <div key={w} className="text-xs text-amber-700">{w}</div>
          ))}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid min-h-[calc(100vh-12rem)] gap-0 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="border-r border-border">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Package files</h2>
            <p className="text-xs text-muted-foreground">
              {totalFiles} file{totalFiles === 1 ? "" : "s"} in {exportData.rootPath}
            </p>
          </div>
          <ExportFileTree
            nodes={tree}
            selectedFile={selectedFile}
            expandedDirs={expandedDirs}
            checkedFiles={checkedFiles}
            onToggleDir={handleToggleDir}
            onSelectFile={setSelectedFile}
            onToggleCheck={handleToggleCheck}
          />
        </aside>
        <div className="min-w-0 pl-6">
          <ExportPreviewPane selectedFile={selectedFile} content={previewContent} />
        </div>
      </div>
    </div>
  );
}
