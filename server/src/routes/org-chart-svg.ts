/**
 * Server-side SVG renderer for Paperclip org charts.
 * Renders the org tree in the "Warmth" style with Paperclip branding.
 * Supports SVG output and PNG conversion via sharp.
 */
import sharp from "sharp";

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  status: string;
  reports: OrgNode[];
}

interface LayoutNode {
  node: OrgNode;
  x: number;
  y: number;
  width: number;
  height: number;
  children: LayoutNode[];
}

// ── Design tokens (Warmth style — matches index.html s-warm) ──────
const CARD_H = 88;
const CARD_MIN_W = 150;
const CARD_PAD_X = 22;
const CARD_RADIUS = 6;
const AVATAR_SIZE = 34;
const GAP_X = 24;
const GAP_Y = 56;
const LINE_COLOR = "#d6d3d1";
const LINE_W = 2;
const BG_COLOR = "#fafaf9";
const CARD_BG = "#ffffff";
const CARD_BORDER = "#e7e5e4";
const CARD_SHADOW_COLOR = "rgba(0,0,0,0.05)";
const NAME_COLOR = "#1c1917";
const ROLE_COLOR = "#78716c";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const PADDING = 48;
const LOGO_PADDING = 16;

// Role config: descriptive labels, avatar colors, and SVG icon paths (Pango-safe)
const ROLE_ICONS: Record<string, {
  bg: string;
  roleLabel: string;
  iconColor: string;
  /** SVG path data centered in a 16x16 viewBox */
  iconPath: string;
}> = {
  ceo: {
    bg: "#fef3c7", roleLabel: "Chief Executive", iconColor: "#92400e",
    // Star icon
    iconPath: "M8 1l2.2 4.5L15 6.2l-3.5 3.4.8 4.9L8 12.2 3.7 14.5l.8-4.9L1 6.2l4.8-.7z",
  },
  cto: {
    bg: "#dbeafe", roleLabel: "Technology", iconColor: "#1e40af",
    // Terminal/code icon
    iconPath: "M2 3l5 5-5 5M9 13h5",
  },
  cmo: {
    bg: "#dcfce7", roleLabel: "Marketing", iconColor: "#166534",
    // Globe icon
    iconPath: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM1 8h14M8 1c-2 2-3 4.5-3 7s1 5 3 7c2-2 3-4.5 3-7s-1-5-3-7z",
  },
  cfo: {
    bg: "#fef3c7", roleLabel: "Finance", iconColor: "#92400e",
    // Dollar sign icon
    iconPath: "M8 1v14M5 4.5C5 3.1 6.3 2 8 2s3 1.1 3 2.5S9.7 7 8 7 5 8.1 5 9.5 6.3 12 8 12s3-1.1 3-2.5",
  },
  coo: {
    bg: "#e0f2fe", roleLabel: "Operations", iconColor: "#075985",
    // Settings/gear icon
    iconPath: "M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM13 8a5 5 0 0 1-.1.9l1.5 1.2-1.5 2.5-1.7-.7a5 5 0 0 1-1.6.9L9.3 15H6.7l-.3-2.2a5 5 0 0 1-1.6-.9l-1.7.7L1.6 10l1.5-1.2A5 5 0 0 1 3 8c0-.3 0-.6.1-.9L1.6 6l1.5-2.5 1.7.7a5 5 0 0 1 1.6-.9L6.7 1h2.6l.3 2.2c.6.2 1.1.5 1.6.9l1.7-.7L14.4 6l-1.5 1.2c.1.2.1.5.1.8z",
  },
  engineer: {
    bg: "#f3e8ff", roleLabel: "Engineering", iconColor: "#6b21a8",
    // Code brackets icon
    iconPath: "M5 3L1 8l4 5M11 3l4 5-4 5",
  },
  quality: {
    bg: "#ffe4e6", roleLabel: "Quality", iconColor: "#9f1239",
    // Checkmark/shield icon
    iconPath: "M4 8l3 3 5-6M8 1L2 4v4c0 3.5 2.6 6.8 6 8 3.4-1.2 6-4.5 6-8V4z",
  },
  design: {
    bg: "#fce7f3", roleLabel: "Design", iconColor: "#9d174d",
    // Pen/brush icon
    iconPath: "M12 2l2 2-9 9H3v-2zM9.5 4.5l2 2",
  },
  finance: {
    bg: "#fef3c7", roleLabel: "Finance", iconColor: "#92400e",
    iconPath: "M8 1v14M5 4.5C5 3.1 6.3 2 8 2s3 1.1 3 2.5S9.7 7 8 7 5 8.1 5 9.5 6.3 12 8 12s3-1.1 3-2.5",
  },
  operations: {
    bg: "#e0f2fe", roleLabel: "Operations", iconColor: "#075985",
    iconPath: "M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM13 8a5 5 0 0 1-.1.9l1.5 1.2-1.5 2.5-1.7-.7a5 5 0 0 1-1.6.9L9.3 15H6.7l-.3-2.2a5 5 0 0 1-1.6-.9l-1.7.7L1.6 10l1.5-1.2A5 5 0 0 1 3 8c0-.3 0-.6.1-.9L1.6 6l1.5-2.5 1.7.7a5 5 0 0 1 1.6-.9L6.7 1h2.6l.3 2.2c.6.2 1.1.5 1.6.9l1.7-.7L14.4 6l-1.5 1.2c.1.2.1.5.1.8z",
  },
  default: {
    bg: "#f3e8ff", roleLabel: "Agent", iconColor: "#6b21a8",
    // User icon
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

function measureText(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}

function cardWidth(node: OrgNode): number {
  const tag = guessRoleTag(node);
  const roleLabel = ROLE_ICONS[tag]?.roleLabel ?? node.role;
  const nameW = measureText(node.name, 14) + CARD_PAD_X * 2;
  const roleW = measureText(roleLabel, 11) + CARD_PAD_X * 2;
  return Math.max(CARD_MIN_W, Math.max(nameW, roleW));
}

// ── Tree layout (top-down, centered) ────────────────────────────

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

// ── SVG rendering ───────────────────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderCard(ln: LayoutNode): string {
  const tag = guessRoleTag(ln.node);
  const role = ROLE_ICONS[tag] || ROLE_ICONS.default;
  const cx = ln.x + ln.width / 2;

  // Vertical layout: avatar circle → name → role label
  const avatarCY = ln.y + 24;
  const nameY = ln.y + 52;
  const roleY = ln.y + 68;

  // SVG icon inside the avatar circle, scaled to fit
  const iconScale = 0.7;
  const iconOffset = (AVATAR_SIZE * iconScale) / 2;
  const iconX = cx - iconOffset;
  const iconY = avatarCY - iconOffset;

  return `
    <g>
      <filter id="shadow-${ln.node.id}" x="-4" y="-2" width="${ln.width + 8}" height="${ln.height + 6}">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="${CARD_SHADOW_COLOR}" />
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.03)" />
      </filter>
      <rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="${CARD_RADIUS}" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1" filter="url(#shadow-${ln.node.id})" />
      <circle cx="${cx}" cy="${avatarCY}" r="${AVATAR_SIZE / 2}" fill="${role.bg}" />
      <g transform="translate(${iconX}, ${iconY}) scale(${iconScale})">
        <path d="${role.iconPath}" fill="none" stroke="${role.iconColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <text x="${cx}" y="${nameY}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="600" fill="${NAME_COLOR}">${escapeXml(ln.node.name)}</text>
      <text x="${cx}" y="${roleY}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="500" fill="${ROLE_COLOR}">${escapeXml(role.roleLabel)}</text>
    </g>`;
}

function renderConnectors(ln: LayoutNode): string {
  if (ln.children.length === 0) return "";

  const parentCx = ln.x + ln.width / 2;
  const parentBottom = ln.y + ln.height;
  const midY = parentBottom + GAP_Y / 2;

  let svg = "";

  // Vertical line from parent to midpoint
  svg += `<line x1="${parentCx}" y1="${parentBottom}" x2="${parentCx}" y2="${midY}" stroke="${LINE_COLOR}" stroke-width="${LINE_W}" />`;

  if (ln.children.length === 1) {
    const childCx = ln.children[0].x + ln.children[0].width / 2;
    svg += `<line x1="${childCx}" y1="${midY}" x2="${childCx}" y2="${ln.children[0].y}" stroke="${LINE_COLOR}" stroke-width="${LINE_W}" />`;
  } else {
    const leftCx = ln.children[0].x + ln.children[0].width / 2;
    const rightCx = ln.children[ln.children.length - 1].x + ln.children[ln.children.length - 1].width / 2;
    svg += `<line x1="${leftCx}" y1="${midY}" x2="${rightCx}" y2="${midY}" stroke="${LINE_COLOR}" stroke-width="${LINE_W}" />`;

    for (const child of ln.children) {
      const childCx = child.x + child.width / 2;
      svg += `<line x1="${childCx}" y1="${midY}" x2="${childCx}" y2="${child.y}" stroke="${LINE_COLOR}" stroke-width="${LINE_W}" />`;
    }
  }

  for (const child of ln.children) {
    svg += renderConnectors(child);
  }

  return svg;
}

function renderCards(ln: LayoutNode): string {
  let svg = renderCard(ln);
  for (const child of ln.children) {
    svg += renderCards(child);
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

// Paperclip logo as inline SVG path
const PAPERCLIP_LOGO_SVG = `<g>
  <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" d="m18 4-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>
  <text x="26" y="17" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="currentColor">Paperclip</text>
</g>`;

export function renderOrgChartSvg(orgTree: OrgNode[]): string {
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
  <rect width="100%" height="100%" fill="${BG_COLOR}" rx="6" />
  <g transform="translate(${logoX}, ${logoY})" color="${ROLE_COLOR}">
    ${PAPERCLIP_LOGO_SVG}
  </g>
  ${renderConnectors(layout)}
  ${renderCards(layout)}
</svg>`;
}

export async function renderOrgChartPng(orgTree: OrgNode[]): Promise<Buffer> {
  const svg = renderOrgChartSvg(orgTree);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
