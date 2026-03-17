/**
 * Generates README.md and org chart SVG for company exports.
 */
import type { CompanyPortabilityManifest } from "@paperclipai/shared";

// ── Org chart layout (mirrors ui/src/pages/OrgChart.tsx) ────────────────

const CARD_W = 200;
const CARD_H = 72;
const GAP_X = 32;
const GAP_Y = 64;
const PADDING = 40;

interface OrgNode {
  id: string;
  name: string;
  role: string;
  reports: OrgNode[];
}

interface LayoutNode {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  children: LayoutNode[];
}

function subtreeWidth(node: OrgNode): number {
  if (node.reports.length === 0) return CARD_W;
  const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(CARD_W, childrenW + gaps);
}

function layoutTree(node: OrgNode, x: number, y: number): LayoutNode {
  const totalW = subtreeWidth(node);
  const layoutChildren: LayoutNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (const child of node.reports) {
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + CARD_H + GAP_Y));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    x: x + (totalW - CARD_W) / 2,
    y,
    children: layoutChildren,
  };
}

function flattenLayout(nodes: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  function walk(n: LayoutNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

function collectEdges(nodes: LayoutNode[]): Array<{ parent: LayoutNode; child: LayoutNode }> {
  const edges: Array<{ parent: LayoutNode; child: LayoutNode }> = [];
  function walk(n: LayoutNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  }
  nodes.forEach(walk);
  return edges;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  cto: "CTO",
  cmo: "CMO",
  cfo: "CFO",
  coo: "COO",
  vp: "VP",
  manager: "Manager",
  engineer: "Engineer",
  agent: "Agent",
};

/**
 * Build an org-tree from the manifest agent list using reportsToSlug.
 */
function buildOrgTree(agents: CompanyPortabilityManifest["agents"]): OrgNode[] {
  const bySlug = new Map(agents.map((a) => [a.slug, a]));
  const childrenOf = new Map<string | null, OrgNode[]>();

  for (const agent of agents) {
    const node: OrgNode = {
      id: agent.slug,
      name: agent.name,
      role: agent.role,
      reports: [],
    };
    const parentKey = agent.reportsToSlug ?? null;
    const siblings = childrenOf.get(parentKey) ?? [];
    siblings.push(node);
    childrenOf.set(parentKey, siblings);
  }

  // Build tree recursively
  function attach(nodes: OrgNode[]): OrgNode[] {
    for (const node of nodes) {
      node.reports = childrenOf.get(node.id) ?? [];
      attach(node.reports);
    }
    return nodes;
  }

  // Roots are agents whose reportsToSlug is null or points to a non-existent agent
  const roots: OrgNode[] = [];
  for (const [parentKey, children] of childrenOf.entries()) {
    if (parentKey === null || !bySlug.has(parentKey)) {
      roots.push(...children);
    }
  }
  return attach(roots);
}

/**
 * Generate an SVG org chart from the manifest agents.
 * Returns null if there are no agents.
 */
export function generateOrgChartSvg(manifest: CompanyPortabilityManifest): string | null {
  if (manifest.agents.length === 0) return null;

  const roots = buildOrgTree(manifest.agents);
  if (roots.length === 0) return null;

  // Layout all roots side by side
  const layoutRoots: LayoutNode[] = [];
  let x = PADDING;
  for (const root of roots) {
    const w = subtreeWidth(root);
    layoutRoots.push(layoutTree(root, x, PADDING));
    x += w + GAP_X;
  }

  const allNodes = flattenLayout(layoutRoots);
  const edges = collectEdges(layoutRoots);

  // Compute canvas bounds
  let maxX = 0;
  let maxY = 0;
  for (const n of allNodes) {
    maxX = Math.max(maxX, n.x + CARD_W);
    maxY = Math.max(maxY, n.y + CARD_H);
  }
  const svgW = maxX + PADDING;
  const svgH = maxY + PADDING;

  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`);
  lines.push(`<style>`);
  lines.push(`  text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }`);
  lines.push(`</style>`);
  lines.push(`<rect width="${svgW}" height="${svgH}" fill="#ffffff" rx="8"/>`);

  // Draw edges (bezier connectors)
  for (const { parent, child } of edges) {
    const x1 = parent.x + CARD_W / 2;
    const y1 = parent.y + CARD_H;
    const x2 = child.x + CARD_W / 2;
    const y2 = child.y;
    const midY = (y1 + y2) / 2;
    lines.push(`<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}" fill="none" stroke="#d1d5db" stroke-width="2"/>`);
  }

  // Draw cards
  for (const node of allNodes) {
    const roleLabel = ROLE_LABELS[node.role] ?? node.role;
    lines.push(`<g transform="translate(${node.x},${node.y})">`);
    lines.push(`  <rect width="${CARD_W}" height="${CARD_H}" rx="8" fill="#f9fafb" stroke="#e5e7eb" stroke-width="1.5"/>`);
    lines.push(`  <text x="${CARD_W / 2}" y="28" text-anchor="middle" font-size="14" font-weight="600" fill="#111827">${escapeXml(truncate(node.name, 22))}</text>`);
    lines.push(`  <text x="${CARD_W / 2}" y="48" text-anchor="middle" font-size="12" fill="#6b7280">${escapeXml(roleLabel)}</text>`);
    lines.push(`</g>`);
  }

  lines.push(`</svg>`);
  return lines.join("\n");
}

