import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companySkills } from "@paperclipai/db";
import type {
  CompanySkill,
  CompanySkillCompatibility,
  CompanySkillDetail,
  CompanySkillFileInventoryEntry,
  CompanySkillImportResult,
  CompanySkillListItem,
  CompanySkillSourceType,
  CompanySkillTrustLevel,
  CompanySkillUsageAgent,
} from "@paperclipai/shared";
import { normalizeAgentUrlKey } from "@paperclipai/shared";
import { readPaperclipSkillSyncPreference } from "@paperclipai/adapter-utils/server-utils";
import { findServerAdapter } from "../adapters/index.js";
import { notFound, unprocessable } from "../errors.js";
import { agentService } from "./agents.js";
import { secretService } from "./secrets.js";

type CompanySkillRow = typeof companySkills.$inferSelect;

type ImportedSkill = {
  slug: string;
  name: string;
  description: string | null;
  markdown: string;
  sourceType: CompanySkillSourceType;
  sourceLocator: string | null;
  sourceRef: string | null;
  trustLevel: CompanySkillTrustLevel;
  compatibility: CompanySkillCompatibility;
  fileInventory: CompanySkillFileInventoryEntry[];
  metadata: Record<string, unknown> | null;
};

type ParsedSkillImportSource = {
  resolvedSource: string;
  requestedSkillSlug: string | null;
  warnings: string[];
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePortablePath(input: string) {
  return input.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
}

function normalizeSkillSlug(value: string | null | undefined) {
  return value ? normalizeAgentUrlKey(value) ?? null : null;
}

function classifyInventoryKind(relativePath: string): CompanySkillFileInventoryEntry["kind"] {
  const normalized = normalizePortablePath(relativePath).toLowerCase();
  if (normalized.endsWith("/skill.md") || normalized === "skill.md") return "skill";
  if (normalized.startsWith("references/")) return "reference";
  if (normalized.startsWith("scripts/")) return "script";
  if (normalized.startsWith("assets/")) return "asset";
  if (normalized.endsWith(".md")) return "markdown";
  const fileName = path.posix.basename(normalized);
  if (
    fileName.endsWith(".sh")
    || fileName.endsWith(".js")
    || fileName.endsWith(".mjs")
    || fileName.endsWith(".cjs")
    || fileName.endsWith(".ts")
    || fileName.endsWith(".py")
    || fileName.endsWith(".rb")
    || fileName.endsWith(".bash")
  ) {
    return "script";
  }
  if (
    fileName.endsWith(".png")
    || fileName.endsWith(".jpg")
    || fileName.endsWith(".jpeg")
    || fileName.endsWith(".gif")
    || fileName.endsWith(".svg")
    || fileName.endsWith(".webp")
    || fileName.endsWith(".pdf")
  ) {
    return "asset";
  }
  return "other";
}

function deriveTrustLevel(fileInventory: CompanySkillFileInventoryEntry[]): CompanySkillTrustLevel {
  if (fileInventory.some((entry) => entry.kind === "script")) return "scripts_executables";
  if (fileInventory.some((entry) => entry.kind === "asset" || entry.kind === "other")) return "assets";
  return "markdown_only";
}

function prepareYamlLines(raw: string) {
  return raw
    .split("\n")
    .map((line) => ({
      indent: line.match(/^ */)?.[0].length ?? 0,
      content: line.trim(),
    }))
    .filter((line) => line.content.length > 0 && !line.content.startsWith("#"));
}

function parseYamlScalar(rawValue: string): unknown {
  const trimmed = rawValue.trim();
  if (trimmed === "") return "";
  if (trimmed === "null" || trimmed === "~") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "[]") return [];
  if (trimmed === "{}") return {};
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith("\"") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function parseYamlBlock(
  lines: Array<{ indent: number; content: string }>,
  startIndex: number,
  indentLevel: number,
): { value: unknown; nextIndex: number } {
  let index = startIndex;
  while (index < lines.length && lines[index]!.content.length === 0) index += 1;
  if (index >= lines.length || lines[index]!.indent < indentLevel) {
    return { value: {}, nextIndex: index };
  }

  const isArray = lines[index]!.indent === indentLevel && lines[index]!.content.startsWith("-");
  if (isArray) {
    const values: unknown[] = [];
    while (index < lines.length) {
      const line = lines[index]!;
      if (line.indent < indentLevel) break;
      if (line.indent !== indentLevel || !line.content.startsWith("-")) break;
      const remainder = line.content.slice(1).trim();
      index += 1;
      if (!remainder) {
        const nested = parseYamlBlock(lines, index, indentLevel + 2);
        values.push(nested.value);
        index = nested.nextIndex;
        continue;
      }
      values.push(parseYamlScalar(remainder));
    }
    return { value: values, nextIndex: index };
  }

  const record: Record<string, unknown> = {};
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.indent < indentLevel) break;
    if (line.indent !== indentLevel) {
      index += 1;
      continue;
    }
    const separatorIndex = line.content.indexOf(":");
    if (separatorIndex <= 0) {
      index += 1;
      continue;
    }
    const key = line.content.slice(0, separatorIndex).trim();
    const remainder = line.content.slice(separatorIndex + 1).trim();
    index += 1;
    if (!remainder) {
      const nested = parseYamlBlock(lines, index, indentLevel + 2);
      record[key] = nested.value;
      index = nested.nextIndex;
      continue;
    }
    record[key] = parseYamlScalar(remainder);
  }
  return { value: record, nextIndex: index };
}

