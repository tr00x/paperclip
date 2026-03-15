import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CompanyPortabilityCollisionStrategy,
  CompanyPortabilityPreviewResult,
  CompanyPortabilitySource,
} from "@paperclipai/shared";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { companiesApi } from "../api/companies";
import { queryKeys } from "../lib/queryKeys";
import { MarkdownBody } from "../components/MarkdownBody";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { cn } from "../lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Github,
  Link2,
  Package,
  Upload,
} from "lucide-react";
import { Field } from "../components/agent-config-primitives";

// ── Tree types ────────────────────────────────────────────────────────

type FileTreeNode = {
  name: string;
  path: string;
  kind: "dir" | "file";
  children: FileTreeNode[];
  action?: string | null;
};

const TREE_BASE_INDENT = 16;
const TREE_STEP_INDENT = 24;
const TREE_ROW_HEIGHT_CLASS = "min-h-9";

// ── Tree helpers ──────────────────────────────────────────────────────

function buildFileTree(files: Record<string, string>, actionMap: Map<string, string>): FileTreeNode[] {
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
          action: isLeaf ? (actionMap.get(filePath) ?? null) : null,
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

/** Build a map from file path → planned action (create/update/skip) using the manifest + plan */
function buildActionMap(preview: CompanyPortabilityPreviewResult): Map<string, string> {
  const map = new Map<string, string>();
  const manifest = preview.manifest;

  for (const ap of preview.plan.agentPlans) {
    const agent = manifest.agents.find((a) => a.slug === ap.slug);
    if (agent) {
      const path = ensureMarkdownPath(agent.path);
      map.set(path, ap.action);
    }
  }

  for (const pp of preview.plan.projectPlans) {
    const project = manifest.projects.find((p) => p.slug === pp.slug);
    if (project) {
      const path = ensureMarkdownPath(project.path);
      map.set(path, pp.action);
    }
  }

  for (const ip of preview.plan.issuePlans) {
    const issue = manifest.issues.find((i) => i.slug === ip.slug);
    if (issue) {
      const path = ensureMarkdownPath(issue.path);
      map.set(path, ip.action);
    }
  }

  for (const skill of manifest.skills) {
    const path = ensureMarkdownPath(skill.path);
    map.set(path, "create");
    // Also mark skill file inventory
    for (const file of skill.fileInventory) {
      if (preview.files[file.path]) {
        map.set(file.path, "create");
      }
    }
  }

  // Company file
  if (manifest.company) {
    const path = ensureMarkdownPath(manifest.company.path);
    map.set(path, preview.plan.companyAction === "none" ? "skip" : preview.plan.companyAction);
  }

  return map;
}

function ensureMarkdownPath(p: string): string {
  return p.endsWith(".md") ? p : `${p}.md`;
}

const ACTION_COLORS: Record<string, string> = {
  create: "text-emerald-500 border-emerald-500/30",
  update: "text-blue-500 border-blue-500/30",
  skip: "text-muted-foreground border-border",
  none: "text-muted-foreground border-border",
};

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

    if (trimmed.startsWith("- ") && currentKey) {
      if (!currentList) currentList = [];
      currentList.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ""));
      continue;
    }

    if (currentKey && currentList) {
      data[currentKey] = currentList;
      currentList = null;
      currentKey = null;
    }

    const kvMatch = trimmed.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim().replace(/^["']|["']$/g, "");
      if (val) {
        data[key] = val;
        currentKey = null;
      } else {
        currentKey = key;
      }
    }
  }

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

// ── File tree component ───────────────────────────────────────────────

