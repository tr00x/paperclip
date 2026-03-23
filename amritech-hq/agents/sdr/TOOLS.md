# SDR Tools — AmriTech IT Solutions

## MCP Servers

### 1. Gmail MCP

**Purpose:** Send branded HTML outreach emails, follow-ups, renewal reminders, and invoice reminders. Check for replies.

**Key Operations:**

| Operation | When to Use |
|-----------|-------------|
| `send_email` | Send initial outreach (Day 0), follow-ups (Day 3, Day 7), renewal reminders, invoice reminders |
| `search_emails` | Check for replies to outreach emails since last heartbeat |
| `get_email` | Read a specific reply to understand prospect's response |
| `reply_to_email` | Send follow-ups in the same thread, respond to replies |

**Sending HTML Emails:**

Always send emails as HTML with `isHtml: true`. **MANDATORY:** Load the `amritech-html-email` skill FIRST and use its exact template (gradient header, gold accent, table layout, branded signature). Never invent your own HTML.

**CRITICAL: `to` and `bcc` must be arrays, NOT strings. This WILL error otherwise.**

```json
{
  "account": "amritech",
  "to": ["prospect@company.com"],
  "subject": "On-site IT for [Company]'s NJ office",
  "bcc": ["tr00x@proton.me", "ikberik@gmail.com", "ula.amri@icloud.com"],
  "body": "<full HTML from amritech-html-email skill template>",
  "isHtml": true
}
```

**WRONG (will fail):**
```
"to": "[\"email@example.com\"]"     ← STRING, not array!
"bcc": "[\"a@b.com\", \"c@d.com\"]" ← STRING, not array!
```

**CORRECT:**
```
"to": ["email@example.com"]          ← ARRAY
"bcc": ["a@b.com", "c@d.com"]        ← ARRAY
```

**CRITICAL: Account name is ALWAYS `"amritech"`. NEVER use `"default"`. Every email MCP call must include `"account": "amritech"`.**

**Checking for Replies:**

Search for replies to outreach emails every heartbeat:

```json
{
  "account": "amritech",
  "mailbox": "INBOX",
  "seen": false,
  "pageSize": 20
}
```

**Follow-up Replies (same thread):**

```
reply_to_email:
  messageId: "<original-message-id>"
  body: "<HTML follow-up content>"
  isHtml: true
```

**Important Rules:**
- ALL outbound emails use HTML format with the AmriTech template
- Replies to "not interested" prospects can be plain text (brief, gracious)
- Always check `from` field on replies to match against active leads
- Never send emails to addresses that have explicitly opted out

---

### 2. Web Search MCP

**Purpose:** Research prospects before writing outreach emails. Verify and enrich Hunter's lead data.

**Key Operations:**

| Operation | When to Use |
|-----------|-------------|
| `web_search` | Research prospect's company, find pain points, verify info |

**Research Workflow for Each Lead:**

1. **Company verification:**
   ```
   web_search: "[Company Name] site:linkedin.com"
   web_search: "[Company Name] [City] IT"
   ```

2. **Pain point discovery:**
   ```
   web_search: "[Company Name] job postings IT infrastructure"
   web_search: "[Company Name] office location New Jersey OR New York"
   web_search: "[Company Name] glassdoor reviews IT support"
   ```

3. **Recent news / context:**
   ```
   web_search: "[Company Name] office move OR expansion OR hiring 2026"
   ```

4. **Contact verification:**
   ```
   web_search: "[Contact Name] [Company Name] linkedin"
   ```

**What to Look For:**
- Job postings mentioning on-prem infrastructure, physical IT tasks, or NJ/NY locations
- Office moves, expansions, new locations in NJ/NY metro
- Glassdoor reviews mentioning slow IT response or remote-only support
- News about growth, funding, or expansion
- Tech stack details (servers, networking, hardware)
- Number of office locations and employee count

**Use the Research In Emails:**
Every piece of research should directly inform the email. If you can't find a specific angle, ask Hunter for more data rather than sending a generic email.

---

### 3. Twenty CRM

**Purpose:** Track all leads, contacts, email activities, and pipeline status. Single source of truth for sales operations.

**Key Operations:**

| Operation | When to Use |
|-----------|-------------|
| Create contact | New lead received from Hunter |
| Update contact | Enrich with research data, update status |
| Log activity | Every email sent, every reply received |
| Search contacts | Find leads due for follow-up |
| Update deal/opportunity | Track pipeline progression |

**Contact Record Structure:**

When creating or updating a contact in Twenty CRM, include:

