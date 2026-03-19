import { beforeEach, describe, expect, it, vi } from "vitest";

const companySvc = {
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const agentSvc = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const accessSvc = {
  ensureMembership: vi.fn(),
  listActiveUserMemberships: vi.fn(),
  copyActiveUserMemberships: vi.fn(),
};

const projectSvc = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

const issueSvc = {
  list: vi.fn(),
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
  create: vi.fn(),
};

const companySkillSvc = {
  list: vi.fn(),
  listFull: vi.fn(),
  readFile: vi.fn(),
  importPackageFiles: vi.fn(),
};

const agentInstructionsSvc = {
  exportFiles: vi.fn(),
  materializeManagedBundle: vi.fn(),
};

vi.mock("../services/companies.js", () => ({
  companyService: () => companySvc,
}));

vi.mock("../services/agents.js", () => ({
  agentService: () => agentSvc,
}));

vi.mock("../services/access.js", () => ({
  accessService: () => accessSvc,
}));

vi.mock("../services/projects.js", () => ({
  projectService: () => projectSvc,
}));

vi.mock("../services/issues.js", () => ({
  issueService: () => issueSvc,
}));

vi.mock("../services/company-skills.js", () => ({
  companySkillService: () => companySkillSvc,
}));

vi.mock("../services/agent-instructions.js", () => ({
  agentInstructionsService: () => agentInstructionsSvc,
}));

const { companyPortabilityService } = await import("../services/company-portability.js");

describe("company portability", () => {
  const paperclipKey = "paperclipai/paperclip/paperclip";
  const companyPlaybookKey = "company/company-1/company-playbook";

  beforeEach(() => {
    vi.clearAllMocks();
    companySvc.getById.mockResolvedValue({
      id: "company-1",
      name: "Paperclip",
      description: null,
      issuePrefix: "PAP",
      brandColor: "#5c5fff",
      requireBoardApprovalForNewAgents: true,
    });
    agentSvc.list.mockResolvedValue([
      {
        id: "agent-1",
        name: "ClaudeCoder",
        status: "idle",
        role: "engineer",
        title: "Software Engineer",
        icon: "code",
        reportsTo: null,
        capabilities: "Writes code",
        adapterType: "claude_local",
        adapterConfig: {
          promptTemplate: "You are ClaudeCoder.",
          paperclipSkillSync: {
            desiredSkills: [paperclipKey],
          },
          instructionsFilePath: "/tmp/ignored.md",
          cwd: "/tmp/ignored",
          command: "/Users/dotta/.local/bin/claude",
          model: "claude-opus-4-6",
          env: {
            ANTHROPIC_API_KEY: {
              type: "secret_ref",
              secretId: "secret-1",
              version: "latest",
            },
            GH_TOKEN: {
              type: "secret_ref",
              secretId: "secret-2",
              version: "latest",
            },
            PATH: {
              type: "plain",
              value: "/usr/bin:/bin",
            },
          },
        },
        runtimeConfig: {
          heartbeat: {
            intervalSec: 3600,
          },
        },
        budgetMonthlyCents: 0,
        permissions: {
          canCreateAgents: false,
        },
        metadata: null,
      },
      {
        id: "agent-2",
        name: "CMO",
        status: "idle",
        role: "cmo",
        title: "Chief Marketing Officer",
        icon: "globe",
        reportsTo: null,
        capabilities: "Owns marketing",
        adapterType: "claude_local",
        adapterConfig: {
          promptTemplate: "You are CMO.",
        },
        runtimeConfig: {
          heartbeat: {
            intervalSec: 3600,
          },
        },
        budgetMonthlyCents: 0,
        permissions: {
          canCreateAgents: false,
        },
        metadata: null,
      },
    ]);
    projectSvc.list.mockResolvedValue([]);
    issueSvc.list.mockResolvedValue([]);
    issueSvc.getById.mockResolvedValue(null);
    issueSvc.getByIdentifier.mockResolvedValue(null);
    const companySkills = [
      {
        id: "skill-1",
        companyId: "company-1",
        key: paperclipKey,
        slug: "paperclip",
        name: "paperclip",
        description: "Paperclip coordination skill",
        markdown: "---\nname: paperclip\ndescription: Paperclip coordination skill\n---\n\n# Paperclip\n",
        sourceType: "github",
        sourceLocator: "https://github.com/paperclipai/paperclip/tree/master/skills/paperclip",
        sourceRef: "0123456789abcdef0123456789abcdef01234567",
        trustLevel: "markdown_only",
        compatibility: "compatible",
        fileInventory: [
          { path: "SKILL.md", kind: "skill" },
          { path: "references/api.md", kind: "reference" },
        ],
        metadata: {
          sourceKind: "github",
          owner: "paperclipai",
          repo: "paperclip",
          ref: "0123456789abcdef0123456789abcdef01234567",
          trackingRef: "master",
          repoSkillDir: "skills/paperclip",
        },
      },
      {
        id: "skill-2",
        companyId: "company-1",
        key: companyPlaybookKey,
        slug: "company-playbook",
        name: "company-playbook",
        description: "Internal company skill",
        markdown: "---\nname: company-playbook\ndescription: Internal company skill\n---\n\n# Company Playbook\n",
        sourceType: "local_path",
        sourceLocator: "/tmp/company-playbook",
        sourceRef: null,
        trustLevel: "markdown_only",
        compatibility: "compatible",
        fileInventory: [
          { path: "SKILL.md", kind: "skill" },
          { path: "references/checklist.md", kind: "reference" },
        ],
        metadata: {
          sourceKind: "local_path",
        },
      },
    ];
    companySkillSvc.list.mockResolvedValue(companySkills);
    companySkillSvc.listFull.mockResolvedValue(companySkills);
    companySkillSvc.readFile.mockImplementation(async (_companyId: string, skillId: string, relativePath: string) => {
      if (skillId === "skill-2") {
        return {
          skillId,
          path: relativePath,
          kind: relativePath === "SKILL.md" ? "skill" : "reference",
          content: relativePath === "SKILL.md"
            ? "---\nname: company-playbook\ndescription: Internal company skill\n---\n\n# Company Playbook\n"
            : "# Checklist\n",
          language: "markdown",
          markdown: true,
          editable: true,
        };
      }

      return {
        skillId,
        path: relativePath,
        kind: relativePath === "SKILL.md" ? "skill" : "reference",
        content: relativePath === "SKILL.md"
          ? "---\nname: paperclip\ndescription: Paperclip coordination skill\n---\n\n# Paperclip\n"
          : "# API\n",
        language: "markdown",
        markdown: true,
        editable: false,
      };
    });
    companySkillSvc.importPackageFiles.mockResolvedValue([]);
    accessSvc.listActiveUserMemberships.mockResolvedValue([
      {
        id: "membership-1",
        companyId: "company-1",
        principalType: "user",
        principalId: "user-1",
        membershipRole: "owner",
        status: "active",
      },
    ]);
    accessSvc.copyActiveUserMemberships.mockResolvedValue([]);
    agentInstructionsSvc.exportFiles.mockImplementation(async (agent: { name: string }) => ({
      files: { "AGENTS.md": agent.name === "CMO" ? "You are CMO." : "You are ClaudeCoder." },
      entryFile: "AGENTS.md",
      warnings: [],
    }));
    agentInstructionsSvc.materializeManagedBundle.mockImplementation(async (agent: { adapterConfig: Record<string, unknown> }) => ({
      bundle: null,
      adapterConfig: {
        ...agent.adapterConfig,
        instructionsBundleMode: "managed",
        instructionsRootPath: `/tmp/${agent.id}`,
        instructionsEntryFile: "AGENTS.md",
        instructionsFilePath: `/tmp/${agent.id}/AGENTS.md`,
      },
    }));
  });

  it("exports referenced skills as stubs by default with sanitized Paperclip extension data", async () => {
    const portability = companyPortabilityService({} as any);

    const exported = await portability.exportBundle("company-1", {
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
    });

    expect(exported.files["COMPANY.md"]).toContain('name: "Paperclip"');
    expect(exported.files["COMPANY.md"]).toContain('schema: "agentcompanies/v1"');
    expect(exported.files["agents/claudecoder/AGENTS.md"]).toContain("You are ClaudeCoder.");
    expect(exported.files["agents/claudecoder/AGENTS.md"]).toContain("skills:");
    expect(exported.files["agents/claudecoder/AGENTS.md"]).toContain(`- "${paperclipKey}"`);
    expect(exported.files["agents/cmo/AGENTS.md"]).not.toContain("skills:");
    expect(exported.files["skills/paperclipai/paperclip/paperclip/SKILL.md"]).toContain("metadata:");
    expect(exported.files["skills/paperclipai/paperclip/paperclip/SKILL.md"]).toContain('kind: "github-dir"');
    expect(exported.files["skills/paperclipai/paperclip/paperclip/references/api.md"]).toBeUndefined();
    expect(exported.files["skills/company/PAP/company-playbook/SKILL.md"]).toContain("# Company Playbook");
    expect(exported.files["skills/company/PAP/company-playbook/references/checklist.md"]).toContain("# Checklist");

    const extension = exported.files[".paperclip.yaml"];
    expect(extension).toContain('schema: "paperclip/v1"');
    expect(extension).not.toContain("promptTemplate");
    expect(extension).not.toContain("instructionsFilePath");
    expect(extension).not.toContain("command:");
    expect(extension).not.toContain("secretId");
    expect(extension).not.toContain('type: "secret_ref"');
    expect(extension).toContain("inputs:");
    expect(extension).toContain("ANTHROPIC_API_KEY:");
    expect(extension).toContain('requirement: "optional"');
    expect(extension).toContain('default: ""');
    expect(extension).not.toContain("paperclipSkillSync");
    expect(extension).not.toContain("PATH:");
    expect(extension).not.toContain("requireBoardApprovalForNewAgents: true");
    expect(extension).not.toContain("budgetMonthlyCents: 0");
    expect(exported.warnings).toContain("Agent claudecoder command /Users/dotta/.local/bin/claude was omitted from export because it is system-dependent.");
    expect(exported.warnings).toContain("Agent claudecoder PATH override was omitted from export because it is system-dependent.");
  });

  it("expands referenced skills when requested", async () => {
    const portability = companyPortabilityService({} as any);

    const exported = await portability.exportBundle("company-1", {
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
      expandReferencedSkills: true,
    });

    expect(exported.files["skills/paperclipai/paperclip/paperclip/SKILL.md"]).toContain("# Paperclip");
    expect(exported.files["skills/paperclipai/paperclip/paperclip/SKILL.md"]).toContain("metadata:");
    expect(exported.files["skills/paperclipai/paperclip/paperclip/references/api.md"]).toContain("# API");
  });

  it("exports duplicate skill slugs into readable namespaced paths", async () => {
    const portability = companyPortabilityService({} as any);

    companySkillSvc.readFile.mockImplementation(async (_companyId: string, skillId: string, relativePath: string) => {
      if (skillId === "skill-local") {
        return {
          skillId,
          path: relativePath,
          kind: "skill",
          content: "---\nname: release-changelog\n---\n\n# Local Release Changelog\n",
          language: "markdown",
          markdown: true,
          editable: true,
        };
      }

      return {
        skillId,
        path: relativePath,
        kind: "skill",
        content: "---\nname: release-changelog\n---\n\n# Bundled Release Changelog\n",
        language: "markdown",
        markdown: true,
        editable: false,
      };
    });

    companySkillSvc.listFull.mockResolvedValue([
      {
        id: "skill-local",
        companyId: "company-1",
        key: "local/36dfd631da/release-changelog",
        slug: "release-changelog",
        name: "release-changelog",
        description: "Local release changelog skill",
        markdown: "---\nname: release-changelog\n---\n\n# Local Release Changelog\n",
        sourceType: "local_path",
        sourceLocator: "/tmp/release-changelog",
        sourceRef: null,
        trustLevel: "markdown_only",
        compatibility: "compatible",
        fileInventory: [{ path: "SKILL.md", kind: "skill" }],
        metadata: {
          sourceKind: "local_path",
        },
      },
      {
        id: "skill-paperclip",
        companyId: "company-1",
        key: "paperclipai/paperclip/release-changelog",
        slug: "release-changelog",
        name: "release-changelog",
        description: "Bundled release changelog skill",
        markdown: "---\nname: release-changelog\n---\n\n# Bundled Release Changelog\n",
        sourceType: "github",
        sourceLocator: "https://github.com/paperclipai/paperclip/tree/master/skills/release-changelog",
        sourceRef: "0123456789abcdef0123456789abcdef01234567",
        trustLevel: "markdown_only",
        compatibility: "compatible",
        fileInventory: [{ path: "SKILL.md", kind: "skill" }],
        metadata: {
          sourceKind: "paperclip_bundled",
          owner: "paperclipai",
          repo: "paperclip",
          ref: "0123456789abcdef0123456789abcdef01234567",
          trackingRef: "master",
          repoSkillDir: "skills/release-changelog",
        },
      },
    ]);

    const exported = await portability.exportBundle("company-1", {
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
    });

    expect(exported.files["skills/local/release-changelog/SKILL.md"]).toContain("# Local Release Changelog");
    expect(exported.files["skills/paperclipai/paperclip/release-changelog/SKILL.md"]).toContain("metadata:");
    expect(exported.files["skills/paperclipai/paperclip/release-changelog/SKILL.md"]).toContain("paperclipai/paperclip/release-changelog");
  });

  it("builds export previews without tasks by default", async () => {
    const portability = companyPortabilityService({} as any);

    projectSvc.list.mockResolvedValue([
      {
        id: "project-1",
        name: "Launch",
        urlKey: "launch",
        description: "Ship it",
        leadAgentId: "agent-1",
        targetDate: null,
        color: null,
        status: "planned",
        executionWorkspacePolicy: null,
        archivedAt: null,
      },
    ]);
    issueSvc.list.mockResolvedValue([
      {
        id: "issue-1",
        identifier: "PAP-1",
        title: "Write launch task",
        description: "Task body",
        projectId: "project-1",
        assigneeAgentId: "agent-1",
        status: "todo",
        priority: "medium",
        labelIds: [],
        billingCode: null,
        executionWorkspaceSettings: null,
        assigneeAdapterOverrides: null,
      },
    ]);

    const preview = await portability.previewExport("company-1", {
      include: {
        company: true,
        agents: true,
        projects: true,
      },
    });

    expect(preview.counts.issues).toBe(0);
    expect(preview.fileInventory.some((entry) => entry.path.startsWith("tasks/"))).toBe(false);
  });

  it("reads env inputs back from .paperclip.yaml during preview import", async () => {
    const portability = companyPortabilityService({} as any);

    const exported = await portability.exportBundle("company-1", {
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
    });

    const preview = await portability.previewImport({
      source: {
        type: "inline",
        rootPath: exported.rootPath,
        files: exported.files,
      },
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
      target: {
        mode: "new_company",
        newCompanyName: "Imported Paperclip",
      },
      agents: "all",
      collisionStrategy: "rename",
    });

    expect(preview.errors).toEqual([]);
    expect(preview.envInputs).toEqual([
      {
        key: "ANTHROPIC_API_KEY",
        description: "Provide ANTHROPIC_API_KEY for agent claudecoder",
        agentSlug: "claudecoder",
        kind: "secret",
        requirement: "optional",
        defaultValue: "",
        portability: "portable",
      },
      {
        key: "GH_TOKEN",
        description: "Provide GH_TOKEN for agent claudecoder",
        agentSlug: "claudecoder",
        kind: "secret",
        requirement: "optional",
        defaultValue: "",
        portability: "portable",
      },
    ]);
  });

  it("imports packaged skills and restores desired skill refs on agents", async () => {
    const portability = companyPortabilityService({} as any);

    companySvc.create.mockResolvedValue({
      id: "company-imported",
      name: "Imported Paperclip",
    });
    accessSvc.ensureMembership.mockResolvedValue(undefined);
    agentSvc.create.mockResolvedValue({
      id: "agent-created",
      name: "ClaudeCoder",
    });

    const exported = await portability.exportBundle("company-1", {
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
    });

    agentSvc.list.mockResolvedValue([]);

    await portability.importBundle({
      source: {
        type: "inline",
        rootPath: exported.rootPath,
        files: exported.files,
      },
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
      target: {
        mode: "new_company",
        newCompanyName: "Imported Paperclip",
      },
      agents: "all",
      collisionStrategy: "rename",
    }, "user-1");

    expect(companySkillSvc.importPackageFiles).toHaveBeenCalledWith("company-imported", exported.files, {
      onConflict: "replace",
    });
    expect(agentSvc.create).toHaveBeenCalledWith("company-imported", expect.objectContaining({
      adapterConfig: expect.objectContaining({
        paperclipSkillSync: {
          desiredSkills: [paperclipKey],
        },
      }),
    }));
  });

  it("copies source company memberships for safe new-company imports", async () => {
    const portability = companyPortabilityService({} as any);

    companySvc.create.mockResolvedValue({
      id: "company-imported",
      name: "Imported Paperclip",
    });
    agentSvc.create.mockResolvedValue({
      id: "agent-created",
      name: "ClaudeCoder",
    });

    const exported = await portability.exportBundle("company-1", {
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
    });

    agentSvc.list.mockResolvedValue([]);

    await portability.importBundle({
      source: {
        type: "inline",
        rootPath: exported.rootPath,
        files: exported.files,
      },
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
      target: {
        mode: "new_company",
        newCompanyName: "Imported Paperclip",
      },
      agents: "all",
      collisionStrategy: "rename",
    }, null, {
      mode: "agent_safe",
      sourceCompanyId: "company-1",
    });

    expect(accessSvc.listActiveUserMemberships).toHaveBeenCalledWith("company-1");
    expect(accessSvc.copyActiveUserMemberships).toHaveBeenCalledWith("company-1", "company-imported");
    expect(accessSvc.ensureMembership).not.toHaveBeenCalledWith("company-imported", "user", expect.anything(), "owner", "active");
    expect(companySkillSvc.importPackageFiles).toHaveBeenCalledWith("company-imported", exported.files, {
      onConflict: "rename",
    });
  });

  it("imports only selected files and leaves unchecked company metadata alone", async () => {
    const portability = companyPortabilityService({} as any);

    const exported = await portability.exportBundle("company-1", {
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
    });

    agentSvc.list.mockResolvedValue([]);
    projectSvc.list.mockResolvedValue([]);
    companySvc.getById.mockResolvedValue({
      id: "company-1",
      name: "Paperclip",
      description: "Existing company",
      brandColor: "#123456",
      requireBoardApprovalForNewAgents: false,
    });
    agentSvc.create.mockResolvedValue({
      id: "agent-cmo",
      name: "CMO",
    });

    const result = await portability.importBundle({
      source: {
        type: "inline",
        rootPath: exported.rootPath,
        files: exported.files,
      },
      include: {
        company: true,
        agents: true,
        projects: true,
        issues: true,
      },
      selectedFiles: ["agents/cmo/AGENTS.md"],
      target: {
        mode: "existing_company",
        companyId: "company-1",
      },
      agents: "all",
      collisionStrategy: "rename",
    }, "user-1");

    expect(companySvc.update).not.toHaveBeenCalled();
    expect(companySkillSvc.importPackageFiles).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        "COMPANY.md": expect.any(String),
        "agents/cmo/AGENTS.md": expect.any(String),
      }),
      {
        onConflict: "replace",
      },
    );
    expect(companySkillSvc.importPackageFiles).toHaveBeenCalledWith(
      "company-1",
      expect.not.objectContaining({
        "agents/claudecoder/AGENTS.md": expect.any(String),
      }),
      {
        onConflict: "replace",
      },
    );
    expect(agentSvc.create).toHaveBeenCalledTimes(1);
    expect(agentSvc.create).toHaveBeenCalledWith("company-1", expect.objectContaining({
      name: "CMO",
    }));
    expect(result.company.action).toBe("unchanged");
    expect(result.agents).toEqual([
      {
        slug: "cmo",
        id: "agent-cmo",
        action: "created",
        name: "CMO",
        reason: null,
      },
    ]);
  });

  it("applies adapter overrides while keeping imported AGENTS content implicit", async () => {
    const portability = companyPortabilityService({} as any);

    companySvc.create.mockResolvedValue({
      id: "company-imported",
      name: "Imported Paperclip",
    });
    accessSvc.ensureMembership.mockResolvedValue(undefined);
    agentSvc.create.mockResolvedValue({
      id: "agent-created",
      name: "ClaudeCoder",
    });

    const exported = await portability.exportBundle("company-1", {
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
    });

    agentSvc.list.mockResolvedValue([]);

    await portability.importBundle({
      source: {
        type: "inline",
        rootPath: exported.rootPath,
        files: exported.files,
      },
      include: {
        company: true,
        agents: true,
        projects: false,
        issues: false,
      },
      target: {
        mode: "new_company",
        newCompanyName: "Imported Paperclip",
      },
      agents: "all",
      collisionStrategy: "rename",
      adapterOverrides: {
        claudecoder: {
          adapterType: "codex_local",
          adapterConfig: {
            dangerouslyBypassApprovalsAndSandbox: true,
            instructionsFilePath: "/tmp/should-not-survive.md",
          },
        },
      },
    }, "user-1");

    expect(agentSvc.create).toHaveBeenCalledWith("company-imported", expect.objectContaining({
      adapterType: "codex_local",
      adapterConfig: expect.objectContaining({
        dangerouslyBypassApprovalsAndSandbox: true,
      }),
    }));
    expect(agentSvc.create).toHaveBeenCalledWith("company-imported", expect.objectContaining({
      adapterConfig: expect.not.objectContaining({
        instructionsFilePath: expect.anything(),
        promptTemplate: expect.anything(),
      }),
    }));
    expect(agentInstructionsSvc.materializeManagedBundle).toHaveBeenCalledWith(
      expect.objectContaining({ name: "ClaudeCoder" }),
      expect.objectContaining({
        "AGENTS.md": expect.stringContaining("You are ClaudeCoder."),
      }),
      expect.objectContaining({
        clearLegacyPromptTemplate: true,
        replaceExisting: true,
      }),
    );
  });
});
