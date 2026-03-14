# Company Packages Specification

Extension of the Agent Skills Specification

Version: `0.1-draft`

## 1. Purpose

A Company Package is a filesystem- and GitHub-native format for describing a company, team, agent, and associated skills using markdown files with YAML frontmatter.

This specification is an extension of the Agent Skills specification, not a replacement for it.

It defines how company-, team-, and agent-level package structure composes around the existing `SKILL.md` model.

The format is designed to:

- be readable and writable by humans
- work directly from a local folder or GitHub repository
- require no central registry
- support attribution and pinned references to upstream files
- extend the existing Agent Skills ecosystem without redefining it
- be useful outside Paperclip

## 2. Core Principles

1. Markdown is canonical.
2. Git repositories are valid package containers.
3. Registries are optional discovery layers, not authorities.
4. `SKILL.md` remains owned by the Agent Skills specification.
5. External references must be pinnable to immutable Git commits.
6. Attribution and license metadata must survive import/export.
7. Slugs and relative paths are the portable identity layer, not database ids.

## 3. Package Kinds

A package root is identified by one primary markdown file:

- `COMPANY.md` for a company package
- `TEAM.md` for a team package
- `AGENTS.md` for an agent package
- `SKILL.md` for a skill package defined by the Agent Skills specification

A GitHub repo may contain one package at root or many packages in subdirectories.

## 4. Reserved Files And Directories

Common conventions:

```text
COMPANY.md
TEAM.md
AGENTS.md
SKILL.md

agents/<slug>/AGENTS.md
teams/<slug>/TEAM.md
skills/<slug>/SKILL.md

HEARTBEAT.md
SOUL.md
TOOLS.md
README.md
assets/
scripts/
references/
```

Rules:

- only markdown files are canonical content docs
- non-markdown directories like `assets/`, `scripts/`, and `references/` are allowed
- package tools may generate optional lock files, but lock files are not required for authoring

## 5. Common Frontmatter

All package root docs should support these fields:

```yaml
schema: company-packages/v0.1
kind: company | team | agent
slug: my-slug
name: Human Readable Name
description: Short description
version: 0.1.0
license: MIT
authors:
  - name: Jane Doe
homepage: https://example.com
tags:
  - startup
  - engineering
metadata: {}
sources: []
```

Notes:

- `schema` is required for `COMPANY.md`, `TEAM.md`, and `AGENTS.md`
- `kind` is required
- `slug` should be URL-safe and stable
- `sources` is for provenance and external references
- `metadata` is for tool-specific extensions

## 6. COMPANY.md

`COMPANY.md` is the root entrypoint for a whole company package.

### Required fields

```yaml
schema: company-packages/v0.1
kind: company
slug: lean-dev-shop
name: Lean Dev Shop
description: Small engineering-focused AI company
```

### Recommended fields

```yaml
version: 1.0.0
license: MIT
authors:
  - name: Example Org
brandColor: "#22c55e"
goals:
  - Build and ship software products
defaults:
  requireBoardApprovalForNewAgents: true
includes:
  - path: agents/ceo/AGENTS.md
  - path: teams/engineering/TEAM.md
  - path: skills/review/SKILL.md
requirements:
  secrets:
    - OPENAI_API_KEY
```

### Semantics

- `includes` defines the package graph
- included items may be local or external references
- `COMPANY.md` may include agents directly, teams, or skills
- a company importer may render `includes` as the tree/checkbox import UI

## 7. TEAM.md

`TEAM.md` defines an org subtree.

### Example

```yaml
schema: company-packages/v0.1
kind: team
slug: engineering
name: Engineering
description: Product and platform engineering team
manager:
  path: ../cto/AGENTS.md
includes:
  - path: ../platform-lead/AGENTS.md
  - path: ../frontend-lead/AGENTS.md
  - path: ../../skills/review/SKILL.md
tags:
  - team
  - engineering
```

### Semantics

- a team package is a reusable subtree, not necessarily a runtime database table
- `manager` identifies the root agent of the subtree
- `includes` may contain child agents, child teams, or shared skills
- a team package can be imported into an existing company and attached under a target manager

## 8. AGENTS.md

`AGENTS.md` defines an agent.

### Example

```yaml
schema: company-packages/v0.1
kind: agent
slug: ceo
name: CEO
role: ceo
title: Chief Executive Officer
description: Sets strategy and manages executives
icon: crown
capabilities:
  - strategy
  - delegation
reportsTo: null
adapter:
  type: codex_local
  config:
    model: gpt-5
runtime:
  heartbeat:
    intervalSec: 3600
permissions:
  canCreateAgents: true
skills:
  - path: ../../skills/plan-ceo-review/SKILL.md
docs:
  instructions: AGENTS.md
  heartbeat: HEARTBEAT.md
  soul: SOUL.md
requirements:
  secrets:
    - OPENAI_API_KEY
metadata: {}
```

### Semantics

- body content is the canonical default instruction content for the agent
- `docs` points to sibling markdown docs when present
- `skills` references reusable `SKILL.md` packages
- `adapter.config` and `runtime` should contain only portable values
- local absolute paths, machine-specific cwd values, and secret values must not be exported as canonical package data

## 9. SKILL.md Compatibility

A skill package must remain a valid Agent Skills package.

Rules:

