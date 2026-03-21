---
phase: 03-registry-skills-install
plan: 01
subsystem: infra
tags: [skills, registry, npx-skills, paperclip-cli]

requires:
  - phase: 01-twenty-crm-setup
    provides: "Base Paperclip project with initial skills (paperclip, para-memory-files)"
provides:
  - "222 skills installed from 5 sources (21 required + bonus)"
  - "skills-lock.json with all source tracking"
  - "Agent-specific skill directories populated"
affects: [04-company-package-scaffold, 05-ceo-agent, 06-hunter-agent, 07-sdr-agent]

tech-stack:
  added: [npx-skills-cli]
  patterns: ["npx skills add <repo>@<skill> --all -y for batch skill install"]

key-files:
  created:
    - skills-lock.json
  modified:
    - .gitignore
    - skills/
    - .claude/skills/

key-decisions:
  - "Installed all skills from each repo (not just target skills) since --all flag pulls entire registry"
  - "Added 33 agent-specific directories to .gitignore to keep repo clean"

patterns-established:
  - "Skills install via npx skills add <owner>/<repo>@<skill> --all -y"
  - "Agent tool directories (.adal/, .agent/, .augment/, etc.) are gitignored"

requirements-completed: [INFRA-03]

duration: 3min
completed: 2026-03-21
---

# Phase 03 Plan 01: Registry Skills Install Summary

**222 registry skills installed from 5 sources (tech-leads-club GTM, seb1n sales/finance, lawvable legal) via npx skills CLI**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T19:51:14Z
- **Completed:** 2026-03-21T19:54:15Z
- **Tasks:** 2
- **Files modified:** 430

## Accomplishments

- Installed all 21 required skills for AmriTech AI HQ agents from 3 external sources
- 222 total skills available (77 from tech-leads-club, 91 from seb1n, 54 from lawvable, plus existing)
- skills-lock.json tracks all 5 sources with computed hashes
- Agent-specific directories cleaned up in .gitignore

## Task Commits

Each task was committed atomically:

1. **Task 1: Install all 19 registry skills from 3 external sources** - `e0d65871` (feat)
2. **Task 2: Verify all 21 required skills are present and update state** - `9a75eac9` (chore)

## Files Created/Modified

- `skills-lock.json` - Lock file tracking all installed skill sources and hashes
- `skills/` - Symlinks to installed skills for OpenClaw agent
- `.claude/skills/` - Symlinks to installed skills for Claude Code agent
- `.gitignore` - Added 33 agent-specific directories to ignore list

## Decisions Made

- Installed full repos (not individual skills) since `npx skills add` with `--all` flag pulls entire registry. This gives agents access to 222 skills total, far exceeding the 21 minimum required.
- Added agent-specific directories (.adal/, .agent/, .augment/, etc.) to .gitignore since they are generated artifacts not needed in version control.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added agent directories to .gitignore**
- **Found during:** Task 2 (Verification)
- **Issue:** Skills installer created 28+ agent-specific directories (.adal/, .agent/, .augment/, etc.) that polluted git status
- **Fix:** Added all agent directories to .gitignore
- **Files modified:** .gitignore
- **Verification:** `git status` clean after commit
- **Committed in:** 9a75eac9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for repo cleanliness. No scope creep.

## Issues Encountered

None - all skills installed successfully on first attempt from all 3 sources.

## Verification Summary

All 21 required skills confirmed installed:

| Source | Count | Skills |
|--------|-------|--------|
| paperclip ecosystem | 4 | paperclip, paperclip-ai-orchestration, paperclip-create-agent, para-memory-files |
| tech-leads-club | 9 | ai-cold-outreach, ai-sdr, lead-enrichment, expansion-retention, social-selling, gtm-metrics, gtm-engineering, positioning-icp, sales-motion-design |
| seb1n | 7 | lead-scoring, crm-data-enrichment, invoice-processing, financial-report-generation, proposal-generation, competitive-battlecard-creation, sales-email-sequences |
| lawvable | 3 | tech-contract-negotiation-patrick-munro, compliance-anthropic, vendor-due-diligence-patrick-munro |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 21 required skills installed and verified
- Ready for Phase 04 (Company Package Scaffold) and agent phases (05+)
- Each agent can reference domain skills during heartbeat execution

## Self-Check: PASSED

- FOUND: skills-lock.json
- FOUND: .gitignore
- FOUND: 03-01-SUMMARY.md
- FOUND: commit e0d65871
- FOUND: commit 9a75eac9
- Skills count: 222

---
*Phase: 03-registry-skills-install*
*Completed: 2026-03-21*
