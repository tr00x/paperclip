import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCodexSkills,
  syncCodexSkills,
} from "@paperclipai/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("codex local skill sync", () => {
  const paperclipKey = "paperclipai/paperclip/paperclip";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured Paperclip skills and installs them into the Codex skills home", async () => {
    const codexHome = await makeTempDir("paperclip-codex-skill-sync-");
    cleanupDirs.add(codexHome);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        paperclipSkillSync: {
          desiredSkills: [paperclipKey],
        },
      },
    } as const;

    const before = await listCodexSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(paperclipKey);
    expect(before.entries.find((entry) => entry.key === paperclipKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("missing");

    const after = await syncCodexSkills(ctx, [paperclipKey]);
    expect(after.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(codexHome, "skills", "paperclip"))).isSymbolicLink()).toBe(true);
  });

  it("isolates default Codex skills by company when CODEX_HOME comes from process env", async () => {
    const sharedCodexHome = await makeTempDir("paperclip-codex-skill-scope-");
    cleanupDirs.add(sharedCodexHome);
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = sharedCodexHome;

    try {
      const companyAContext = {
        agentId: "agent-a",
        companyId: "company-a",
        adapterType: "codex_local",
        config: {
          env: {},
          paperclipSkillSync: {
            desiredSkills: [paperclipKey],
          },
        },
      } as const;

      const companyBContext = {
        agentId: "agent-b",
        companyId: "company-b",
        adapterType: "codex_local",
        config: {
          env: {},
          paperclipSkillSync: {
            desiredSkills: [paperclipKey],
          },
        },
      } as const;

      await syncCodexSkills(companyAContext, [paperclipKey]);
      await syncCodexSkills(companyBContext, [paperclipKey]);

      expect((await fs.lstat(path.join(sharedCodexHome, "companies", "company-a", "skills", "paperclip"))).isSymbolicLink()).toBe(true);
      expect((await fs.lstat(path.join(sharedCodexHome, "companies", "company-b", "skills", "paperclip"))).isSymbolicLink()).toBe(true);
      await expect(fs.lstat(path.join(sharedCodexHome, "skills", "paperclip"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = previousCodexHome;
      }
    }
  });

  it("keeps required bundled Paperclip skills installed even when the desired set is emptied", async () => {
    const codexHome = await makeTempDir("paperclip-codex-skill-prune-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        paperclipSkillSync: {
          desiredSkills: [paperclipKey],
        },
      },
    } as const;

    await syncCodexSkills(configuredCtx, [paperclipKey]);

    const clearedCtx = {
      ...configuredCtx,
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        paperclipSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncCodexSkills(clearedCtx, []);
    expect(after.desiredSkills).toContain(paperclipKey);
    expect(after.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(codexHome, "skills", "paperclip"))).isSymbolicLink()).toBe(true);
  });

  it("normalizes legacy flat Paperclip skill refs before reporting persistent state", async () => {
    const codexHome = await makeTempDir("paperclip-codex-legacy-skill-sync-");
    cleanupDirs.add(codexHome);

    const snapshot = await listCodexSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        paperclipSkillSync: {
          desiredSkills: ["paperclip"],
        },
      },
    });

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.desiredSkills).toContain(paperclipKey);
    expect(snapshot.desiredSkills).not.toContain("paperclip");
    expect(snapshot.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("missing");
    expect(snapshot.entries.find((entry) => entry.key === "paperclip")).toBeUndefined();
  });

  it("reports unmanaged user-installed Codex skills with provenance metadata", async () => {
    const codexHome = await makeTempDir("paperclip-codex-user-skills-");
    cleanupDirs.add(codexHome);

    const externalSkillDir = await createSkillDir(path.join(codexHome, "skills"), "crack-python");
    expect(externalSkillDir).toContain(path.join(codexHome, "skills"));

    const snapshot = await listCodexSkills({
      agentId: "agent-4",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
      },
    });

    expect(snapshot.entries).toContainEqual(expect.objectContaining({
      key: "crack-python",
      runtimeName: "crack-python",
      state: "external",
      managed: false,
      origin: "user_installed",
      originLabel: "User-installed",
      locationLabel: "$CODEX_HOME/skills",
      readOnly: true,
      detail: "Installed outside Paperclip management.",
    }));
  });
});