/**
 * Generate the README.md content for a company export.
 */
export function generateReadme(
  manifest: CompanyPortabilityManifest,
  options: {
    companyName: string;
    companyDescription: string | null;
    hasOrgChart: boolean;
  },
): string {
  const lines: string[] = [];

  lines.push(`# ${options.companyName}`);
  lines.push("");
  if (options.companyDescription) {
    lines.push(`> ${options.companyDescription}`);
    lines.push("");
  }

  if (options.hasOrgChart) {
    lines.push(`![Org Chart](images/org-chart.svg)`);
    lines.push("");
  }

  // What's Inside table
  lines.push("## What's Inside");
  lines.push("");
  lines.push("This is an [Agent Company](https://paperclip.ing) package.");
  lines.push("");

  const counts: Array<[string, number]> = [];
  if (manifest.agents.length > 0) counts.push(["Agents", manifest.agents.length]);
  if (manifest.projects.length > 0) counts.push(["Projects", manifest.projects.length]);
  if (manifest.skills.length > 0) counts.push(["Skills", manifest.skills.length]);
  if (manifest.issues.length > 0) counts.push(["Tasks", manifest.issues.length]);

  if (counts.length > 0) {
    lines.push("| Content | Count |");
    lines.push("|---------|-------|");
    for (const [label, count] of counts) {
      lines.push(`| ${label} | ${count} |`);
    }
    lines.push("");
  }

  // Agents table
  if (manifest.agents.length > 0) {
    lines.push("### Agents");
    lines.push("");
    lines.push("| Agent | Role | Reports To |");
    lines.push("|-------|------|------------|");
    for (const agent of manifest.agents) {
      const roleLabel = ROLE_LABELS[agent.role] ?? agent.role;
      const reportsTo = agent.reportsToSlug ?? "\u2014";
      lines.push(`| ${agent.name} | ${roleLabel} | ${reportsTo} |`);
    }
    lines.push("");
  }

  // Projects list
  if (manifest.projects.length > 0) {
    lines.push("### Projects");
    lines.push("");
    for (const project of manifest.projects) {
      const desc = project.description ? ` \u2014 ${project.description}` : "";
      lines.push(`- **${project.name}**${desc}`);
    }
    lines.push("");
  }

  // Getting Started
  lines.push("## Getting Started");
  lines.push("");
  lines.push("```bash");
  lines.push("pnpm paperclipai company import this-github-url-or-folder");
  lines.push("```");
  lines.push("");
  lines.push("See [Paperclip](https://paperclip.ing) for more information.");
  lines.push("");

  // Footer
  lines.push("---");
  lines.push(`Exported from [Paperclip](https://paperclip.ing) on ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  return lines.join("\n");
}
