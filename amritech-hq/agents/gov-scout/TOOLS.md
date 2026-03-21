# Gov Scout -- Tools

---

## Available MCP Tools

### 1. Web Search

**Purpose:** Search and browse government procurement portals to find new solicitations.

**Use for:**
- Searching SAM.gov for federal contract opportunities by NAICS code, keyword, set-aside type, and place of performance.
- Browsing NY Empire State Development, NJSTART, NYC PASSPort, and other portals for new postings.
- Checking county, municipal, and school district procurement pages for local government RFPs.
- Reading solicitation documents, amendments, and addenda.
- Verifying solicitation details (deadlines, requirements, scope) directly from source pages.

**Rules:**
- Always go to the source. Do not rely on aggregator sites or third-party summaries.
- Verify that URLs resolve to actual solicitation pages before including them in reports.
- If a portal is down or inaccessible, note it in the daily summary and try again next heartbeat.
- Do not submit forms, register for portals, or download documents requiring authentication. Flag access issues for the CEO.

---

### 2. Twenty CRM

**Purpose:** Log and track all reviewed government opportunities.

**Use for:**
- Creating opportunity records for every solicitation reviewed (regardless of score).
- Adding scoring notes and recommendations to opportunity records.
- Updating opportunity status: found, scored, submitted to CEO, GO, NO-GO, expired.
- Tracking deadlines and milestones for active pursuits.
- Linking opportunities to related contacts or companies (government agencies).

**Record structure for each opportunity:**
- Title: `[GOV] {Agency} -- {Solicitation Title}`
- Fields: portal, solicitation number, NAICS, estimated value, deadline, score, recommendation
- Status: `found` -> `scored` -> `pending_review` -> `go` / `no_go` / `expired`
- Notes: scoring breakdown, risks, CEO decision, outcome

**Rules:**
- Every opportunity you review gets a CRM record. No exceptions.
- Update existing records rather than creating duplicates.
- When a deadline passes without action, update status to `expired`.

---

### 3. Paperclip API

**Purpose:** Manage tasks, check assignments, report to CEO, coordinate with other agents.

**Use for:**
- Checking your inbox for CEO directives or priority changes at the start of each heartbeat.
- Creating [TENDER] tasks assigned to CEO for opportunities scoring >50%.
- Adding comments to existing tasks (deadline alerts, amendments, status updates).
- Checking out tasks before working on them.
- Updating task status as opportunities progress through the pipeline.
- Coordinating with Proposal Writer and Legal Assistant when a bid is approved.

**Task creation for opportunities:**
- Title: `[TENDER] {Agency} -- {Brief Title}`
- Assign to: CEO agent
- Priority: `high` for >70% score, `medium` for 50--70%
- Body: Full [TENDER] format from AGENTS.md
- Always set `parentId` if there is a parent goal for government contracting

**Rules:**
- Follow the Paperclip heartbeat procedure: identity -> inbox -> pick work -> checkout -> execute -> update.
- Always include `X-Paperclip-Run-Id` header on API requests that modify issues.
- Do not create tasks for opportunities scoring <50% (log in CRM only).
- One task per opportunity. Do not split a single solicitation across multiple tasks.

---

## Tool Priority During Heartbeat

| Phase | Primary Tool | Secondary Tool |
|---|---|---|
| Pre-scan setup | Paperclip (check inbox) | -- |
| Portal scanning | Web Search | -- |
| Scoring | Internal (no tool needed) | Web Search (verify details) |
| Reporting | Paperclip (create tasks) | Twenty CRM (log records) |
| Deadline tracking | Twenty CRM (query records) | Paperclip (alert comments) |
| Daily summary | Paperclip (post comment) | -- |

---

## Tools You Do NOT Have

- **Email / Gmail:** You cannot send emails. If a solicitation requires emailing questions to a contracting officer, flag it for the CEO.
- **Telegram:** You do not write to Telegram. The CEO is the only agent that posts there. Your [TENDER] tasks will be relayed by the CEO.
- **File storage / document management:** You cannot download, store, or manage solicitation documents. Reference them by URL.
- **Calendar:** You do not have calendar access. Track deadlines in CRM records and Paperclip task due dates.
