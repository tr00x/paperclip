# 2026-03-14 Skills UI Product Plan

Status: Proposed
Date: 2026-03-14
Audience: Product and engineering
Related:
- `doc/plans/2026-03-13-company-import-export-v2.md`
- `docs/companies/companies-spec.md`
- `ui/src/pages/AgentDetail.tsx`

## 1. Purpose

This document defines the product and UI plan for skill management in Paperclip.

The goal is to make skills understandable and manageable in the website without pretending that all adapters behave the same way.

This plan assumes:

- `SKILL.md` remains Agent Skills compatible
- `skills.sh` compatibility is a V1 requirement
- Paperclip company import/export can include skills as package content
- adapters may support persistent skill sync, ephemeral skill mounting, read-only skill discovery, or no skill integration at all

## 2. Current State

There is already a first-pass agent-level skill sync UI on `AgentDetail`.

Today it supports:

- loading adapter skill sync state
- showing unsupported adapters clearly
- showing managed skills as checkboxes
- showing external skills separately
- syncing desired skills for adapters that implement the new API

Current limitations:

1. There is no company-level skill library UI.
2. There is no package import flow for skills in the website.
3. There is no distinction between skill package management and per-agent skill attachment.
4. There is no multi-agent desired-vs-actual view.
5. The current UI is adapter-sync-oriented, not package-oriented.
6. Unsupported adapters degrade safely, but not elegantly.

## 3. Product Principles

1. Skills are company assets first, agent attachments second.
2. Package management and adapter sync are different concerns and should not be conflated in one screen.
3. The UI must always tell the truth about what Paperclip knows:
   - desired state in Paperclip
   - actual state reported by the adapter
   - whether the adapter can reconcile the two
4. Agent Skills compatibility must remain visible in the product model.
5. Agent-to-skill associations should be human-readable and shortname-based wherever possible.
6. Unsupported adapters should still have a useful UI, not just a dead end.

## 4. User Model

Paperclip should treat skills at two scopes:

### 4.1 Company skills

These are reusable skills known to the company.

Examples:

- imported from a GitHub repo
- added from a local folder
- installed from a `skills.sh`-compatible repo
- created locally inside Paperclip later

These should have:

- name
- description
- slug or package identity
- source/provenance
- trust level
- compatibility status

### 4.2 Agent skills

These are skill attachments for a specific agent.

Each attachment should have:

- shortname
- desired state in Paperclip
- actual state in the adapter when readable
- sync status
- origin

Agent attachments should normally reference skills by shortname or slug, for example:

- `review`
- `react-best-practices`

not by noisy relative file path.

## 5. Core UI Surfaces

The product should have two primary skill surfaces.

### 5.1 Company Skills page

Add a company-level page, likely:

- `/companies/:companyId/skills`

Purpose:

- manage the company skill library
- import and inspect skill packages
- understand provenance and trust
- see which agents use which skills

#### A. Skill library list

Each skill row should show:

- name
- short description
- source badge
- trust badge
- compatibility badge
- number of attached agents

Suggested source states:

- local
- github
- imported package
- external reference
- adapter-discovered only

Suggested compatibility states:

- compatible
- paperclip-extension
- unknown
- invalid

Suggested trust states:

- markdown-only
- assets
- scripts/executables

#### B. Import actions

Allow:

- import from local folder
- import from GitHub URL
- import from direct URL

Future:

- install from `companies.sh`
- install from `skills.sh`

#### C. Skill detail drawer or page

Each skill should have a detail view showing:

- rendered `SKILL.md`
- package source and pinning
- included files
- trust and licensing warnings
- who uses it
- adapter compatibility notes

### 5.2 Agent Skills panel

Keep and evolve the existing `AgentDetail` skills section.

Purpose:

- attach/detach company skills to one agent
- inspect adapter reality for that agent
- reconcile desired vs actual state
- keep the association format readable and aligned with `AGENTS.md`

#### A. Desired skills

Show company-managed skills attached to the agent.

Each row should show:

- skill name
- shortname
- sync state
- source
- last adapter observation if available

#### B. External or discovered skills

Show skills reported by the adapter that are not company-managed.

This matters because Codex and similar adapters may already have local skills that Paperclip did not install.

These should be clearly marked:

- external
- not managed by Paperclip

#### C. Sync controls

Support:

- sync
- reset draft
- detach

Future:

- import external skill into company library
- promote ad hoc local skill into a managed company skill

## 6. Skill State Model In The UI

