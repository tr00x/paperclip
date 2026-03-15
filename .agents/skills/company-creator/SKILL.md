---
name: company-creator
description: >
  Create agent company packages conforming to the Agent Companies specification
  (agentcompanies/v1). Use when a user wants to create a new agent company from
  scratch, build a company around an existing git repo or skills collection, or
  scaffold a team/department of agents. Triggers on: "create a company", "make me
  a company", "build a company from this repo", "set up an agent company",
  "create a team of agents", "hire some agents", or when given a repo URL and
  asked to turn it into a company. Do NOT use for importing an existing company
  package (use the CLI import command instead) or for modifying a company that
  is already running in Paperclip.
---

# Company Creator

Create agent company packages that conform to the Agent Companies specification.

Spec references:

- Normative spec: `docs/companies/companies-spec.md` (read this before generating files)
- Web spec: https://agentcompanies.io/specification
- Protocol site: https://agentcompanies.io/

## Two Modes

### Mode 1: Company From Scratch

The user describes what they want. Interview them to flesh out the vision, then generate the package.

### Mode 2: Company From a Repo

The user provides a git repo URL, local path, or tweet. Analyze the repo, then create a company that wraps it.

See [references/from-repo-guide.md](references/from-repo-guide.md) for detailed repo analysis steps.

## Process

### Step 1: Gather Context

Determine which mode applies:

- **From scratch**: What kind of company or team? What domain? What should the agents do?
- **From repo**: Clone/read the repo. Scan for existing skills, agent configs, README, source structure.

### Step 2: Interview (Use AskUserQuestion)

Do not skip this step. Use AskUserQuestion to align with the user before writing any files.

**For from-scratch companies**, ask about:

- Company purpose and domain (1-2 sentences is fine)
- What agents they need - propose a hiring plan based on what they described
- Whether this is a full company (needs a CEO) or a team/department (no CEO required)
- Any specific skills the agents should have
- Whether they want projects and starter tasks

**For from-repo companies**, present your analysis and ask:

- Confirm the agents you plan to create and their roles
- Whether to reference or vendor any discovered skills (default: reference)
- Any additional agents or skills beyond what the repo provides
- Company name and any customization

**Key interviewing principles:**

- Propose a concrete hiring plan. Don't ask open-ended "what agents do you want?" - suggest specific agents based on context and let the user adjust.
- Keep it lean. Most users are new to agent companies. A few agents (3-5) is typical for a startup. Don't suggest 10+ agents unless the scope demands it.
- From-scratch companies should start with a CEO who manages everyone. Teams/departments don't need one.
- Ask 2-3 focused questions per round, not 10.

### Step 3: Read the Spec

Before generating any files, read the normative spec:

```
docs/companies/companies-spec.md
```

Also read the quick reference: [references/companies-spec.md](references/companies-spec.md)

And the example: [references/example-company.md](references/example-company.md)

### Step 4: Generate the Package

Create the directory structure and all files. Follow the spec's conventions exactly.

**Directory structure:**

```
<company-slug>/
├── COMPANY.md
├── agents/
│   └── <slug>/AGENTS.md
├── teams/
│   └── <slug>/TEAM.md        (if teams are needed)
├── projects/
│   └── <slug>/PROJECT.md     (if projects are needed)
├── tasks/
│   └── <slug>/TASK.md        (if tasks are needed)
├── skills/
│   └── <slug>/SKILL.md       (if custom skills are needed)
└── .paperclip.yaml            (Paperclip vendor extension)
```

**Rules:**

- Slugs must be URL-safe, lowercase, hyphenated
- COMPANY.md gets `schema: agentcompanies/v1` - other files inherit it
- Agent instructions go in the AGENTS.md body, not in .paperclip.yaml
- Skills referenced by shortname in AGENTS.md resolve to `skills/<shortname>/SKILL.md`
- For external skills, use `sources` with `usage: referenced` (see spec section 12)
- Do not export secrets, machine-local paths, or database IDs
- Omit empty/default fields

**Reporting structure:**

- Every agent except the CEO should have `reportsTo` set to their manager's slug
- The CEO has `reportsTo: null`
- For teams without a CEO, the top-level agent has `reportsTo: null`

### Step 5: Confirm Output Location

Ask the user where to write the package. Common options:

- A subdirectory in the current repo
- A new directory the user specifies
- The current directory (if it's empty or they confirm)

### Step 6: Write Files and Summarize

Write all files, then give a brief summary:

- Company name and what it does
- Agent roster with roles and reporting structure
- Skills (custom + referenced)
- Projects and tasks if any
- The output path

## Adapter Defaults for .paperclip.yaml

```yaml
schema: paperclip/v1
agents:
  <agent-slug>:
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6 # or claude-opus-4-6 for CEO/leadership
    inputs:
      env:
        <SOME_ENV_VARIABLE>:
          kind: secret
          requirement: optional
          default: ""
```

## External Skill References

When referencing skills from a GitHub repo, always use the references pattern:

```yaml
metadata:
  sources:
    - kind: github-file
      repo: owner/repo
      path: path/to/SKILL.md
      commit: <full SHA from git ls-remote or the repo>
      attribution: Owner or Org Name
      license: <from the repo's LICENSE>
      usage: referenced
```

Get the commit SHA with:

```bash
git ls-remote https://github.com/owner/repo HEAD
```

Do NOT copy external skill content into the package unless the user explicitly asks.