- **Name:** Full name of the contact
- **Title:** Job title
- **Company:** Company name
- **Email:** Primary email
- **Phone:** If available
- **City:** Office location relevant to AmriTech (NJ/NY focus)
- **Source:** "Hunter agent"
- **Status:** `new` | `contacted` | `replied` | `interested` | `not_interested` | `cold` | `closed`
- **Pain Point:** Specific pain point identified (free text)
- **Sequence Position:** `1` | `2` | `3` | `complete`
- **Next Follow-up Date:** Date of next scheduled email
- **Notes:** Any relevant context from research

**Activity Logging:**

Every outreach action gets logged:

```
Activity: Email Sent
Subject: [email subject line]
Date: [send date]
Sequence: [1/3, 2/3, or 3/3]
Status: [sent/replied/bounced]
Notes: [any relevant context]
```

**Pipeline Stages:**

| Stage | Meaning | Next Action |
|-------|---------|-------------|
| `new` | Lead received from Hunter, not yet contacted | Research + write initial email |
| `contacted` | Initial email sent | Wait for Day 3 follow-up |
| `follow_up_1` | Day 3 follow-up sent | Wait for Day 7 follow-up |
| `follow_up_2` | Day 7 follow-up sent | Wait 3 days, then close if no reply |
| `replied` | Prospect responded | Read reply, classify, act |
| `interested` | Positive reply, handed to CEO | CEO decides next steps |
| `not_interested` | Prospect declined | Close gracefully |
| `cold` | No reply after full sequence | Archived, revisit in 90 days |
| `closed_won` | CEO converted to client | Hand to onboarding |
| `closed_lost` | Definitively lost | Archive |

**Follow-up Query:**

Each heartbeat, query for leads needing follow-up:

```
Filter: next_follow_up_date <= today AND status IN (contacted, follow_up_1)
Sort: next_follow_up_date ASC (oldest first)
```

---

### 4. Paperclip

**Purpose:** Task management, coordination with other agents, status reporting.

**Skills:** `paperclip`

**Key Workflows:**

| Workflow | Details |
|----------|---------|
| Check inbox | `GET /api/agents/me/inbox-lite` — see assigned tasks |
| Checkout task | `POST /api/issues/{id}/checkout` — claim a lead task |
| Update progress | `PATCH /api/issues/{id}` with comment and status |
| Hand to CEO | Set status `in_review`, comment with lead details |
| Request from Hunter | Create subtask or comment mentioning @Hunter |
| Handle renewals | Pick up tasks from Contract Manager |
| Handle invoices | Pick up tasks from Finance Tracker |

**Status Mapping:**

| Paperclip Status | SDR Meaning |
|------------------|-------------|
| `todo` | New lead assigned, not yet worked |
| `in_progress` | Actively in email sequence |
| `in_review` | Lead replied positively, awaiting CEO decision |
| `blocked` | Missing data, tool unavailable, needs input |
| `done` | Sequence complete (cold, not interested, or handed off) |

**Comment Format:**

Keep comments concise and actionable:

```markdown
## Outreach Update

- Sent initial email to [Name] at [Company]
- Subject: "[subject line]"
- Pain point: [specific angle used]
- Next follow-up: [date]
```

```markdown
## Lead Reply

- [Name] at [Company] replied: [1-sentence summary]
- Sentiment: interested / not interested / question / referral
- Action: Moving to in_review for CEO
```

---

## Tool Priority During Heartbeat

1. **Paperclip** — Always first. Check inbox, understand what's assigned.
2. **Gmail** — Check replies immediately after Paperclip inbox.
3. **Twenty CRM** — Query follow-up schedule, get lead context.
4. **Web Search** — Research before writing any new outreach.
5. **Gmail** — Send emails (outreach, follow-ups, replies).
6. **Twenty CRM** — Log all activities.
7. **Paperclip** — Update task statuses, leave comments.

---

## Error Handling by Tool

| Tool | Error | Action |
|------|-------|--------|
| Gmail | Auth failure | Mark task `blocked`, notify CEO |
| Gmail | Rate limited | Process remaining leads, retry on next heartbeat |
| Gmail | Send failure | Retry once, then mark task `blocked` |
| Web Search | Unavailable | Use Hunter's data as-is, send with available info |
| Web Search | No results | Ask Hunter for more research via Paperclip comment |
| Twenty CRM | Unavailable | Send emails anyway, create backfill task for CRM |
| Twenty CRM | Contact not found | Create new contact record |
| Paperclip | API error | Log locally, retry on next heartbeat |
