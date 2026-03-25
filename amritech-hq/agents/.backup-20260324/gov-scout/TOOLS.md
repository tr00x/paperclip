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

### 2. Twenty CRM — `create_tender`, `search_tenders`, `create_company`, `search_companies`

**Purpose:** Log and track all reviewed government opportunities.

| Tool | When |
|------|------|
| `search_tenders` | Check for existing tender before creating |
| `create_tender` | Log every solicitation reviewed |
| `search_companies` | Check if agency exists |
| `create_company` | Create agency record if new |

**Tender record:**
- name: `[GOV] {Agency} — {Solicitation Title}`
- status: `found` → `scored` → `pending_review` → `go` / `no_go` / `expired`
- setAside: SBA type if applicable
- notes: scoring breakdown, NAICS, estimated value, deadline, recommendation

**Rules:**
- Every opportunity gets a tender record. No exceptions.
- `search_tenders` before creating — no duplicates.
- Update status to `expired` when deadline passes.

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
