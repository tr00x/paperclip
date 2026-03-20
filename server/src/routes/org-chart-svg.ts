/**
 * Server-side SVG renderer for Paperclip org charts.
 * Supports 5 visual styles: monochrome, nebula, circuit, warmth, schematic.
 * Pure SVG output — no browser/Playwright needed. PNG via sharp.
 */
import sharp from "sharp";

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reports: OrgNode[];
}

export type OrgChartStyle = "monochrome" | "nebula" | "circuit" | "warmth" | "schematic";

export const ORG_CHART_STYLES: OrgChartStyle[] = ["monochrome", "nebula", "circuit", "warmth", "schematic"];

interface LayoutNode {
  node: OrgNode;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
}

// ── Style theme definitions ──────────────────────────────────────

interface StyleTheme {
  bgColor: string;
  cardBg: string;
  cardBorder: string;
  cardRadius: number;
  cardShadow: string | null;
  lineColor: string;
  lineWidth: number;
  nameColor: string;
  roleColor: string;
  font: string;
  watermarkColor: string;
  /** Extra SVG defs (filters, patterns, gradients) */
  defs: (svgW: number, svgH: number) => string;
  /** Extra background elements after the main bg rect */
  bgExtras: (svgW: number, svgH: number) => string;
  /** Custom card renderer — if null, uses default avatar+name+role */
  renderCard: ((ln: LayoutNode, theme: StyleTheme) => string) | null;
  /** Per-card accent (top bar, border glow, etc.) */
  cardAccent: ((tag: string) => string) | null;
}

// ── Role icons (shared across styles) ────────────────────────────

const ROLE_ICONS: Record<string, {
  bg: string;
  roleLabel: string;
  iconColor: string;
  iconPath: string;
  accentColor: string;
}> = {
  ceo: {
    bg: "#fef3c7", roleLabel: "Chief Executive", iconColor: "#92400e", accentColor: "#f0883e",
    iconPath: "M8 1l2.2 4.5L15 6.2l-3.5 3.4.8 4.9L8 12.2 3.7 14.5l.8-4.9L1 6.2l4.8-.7z",
  },
  cto: {
    bg: "#dbeafe", roleLabel: "Technology", iconColor: "#1e40af", accentColor: "#58a6ff",
    iconPath: "M2 3l5 5-5 5M9 13h5",
  },
  cmo: {
    bg: "#dcfce7", roleLabel: "Marketing", iconColor: "#166534", accentColor: "#3fb950",
    iconPath: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM1 8h14M8 1c-2 2-3 4.5-3 7s1 5 3 7c2-2 3-4.5 3-7s-1-5-3-7z",
  },
  cfo: {
    bg: "#fef3c7", roleLabel: "Finance", iconColor: "#92400e", accentColor: "#f0883e",
    iconPath: "M8 1v14M5 4.5C5 3.1 6.3 2 8 2s3 1.1 3 2.5S9.7 7 8 7 5 8.1 5 9.5 6.3 12 8 12s3-1.1 3-2.5",
  },
  coo: {
    bg: "#e0f2fe", roleLabel: "Operations", iconColor: "#075985", accentColor: "#58a6ff",
    iconPath: "M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM13 8a5 5 0 0 1-.1.9l1.5 1.2-1.5 2.5-1.7-.7a5 5 0 0 1-1.6.9L9.3 15H6.7l-.3-2.2a5 5 0 0 1-1.6-.9l-1.7.7L1.6 10l1.5-1.2A5 5 0 0 1 3 8c0-.3 0-.6.1-.9L1.6 6l1.5-2.5 1.7.7a5 5 0 0 1 1.6-.9L6.7 1h2.6l.3 2.2c.6.2 1.1.5 1.6.9l1.7-.7L14.4 6l-1.5 1.2c.1.2.1.5.1.8z",
  },
  engineer: {
    bg: "#f3e8ff", roleLabel: "Engineering", iconColor: "#6b21a8", accentColor: "#bc8cff",
    iconPath: "M5 3L1 8l4 5M11 3l4 5-4 5",
  },
  quality: {
    bg: "#ffe4e6", roleLabel: "Quality", iconColor: "#9f1239", accentColor: "#f778ba",
    iconPath: "M4 8l3 3 5-6M8 1L2 4v4c0 3.5 2.6 6.8 6 8 3.4-1.2 6-4.5 6-8V4z",
  },
  design: {
    bg: "#fce7f3", roleLabel: "Design", iconColor: "#9d174d", accentColor: "#79c0ff",
    iconPath: "M12 2l2 2-9 9H3v-2zM9.5 4.5l2 2",
  },
  finance: {
    bg: "#fef3c7", roleLabel: "Finance", iconColor: "#92400e", accentColor: "#f0883e",
    iconPath: "M8 1v14M5 4.5C5 3.1 6.3 2 8 2s3 1.1 3 2.5S9.7 7 8 7 5 8.1 5 9.5 6.3 12 8 12s3-1.1 3-2.5",
  },
  operations: {
    bg: "#e0f2fe", roleLabel: "Operations", iconColor: "#075985", accentColor: "#58a6ff",
    iconPath: "M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM13 8a5 5 0 0 1-.1.9l1.5 1.2-1.5 2.5-1.7-.7a5 5 0 0 1-1.6.9L9.3 15H6.7l-.3-2.2a5 5 0 0 1-1.6-.9l-1.7.7L1.6 10l1.5-1.2A5 5 0 0 1 3 8c0-.3 0-.6.1-.9L1.6 6l1.5-2.5 1.7.7a5 5 0 0 1 1.6-.9L6.7 1h2.6l.3 2.2c.6.2 1.1.5 1.6.9l1.7-.7L14.4 6l-1.5 1.2c.1.2.1.5.1.8z",
  },
  default: {
    bg: "#f3e8ff", roleLabel: "Agent", iconColor: "#6b21a8", accentColor: "#bc8cff",
    iconPath: "M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 14c0-3.3 2.7-4 6-4s6 .7 6 4",
  },
};

