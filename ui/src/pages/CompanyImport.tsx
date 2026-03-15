import { useEffect, useRef, useState, type ChangeEvent } from "react";
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
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { cn } from "../lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Github,
  Link2,
  Upload,
} from "lucide-react";
import { Field } from "../components/agent-config-primitives";

// ── Preview tree types ────────────────────────────────────────────────

type PreviewTreeNode = {
  name: string;
  kind: "section" | "item";
  action?: string;
  reason?: string | null;
  detail?: string;
  children: PreviewTreeNode[];
};

const TREE_BASE_INDENT = 16;
const TREE_STEP_INDENT = 24;
const TREE_ROW_HEIGHT_CLASS = "min-h-9";

// ── Build preview tree from preview result ────────────────────────────

function buildPreviewTree(preview: CompanyPortabilityPreviewResult): PreviewTreeNode[] {
  const sections: PreviewTreeNode[] = [];

  // Company section
  if (preview.plan.companyAction !== "none") {
    sections.push({
      name: "Company",
      kind: "section",
      children: [
        {
          name: preview.targetCompanyName ?? "New company",
          kind: "item",
          action: preview.plan.companyAction,
          detail: `Target: ${preview.targetCompanyName ?? "new"}`,
          children: [],
        },
      ],
    });
  }

  // Agents section
  if (preview.plan.agentPlans.length > 0) {
    sections.push({
      name: `Agents (${preview.plan.agentPlans.length})`,
      kind: "section",
      children: preview.plan.agentPlans.map((ap) => ({
        name: `${ap.slug} → ${ap.plannedName}`,
        kind: "item" as const,
        action: ap.action,
        reason: ap.reason,
        children: [],
      })),
    });
  }

  // Projects section
  if (preview.plan.projectPlans.length > 0) {
    sections.push({
      name: `Projects (${preview.plan.projectPlans.length})`,
      kind: "section",
      children: preview.plan.projectPlans.map((pp) => ({
        name: `${pp.slug} → ${pp.plannedName}`,
        kind: "item" as const,
        action: pp.action,
        reason: pp.reason,
        children: [],
      })),
    });
  }

  // Issues section
  if (preview.plan.issuePlans.length > 0) {
    sections.push({
      name: `Tasks (${preview.plan.issuePlans.length})`,
      kind: "section",
      children: preview.plan.issuePlans.map((ip) => ({
        name: `${ip.slug} → ${ip.plannedTitle}`,
        kind: "item" as const,
        action: ip.action,
        reason: ip.reason,
        children: [],
      })),
    });
  }

  // Env inputs section
  if (preview.envInputs.length > 0) {
    sections.push({
      name: `Environment inputs (${preview.envInputs.length})`,
      kind: "section",
      children: preview.envInputs.map((ei) => ({
        name: ei.key + (ei.agentSlug ? ` (${ei.agentSlug})` : ""),
        kind: "item" as const,
        action: ei.requirement,
        detail: [
          ei.kind,
          ei.requirement,
          ei.defaultValue !== null ? `default: ${JSON.stringify(ei.defaultValue)}` : null,
          ei.portability === "system_dependent" ? "system-dependent" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        reason: ei.description,
        children: [],
      })),
    });
  }

  return sections;
}

// ── Preview tree component ────────────────────────────────────────────

function ImportPreviewTree({
  nodes,
  selectedItem,
  expandedSections,
  onToggleSection,
  onSelectItem,
  depth = 0,
}: {
  nodes: PreviewTreeNode[];
  selectedItem: string | null;
  expandedSections: Set<string>;
  onToggleSection: (name: string) => void;
  onSelectItem: (name: string) => void;
  depth?: number;
}) {
  return (
    <div>
      {nodes.map((node) => {
        if (node.kind === "section") {
          const expanded = expandedSections.has(node.name);
          return (
            <div key={node.name}>
              <button
                type="button"
                className={cn(
                  "group flex w-full items-center gap-2 pr-3 text-left text-sm font-medium text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  TREE_ROW_HEIGHT_CLASS,
                )}
                style={{ paddingLeft: `${TREE_BASE_INDENT + depth * TREE_STEP_INDENT}px` }}
                onClick={() => onToggleSection(node.name)}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="truncate">{node.name}</span>
              </button>
              {expanded && (
                <ImportPreviewTree
                  nodes={node.children}
                  selectedItem={selectedItem}
                  expandedSections={expandedSections}
                  onToggleSection={onToggleSection}
                  onSelectItem={onSelectItem}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

        return (
          <button
            key={node.name}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 pr-3 text-left text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground",
              TREE_ROW_HEIGHT_CLASS,
              node.name === selectedItem && "text-foreground bg-accent/20",
            )}
            style={{ paddingLeft: `${TREE_BASE_INDENT + depth * TREE_STEP_INDENT}px` }}
            onClick={() => onSelectItem(node.name)}
          >
            <span className="flex-1 truncate">{node.name}</span>
            {node.action && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                {node.action}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Import detail pane ────────────────────────────────────────────────

function ImportDetailPane({
  selectedItem,
  previewTree,
}: {
  selectedItem: string | null;
  previewTree: PreviewTreeNode[];
}) {
  if (!selectedItem) {
    return (
      <EmptyState icon={Download} message="Select an item to see its details." />
    );
  }

  // Find the selected node
  let found: PreviewTreeNode | null = null;
  for (const section of previewTree) {
    for (const child of section.children) {
      if (child.name === selectedItem) {
        found = child;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    return (
      <EmptyState icon={Download} message="Item not found." />
    );
  }

  return (
    <div className="min-w-0">
      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{found.name}</h2>
          </div>
          {found.action && (
            <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
              {found.action}
            </span>
          )}
        </div>
      </div>
      <div className="px-5 py-5 space-y-3">
        {found.detail && (
          <div className="text-sm text-muted-foreground">{found.detail}</div>
        )}
        {found.reason && (
          <div className="text-sm">{found.reason}</div>
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
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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
      // Expand all sections by default
      const sections = buildPreviewTree(result).map((s) => s.name);
      setExpandedSections(new Set(sections));
      setSelectedItem(null);
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

  const previewTree = importPreview ? buildPreviewTree(importPreview) : [];
  const hasSource =
    sourceMode === "local" ? !!localPackage : importUrl.trim().length > 0;
  const hasErrors = importPreview ? importPreview.errors.length > 0 : false;

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
                ? "Repo root, tree path, or blob URL to COMPANY.md."
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
            label="Collision strategy"
            hint="Controls what happens when imported agent slugs already exist."
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
                  Target: {importPreview.targetCompanyName ?? "new company"}
                </span>
                <span className="text-muted-foreground">
                  Strategy: {importPreview.collisionStrategy}
                </span>
                {importPreview.warnings.length > 0 && (
                  <span className="text-amber-600">
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
                disabled={importMutation.isPending || hasErrors}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {importMutation.isPending ? "Importing..." : "Apply import"}
              </Button>
            </div>
          </div>

          {/* Warnings */}
          {importPreview.warnings.length > 0 && (
            <div className="border-b border-amber-300/60 bg-amber-50/60 px-5 py-2">
              {importPreview.warnings.map((w) => (
                <div key={w} className="text-xs text-amber-700">{w}</div>
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
                <h2 className="text-base font-semibold">Import plan</h2>
                <p className="text-xs text-muted-foreground">
                  {importPreview.plan.agentPlans.length} agent{importPreview.plan.agentPlans.length === 1 ? "" : "s"},
                  {" "}{importPreview.plan.projectPlans.length} project{importPreview.plan.projectPlans.length === 1 ? "" : "s"},
                  {" "}{importPreview.plan.issuePlans.length} task{importPreview.plan.issuePlans.length === 1 ? "" : "s"}
                </p>
              </div>
              <ImportPreviewTree
                nodes={previewTree}
                selectedItem={selectedItem}
                expandedSections={expandedSections}
                onToggleSection={(name) => {
                  setExpandedSections((prev) => {
                    const next = new Set(prev);
                    if (next.has(name)) next.delete(name);
                    else next.add(name);
                    return next;
                  });
                }}
                onSelectItem={setSelectedItem}
              />
            </aside>
            <div className="min-w-0 pl-6">
              <ImportDetailPane
                selectedItem={selectedItem}
                previewTree={previewTree}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
