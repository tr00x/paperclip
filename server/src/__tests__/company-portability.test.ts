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

const { companyPortabilityService } = await import("../services/company-portability.js");

describe("company portability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    companySvc.getById.mockResolvedValue({
      id: "company-1",
      name: "Paperclip",
      description: null,
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
    ]);
    projectSvc.list.mockResolvedValue([]);
    issueSvc.list.mockResolvedValue([]);
    issueSvc.getById.mockResolvedValue(null);
    issueSvc.getByIdentifier.mockResolvedValue(null);
  });

  it("exports a clean base package with sanitized Paperclip extension data", async () => {
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
    expect(extension).not.toContain("PATH:");
    expect(extension).not.toContain("requireBoardApprovalForNewAgents: true");
    expect(extension).not.toContain("budgetMonthlyCents: 0");
    expect(exported.warnings).toContain("Agent claudecoder command /Users/dotta/.local/bin/claude was omitted from export because it is system-dependent.");
    expect(exported.warnings).toContain("Agent claudecoder PATH override was omitted from export because it is system-dependent.");
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
});
