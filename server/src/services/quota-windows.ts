import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProviderQuotaResult, QuotaWindow } from "@paperclipai/shared";

// ---------- claude ----------

function claudeConfigDir(): string {
  const fromEnv = process.env.CLAUDE_CONFIG_DIR;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) return fromEnv.trim();
  return path.join(os.homedir(), ".claude");
}

async function readClaudeToken(): Promise<string | null> {
  const credPath = path.join(claudeConfigDir(), "credentials.json");
  let raw: string;
  try {
    raw = await fs.readFile(credPath, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const oauth = obj["claudeAiOauth"];
  if (typeof oauth !== "object" || oauth === null) return null;
  const token = (oauth as Record<string, unknown>)["accessToken"];
  return typeof token === "string" && token.length > 0 ? token : null;
}

interface AnthropicUsageWindow {
  utilization?: number | null;
  resets_at?: string | null;
}

interface AnthropicUsageResponse {
  five_hour?: AnthropicUsageWindow | null;
  seven_day?: AnthropicUsageWindow | null;
  seven_day_sonnet?: AnthropicUsageWindow | null;
  seven_day_opus?: AnthropicUsageWindow | null;
}

function toPercent(utilization: number | null | undefined): number | null {
  if (utilization == null) return null;
  // utilization is 0-1 fraction; clamp to 100 in case of floating-point overshoot
  return Math.min(100, Math.round(utilization * 100));
}

// fetch with an abort-based timeout so a hanging provider api doesn't block the response indefinitely
async function fetchWithTimeout(url: string, init: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchClaudeQuota(token: string): Promise<QuotaWindow[]> {
  const resp = await fetchWithTimeout("https://api.anthropic.com/api/oauth/usage", {
    headers: {
      "Authorization": `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
    },
  });
  if (!resp.ok) throw new Error(`anthropic usage api returned ${resp.status}`);
  const body = (await resp.json()) as AnthropicUsageResponse;
  const windows: QuotaWindow[] = [];

  if (body.five_hour != null) {
    windows.push({
      label: "5h",
      usedPercent: toPercent(body.five_hour.utilization),
      resetsAt: body.five_hour.resets_at ?? null,
      valueLabel: null,
    });
  }
  if (body.seven_day != null) {
    windows.push({
      label: "7d",
      usedPercent: toPercent(body.seven_day.utilization),
      resetsAt: body.seven_day.resets_at ?? null,
      valueLabel: null,
    });
  }
  if (body.seven_day_sonnet != null) {
    windows.push({
      label: "Sonnet 7d",
      usedPercent: toPercent(body.seven_day_sonnet.utilization),
      resetsAt: body.seven_day_sonnet.resets_at ?? null,
      valueLabel: null,
    });
  }
  if (body.seven_day_opus != null) {
    windows.push({
      label: "Opus 7d",
      usedPercent: toPercent(body.seven_day_opus.utilization),
      resetsAt: body.seven_day_opus.resets_at ?? null,
      valueLabel: null,
    });
  }
  return windows;
}

// ---------- codex / openai ----------

function codexHomeDir(): string {
  const fromEnv = process.env.CODEX_HOME;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) return fromEnv.trim();
  return path.join(os.homedir(), ".codex");
}

interface CodexAuthFile {
  accessToken?: string | null;
  accountId?: string | null;
}

async function readCodexToken(): Promise<{ token: string; accountId: string | null } | null> {
  const authPath = path.join(codexHomeDir(), "auth.json");
  let raw: string;
  try {
    raw = await fs.readFile(authPath, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as CodexAuthFile;
  const token = obj.accessToken;
  if (typeof token !== "string" || token.length === 0) return null;
  const accountId = typeof obj.accountId === "string" && obj.accountId.length > 0
    ? obj.accountId
    : null;
  return { token, accountId };
}

interface WhamWindow {
  used_percent?: number | null;
  limit_window_seconds?: number | null;
  reset_at?: string | null;
}

interface WhamCredits {
  balance?: number | null;
  unlimited?: boolean | null;
}

interface WhamUsageResponse {
  rate_limit?: {
    primary_window?: WhamWindow | null;
    secondary_window?: WhamWindow | null;
  } | null;
  credits?: WhamCredits | null;
}

function secondsToWindowLabel(seconds: number | null | undefined, fallback: string): string {
  if (seconds == null) return fallback;
  const hours = seconds / 3600;
  if (hours < 6) return "5h";
  if (hours <= 24) return "24h";
  if (hours <= 168) return "7d";
  // for windows larger than 7d, show the actual day count rather than silently mislabelling
  return `${Math.round(hours / 24)}d`;
}

async function fetchCodexQuota(token: string, accountId: string | null): Promise<QuotaWindow[]> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;

  const resp = await fetchWithTimeout("https://chatgpt.com/backend-api/wham/usage", { headers });
  if (!resp.ok) throw new Error(`chatgpt wham api returned ${resp.status}`);
  const body = (await resp.json()) as WhamUsageResponse;
  const windows: QuotaWindow[] = [];

  const rateLimit = body.rate_limit;
  if (rateLimit?.primary_window != null) {
    const w = rateLimit.primary_window;
    // wham used_percent is 0-100 (confirmed empirically); guard against 0-1 format just in case
    const rawPct = w.used_percent ?? null;
    const usedPercent = rawPct != null
      ? Math.min(100, Math.round(rawPct <= 1 ? rawPct * 100 : rawPct))
      : null;
    windows.push({
      label: secondsToWindowLabel(w.limit_window_seconds, "Primary"),
      usedPercent,
      resetsAt: w.reset_at ?? null,
      valueLabel: null,
    });
  }
  if (rateLimit?.secondary_window != null) {
    const w = rateLimit.secondary_window;
    // wham used_percent is 0-100 (confirmed empirically); guard against 0-1 format just in case
    const rawPct = w.used_percent ?? null;
    const usedPercent = rawPct != null
      ? Math.min(100, Math.round(rawPct <= 1 ? rawPct * 100 : rawPct))
      : null;
    windows.push({
      label: secondsToWindowLabel(w.limit_window_seconds, "Secondary"),
      usedPercent,
      resetsAt: w.reset_at ?? null,
      valueLabel: null,
    });
  }
  if (body.credits != null && body.credits.unlimited !== true) {
    const balance = body.credits.balance;
    const valueLabel = balance != null
      ? `$${(balance / 100).toFixed(2)} remaining`
      : "N/A";
    windows.push({
      label: "Credits",
      usedPercent: null,
      resetsAt: null,
      valueLabel,
    });
  }
  return windows;
}

// ---------- aggregate ----------

export async function fetchAllQuotaWindows(): Promise<ProviderQuotaResult[]> {
  const results: ProviderQuotaResult[] = [];

  const [claudeResult, codexResult] = await Promise.allSettled([
    (async (): Promise<ProviderQuotaResult> => {
      const token = await readClaudeToken();
      if (!token) return { provider: "anthropic", ok: false, error: "no local claude auth token", windows: [] };
      const windows = await fetchClaudeQuota(token);
      return { provider: "anthropic", ok: true, windows };
    })(),
    (async (): Promise<ProviderQuotaResult> => {
      const auth = await readCodexToken();
      if (!auth) return { provider: "openai", ok: false, error: "no local codex auth token", windows: [] };
      const windows = await fetchCodexQuota(auth.token, auth.accountId);
      return { provider: "openai", ok: true, windows };
    })(),
  ]);

  if (claudeResult.status === "fulfilled") {
    results.push(claudeResult.value);
  } else {
    results.push({ provider: "anthropic", ok: false, error: String(claudeResult.reason), windows: [] });
  }

  if (codexResult.status === "fulfilled") {
    results.push(codexResult.value);
  } else {
    results.push({ provider: "openai", ok: false, error: String(codexResult.reason), windows: [] });
  }

  return results;
}
