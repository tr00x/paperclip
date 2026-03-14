# 2026-03-13 Company Import / Export V2 Plan

Status: Proposed implementation plan
Date: 2026-03-13
Audience: Product and engineering
Supersedes for package-format direction:
- `doc/plans/2026-02-16-module-system.md` sections that describe company templates as JSON-only
- `docs/specs/cliphub-plan.md` assumptions about blueprint bundle shape where they conflict with the markdown-first package model

## 1. Purpose

This document defines the next-stage plan for Paperclip company import/export.

The core shift is:

- move from a Paperclip-specific JSON-first portability package toward a markdown-first package format
- make GitHub repositories first-class package sources
- stay compatible with the existing Agent Skills ecosystem instead of inventing a separate skill format
- support company, team, agent, and skill reuse without requiring a central registry

The normative package format draft lives in:

- `docs/companies/companies-spec.md`

This plan is about implementation and rollout inside Paperclip.

## 2. Executive Summary

Paperclip already has a V1 portability feature:

- server import/export/preview APIs
- CLI import/export commands
- a `paperclip.manifest.json` plus markdown payload format
- company metadata + agent portability only

That is useful, but it is not the right long-term authoring format.

The new direction is:

1. markdown-first package authoring
2. GitHub repo or local folder as the default source of truth
3. `SKILL.md` compatibility as a hard constraint
4. optional generated lock/cache artifacts, not required manifests
5. package graph resolution at import time
6. entity-level import UI with dependency-aware tree selection

## 3. Product Goals

### 3.1 Goals

- A user can point Paperclip at a local folder or GitHub repo and import a company package without any registry.
- A package is readable and writable by humans with normal git workflows.
- A package can contain:
  - company definition
  - org subtree / team definition
  - agent definitions
  - reusable skills
- A user can import into:
  - a new company
  - an existing company
- Import preview shows:
  - what will be created
  - what will be updated
  - what is skipped
  - what is referenced externally
  - what needs secrets or approvals
- Export preserves attribution, licensing, and pinned upstream references.
- `companies.sh` can later act as a discovery/index layer over repos implementing this format.

### 3.2 Non-Goals

- No central registry is required for package validity.
- This is not full database backup/restore.
- This does not attempt to export runtime state like:
  - heartbeat runs
  - API keys
  - spend totals
  - run sessions
  - transient workspaces
- This does not require a first-class runtime `teams` table before team portability ships.

## 4. Current State In Repo

Current implementation exists here:

- shared types: `packages/shared/src/types/company-portability.ts`
- shared validators: `packages/shared/src/validators/company-portability.ts`
- server routes: `server/src/routes/companies.ts`
- server service: `server/src/services/company-portability.ts`
- CLI commands: `cli/src/commands/client/company.ts`

Current product limitations:

1. Portability model is only `company` + `agents`.
2. Current import/export contract is JSON-entrypoint-first.
3. UI API methods exist but there is no real Company Settings import/export UX.
4. Import is lossy relative to export.
5. The current markdown frontmatter parser is too primitive for the richer package model.

## 5. Canonical Package Direction

### 5.1 Canonical Authoring Format

The canonical authoring format becomes a markdown-first package rooted in one of:

- `COMPANY.md`
- `TEAM.md`
- `AGENTS.md`
- `SKILL.md`

The normative draft is:

- `docs/companies/companies-spec.md`

### 5.2 Relationship To Agent Skills

Paperclip must not redefine `SKILL.md`.

Rules:

- `SKILL.md` stays Agent Skills compatible
- Paperclip-specific extensions live under metadata
- Paperclip may resolve and install `SKILL.md` packages, but it must not require a Paperclip-only skill format

### 5.3 Relationship To Current V1 Manifest

The current `paperclip.manifest.json` format stays supported as a compatibility format during transition.

But:

- markdown-first repo layout becomes the preferred export target
- JSON manifests become optional generated artifacts at most
- future portability work should target the markdown-first model first