function parseYamlFrontmatter(raw: string): Record<string, unknown> {
  const prepared = prepareYamlLines(raw);
  if (prepared.length === 0) return {};
  const parsed = parseYamlBlock(prepared, 0, prepared[0]!.indent);
  return isPlainRecord(parsed.value) ? parsed.value : {};
}

function parseFrontmatterMarkdown(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: {}, body: normalized.trim() };
  }
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) {
    return { frontmatter: {}, body: normalized.trim() };
  }
  const frontmatterRaw = normalized.slice(4, closing).trim();
  const body = normalized.slice(closing + 5).trim();
  return {
    frontmatter: parseYamlFrontmatter(frontmatterRaw),
    body,
  };
}

async function fetchText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw unprocessable(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    throw unprocessable(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function parseGitHubSourceUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.hostname !== "github.com") {
    throw unprocessable("GitHub source must use github.com URL");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw unprocessable("Invalid GitHub URL");
  }
  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/i, "");
  let ref = "main";
  let basePath = "";
  let filePath: string | null = null;
  if (parts[2] === "tree") {
    ref = parts[3] ?? "main";
    basePath = parts.slice(4).join("/");
  } else if (parts[2] === "blob") {
    ref = parts[3] ?? "main";
    filePath = parts.slice(4).join("/");
    basePath = filePath ? path.posix.dirname(filePath) : "";
  }
  return { owner, repo, ref, basePath, filePath };
}

function resolveRawGitHubUrl(owner: string, repo: string, ref: string, filePath: string) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath.replace(/^\/+/, "")}`;
}

function extractCommandTokens(raw: string) {
  const matches = raw.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ""));
}

export function parseSkillImportSourceInput(rawInput: string): ParsedSkillImportSource {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw unprocessable("Skill source is required.");
  }

  const warnings: string[] = [];
  let source = trimmed;
  let requestedSkillSlug: string | null = null;

  if (/^npx\s+skills\s+add\s+/i.test(trimmed)) {
    const tokens = extractCommandTokens(trimmed);
    const addIndex = tokens.findIndex(
      (token, index) =>
        token === "add"
        && index > 0
        && tokens[index - 1]?.toLowerCase() === "skills",
    );
    if (addIndex >= 0) {
      source = tokens[addIndex + 1] ?? "";
      for (let index = addIndex + 2; index < tokens.length; index += 1) {
        const token = tokens[index]!;
        if (token === "--skill") {
          requestedSkillSlug = normalizeSkillSlug(tokens[index + 1] ?? null);
          index += 1;
          continue;
        }
        if (token.startsWith("--skill=")) {
          requestedSkillSlug = normalizeSkillSlug(token.slice("--skill=".length));
        }
      }
      warnings.push("Parsed a skills.sh command. Paperclip imports the referenced skill package without executing shell input.");
    }
  }

  const normalizedSource = source.trim();
  if (!normalizedSource) {
    throw unprocessable("Skill source is required.");
  }

  if (!/^https?:\/\//i.test(normalizedSource) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedSource)) {
    const [owner, repo, skillSlugRaw] = normalizedSource.split("/");
    return {
      resolvedSource: `https://github.com/${owner}/${repo}`,
      requestedSkillSlug: normalizeSkillSlug(skillSlugRaw),
      warnings,
    };
  }

  if (!/^https?:\/\//i.test(normalizedSource) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalizedSource)) {
    return {
      resolvedSource: `https://github.com/${normalizedSource}`,
      requestedSkillSlug,
      warnings,
    };
  }

  return {
    resolvedSource: normalizedSource,
    requestedSkillSlug,
    warnings,
  };
}