Each skill attachment should have a user-facing state.

Suggested states:

- `in_sync`
- `desired_only`
- `external`
- `drifted`
- `unmanaged`
- `unknown`

Definitions:

- `in_sync`: desired and actual match
- `desired_only`: Paperclip wants it, adapter does not show it yet
- `external`: adapter has it but Paperclip does not manage it
- `drifted`: adapter has a conflicting or unexpected version/location
- `unmanaged`: adapter does not support sync, Paperclip only tracks desired state
- `unknown`: adapter read failed or state cannot be trusted

## 7. Adapter Presentation Rules

The UI should not describe all adapters the same way.

### 7.1 Persistent adapters

Example:

- Codex local

Language:

- installed
- synced into adapter home
- external skills detected

### 7.2 Ephemeral adapters

Example:

- Claude local

Language:

- will be mounted on next run
- effective runtime skills
- not globally installed

### 7.3 Unsupported adapters

Language:

- this adapter does not implement skill sync yet
- Paperclip can still track desired skills
- actual adapter state is unavailable

This state should still allow:

- attaching company skills to the agent as desired state
- export/import of those desired attachments

## 8. Information Architecture

Recommended navigation:

- company nav adds `Skills`
- agent detail keeps `Skills` inside configuration for now

Later, if the skill system grows:

- company-level `Skills` page
- optional skill detail route
- optional skill usage graph view

Recommended separation:

- Company Skills page answers: “What skills do we have?”
- Agent Skills panel answers: “What does this agent use, and is it synced?”

## 9. Import / Export Integration

Skill UI and package portability should meet in the company skill library.

Import behavior:

- importing a company package with `SKILL.md` content should create or update company skills
- agent attachments should primarily come from `AGENTS.md` shortname associations
- `.paperclip.yaml` may add Paperclip-specific fidelity, but should not replace the base shortname association model
- referenced third-party skills should keep provenance visible

Export behavior:

- exporting a company should include company-managed skills when selected
- `AGENTS.md` should emit skill associations by shortname or slug
- `.paperclip.yaml` may add Paperclip-specific skill fidelity later if needed, but should not be required for ordinary agent-to-skill association
- adapter-only external skills should not be silently exported as managed company skills

## 10. Data And API Shape

This plan implies a clean split in backend concepts.

### 10.1 Company skill records

Paperclip should have a company-scoped skill model or managed package model representing:

- identity
- source
- files
- provenance
- trust and licensing metadata

### 10.2 Agent skill attachments

Paperclip should separately store:

- agent id
- skill identity
- desired enabled state
- optional ordering or metadata later

### 10.3 Adapter sync snapshot

Adapter reads should return:

- supported flag
- sync mode
- entries
- warnings
- desired skills

This already exists in rough form and should be the basis for the UI.

## 11. UI Phases

### Phase A: Stabilize current agent skill sync UI

Goals:

- keep current `AgentDetail` panel
- improve status language
- support desired-only state even on unsupported adapters
- polish copy for persistent vs ephemeral adapters

### Phase B: Add Company Skills page

Goals:

- company-level skill library
- import from GitHub/local folder
- basic detail view
- usage counts by agent

### Phase C: Connect skills to portability

Goals:

- importing company packages creates company skills
- exporting selected skills works cleanly
- agent attachments round-trip through `.paperclip.yaml`

### Phase D: External skill adoption flow

Goals:

- detect adapter external skills
- allow importing them into company-managed state where possible
- make provenance explicit

### Phase E: Advanced sync and drift UX

Goals:

- desired-vs-actual diffing
- drift resolution actions
- multi-agent skill usage and sync reporting

## 12. Design Risks

1. Overloading the agent page with package management will make the feature confusing.
2. Treating unsupported adapters as broken rather than unmanaged will make the product feel inconsistent.
3. Mixing external adapter-discovered skills with company-managed skills without clear labels will erode trust.
4. If company skill records do not exist, import/export and UI will remain loosely coupled and round-trip fidelity will stay weak.

## 13. Recommendation

The next product step should be:

1. keep the current agent-level skill sync panel as the short-term attachment UI
2. add a dedicated company-level `Skills` page as the library and package-management surface
3. make company import/export target that company skill library, not the agent page directly
4. preserve adapter-aware truth in the UI by clearly separating:
   - desired
   - actual
   - external
   - unmanaged

That gives Paperclip one coherent skill story instead of forcing package management, adapter sync, and agent configuration into the same screen.