- `SKILL.md` should follow the Agent Skills spec
- Paperclip must not require extra top-level fields for skill validity
- Paperclip-specific extensions must live under `metadata.paperclip` or `metadata.sources`
- a skill directory may include `scripts/`, `references/`, and `assets/` exactly as the Agent Skills ecosystem expects

In other words, this spec extends Agent Skills upward into company/team/agent composition. It does not redefine skill package semantics.

### Example compatible extension

```yaml
---
name: review
description: Paranoid code review skill
allowed-tools:
  - Read
  - Grep
metadata:
  paperclip:
    tags:
      - engineering
      - review
  sources:
    - kind: github-file
      repo: vercel-labs/skills
      path: review/SKILL.md
      commit: 0123456789abcdef0123456789abcdef01234567
      sha256: 3b7e...9a
      attribution: Vercel Labs
      usage: referenced
---
```

## 10. Source References

A package may point to upstream content instead of vendoring it.

### Source object

```yaml
sources:
  - kind: github-file
    repo: owner/repo
    path: path/to/file.md
    commit: 0123456789abcdef0123456789abcdef01234567
    blob: abcdef0123456789abcdef0123456789abcdef01
    sha256: 3b7e...9a
    url: https://github.com/owner/repo/blob/0123456789abcdef0123456789abcdef01234567/path/to/file.md
    rawUrl: https://raw.githubusercontent.com/owner/repo/0123456789abcdef0123456789abcdef01234567/path/to/file.md
    attribution: Owner Name
    license: MIT
    usage: referenced
```

### Supported kinds

- `local-file`
- `local-dir`
- `github-file`
- `github-dir`
- `url`

### Usage modes

- `vendored`: bytes are included in the package
- `referenced`: package points to upstream immutable content
- `mirrored`: bytes are cached locally but upstream attribution remains canonical

### Rules

- `commit` is required for `github-file` and `github-dir` in strict mode
- `sha256` is strongly recommended and should be verified on fetch
- branch-only refs may be allowed in development mode but must warn
- exporters should default to `referenced` for third-party content unless redistribution is clearly allowed

## 11. Resolution Rules

Given a package root, an importer resolves in this order:

1. local relative paths
2. local absolute paths if explicitly allowed by the importing tool
3. pinned GitHub refs
4. generic URLs

For pinned GitHub refs:

1. resolve `repo + commit + path`
2. fetch content
3. verify `sha256` if present
4. verify `blob` if present
5. fail closed on mismatch

An importer must surface:

- missing files
- hash mismatches
- missing licenses
- referenced upstream content that requires network fetch
- executable content in skills or scripts

## 12. Import Graph

A package importer should build a graph from:

- `COMPANY.md`
- `TEAM.md`
- `AGENTS.md`
- `SKILL.md`
- local and external refs

Suggested import UI behavior:

- render graph as a tree
- checkbox at entity level, not raw file level
- selecting an agent auto-selects required docs and referenced skills
- selecting a team auto-selects its subtree
- selecting referenced third-party content shows attribution, license, and fetch policy

## 13. Export Rules

A compliant exporter should:

- emit markdown roots and relative folder layout
- omit machine-local ids and timestamps
- omit secret values
- omit machine-specific paths
- preserve attribution and source references
- prefer `referenced` over silent vendoring for third-party content
- preserve `SKILL.md` as-is when exporting compatible skills

## 14. Licensing And Attribution

A compliant tool must:

- preserve `license` and `attribution` metadata when importing and exporting
- distinguish vendored vs referenced content
- not silently inline referenced third-party content during export
- surface missing license metadata as a warning
- surface restrictive or unknown licenses before install/import if content is vendored or mirrored

## 15. Optional Lock File

Authoring does not require a lock file.

Tools may generate an optional lock file such as:

```text
company-package.lock.json
```

Purpose:

- cache resolved refs
- record final hashes
- support reproducible installs

Rules:

- lock files are optional
- lock files are generated artifacts, not canonical authoring input
- the markdown package remains the source of truth

## 16. Paperclip Mapping

Paperclip can map this spec to its runtime model like this:

- `COMPANY.md` -> company metadata
- `TEAM.md` -> importable org subtree
- `AGENTS.md` -> agent records plus adapter/runtime config
- `SKILL.md` -> imported skill package, ideally as a managed reusable skill reference
- `sources[]` -> provenance and pinned upstream refs

Paperclip-specific data should live under:

- `metadata.paperclip`

That keeps the base format broader than Paperclip.

## 17. Cutover

Paperclip should cut over to this markdown-first package model as the primary portability format.

`paperclip.manifest.json` does not need to be preserved as a compatibility requirement for the future package system.

For Paperclip, this should be treated as a hard cutover in product direction rather than a long-lived dual-format strategy.

## 18. Minimal Example

```text
lean-dev-shop/
├── COMPANY.md
├── agents/
│   ├── ceo/AGENTS.md
│   └── cto/AGENTS.md
├── teams/
│   └── engineering/TEAM.md
└── skills/
    └── review/SKILL.md
```

**Recommendation**
This is the direction I would take:

- make this the human-facing spec
- define `SKILL.md` compatibility as non-negotiable
- treat this spec as an extension of Agent Skills, not a parallel format
- make `companies.sh` a discovery layer for repos implementing this spec, not a publishing authority