function resolveBundledSkillsRoot() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(moduleDir, "../../skills"),
    path.resolve(process.cwd(), "skills"),
    path.resolve(moduleDir, "../../../skills"),
  ];
}

function matchesRequestedSkill(relativeSkillPath: string, requestedSkillSlug: string | null) {
  if (!requestedSkillSlug) return true;
  const skillDir = path.posix.dirname(relativeSkillPath);
  return normalizeSkillSlug(path.posix.basename(skillDir)) === requestedSkillSlug;
}

async function walkLocalFiles(root: string, current: string, out: string[]) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walkLocalFiles(root, absolutePath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    out.push(normalizePortablePath(path.relative(root, absolutePath)));
  }
}

async function readLocalSkillImports(sourcePath: string): Promise<ImportedSkill[]> {
  const resolvedPath = path.resolve(sourcePath);
  const stat = await fs.stat(resolvedPath).catch(() => null);
  if (!stat) {
    throw unprocessable(`Skill source path does not exist: ${sourcePath}`);
  }

  if (stat.isFile()) {
    const markdown = await fs.readFile(resolvedPath, "utf8");
    const parsed = parseFrontmatterMarkdown(markdown);
    const slug = normalizeAgentUrlKey(path.basename(path.dirname(resolvedPath))) ?? "skill";
    const inventory: CompanySkillFileInventoryEntry[] = [
      { path: "SKILL.md", kind: "skill" },
    ];
    return [{
      slug,
      name: asString(parsed.frontmatter.name) ?? slug,
      description: asString(parsed.frontmatter.description),
      markdown,
      sourceType: "local_path",
      sourceLocator: resolvedPath,
      sourceRef: null,
      trustLevel: deriveTrustLevel(inventory),
      compatibility: "compatible",
      fileInventory: inventory,
      metadata: null,
    }];
  }

  const root = resolvedPath;
  const allFiles: string[] = [];
  await walkLocalFiles(root, root, allFiles);
  const skillPaths = allFiles.filter((entry) => path.posix.basename(entry).toLowerCase() === "skill.md");
  if (skillPaths.length === 0) {
    throw unprocessable("No SKILL.md files were found in the provided path.");
  }

  const imports: ImportedSkill[] = [];
  for (const skillPath of skillPaths) {
    const skillDir = path.posix.dirname(skillPath);
    const markdown = await fs.readFile(path.join(root, skillPath), "utf8");
    const parsed = parseFrontmatterMarkdown(markdown);
    const slug = normalizeAgentUrlKey(path.posix.basename(skillDir)) ?? "skill";
    const inventory = allFiles
      .filter((entry) => entry === skillPath || entry.startsWith(`${skillDir}/`))
      .map((entry) => {
        const relative = entry === skillPath ? "SKILL.md" : entry.slice(skillDir.length + 1);
        return {
          path: normalizePortablePath(relative),
          kind: classifyInventoryKind(relative),
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path));
    imports.push({
      slug,
      name: asString(parsed.frontmatter.name) ?? slug,
      description: asString(parsed.frontmatter.description),
      markdown,
      sourceType: "local_path",
      sourceLocator: resolvedPath,
      sourceRef: null,
      trustLevel: deriveTrustLevel(inventory),
      compatibility: "compatible",
      fileInventory: inventory,
      metadata: null,
    });
  }

  return imports;
}

async function readUrlSkillImports(
  sourceUrl: string,
  requestedSkillSlug: string | null = null,
): Promise<{ skills: ImportedSkill[]; warnings: string[] }> {
  const url = sourceUrl.trim();
  const warnings: string[] = [];
  if (url.includes("github.com/")) {
    const parsed = parseGitHubSourceUrl(url);
    let ref = parsed.ref;
    if (!/^[0-9a-f]{40}$/i.test(ref.trim())) {
      warnings.push("GitHub skill source is not pinned to a commit SHA; imports may drift if the ref changes.");
    }
    const tree = await fetchJson<{ tree?: Array<{ path: string; type: string }> }>(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${ref}?recursive=1`,
    ).catch(async () => {
      if (ref === "main") {
        ref = "master";
        warnings.push("GitHub ref main not found; falling back to master.");
        return fetchJson<{ tree?: Array<{ path: string; type: string }> }>(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${ref}?recursive=1`,
        );
      }
      throw unprocessable(`Failed to read GitHub tree for ${url}`);
    });
    const allPaths = (tree.tree ?? [])
      .filter((entry) => entry.type === "blob")
      .map((entry) => entry.path)
      .filter((entry): entry is string => typeof entry === "string");
    const basePrefix = parsed.basePath ? `${parsed.basePath.replace(/^\/+|\/+$/g, "")}/` : "";
    const scopedPaths = basePrefix
      ? allPaths.filter((entry) => entry.startsWith(basePrefix))
      : allPaths;
    const relativePaths = scopedPaths.map((entry) => basePrefix ? entry.slice(basePrefix.length) : entry);
    const filteredPaths = parsed.filePath
      ? relativePaths.filter((entry) => entry === path.posix.relative(parsed.basePath || ".", parsed.filePath!))
      : relativePaths;
    const skillPaths = filteredPaths.filter(
      (entry) => path.posix.basename(entry).toLowerCase() === "skill.md" && matchesRequestedSkill(entry, requestedSkillSlug),
    );
    if (skillPaths.length === 0) {
      throw unprocessable(
        requestedSkillSlug
          ? `Skill ${requestedSkillSlug} was not found in the provided GitHub source.`
          : "No SKILL.md files were found in the provided GitHub source.",
      );
    }
    const skills: ImportedSkill[] = [];
    for (const relativeSkillPath of skillPaths) {
      const repoSkillPath = basePrefix ? `${basePrefix}${relativeSkillPath}` : relativeSkillPath;
      const markdown = await fetchText(resolveRawGitHubUrl(parsed.owner, parsed.repo, ref, repoSkillPath));
      const parsedMarkdown = parseFrontmatterMarkdown(markdown);
      const skillDir = path.posix.dirname(relativeSkillPath);
      const slug = normalizeAgentUrlKey(path.posix.basename(skillDir)) ?? "skill";
      const inventory = filteredPaths
        .filter((entry) => entry === relativeSkillPath || entry.startsWith(`${skillDir}/`))
        .map((entry) => ({
          path: entry === relativeSkillPath ? "SKILL.md" : entry.slice(skillDir.length + 1),
          kind: classifyInventoryKind(entry === relativeSkillPath ? "SKILL.md" : entry.slice(skillDir.length + 1)),
        }))
        .sort((left, right) => left.path.localeCompare(right.path));
      skills.push({
        slug,
        name: asString(parsedMarkdown.frontmatter.name) ?? slug,
        description: asString(parsedMarkdown.frontmatter.description),
        markdown,
        sourceType: "github",
        sourceLocator: sourceUrl,
        sourceRef: ref,
        trustLevel: deriveTrustLevel(inventory),
        compatibility: "compatible",
        fileInventory: inventory,
        metadata: null,
      });
    }
    return { skills, warnings };
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    const markdown = await fetchText(url);
    const parsedMarkdown = parseFrontmatterMarkdown(markdown);
    const urlObj = new URL(url);
    const fileName = path.posix.basename(urlObj.pathname);
    const slug = normalizeAgentUrlKey(fileName.replace(/\.md$/i, "")) ?? "skill";
    const inventory: CompanySkillFileInventoryEntry[] = [{ path: "SKILL.md", kind: "skill" }];
    return {
      skills: [{
        slug,
        name: asString(parsedMarkdown.frontmatter.name) ?? slug,
        description: asString(parsedMarkdown.frontmatter.description),
        markdown,
        sourceType: "url",
        sourceLocator: url,
        sourceRef: null,
        trustLevel: deriveTrustLevel(inventory),
        compatibility: "compatible",
        fileInventory: inventory,
        metadata: null,
      }],
      warnings,
    };
  }

  throw unprocessable("Unsupported skill source. Use a local path or URL.");
}