function guessRoleTag(node: OrgNode): string {
  const name = node.name.toLowerCase();
  const role = node.role.toLowerCase();
  if (name === "ceo" || role.includes("chief executive")) return "ceo";
  if (name === "cto" || role.includes("chief technology") || role.includes("technology")) return "cto";
  if (name === "cmo" || role.includes("chief marketing") || role.includes("marketing")) return "cmo";
  if (name === "cfo" || role.includes("chief financial")) return "cfo";
  if (name === "coo" || role.includes("chief operating")) return "coo";
  if (role.includes("engineer") || role.includes("eng")) return "engineer";
  if (role.includes("quality") || role.includes("qa")) return "quality";
  if (role.includes("design")) return "design";
  if (role.includes("finance")) return "finance";
  if (role.includes("operations") || role.includes("ops")) return "operations";
  return "default";
}

function getRoleInfo(node: OrgNode) {
  const tag = guessRoleTag(node);
  return { tag, ...(ROLE_ICONS[tag] || ROLE_ICONS.default) };
}

// ── Style themes ─────────────────────────────────────────────────

const THEMES: Record<OrgChartStyle, StyleTheme> = {
  // 01 — Monochrome (Vercel-inspired, dark minimal)
  monochrome: {
    bgColor: "#18181b",
    cardBg: "#18181b",
    cardBorder: "#27272a",
    cardRadius: 6,
    cardShadow: null,
    lineColor: "#3f3f46",
    lineWidth: 1.5,
    nameColor: "#fafafa",
    roleColor: "#71717a",
    font: "'Inter', system-ui, sans-serif",
    watermarkColor: "rgba(255,255,255,0.25)",
    defs: () => "",
    bgExtras: () => "",
    renderCard: null,
    cardAccent: null,
  },

  // 02 — Nebula (glassmorphism on cosmic gradient)
  nebula: {
    bgColor: "#0f0c29",
    cardBg: "rgba(255,255,255,0.07)",
    cardBorder: "rgba(255,255,255,0.12)",
    cardRadius: 6,
    cardShadow: null,
    lineColor: "rgba(255,255,255,0.25)",
    lineWidth: 1.5,
    nameColor: "#ffffff",
    roleColor: "rgba(255,255,255,0.45)",
    font: "'Inter', system-ui, sans-serif",
    watermarkColor: "rgba(255,255,255,0.2)",
    defs: (_w, _h) => `
      <linearGradient id="nebula-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f0c29"/>
        <stop offset="50%" stop-color="#302b63"/>
        <stop offset="100%" stop-color="#24243e"/>
      </linearGradient>
      <radialGradient id="nebula-glow1" cx="25%" cy="30%" r="40%">
        <stop offset="0%" stop-color="rgba(99,102,241,0.12)"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
      <radialGradient id="nebula-glow2" cx="75%" cy="65%" r="35%">
        <stop offset="0%" stop-color="rgba(168,85,247,0.08)"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>`,
    bgExtras: (w, h) => `
      <rect width="${w}" height="${h}" fill="url(#nebula-bg)" rx="6"/>
      <rect width="${w}" height="${h}" fill="url(#nebula-glow1)"/>
      <rect width="${w}" height="${h}" fill="url(#nebula-glow2)"/>`,
    renderCard: null,
    cardAccent: null,
  },

  // 03 — Circuit (Linear/Raycast — indigo traces, amethyst CEO)
  circuit: {
    bgColor: "#0c0c0e",
    cardBg: "rgba(99,102,241,0.04)",
    cardBorder: "rgba(99,102,241,0.18)",
    cardRadius: 5,
    cardShadow: null,
    lineColor: "rgba(99,102,241,0.35)",
    lineWidth: 1.5,
    nameColor: "#e4e4e7",
    roleColor: "#6366f1",
    font: "'Inter', system-ui, sans-serif",
    watermarkColor: "rgba(99,102,241,0.3)",
    defs: () => "",
    bgExtras: () => "",
    renderCard: (ln: LayoutNode, theme: StyleTheme) => {
      const { tag, roleLabel, iconPath, iconColor } = getRoleInfo(ln.node);
      const cx = ln.x + ln.width / 2;
      const isCeo = tag === "ceo";
      const borderColor = isCeo ? "rgba(168,85,247,0.35)" : theme.cardBorder;
      const bgColor = isCeo ? "rgba(168,85,247,0.06)" : theme.cardBg;

      const avatarCY = ln.y + 24;
      const nameY = ln.y + 52;
      const roleY = ln.y + 68;
      const iconScale = 0.7;
      const iconOffset = (34 * iconScale) / 2;

      return `<g>
        <rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="${theme.cardRadius}" fill="${bgColor}" stroke="${borderColor}" stroke-width="1"/>
        <circle cx="${cx}" cy="${avatarCY}" r="17" fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.15)" stroke-width="1"/>
        <g transform="translate(${cx - iconOffset}, ${avatarCY - iconOffset}) scale(${iconScale})">
          <path d="${iconPath}" fill="none" stroke="${iconColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <text x="${cx}" y="${nameY}" text-anchor="middle" font-family="${theme.font}" font-size="13" font-weight="600" fill="${theme.nameColor}" letter-spacing="-0.005em">${escapeXml(ln.node.name)}</text>
        <text x="${cx}" y="${roleY}" text-anchor="middle" font-family="${theme.font}" font-size="10" font-weight="500" fill="${theme.roleColor}" letter-spacing="0.07em">${escapeXml(roleLabel).toUpperCase()}</text>
      </g>`;
    },
    cardAccent: null,
  },

  // 04 — Warmth (Airbnb — light, colored avatars, soft shadows)
  warmth: {
    bgColor: "#fafaf9",
    cardBg: "#ffffff",
    cardBorder: "#e7e5e4",
    cardRadius: 6,
    cardShadow: "rgba(0,0,0,0.05)",
    lineColor: "#d6d3d1",
    lineWidth: 2,
    nameColor: "#1c1917",
    roleColor: "#78716c",
    font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    watermarkColor: "rgba(0,0,0,0.25)",
    defs: () => "",
    bgExtras: () => "",
    renderCard: null,
    cardAccent: null,
  },

  // 05 — Schematic (Blueprint — grid bg, monospace, colored top-bars)
  schematic: {
    bgColor: "#0d1117",
    cardBg: "rgba(13,17,23,0.92)",
    cardBorder: "#30363d",
    cardRadius: 4,
    cardShadow: null,
    lineColor: "#30363d",
    lineWidth: 1.5,
    nameColor: "#c9d1d9",
    roleColor: "#8b949e",
    font: "'JetBrains Mono', 'SF Mono', monospace",
    watermarkColor: "rgba(139,148,158,0.3)",
    defs: (w, h) => `
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(48,54,61,0.25)" stroke-width="1"/>
      </pattern>`,
    bgExtras: (w, h) => `<rect width="${w}" height="${h}" fill="url(#grid)"/>`,
    renderCard: (ln: LayoutNode, theme: StyleTheme) => {
      const { tag, accentColor, iconPath, iconColor } = getRoleInfo(ln.node);
      const cx = ln.x + ln.width / 2;

      // Schematic uses monospace role labels
      const schemaRoles: Record<string, string> = {
        ceo: "chief_executive", cto: "chief_technology", cmo: "chief_marketing",
        cfo: "chief_financial", coo: "chief_operating", engineer: "engineer",
        quality: "quality_assurance", design: "designer", finance: "finance",
        operations: "operations", default: "agent",
      };
      const roleText = schemaRoles[tag] || schemaRoles.default;

      const avatarCY = ln.y + 24;
      const nameY = ln.y + 52;
      const roleY = ln.y + 68;
      const iconScale = 0.7;
      const iconOffset = (34 * iconScale) / 2;

      return `<g>
        <rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="${theme.cardRadius}" fill="${theme.cardBg}" stroke="${theme.cardBorder}" stroke-width="1"/>
        <rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="2" rx="${theme.cardRadius} ${theme.cardRadius} 0 0" fill="${accentColor}"/>
        <circle cx="${cx}" cy="${avatarCY}" r="17" fill="rgba(48,54,61,0.3)" stroke="${theme.cardBorder}" stroke-width="1"/>
        <g transform="translate(${cx - iconOffset}, ${avatarCY - iconOffset}) scale(${iconScale})">
          <path d="${iconPath}" fill="none" stroke="${iconColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <text x="${cx}" y="${nameY}" text-anchor="middle" font-family="${theme.font}" font-size="12" font-weight="600" fill="${theme.nameColor}">${escapeXml(ln.node.name)}</text>
        <text x="${cx}" y="${roleY}" text-anchor="middle" font-family="${theme.font}" font-size="10" fill="${theme.roleColor}" letter-spacing="0.02em">${escapeXml(roleText)}</text>
      </g>`;
    },
    cardAccent: null,
  },
};