## 6. Package Graph Model

### 6.1 Entity Kinds

Paperclip import/export should support these entity kinds:

- company
- team
- agent
- skill

Future optional kinds:

- project
- goal
- seed task bundle

### 6.2 Team Semantics

`team` is a package concept first, not a database-table requirement.

In Paperclip V2 portability:

- a team is an importable org subtree
- it is rooted at a manager agent
- it can be attached under a target manager in an existing company

This avoids blocking portability on a future runtime `teams` model.

### 6.3 Dependency Graph

Import should operate on an entity graph, not raw file selection.

Examples:

- selecting an agent auto-selects its required docs and skill refs
- selecting a team auto-selects its subtree
- selecting a company auto-selects all included entities by default

The preview output should reflect graph resolution explicitly.

## 7. External References, Pinning, And Attribution

### 7.1 Why This Matters

Some packages will:

- reference upstream files we do not want to republish
- include third-party work where attribution must remain visible
- need protection from branch hot-swapping

### 7.2 Policy

Paperclip should support source references in package metadata with:

- repo
- path
- commit sha
- optional blob sha
- optional sha256
- attribution
- license
- usage mode

Usage modes:

- `vendored`
- `referenced`
- `mirrored`

Default exporter behavior for third-party content should be:

- prefer `referenced`
- preserve attribution
- do not silently inline third-party content into exports

### 7.3 Trust Model

Imported package content should be classified by trust level:

- markdown-only
- markdown + assets
- markdown + scripts/executables

The UI and CLI should surface this clearly before apply.

## 8. Import Behavior

### 8.1 Supported Sources

- local folder
- local package root file
- GitHub repo URL
- GitHub subtree URL
- direct URL to markdown/package root

Registry-based discovery may be added later, but must remain optional.

### 8.2 Import Targets

- new company
- existing company

For existing company imports, the preview must support:

- collision handling
- attach-point selection for team imports
- selective entity import

### 8.3 Collision Strategy

Current `rename | skip | replace` support remains, but matching should improve over time.

Preferred matching order:

1. prior install provenance
2. stable package entity identity
3. slug
4. human name as weak fallback

Slug-only matching is acceptable only as a transitional strategy.

### 8.4 Required Preview Output

Every import preview should surface:

- target company action
- entity-level create/update/skip plan
- referenced external content
- missing files
- hash mismatch or pinning issues
- required secrets
- unsupported content types
- trust/licensing warnings

## 9. Export Behavior

### 9.1 Default Export Target

Default export target should become a markdown-first folder structure.

Example:

```text
my-company/
├── COMPANY.md
├── agents/
├── teams/
└── skills/
```

### 9.2 Export Rules

Exports should:

- omit machine-local ids
- omit timestamps and counters unless explicitly needed
- omit secret values
- omit local absolute paths
- preserve references and attribution
- preserve compatible `SKILL.md` content as-is

### 9.3 Export Modes

Initial export modes:

- company package
- team package
- single agent package

Later optional modes:

- skill pack export
- seed projects/goals bundle

## 10. Storage Model Inside Paperclip

### 10.1 Short-Term

In the first phase, imported entities can continue mapping onto current runtime tables:

- company -> companies
- agent -> agents
- team -> imported agent subtree attachment
- skill -> referenced package metadata only

### 10.2 Medium-Term

Paperclip should add managed package/provenance records so imports are not anonymous one-off copies.

Needed capabilities:

- remember install origin
- support re-import / upgrade
- distinguish local edits from upstream package state
- preserve external refs and package-level metadata

Suggested future tables:

- package_installs
- package_install_entities
- package_sources

This is not required for phase 1 UI, but it is required for a robust long-term system.

## 11. API Plan

### 11.1 Keep Existing Endpoints Initially

Retain:

- `POST /api/companies/:companyId/export`
- `POST /api/companies/import/preview`
- `POST /api/companies/import`

But evolve payloads toward the markdown-first graph model.