function ImportFileTree({
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
                <ImportFileTree
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
        const actionColor = node.action ? (ACTION_COLORS[node.action] ?? ACTION_COLORS.skip) : "";
        return (
          <div
            key={node.path}
            className={cn(
              "flex w-full items-center gap-2 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground cursor-pointer",
              TREE_ROW_HEIGHT_CLASS,
              node.path === selectedFile && "text-foreground bg-accent/20",
              !checked && "opacity-50",
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
            {node.action && (
              <span className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                actionColor,
              )}>
                {checked ? node.action : "skip"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Preview pane ──────────────────────────────────────────────────────

function ImportPreviewPane({
  selectedFile,
  content,
  action,
}: {
  selectedFile: string | null;
  content: string | null;
  action: string | null;
}) {
  if (!selectedFile || content === null) {
    return (
      <EmptyState icon={Package} message="Select a file to preview its contents." />
    );
  }

  const isMarkdown = selectedFile.endsWith(".md");
  const parsed = isMarkdown ? parseFrontmatter(content) : null;
  const actionColor = action ? (ACTION_COLORS[action] ?? ACTION_COLORS.skip) : "";

  return (
    <div className="min-w-0">
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate font-mono text-sm">{selectedFile}</div>
          {action && (
            <span className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide",
              actionColor,
            )}>
              {action}
            </span>
          )}
        </div>
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

// ── Helpers ───────────────────────────────────────────────────────────

async function readLocalPackageSelection(fileList: FileList): Promise<{
  rootPath: string | null;
  files: Record<string, string>;
}> {
  const files: Record<string, string> = {};
  let rootPath: string | null = null;
  for (const file of Array.from(fileList)) {
    const relativePath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath?.replace(
        /\\/g,
        "/",
      ) || file.name;
    const isMarkdown = relativePath.endsWith(".md");
    const isPaperclipYaml =
      relativePath.endsWith(".paperclip.yaml") || relativePath.endsWith(".paperclip.yml");
    if (!isMarkdown && !isPaperclipYaml) continue;
    const topLevel = relativePath.split("/")[0] ?? null;
    if (!rootPath && topLevel) rootPath = topLevel;
    files[relativePath] = await file.text();
  }
  if (Object.keys(files).length === 0) {
    throw new Error("No package files were found in the selected folder.");
  }
  return { rootPath, files };
}

// ── Main page ─────────────────────────────────────────────────────────

export function CompanyImport() {
  const {
    selectedCompanyId,
    selectedCompany,
    setSelectedCompanyId,
  } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const packageInputRef = useRef<HTMLInputElement | null>(null);

  // Source state
  const [sourceMode, setSourceMode] = useState<"github" | "url" | "local">("github");
  const [importUrl, setImportUrl] = useState("");
  const [localPackage, setLocalPackage] = useState<{
    rootPath: string | null;
    files: Record<string, string>;
  } | null>(null);

  // Target state
  const [targetMode, setTargetMode] = useState<"existing" | "new">("existing");
  const [collisionStrategy, setCollisionStrategy] =
    useState<CompanyPortabilityCollisionStrategy>("rename");
  const [newCompanyName, setNewCompanyName] = useState("");

  // Preview state
  const [importPreview, setImportPreview] =
    useState<CompanyPortabilityPreviewResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    setBreadcrumbs([
      { label: "Org Chart", href: "/org" },
      { label: "Import" },
    ]);
  }, [setBreadcrumbs]);

  function buildSource(): CompanyPortabilitySource | null {
    if (sourceMode === "local") {
      if (!localPackage) return null;
      return { type: "inline", rootPath: localPackage.rootPath, files: localPackage.files };
    }
    const url = importUrl.trim();
    if (!url) return null;
    if (sourceMode === "github") return { type: "github", url };
    return { type: "url", url };
  }

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => {
      const source = buildSource();
      if (!source) throw new Error("No source configured.");
      return companiesApi.importPreview({
        source,
        include: { company: true, agents: true, projects: true, issues: true },
        target:
          targetMode === "new"
            ? { mode: "new_company", newCompanyName: newCompanyName || null }
            : { mode: "existing_company", companyId: selectedCompanyId! },
        collisionStrategy,
      });
    },
    onSuccess: (result) => {
      setImportPreview(result);
      // Check all files by default
      const allFiles = new Set(Object.keys(result.files));
      setCheckedFiles(allFiles);
      // Expand top-level dirs
      const tree = buildFileTree(result.files, buildActionMap(result));
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
        title: "Preview failed",
        body: err instanceof Error ? err.message : "Failed to preview import.",
      });
    },
  });

  // Apply mutation
  const importMutation = useMutation({
    mutationFn: () => {
      const source = buildSource();
      if (!source) throw new Error("No source configured.");
      return companiesApi.importBundle({
        source,
        include: { company: true, agents: true, projects: true, issues: true },
        target:
          targetMode === "new"
            ? { mode: "new_company", newCompanyName: newCompanyName || null }
            : { mode: "existing_company", companyId: selectedCompanyId! },
        collisionStrategy,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      if (result.company.action === "created") {
        setSelectedCompanyId(result.company.id);
      }
      pushToast({
        tone: "success",
        title: "Import complete",
        body: `${result.company.name}: ${result.agents.length} agent${result.agents.length === 1 ? "" : "s"} processed.`,
      });
      // Reset
      setImportPreview(null);
      setLocalPackage(null);
      setImportUrl("");
    },
    onError: (err) => {
      pushToast({
        tone: "error",
        title: "Import failed",
        body: err instanceof Error ? err.message : "Failed to apply import.",
      });
    },
  });

  async function handleChooseLocalPackage(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    try {
      const pkg = await readLocalPackageSelection(fileList);
      setLocalPackage(pkg);
      setImportPreview(null);
    } catch (err) {
      pushToast({
        tone: "error",
        title: "Package read failed",
        body: err instanceof Error ? err.message : "Failed to read folder.",
      });
    }
  }

  const actionMap = useMemo(
    () => (importPreview ? buildActionMap(importPreview) : new Map<string, string>()),
    [importPreview],
  );

  const tree = useMemo(
    () => (importPreview ? buildFileTree(importPreview.files, actionMap) : []),
    [importPreview, actionMap],
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
    if (!importPreview) return;
    setCheckedFiles((prev) => {
      const next = new Set(prev);
      if (kind === "file") {
        if (next.has(path)) next.delete(path);
        else next.add(path);
      } else {
        const findNode = (nodes: FileTreeNode[], target: string): FileTreeNode | null => {
          for (const n of nodes) {
            if (n.path === target) return n;
            const found = findNode(n.children, target);
            if (found) return found;
          }
          return null;
        };
        const dirNode = findNode(tree, path);
        if (dirNode) {
          const childFiles = collectAllPaths(dirNode.children, "file");
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

  const hasSource =
    sourceMode === "local" ? !!localPackage : importUrl.trim().length > 0;
  const hasErrors = importPreview ? importPreview.errors.length > 0 : false;

  const previewContent = selectedFile && importPreview
    ? (importPreview.files[selectedFile] ?? null)
    : null;
  const selectedAction = selectedFile ? (actionMap.get(selectedFile) ?? null) : null;

  if (!selectedCompanyId) {
    return <EmptyState icon={Download} message="Select a company to import into." />;
  }

  return (
    <div>
      {/* Source form section */}
      <div className="border-b border-border px-5 py-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Import source</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a GitHub repo, direct URL, or local folder to import from.
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {(
            [
              { key: "github", icon: Github, label: "GitHub repo" },
              { key: "url", icon: Link2, label: "Direct URL" },
              { key: "local", icon: Upload, label: "Local folder" },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                sourceMode === key
                  ? "border-foreground bg-accent"
                  : "border-border hover:bg-accent/50",
              )}
              onClick={() => setSourceMode(key)}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </div>
            </button>
          ))}
        </div>

        {sourceMode === "local" ? (
          <div className="rounded-md border border-dashed border-border px-3 py-3">
            <input
              ref={packageInputRef}
              type="file"
              multiple
              className="hidden"
              // @ts-expect-error webkitdirectory is supported by Chromium-based browsers
              webkitdirectory=""
              onChange={handleChooseLocalPackage}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => packageInputRef.current?.click()}
              >
                Choose folder
              </Button>
              {localPackage && (
                <span className="text-xs text-muted-foreground">
                  {localPackage.rootPath ?? "package"} with{" "}
                  {Object.keys(localPackage.files).length} file
                  {Object.keys(localPackage.files).length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {!localPackage && (
              <p className="mt-2 text-xs text-muted-foreground">
                Select a folder that contains COMPANY.md and any referenced AGENTS.md files.
              </p>
            )}
          </div>
        ) : (
          <Field
            label={sourceMode === "github" ? "GitHub URL" : "Package URL"}
            hint={
              sourceMode === "github"
                ? "Repo tree path or blob URL to COMPANY.md (e.g. github.com/owner/repo/tree/main/company)."
                : "Point directly at COMPANY.md or a directory that contains it."
            }
          >
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={importUrl}
              placeholder={
                sourceMode === "github"
                  ? "https://github.com/owner/repo/tree/main/company"
                  : "https://example.com/company/COMPANY.md"
              }
              onChange={(e) => {
                setImportUrl(e.target.value);
                setImportPreview(null);
              }}
            />
          </Field>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Target" hint="Import into this company or create a new one.">
            <select
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              value={targetMode}
              onChange={(e) => {
                setTargetMode(e.target.value as "existing" | "new");
                setImportPreview(null);
              }}
            >
              <option value="existing">
                Existing company: {selectedCompany?.name}
              </option>
              <option value="new">Create new company</option>
            </select>
          </Field>
          <Field
            label="Default collision strategy"
            hint="Controls what happens when imported slugs already exist."
          >
            <select
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              value={collisionStrategy}
              onChange={(e) => {
                setCollisionStrategy(e.target.value as CompanyPortabilityCollisionStrategy);
                setImportPreview(null);
              }}
            >
              <option value="rename">Rename imported agents</option>
              <option value="skip">Skip existing agents</option>
              <option value="replace">Replace existing agents</option>
            </select>
          </Field>
        </div>

        {targetMode === "new" && (
          <Field
            label="New company name"
            hint="Optional override. Leave blank to use the package name."
          >
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Imported Company"
            />
          </Field>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending || !hasSource}
          >
            {previewMutation.isPending ? "Previewing..." : "Preview import"}
          </Button>
        </div>
      </div>

      {/* Preview results */}
      {importPreview && (
        <>
          {/* Sticky import action bar */}
          <div className="sticky top-0 z-10 border-b border-border bg-background px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium">
                  Import preview
                </span>
                <span className="text-muted-foreground">
                  {selectedCount} / {totalFiles} file{totalFiles === 1 ? "" : "s"} selected
                </span>
                {importPreview.warnings.length > 0 && (
                  <span className="text-amber-500">
                    {importPreview.warnings.length} warning{importPreview.warnings.length === 1 ? "" : "s"}
                  </span>
                )}
                {importPreview.errors.length > 0 && (
                  <span className="text-destructive">
                    {importPreview.errors.length} error{importPreview.errors.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || hasErrors || selectedCount === 0}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {importMutation.isPending
                  ? "Importing..."
                  : `Import ${selectedCount} file${selectedCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>

          {/* Warnings */}
          {importPreview.warnings.length > 0 && (
            <div className="border-b border-amber-500/20 bg-amber-500/5 px-5 py-2">
              {importPreview.warnings.map((w) => (
                <div key={w} className="text-xs text-amber-500">{w}</div>
              ))}
            </div>
          )}

          {/* Errors */}
          {importPreview.errors.length > 0 && (
            <div className="border-b border-destructive/40 bg-destructive/5 px-5 py-2">
              {importPreview.errors.map((e) => (
                <div key={e} className="text-xs text-destructive">{e}</div>
              ))}
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid min-h-[calc(100vh-16rem)] gap-0 xl:grid-cols-[19rem_minmax(0,1fr)]">
            <aside className="border-r border-border">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-base font-semibold">Package files</h2>
                <p className="text-xs text-muted-foreground">
                  {totalFiles} file{totalFiles === 1 ? "" : "s"} &middot;
                  {" "}{importPreview.plan.agentPlans.length} agent{importPreview.plan.agentPlans.length === 1 ? "" : "s"},
                  {" "}{importPreview.manifest.skills.length} skill{importPreview.manifest.skills.length === 1 ? "" : "s"},
                  {" "}{importPreview.plan.projectPlans.length} project{importPreview.plan.projectPlans.length === 1 ? "" : "s"},
                  {" "}{importPreview.plan.issuePlans.length} task{importPreview.plan.issuePlans.length === 1 ? "" : "s"}
                </p>
              </div>
              <ImportFileTree
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
              <ImportPreviewPane
                selectedFile={selectedFile}
                content={previewContent}
                action={selectedAction}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