// ── Layout constants ─────────────────────────────────────────────

const CARD_H = 88;
const CARD_MIN_W = 150;
const CARD_PAD_X = 22;
const AVATAR_SIZE = 34;
const GAP_X = 24;
const GAP_Y = 56;
const PADDING = 48;
const LOGO_PADDING = 16;

// ── Text measurement ─────────────────────────────────────────────

function measureText(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}

function cardWidth(node: OrgNode): number {
  const { roleLabel } = getRoleInfo(node);
  const nameW = measureText(node.name, 14) + CARD_PAD_X * 2;
  const roleW = measureText(roleLabel, 11) + CARD_PAD_X * 2;
  return Math.max(CARD_MIN_W, Math.max(nameW, roleW));
}

// ── Tree layout (top-down, centered) ─────────────────────────────

function subtreeWidth(node: OrgNode): number {
  const cw = cardWidth(node);
  if (!node.reports || node.reports.length === 0) return cw;
  const childrenW = node.reports.reduce(
    (sum, child, i) => sum + subtreeWidth(child) + (i > 0 ? GAP_X : 0),
    0,
  );
  return Math.max(cw, childrenW);
}

function layoutTree(node: OrgNode, x: number, y: number): LayoutNode {
  const w = cardWidth(node);
  const sw = subtreeWidth(node);
  const cardX = x + (sw - w) / 2;

  const layoutNode: LayoutNode = {
    node,
    x: cardX,
    y,
    width: w,
    height: CARD_H,
    children: [],
  };

  if (node.reports && node.reports.length > 0) {
    let childX = x;
    const childY = y + CARD_H + GAP_Y;
    for (let i = 0; i < node.reports.length; i++) {
      const child = node.reports[i];
      const childSW = subtreeWidth(child);
      layoutNode.children.push(layoutTree(child, childX, childY));
      childX += childSW + GAP_X;
    }
  }

  return layoutNode;
}