### 11.2 New API Capabilities

Add support for:

- package root resolution from local/GitHub inputs
- graph resolution preview
- source pin and hash verification results
- entity-level selection
- team attach target selection
- provenance-aware collision planning

### 11.3 Parsing Changes

Replace the current ad hoc markdown frontmatter parser with a real parser that can handle:

- nested YAML
- arrays/objects reliably
- consistent round-tripping

This is a prerequisite for the new package model.

## 12. CLI Plan

The CLI should continue to support direct import/export without a registry.

Target commands:

- `paperclipai company export <company-id> --out <path>`
- `paperclipai company import --from <path-or-url> --dry-run`
- `paperclipai company import --from <path-or-url> --target existing -C <company-id>`

Planned additions:

- `--package-kind company|team|agent`
- `--attach-under <agent-id-or-slug>` for team imports
- `--strict-pins`
- `--allow-unpinned`
- `--materialize-references`

## 13. UI Plan

### 13.1 Company Settings Import / Export

Add a real import/export section to Company Settings.

Export UI:

- export package kind selector
- include options
- local download/export destination guidance
- attribution/reference summary

Import UI:

- source entry:
  - upload/folder where supported
  - GitHub URL
  - generic URL
- preview pane with:
  - resolved package root
  - dependency tree
  - checkboxes by entity
  - trust/licensing warnings
  - secrets requirements
  - collision plan

### 13.2 Team Import UX

If importing a team into an existing company:

- show the subtree structure
- require the user to choose where to attach it
- preview manager/reporting updates before apply

### 13.3 Skills UX

If importing skills:

- show whether each skill is local, vendored, or referenced
- show whether it contains scripts/assets
- preserve Agent Skills compatibility in presentation and export

## 14. Rollout Phases

### Phase 1: Stabilize Current V1 Portability

- add tests for current portability flows
- replace the frontmatter parser
- add Company Settings UI for current import/export capabilities
- preserve current manifest compatibility

### Phase 2: Markdown-First Package Reader

- support `COMPANY.md` / `TEAM.md` / `AGENTS.md` root detection
- build internal graph from markdown-first packages
- support local folder and GitHub repo inputs natively

### Phase 3: Graph-Based Import UX

- entity tree preview
- checkbox selection
- team subtree attach flow
- licensing/trust/reference warnings

### Phase 4: New Export Model

- export markdown-first folder structure by default
- continue optional legacy manifest export for compatibility

### Phase 5: Provenance And Upgrades

- persist install provenance
- support package-aware re-import and upgrades
- improve collision matching beyond slug-only

### Phase 6: Optional Seed Content

- goals
- projects
- starter issues/tasks

This phase is intentionally after the structural model is stable.

## 15. Documentation Plan

Primary docs:

- `docs/companies/companies-spec.md` as the package-format draft
- this implementation plan for rollout sequencing

Docs to update later as implementation lands:

- `doc/SPEC-implementation.md`
- `docs/api/companies.md`
- `docs/cli/control-plane-commands.md`
- board operator docs for Company Settings import/export

## 16. Open Questions

1. Should imported skill packages be stored as managed package files in Paperclip storage, or only referenced at import time?
2. Should the first generalized package import after company+agent be:
   - team
   - or skill
3. Should Paperclip support direct local folder selection in the web UI, or keep that CLI-only initially?
4. Do we want optional generated lock files in phase 2, or defer them until provenance work?
5. How strict should pinning be by default for GitHub references:
   - warn on unpinned
   - or block in normal mode

## 17. Recommendation

Engineering should treat this as the current plan of record for company import/export beyond the existing V1 portability feature.

Immediate next steps:

1. accept `docs/companies/companies-spec.md` as the package-format draft
2. implement phase 1 stabilization work
3. build phase 2 markdown-first package reader before expanding ClipHub or `companies.sh`

This keeps Paperclip aligned with:

- GitHub-native distribution
- Agent Skills compatibility
- a registry-optional ecosystem model
