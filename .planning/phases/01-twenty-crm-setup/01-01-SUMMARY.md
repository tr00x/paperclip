---
phase: 01-twenty-crm-setup
plan: 01
status: complete
started: 2026-03-21T14:00:00Z
completed: 2026-03-21T18:30:00Z
---

## Summary

Deployed Twenty CRM via Docker on port 5555 with 4 custom objects (lead, tender, client, invoice) and a working API key for Phase 2 MCP integration.

## What was built

- Twenty CRM running via Docker Compose (server, worker, postgres, redis) on `localhost:5555`
- Workspace "AmriTech HQ" created with admin account
- 4 custom objects created via metadata API: lead, tender, client, invoice
- API key generated and saved in `twenty-crm/.env` as `TWENTY_API_KEY`

## Key files

### Created
- `twenty-crm/docker-compose.yml` — Docker Compose config (downloaded from official repo, port changed to 5555)
- `twenty-crm/.env` — Environment variables including API key

### Modified
- `server/src/app.ts` — Added `limit: "50mb"` to express.json() to fix company import payload size
- `server/src/middleware/error-handler.ts` — Added console.error for unhandled 500s (debug aid)

## Deviations

- **Port changed from 3000 to 5555** — Port 3000 was occupied, user requested custom ports (Paperclip: 4444, Twenty: 5555)
- **Docker Desktop installed** — Was not present on the machine; installed ARM64 version via direct download
- **Node.js upgraded from 16 to 22** — Required for Paperclip to run
- **Paperclip import fix** — express.json() body limit was 100kb default, increased to 50mb for company package import
- **Pipelines implemented as custom objects** — Twenty CRM latest version doesn't have built-in pipeline/opportunity objects; used custom objects instead

## Issues encountered

- Docker Desktop was not installed; old Intel symlinks from 2021 blocked installation
- Homebrew installed Intel version instead of ARM64; had to download DMG directly
- Company import returned 500 — root cause: PayloadTooLargeError (default 100kb limit)
- Old company deletion required manual SQL cascade across 42 FK tables

## Verification

- [x] Twenty CRM accessible at http://localhost:5555
- [x] Health endpoint returns 200
- [x] 4 Docker services running (server, worker, db, redis)
- [x] Workspace "AmriTech HQ" exists
- [x] 4 custom objects active: lead, tender, client, invoice
- [x] API key works — queries metadata API successfully
- [x] API key saved in twenty-crm/.env