// ── SVG rendering ────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function defaultRenderCard(ln: LayoutNode, theme: StyleTheme): string {
  const { roleLabel, bg, iconColor, iconPath } = getRoleInfo(ln.node);
  const cx = ln.x + ln.width / 2;

  const avatarCY = ln.y + 24;
  const nameY = ln.y + 52;
  const roleY = ln.y + 68;

  const iconScale = 0.7;
  const iconOffset = (AVATAR_SIZE * iconScale) / 2;
  const iconX = cx - iconOffset;
  const iconY = avatarCY - iconOffset;

  const filterId = `shadow-${ln.node.id}`;
  const shadowFilter = theme.cardShadow
    ? `filter="url(#${filterId})"`
    : "";
  const shadowDef = theme.cardShadow
    ? `<filter id="${filterId}" x="-4" y="-2" width="${ln.width + 8}" height="${ln.height + 6}">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="${theme.cardShadow}"/>
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.03)"/>
      </filter>`
    : "";

  // For dark themes without avatars, use a subtle circle
  const isLight = theme.bgColor === "#fafaf9" || theme.bgColor === "#ffffff";
  const avatarBg = isLight ? bg : "rgba(255,255,255,0.06)";
  const avatarStroke = isLight ? "" : `stroke="rgba(255,255,255,0.08)" stroke-width="1"`;

  return `<g>
    ${shadowDef}
    <rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="${theme.cardRadius}" fill="${theme.cardBg}" stroke="${theme.cardBorder}" stroke-width="1" ${shadowFilter}/>
    <circle cx="${cx}" cy="${avatarCY}" r="${AVATAR_SIZE / 2}" fill="${avatarBg}" ${avatarStroke}/>
    <g transform="translate(${iconX}, ${iconY}) scale(${iconScale})">
      <path d="${iconPath}" fill="none" stroke="${iconColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="${cx}" y="${nameY}" text-anchor="middle" font-family="${theme.font}" font-size="14" font-weight="600" fill="${theme.nameColor}">${escapeXml(ln.node.name)}</text>
    <text x="${cx}" y="${roleY}" text-anchor="middle" font-family="${theme.font}" font-size="11" font-weight="500" fill="${theme.roleColor}">${escapeXml(roleLabel)}</text>
  </g>`;
}

