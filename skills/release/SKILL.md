---
name: release
description: >
  Coordinate a full Paperclip release across engineering, website publishing,
  and social announcement. Use when CTO/CEO requests "do a release" or
  "release vX.Y.Z". Runs pre-flight checks, generates changelog via
  release-changelog, executes npm release, creates cross-project follow-up
  tasks, and posts a release wrap-up.
---

# Release Coordination Skill

Run the full Paperclip release process as an organizational workflow, not just
an npm publish.

This skill coordinates:
- App release execution (`scripts/release.sh`)
- User-facing changelog generation (`release-changelog` skill)
- Website publishing task creation
- CMO announcement task creation
- Final release summary with links

---

## Trigger

Use this skill when leadership asks for:
- "do a release"
- "release {patch|minor|major}"
- "release vX.Y.Z"

---

## Preconditions

Before proceeding, verify all of the following:

1. `skills/release-changelog/SKILL.md` exists and is usable.
2. The `release-changelog` dependency work is complete/reviewed before running this flow.
3. App repo working tree is clean.
4. There are commits since the last release tag.
5. You have release permissions (`npm whoami` succeeds for real publish).
6. If running via Paperclip, you have issue context for posting status updates.

If any precondition fails, stop and report the blocker.

---

## Inputs

Collect these inputs up front:

- Release request source issue (if in Paperclip)
- Requested bump (`patch|minor|major`) or explicit version (`vX.Y.Z`)
- Whether this run is dry-run or live publish
- Company/project context for follow-up issue creation

---

## Step 0 — Idempotency Guards

Each step in this skill is designed to be safely re-runnable. Before executing
any step, check whether it has already been completed:

| Step | How to Check | If Already Done |
|---|---|---|
| Changelog | `releases/v{version}.md` exists | Read it, ask reviewer to confirm or update. Do NOT regenerate without asking. |
| npm publish | `git tag v{version}` exists | Skip `release.sh` entirely. A tag means the version is already published. **Never re-run release.sh for an existing tag** — it will fail or create a duplicate. |
| Website task | Search Paperclip issues for "Publish release notes for v{version}" | Skip creation. Link the existing task. |
| CMO task | Search Paperclip issues for "release announcement tweet for v{version}" | Skip creation. Link the existing task. |

**The golden rule:** If a git tag `v{version}` already exists, the npm release
has already happened. Only post-publish tasks (website, CMO, wrap-up) should
proceed. Never attempt to re-publish.

**Iterating on changelogs:** You can re-run this skill with an existing changelog
to refine it _before_ the npm publish step. The `release-changelog` skill has
its own idempotency check and will ask the reviewer what to do with an existing
file. This is the expected workflow for iterating on release notes.

---

## Step 1 - Pre-flight and Version Decision

Run pre-flight in the App repo root:

```bash
LAST_TAG=$(git tag --sort=-version:refname | head -1)
git diff --quiet && git diff --cached --quiet
git log "${LAST_TAG}..HEAD" --oneline --no-merges | head -50
```

Then detect minimum required bump:

```bash
# migrations
git diff --name-only "${LAST_TAG}..HEAD" -- packages/db/src/migrations/

# schema deltas
git diff "${LAST_TAG}..HEAD" -- packages/db/src/schema/

# breaking commit conventions
git log "${LAST_TAG}..HEAD" --format="%s" | rg -n 'BREAKING CHANGE|BREAKING:|^[a-z]+!:' || true
```

Bump policy:
- Destructive migration/API removal/major changeset/breaking commit -> `major`
- Additive migrations or clear new features -> at least `minor`
- Fixes-only -> `patch`

If requested bump is lower than required minimum, escalate bump and explain why.

---

## Step 2 - Generate Changelog Draft

First, check if `releases/v{version}.md` already exists. If it does, the
`release-changelog` skill will detect this and ask the reviewer whether to keep,
regenerate, or update it. **Do not silently overwrite an existing changelog.**

Invoke the `release-changelog` skill and produce:
- `releases/v{version}.md`
- Sections ordered as: Breaking Changes (if any), Highlights, Improvements, Fixes, Upgrade Guide (if any)

