import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AdapterSkillContext,
  AdapterSkillEntry,
  AdapterSkillSnapshot,
} from "@paperclipai/adapter-utils";
import {
  ensurePaperclipSkillSymlink,
  readPaperclipRuntimeSkillEntries,
  resolvePaperclipDesiredSkillNames,
} from "@paperclipai/adapter-utils/server-utils";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolvePiSkillsHome(config: Record<string, unknown>) {
  const env =
    typeof config.env === "object" && config.env !== null && !Array.isArray(config.env)
      ? (config.env as Record<string, unknown>)
      : {};
  const configuredHome = asString(env.HOME);
  const home = configuredHome ? path.resolve(configuredHome) : os.homedir();
  return path.join(home, ".pi", "agent", "skills");
}

async function readInstalledSkillTargets(skillsHome: string) {
  const entries = await fs.readdir(skillsHome, { withFileTypes: true }).catch(() => []);
  const out = new Map<string, { targetPath: string | null; kind: "symlink" | "directory" | "file" }>();
  for (const entry of entries) {
    const fullPath = path.join(skillsHome, entry.name);
    if (entry.isSymbolicLink()) {
      const linkedPath = await fs.readlink(fullPath).catch(() => null);
      out.set(entry.name, {
        targetPath: linkedPath ? path.resolve(path.dirname(fullPath), linkedPath) : null,
        kind: "symlink",
      });
      continue;
    }
    if (entry.isDirectory()) {
      out.set(entry.name, { targetPath: fullPath, kind: "directory" });
      continue;
    }
    out.set(entry.name, { targetPath: fullPath, kind: "file" });
  }
  return out;
}

async function buildPiSkillSnapshot(config: Record<string, unknown>): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  const availableByKey = new Map(availableEntries.map((entry) => [entry.key, entry]));
  const desiredSkills = resolvePaperclipDesiredSkillNames(config, availableEntries);
  const desiredSet = new Set(desiredSkills);
  const skillsHome = resolvePiSkillsHome(config);
  const installed = await readInstalledSkillTargets(skillsHome);
  const entries: AdapterSkillEntry[] = [];
  const warnings: string[] = [];

  for (const available of availableEntries) {
    const installedEntry = installed.get(available.runtimeName) ?? null;
    const desired = desiredSet.has(available.key);
    let state: AdapterSkillEntry["state"] = "available";
    let managed = false;
    let detail: string | null = null;

    if (installedEntry?.targetPath === available.source) {
      managed = true;
      state = desired ? "installed" : "stale";
    } else if (installedEntry) {
      state = "external";
      detail = desired
        ? "Skill name is occupied by an external installation."
        : "Installed outside Paperclip management.";
    } else if (desired) {
      state = "missing";
      detail = "Configured but not currently linked into the Pi skills home.";
    }

    entries.push({
      key: available.key,
      runtimeName: available.runtimeName,
      desired,
      managed,
      state,
      sourcePath: available.source,
      targetPath: path.join(skillsHome, available.runtimeName),
      detail,
      required: Boolean(available.required),
      requiredReason: available.requiredReason ?? null,
    });
  }

  for (const desiredSkill of desiredSkills) {
    if (availableByKey.has(desiredSkill)) continue;
    warnings.push(`Desired skill "${desiredSkill}" is not available from the Paperclip skills directory.`);
    entries.push({
      key: desiredSkill,
      runtimeName: null,
      desired: true,
      managed: true,
      state: "missing",
      sourcePath: null,
      targetPath: null,
      detail: "Paperclip cannot find this skill in the local runtime skills directory.",
    });
  }

  for (const [name, installedEntry] of installed.entries()) {
    if (availableEntries.some((entry) => entry.runtimeName === name)) continue;
    entries.push({
      key: name,
      runtimeName: name,
      desired: false,
      managed: false,
      state: "external",
      sourcePath: null,
      targetPath: installedEntry.targetPath ?? path.join(skillsHome, name),
      detail: "Installed outside Paperclip management.",
    });
  }

  entries.sort((left, right) => left.key.localeCompare(right.key));

  return {
    adapterType: "pi_local",
    supported: true,
    mode: "persistent",
    desiredSkills,
    entries,
    warnings,
  };
}

export async function listPiSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot> {
  return buildPiSkillSnapshot(ctx.config);
}

export async function syncPiSkills(
  ctx: AdapterSkillContext,
  desiredSkills: string[],
): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(ctx.config, __moduleDir);
  const desiredSet = new Set([
    ...desiredSkills,
    ...availableEntries.filter((entry) => entry.required).map((entry) => entry.key),
  ]);
  const skillsHome = resolvePiSkillsHome(ctx.config);
  await fs.mkdir(skillsHome, { recursive: true });
  const installed = await readInstalledSkillTargets(skillsHome);
  const availableByRuntimeName = new Map(availableEntries.map((entry) => [entry.runtimeName, entry]));

  for (const available of availableEntries) {
    if (!desiredSet.has(available.key)) continue;
    const target = path.join(skillsHome, available.runtimeName);
    await ensurePaperclipSkillSymlink(available.source, target);
  }

  for (const [name, installedEntry] of installed.entries()) {
    const available = availableByRuntimeName.get(name);
    if (!available) continue;
    if (desiredSet.has(available.key)) continue;
    if (installedEntry.targetPath !== available.source) continue;
    await fs.unlink(path.join(skillsHome, name)).catch(() => {});
  }

  return buildPiSkillSnapshot(ctx.config);
}

export function resolvePiDesiredSkillNames(
  config: Record<string, unknown>,
  availableEntries: Array<{ key: string; required?: boolean }>,
) {
  return resolvePaperclipDesiredSkillNames(config, availableEntries);
}