function renderConnectors(ln: LayoutNode, theme: StyleTheme): string {
  if (ln.children.length === 0) return "";

  const parentCx = ln.x + ln.width / 2;
  const parentBottom = ln.y + ln.height;
  const midY = parentBottom + GAP_Y / 2;
  const lc = theme.lineColor;
  const lw = theme.lineWidth;

  let svg = "";
  svg += `<line x1="${parentCx}" y1="${parentBottom}" x2="${parentCx}" y2="${midY}" stroke="${lc}" stroke-width="${lw}"/>`;

  if (ln.children.length === 1) {
    const childCx = ln.children[0].x + ln.children[0].width / 2;
    svg += `<line x1="${childCx}" y1="${midY}" x2="${childCx}" y2="${ln.children[0].y}" stroke="${lc}" stroke-width="${lw}"/>`;
  } else {
    const leftCx = ln.children[0].x + ln.children[0].width / 2;
    const rightCx = ln.children[ln.children.length - 1].x + ln.children[ln.children.length - 1].width / 2;
    svg += `<line x1="${leftCx}" y1="${midY}" x2="${rightCx}" y2="${midY}" stroke="${lc}" stroke-width="${lw}"/>`;

    for (const child of ln.children) {
      const childCx = child.x + child.width / 2;
      svg += `<line x1="${childCx}" y1="${midY}" x2="${childCx}" y2="${child.y}" stroke="${lc}" stroke-width="${lw}"/>`;
    }
  }

  for (const child of ln.children) {
    svg += renderConnectors(child, theme);
  }
  return svg;
}

function renderCards(ln: LayoutNode, theme: StyleTheme): string {
  const render = theme.renderCard || defaultRenderCard;
  let svg = render(ln, theme);
  for (const child of ln.children) {
    svg += renderCards(child, theme);
  }
  return svg;
}

function treeBounds(ln: LayoutNode): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = ln.x;
  let minY = ln.y;
  let maxX = ln.x + ln.width;
  let maxY = ln.y + ln.height;
  for (const child of ln.children) {
    const cb = treeBounds(child);
    minX = Math.min(minX, cb.minX);
    minY = Math.min(minY, cb.minY);
    maxX = Math.max(maxX, cb.maxX);
    maxY = Math.max(maxY, cb.maxY);
  }
  return { minX, minY, maxX, maxY };
}

const PAPERCLIP_LOGO_SVG = `<g>
  <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" d="m18 4-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>
  <text x="26" y="17" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="currentColor">Paperclip</text>
</g>`;

// ── Public API ───────────────────────────────────────────────────

export function renderOrgChartSvg(orgTree: OrgNode[], style: OrgChartStyle = "warmth"): string {
  const theme = THEMES[style] || THEMES.warmth;

  let root: OrgNode;
  if (orgTree.length === 1) {
    root = orgTree[0];
  } else {
    root = {
      id: "virtual-root",
      name: "Organization",
      role: "Root",
      status: "active",
      reports: orgTree,
    };
  }

  const layout = layoutTree(root, PADDING, PADDING + 24);
  const bounds = treeBounds(layout);

  const svgW = bounds.maxX + PADDING;
  const svgH = bounds.maxY + PADDING;

  const logoX = svgW - 110 - LOGO_PADDING;
  const logoY = LOGO_PADDING;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <defs>${theme.defs(svgW, svgH)}</defs>
  <rect width="100%" height="100%" fill="${theme.bgColor}" rx="6"/>
  ${theme.bgExtras(svgW, svgH)}
  <g transform="translate(${logoX}, ${logoY})" color="${theme.watermarkColor}">
    ${PAPERCLIP_LOGO_SVG}
  </g>
  ${renderConnectors(layout, theme)}
  ${renderCards(layout, theme)}
</svg>`;
}

export async function renderOrgChartPng(orgTree: OrgNode[], style: OrgChartStyle = "warmth"): Promise<Buffer> {
  const svg = renderOrgChartSvg(orgTree, style);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