function toCompanySkill(row: CompanySkillRow): CompanySkill {
  return {
    ...row,
    description: row.description ?? null,
    sourceType: row.sourceType as CompanySkillSourceType,
    sourceLocator: row.sourceLocator ?? null,
    sourceRef: row.sourceRef ?? null,
    trustLevel: row.trustLevel as CompanySkillTrustLevel,
    compatibility: row.compatibility as CompanySkillCompatibility,
    fileInventory: Array.isArray(row.fileInventory)
      ? row.fileInventory.flatMap((entry) => {
        if (!isPlainRecord(entry)) return [];
        return [{
          path: String(entry.path ?? ""),
          kind: (String(entry.kind ?? "other") as CompanySkillFileInventoryEntry["kind"]),
        }];
      })
      : [],
    metadata: isPlainRecord(row.metadata) ? row.metadata : null,
  };
}

function serializeFileInventory(
  fileInventory: CompanySkillFileInventoryEntry[],
): Array<Record<string, unknown>> {
  return fileInventory.map((entry) => ({
    path: entry.path,
    kind: entry.kind,
  }));
}

export function companySkillService(db: Db) {
  const agents = agentService(db);
  const secretsSvc = secretService(db);

  async function ensureBundledSkills(companyId: string) {
    for (const skillsRoot of resolveBundledSkillsRoot()) {
      const stats = await fs.stat(skillsRoot).catch(() => null);
      if (!stats?.isDirectory()) continue;
      const bundledSkills = await readLocalSkillImports(skillsRoot).catch(() => [] as ImportedSkill[]);
      if (bundledSkills.length === 0) continue;
      return upsertImportedSkills(companyId, bundledSkills);
    }
    return [];
  }

  async function list(companyId: string): Promise<CompanySkillListItem[]> {
    await ensureBundledSkills(companyId);
    const rows = await db
      .select()
      .from(companySkills)
      .where(eq(companySkills.companyId, companyId))
      .orderBy(asc(companySkills.name), asc(companySkills.slug));
    const agentRows = await agents.list(companyId);
    return rows.map((row) => {
      const skill = toCompanySkill(row);
      const attachedAgentCount = agentRows.filter((agent) => {
        const preference = readPaperclipSkillSyncPreference(agent.adapterConfig as Record<string, unknown>);
        return preference.desiredSkills.includes(skill.slug);
      }).length;
      return {
        ...skill,
        attachedAgentCount,
      };
    });
  }

  async function getById(id: string) {
    const row = await db
      .select()
      .from(companySkills)
      .where(eq(companySkills.id, id))
      .then((rows) => rows[0] ?? null);
    return row ? toCompanySkill(row) : null;
  }

  async function getBySlug(companyId: string, slug: string) {
    const row = await db
      .select()
      .from(companySkills)
      .where(and(eq(companySkills.companyId, companyId), eq(companySkills.slug, slug)))
      .then((rows) => rows[0] ?? null);
    return row ? toCompanySkill(row) : null;
  }

  async function usage(companyId: string, slug: string): Promise<CompanySkillUsageAgent[]> {
    const agentRows = await agents.list(companyId);
    const desiredAgents = agentRows.filter((agent) => {
      const preference = readPaperclipSkillSyncPreference(agent.adapterConfig as Record<string, unknown>);
      return preference.desiredSkills.includes(slug);
    });

    return Promise.all(
      desiredAgents.map(async (agent) => {
        const adapter = findServerAdapter(agent.adapterType);
        let actualState: string | null = null;

        if (!adapter?.listSkills) {
          actualState = "unsupported";
        } else {
          try {
            const { config: runtimeConfig } = await secretsSvc.resolveAdapterConfigForRuntime(
              agent.companyId,
              agent.adapterConfig as Record<string, unknown>,
            );
            const snapshot = await adapter.listSkills({
              agentId: agent.id,
              companyId: agent.companyId,
              adapterType: agent.adapterType,
              config: runtimeConfig,
            });
            actualState = snapshot.entries.find((entry) => entry.name === slug)?.state
              ?? (snapshot.supported ? "missing" : "unsupported");
          } catch {
            actualState = "unknown";
          }
        }

        return {
          id: agent.id,
          name: agent.name,
          urlKey: agent.urlKey,
          adapterType: agent.adapterType,
          desired: true,
          actualState,
        };
      }),
    );
  }

  async function detail(companyId: string, id: string): Promise<CompanySkillDetail | null> {
    await ensureBundledSkills(companyId);
    const skill = await getById(id);
    if (!skill || skill.companyId !== companyId) return null;
    const usedByAgents = await usage(companyId, skill.slug);
    return {
      ...skill,
      attachedAgentCount: usedByAgents.length,
      usedByAgents,
    };
  }

  async function upsertImportedSkills(companyId: string, imported: ImportedSkill[]): Promise<CompanySkill[]> {
    const out: CompanySkill[] = [];
    for (const skill of imported) {
      const existing = await getBySlug(companyId, skill.slug);
      const values = {
        companyId,
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        markdown: skill.markdown,
        sourceType: skill.sourceType,
        sourceLocator: skill.sourceLocator,
        sourceRef: skill.sourceRef,
        trustLevel: skill.trustLevel,
        compatibility: skill.compatibility,
        fileInventory: serializeFileInventory(skill.fileInventory),
        metadata: skill.metadata,
        updatedAt: new Date(),
      };
      const row = existing
        ? await db
          .update(companySkills)
          .set(values)
          .where(eq(companySkills.id, existing.id))
          .returning()
          .then((rows) => rows[0] ?? null)
        : await db
          .insert(companySkills)
          .values(values)
          .returning()
          .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Failed to persist company skill");
      out.push(toCompanySkill(row));
    }
    return out;
  }

  async function importFromSource(companyId: string, source: string): Promise<CompanySkillImportResult> {
    await ensureBundledSkills(companyId);
    const parsed = parseSkillImportSourceInput(source);
    const local = !/^https?:\/\//i.test(parsed.resolvedSource);
    const { skills, warnings } = local
      ? {
        skills: (await readLocalSkillImports(parsed.resolvedSource))
          .filter((skill) => !parsed.requestedSkillSlug || skill.slug === parsed.requestedSkillSlug),
        warnings: parsed.warnings,
      }
      : await readUrlSkillImports(parsed.resolvedSource, parsed.requestedSkillSlug)
        .then((result) => ({
          skills: result.skills,
          warnings: [...parsed.warnings, ...result.warnings],
        }));
    const filteredSkills = parsed.requestedSkillSlug
      ? skills.filter((skill) => skill.slug === parsed.requestedSkillSlug)
      : skills;
    if (filteredSkills.length === 0) {
      throw unprocessable(
        parsed.requestedSkillSlug
          ? `Skill ${parsed.requestedSkillSlug} was not found in the provided source.`
          : "No skills were found in the provided source.",
      );
    }
    const imported = await upsertImportedSkills(companyId, filteredSkills);
    return { imported, warnings };
  }

  return {
    list,
    getById,
    getBySlug,
    detail,
    importFromSource,
  };
}