Required behavior:
- Present the draft for human review.
- Flag ambiguous categorization items.
- Flag bump mismatches before publish.
- Do not publish until reviewer confirms.

---

## Step 3 - Run App Release

**Idempotency check:** Before running `release.sh`, verify the tag doesn't
already exist:

```bash
git tag -l "v{version}"
```

If the tag exists, this version has already been published. **Do not re-run
`release.sh`.** Skip to Step 4 (follow-up tasks). Log that the publish was
already completed and capture the existing tag metadata.

If the tag does NOT exist, proceed with the release:

```bash
# dry run
./scripts/release.sh {patch|minor|major} --dry-run

# live release (only after dry-run review)
./scripts/release.sh {patch|minor|major}
```

Then capture final release metadata:

```bash
NEW_TAG=$(git tag --sort=-version:refname | head -1)   # e.g. v0.4.0
NEW_VERSION=${NEW_TAG#v}
NPM_URL="https://www.npmjs.com/package/@paperclipai/cli/v/${NEW_VERSION}"
```

If publish fails, stop immediately, keep issue in progress/blocked, and include
failure logs in the update.

---

## Step 4 - Create Cross-Project Follow-up Tasks

**Idempotency check:** Before creating tasks, search for existing ones:

```
GET /api/companies/{companyId}/issues?q=release+notes+v{version}
GET /api/companies/{companyId}/issues?q=announcement+tweet+v{version}
```

If matching tasks already exist (check title contains the version), skip
creation and link the existing tasks instead. Do not create duplicates.

Create at least two tasks in Paperclip (only if they don't already exist):

1. Website task: publish changelog for `v{version}`
2. CMO task: draft announcement tweet for `v{version}`

When creating tasks:
- Set `parentId` to the release issue id.
- Carry over `goalId` from the parent issue when present.
- Include `billingCode` for cross-team work when required by company policy.
- Mark website task `high` priority if release has breaking changes.

Suggested payloads:

```json
POST /api/companies/{companyId}/issues
{
  "projectId": "{websiteProjectId}",
  "parentId": "{releaseIssueId}",
  "goalId": "{goalId-or-null}",
  "billingCode": "{billingCode-or-null}",
  "title": "Publish release notes for v{version}",
  "priority": "medium",
  "status": "todo",
  "description": "Publish /changelog entry for v{version}. Include full markdown from releases/v{version}.md and prominent upgrade guide if breaking changes exist."
}
```

```json
POST /api/companies/{companyId}/issues
{
  "projectId": "{workspaceProjectId}",
  "parentId": "{releaseIssueId}",
  "goalId": "{goalId-or-null}",
  "billingCode": "{billingCode-or-null}",
  "title": "Draft release announcement tweet for v{version}",
  "priority": "medium",
  "status": "todo",
  "description": "Draft launch tweet with top 1-2 highlights, version number, and changelog URL. If breaking changes exist, include an explicit upgrade-guide callout."
}
```

---

## Step 5 - Wrap Up the Release Issue

Post a concise markdown update linking:
- Release issue
- Changelog file (`releases/v{version}.md`)
- npm package URL
- Website task
- CMO task
- Final changelog URL (once website publishes)
- Tweet URL (once published)

Completion rules:
- Keep issue `in_progress` until website + social tasks are done.
- Mark `done` only when all required artifacts are published and linked.
- If waiting on another team, keep open with clear owner and next action.

---

## Paperclip API Notes (When Running in Agent Context)

Use:
- `GET /api/companies/{companyId}/projects` to resolve website/workspace project IDs.
- `POST /api/companies/{companyId}/issues` to create follow-up tasks.
- `PATCH /api/issues/{issueId}` with comments for release progress.

For issue-modifying calls, include:
- `Authorization: Bearer $PAPERCLIP_API_KEY`
- `X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID`

---

## Failure Handling

If blocked, update the release issue explicitly with:
- what failed
- exact blocker
- who must act next
- whether any release artifacts were partially published

Never silently fail mid-release.
