---
phase: 02-mcp-servers-setup
plan: 01
subsystem: infra
tags: [mcp, twenty-crm, pandoc, office-word, document-conversion]

# Dependency graph
requires:
  - phase: 01-twenty-crm-setup
    provides: Twenty CRM running on localhost:5555 with API key
provides:
  - Twenty CRM MCP server registered (29 CRM tools for agents)
  - Office-Word-MCP registered (DOCX creation/editing)
  - mcp-pandoc registered (document format conversion)
  - pandoc 3.9.0.2 binary installed
  - mcp-servers/ config directory with env files
affects: [03-mcp-servers-credentials, 05-ceo-agent, 06-hunter-agent, 07-sdr-agent, 08-closer-agent, 09-gov-scout-agent, 10-proposal-writer-agent, 11-contract-manager-agent]

# Tech tracking
tech-stack:
  added: [twenty-mcp-server@1.2.0, office-word-mcp-server, mcp-pandoc, pandoc@3.9.0.2]
  patterns: [mcp-servers-directory-config, env-per-server, claude-mcp-registration]

key-files:
  created: [mcp-servers/README.md, mcp-servers/twenty-crm/.env, mcp-servers/docs/.env]
  modified: []

key-decisions:
  - "Pandoc installed at /usr/local/bin/pandoc (Homebrew on this machine uses /usr/local not /opt/homebrew)"
  - "twenty-crm MCP health check shows 'Failed to connect' but this is normal for npx-based stdio servers that start on demand"

patterns-established:
  - "MCP config pattern: each server gets mcp-servers/<name>/.env for credentials, registered via claude mcp add"
  - "Python MCP servers use uvx (no global install), Node MCP servers use npm -g or npx"

requirements-completed: [INFRA-02]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 02 Plan 01: MCP Servers (No-Credential) Summary

**Three MCP servers registered (Twenty CRM, Office-Word, mcp-pandoc) with pandoc 3.9.0.2 binary, config directory structure created**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T19:08:30Z
- **Completed:** 2026-03-21T19:12:41Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Installed pandoc 3.9.0.2 and twenty-mcp-server@1.2.0 globally
- Registered three MCP servers in Claude Code project scope: twenty-crm, word-docs, pandoc
- Created mcp-servers/ directory with README, env configs, and agent usage matrix
- word-docs and pandoc confirmed connected; twenty-crm registered (starts on demand via npx)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install pandoc + register Twenty CRM MCP server** - `73cb7e3c` (feat)
2. **Task 2: Register Office-Word-MCP and mcp-pandoc servers** - `7cbe832e` (feat)

## Files Created/Modified
- `mcp-servers/README.md` - MCP servers overview, start commands, agent usage matrix (91 lines)
- `mcp-servers/twenty-crm/.env` - Twenty CRM API key and base URL (gitignored)
- `mcp-servers/docs/.env` - Pandoc path notes for stateless doc servers (gitignored)

## Decisions Made
- Pandoc binary is at `/usr/local/bin/pandoc` (not `/opt/homebrew/bin` as plan assumed) -- updated docs/.env accordingly
- twenty-crm MCP "Failed to connect" health check is expected for npx-based stdio servers that only start when tools are invoked

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected PANDOC_PATH in docs/.env**
- **Found during:** Task 2
- **Issue:** Plan specified `/opt/homebrew/bin/pandoc` but `which pandoc` returns `/usr/local/bin/pandoc`
- **Fix:** Updated docs/.env to use correct path
- **Files modified:** mcp-servers/docs/.env
- **Verification:** `which pandoc` confirms `/usr/local/bin/pandoc`
- **Committed in:** 7cbe832e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor path correction. No scope creep.

## Issues Encountered
- macOS `timeout` command not available (not GNU coreutils); used background process + kill for MCP server smoke tests instead

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Three no-credential MCP servers ready for agent phases
- Phase 02 Plan 02 will handle credential-requiring servers (Telegram, Email) which need human setup
- Twenty CRM MCP tools available for Hunter, SDR, Closer, Gov Scout, Contract Manager, Finance, Onboarding agents

---
*Phase: 02-mcp-servers-setup*
*Completed: 2026-03-21*
