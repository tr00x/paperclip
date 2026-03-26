# AmriTech AI HQ — Complete Documentation

> Version: HQ v2 | Date: 2026-03-22 | Author: Tim (@cto_handle) + Claude Opus

---

## 1. System Architecture

### 1.1 Overview

AmriTech AI HQ is an autonomous AI headquarters consisting of 12 agents + 3 humans, running on the Paperclip platform. Agents find clients, write emails, prepare briefings, monitor contracts, and track finances. Humans make calls, close deals, and manage the CRM.

### 1.2 Technology Stack

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| Orchestrator | Paperclip | 4444 | Agent management, tasks, heartbeats |
| CRM | Twenty CRM (Docker) | 5555 | Single source of truth — leads, clients, contracts |
| Email | IONOS SMTP/IMAP | — | Sending/receiving email via agent@yourcompany.example.com |
| Telegram Bot | Custom webhook | 3088 | Bidirectional communication: humans ↔ agents |
| CRM Sync | Custom service | 3089 | Auto-sync Paperclip tasks → CRM leads |
| Tunnel | Cloudflare | — | Remote access (crm.yourcompany.example.com, dispatch.yourcompany.example.com) |
| Watchdog | Bash + launchd | — | Automatic monitoring and restart of all services |
| AI Engine | Claude (Anthropic) | — | Brain of each agent (claude_local adapter) |

### 1.3 Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        TELEGRAM GROUP                           │
│  Alex (@founder_handle) | Sam (@cofounder_handle) | Tim (@cto_handle)              │
│  /commands → webhook → Paperclip → agent wakeup                │
│  ← notifications, demands, reports, files                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   TG WEBHOOK    │
                    │   (port 3088)   │
                    │ Routes commands │
                    │ Downloads files │
                    │ Quick queries   │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │        PAPERCLIP            │
              │       (port 4444)           │
              │  Orchestrator — manages:    │
              │  • 12 agents               │
              │  • Tasks/issues            │
              │  • Heartbeat scheduling    │
              │  • Skills sync             │
              │  • Agent wakeup/sleep      │
              └──────┬───────────┬─────────┘
                     │           │
          ┌──────────▼──┐  ┌────▼──────────┐
          │  AGENTS     │  │   CRM SYNC    │
          │ (Claude AI) │  │  (port 3089)  │
          │ 12 instances│  │ Paperclip →   │
          │ Each has:   │  │ Twenty CRM    │
          │ • SOUL.md   │  │ Auto-create   │
          │ • HEARTBEAT │  │ leads from    │
          │ • Skills    │  │ [LEAD] tasks  │
          │ • MCP tools │  └────┬──────────┘
          └──────┬──────┘       │
                 │              │
          ┌──────▼──────────────▼──────┐
          │       TWENTY CRM           │
          │       (port 5555)          │
          │  Docker: server + DB +     │
          │  Redis + worker            │
          │                            │
          │  Objects:                   │
          │  • Lead (28 fields)        │
          │  • Client                  │
          │  • Invoice                 │
          │  • Tender                  │
          │                            │
          │  GraphQL API               │
          └────────────────────────────┘
                 │
          ┌──────▼──────┐
          │  EMAIL MCP  │
          │  IONOS SMTP │
          │  agent@     │
          │ yourcompany.example.com │
          └─────────────┘
```

### 1.4 File Structure

```
paperclip/
├── amritech-hq/
│   ├── agents/
│   │   ├── ceo/           (SOUL.md, HEARTBEAT.md, TOOLS.md, AGENTS.md)
│   │   ├── hunter/
│   │   ├── sdr/
│   │   ├── closer/
│   │   ├── staff-manager/
│   │   ├── contract-manager/
│   │   ├── finance-tracker/
│   │   ├── it-chef/       (+ known-issues.md)
│   │   ├── proposal-writer/
│   │   ├── legal-assistant/
│   │   ├── onboarding-agent/
│   │   └── gov-scout/
│   ├── skills/
│   │   ├── amritech-crm-leads/       CRM queries and mutations
│   │   ├── amritech-html-email/       Email template (gradient, logo, Calendly)
│   │   ├── amritech-documents/        Document creation and delivery
│   │   ├── amritech-team-contacts/    Team contacts
│   │   ├── amritech-self-improvement/ Self-improvement system [IMPROVEMENT]
│   │   ├── amritech-infra-diagnostics/ IT Chef checklists + API reference
│   │   └── amritech-tender-scoring/   Tender scoring
│   ├── knowledge-base/    Knowledge base (7 documents)
│   └── assets/            Logos
├── mcp-servers/
│   ├── telegram-webhook/  TG webhook (commands, files, quick queries)
│   ├── telegram-send/     TG MCP (send_message, send_document, send_photo)
│   ├── crm-sync/          Auto-sync Paperclip → CRM
│   └── agent-mcp-config.json  MCP config for agents
├── twenty-crm/            Docker compose for Twenty CRM
├── scripts/
│   └── watchdog.sh        (copy at ~/.paperclip/watchdog.sh)
└── DOCUMENTATION.md       ← this file
```

---

## 2. Team

### 2.1 People

| Name | Role | TG | Email | Responsibilities |
|------|------|----|-------|-----------------|
| **Alex Founder** | Co-Founder & CEO | @founder_handle | founder@example.com | Deal decisions, pricing, client calls, email approvals, CRM — clients |
| **Sam Cofounder** | Co-Founder & Account Manager | @cofounder_handle | cofounder@example.com | Client calls, renewals, collection, on-site, CRM — call outcomes |
| **Tim** | AI/Automation & Dev | @cto_handle | cto@example.com | Builds and maintains HQ, automation. Often offline — IT Chef steps in |

### 2.2 AI Agents

| # | Agent | Role | Heartbeat | Model | Key Skills |
|---|-------|------|-----------|-------|------------|
| 1 | **CEO** | HQ coordinator, leader | 4h + events | Opus | gtm-metrics, report-generation, data-analysis |
| 2 | **Hunter** | Lead discovery | 6h (4 cycles/day) | Sonnet | deep-research, lead-scoring, lead-enrichment, crm-data-enrichment |
| 3 | **SDR** | Cold email + follow-ups | 2h | Sonnet | ai-sdr, ai-cold-outreach, sales-email-sequences, copywriting |
| 4 | **Closer** | Call briefing preparation | On task | Sonnet | competitive-battlecard-creation, deep-research |
| 5 | **Staff Manager** | HQ oversight | 4h | Sonnet | report-generation |
| 6 | **Contract Manager** | Contracts, renewals | 24h | Sonnet | contract-review, expansion-retention, churn-analysis |
| 7 | **Finance Tracker** | MRR, invoices, payments | Weekly (Mon) | Sonnet | invoice-processing, financial-report-generation, budget-planning |
| 8 | **IT Chef** | DevOps, system repairs | 1h | Sonnet | docker-compose, cloud-monitoring, database-backup, security-audit, task-automation |
| 9 | **Proposal Writer** | Proposals, RFPs | On task | Sonnet | proposal-generation, technical-writing, presentation-creation |
| 10 | **Legal Assistant** | Contracts, compliance | On task | Sonnet | contract-review-anthropic, compliance-anthropic, nda-triage |
| 11 | **Onboarding Agent** | Client onboarding | On task | Sonnet | onboarding-playbook-creation, customer-feedback-analysis |
| 12 | **Gov Scout** | Government tenders | 24h | Sonnet | deep-research, compliance-checklist, tender-scoring |

**Shared skills across ALL agents:**
- `amritech-crm-leads` — CRM queries and mutations
- `amritech-team-contacts` — team contacts
- `amritech-self-improvement` — self-improvement system
- `amritech-html-email` — email template
- `amritech-documents` — document creation
- `paperclip-create-plugin` — Paperclip API
- `para-memory-files` — persistent memory

### 2.3 Hierarchy

```
CEO (agent — central command)
├── Staff Manager (oversees agents AND humans)
│   └── Monitors health, CRM discipline, reports to CEO
├── IT Chef (devops)
│   └── Fixes everything, reviews [IMPROVEMENT], stands in for Tim
├── Sales Pipeline:
│   ├── Hunter → finds leads
│   ├── SDR → sends emails, follow-ups
│   └── Closer → prepares briefing → Alex makes the call
├── Revenue:
│   ├── Contract Manager → renewals, churn risk
│   └── Finance Tracker → MRR, invoices, collection
├── Delivery:
│   ├── Onboarding Agent → welcome, IT audit, 30-day plan
│   └── Legal Assistant → contracts, compliance, red flags
├── Expansion:
│   ├── Gov Scout → tenders
│   └── Proposal Writer → proposals, RFPs
└── People:
    ├── Alex — decisions, calls, signatures
    ├── Sam — client calls, collection, on-site
    └── Tim — infrastructure, automation
```

---

## 3. How Agents Work

### 3.1 Agent Anatomy

Each agent is a Claude AI instance with a set of files:

| File | Purpose |
|------|---------|
| **SOUL.md** | Personality, rules, company context, decision-making principles. "Who you are and how you think." |
| **HEARTBEAT.md** | Step-by-step procedure for each cycle. "What you do when you wake up." |
| **TOOLS.md** | Available MCP tools and APIs. "What you use." |
| **AGENTS.md** | Mission and file references. Entry point for Paperclip. |

### 3.2 Agent Lifecycle

```
launchd → watchdog → Paperclip (port 4444)
                         │
                    ┌─────▼─────┐
                    │  SLEEP    │ ← agent is sleeping
                    └─────┬─────┘
                          │ heartbeat timer OR task assigned OR wakeup API
                    ┌─────▼─────┐
                    │  WAKE     │ ← agent wakes up
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ READ SOUL │ ← reads its instructions
                    │ READ HB   │
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ EXECUTE   │ ← executes HEARTBEAT checklist
                    │ HEARTBEAT │   step by step
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ USE TOOLS │ ← CRM, Email, TG, Web Search
                    │ (MCP)     │
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ REPORT    │ ← comments on tasks, TG
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │  SLEEP    │ ← sleeps until next cycle
                    └───────────┘
```

### 3.3 MCP Tools (Model Context Protocol)

Each agent has access to MCP servers:

| MCP Server | Tools | Used By |
|------------|-------|---------|
| **twenty-crm** | 29 tools — leads, contacts, companies, notes | All except Legal |
| **telegram** | send_message, send_document, send_photo | All |
| **email** | send_email, list_emails, search_emails, get_email | SDR, Onboarding, CEO |
| **word-docs** | create_document, add_heading, add_table, format_text | Proposal Writer, Contract Manager, Legal |
| **pandoc** | convert between formats (MD↔DOCX↔PDF) | Proposal Writer, Legal |
| **ddg-search** | web_search (DuckDuckGo) | Hunter, SDR, Closer, Gov Scout |
| **web-search** | search_web, fetch_url | Hunter, SDR, Closer |

### 3.4 Skills (managed via Paperclip API)

Skills are markdown files with instructions. Paperclip syncs them to agents automatically.

**Binding:** `POST /api/agents/{id}/skills/sync` with `desiredSkills[]`

**Skill types:**
- `local/...` — our custom skills (amritech-crm-leads, etc.)
- `company/...` — bound to the company
- `owner/repo/slug` — from the GitHub marketplace (80+ skills)

---

## 4. Inter-Agent Communication

### 4.1 Communication Channels

| Channel | How It Works | Examples |
|---------|-------------|---------|
| **CRM (Twenty)** | Agents read and write to a shared database. One agent updates a field — another sees it. | Hunter creates a lead → SDR reads and sends email → updates outreachStatus → Closer sees it |
| **Paperclip Tasks** | An agent creates a task for another agent. Paperclip wakes the recipient. | SDR creates [BRIEFING] → Closer wakes up and prepares the briefing |
| **Paperclip Comments** | Comments on tasks — agents read the history. | Hunter leaves signals → SDR reads them before writing the email |
| **Telegram** | Agents write to the shared chat. Humans see and respond. | CEO sends digest → Alex approves → SDR proceeds |
| **Memory (PARA)** | Each agent stores its own memory. Not shared directly, but IT Chef can read it. | Hunter remembers "dental niche converts better" |

### 4.2 Handoff Protocols

#### Hunter → SDR (Auto-queue)
```
Condition: ICP 60+ AND decision maker email is populated
Action:
  1. Hunter sets CRM status: "qualified"
  2. Hunter creates task: [AUTO-QUEUE] {Company} — ICP {score}
  3. Paperclip wakes SDR
  4. SDR reads task + CRM record → writes email
```

#### SDR → Closer (Positive Reply)
```
Condition: SDR classified reply as replied_interested
Action:
  1. SDR updates CRM: outreachStatus → replied_interested, status → engaged
  2. SDR creates task: [BRIEFING] {Company}
  3. SDR posts in TG: "Lead replied!"
  4. Closer wakes up → prepares BANT briefing
```

#### Closer → Onboarding + Contract (Closed Won)
```
Condition: Alex confirmed closed_won
Action:
  1. Closer updates CRM: status → closed_won
  2. Closer creates [ONBOARD] for Onboarding Agent
  3. Closer creates [CONTRACT] for Contract Manager
  4. TG: "New client!"
```

#### Onboarding → Finance (Completion)
```
Condition: 30-day onboarding complete
Action:
  1. Onboarding creates [INVOICE] for Finance Tracker
  2. Onboarding updates CRM: Client record
```

#### Any Agent → IT Chef (Tech Issue)
```
Condition: Any technical error (MCP fail, CRM down, email error)
Action:
  1. Agent creates [TECH-ISSUE] {Agent}: {description}
  2. IT Chef wakes up → diagnoses → fixes or asks Tim
```

#### Any Agent → IT Chef (Improvement)
```
Condition: Agent notices a pattern or improvement opportunity
Action:
  1. Agent creates [IMPROVEMENT] {Agent}: {description} with diff
  2. IT Chef reviews → approves (safe) or escalates to Tim (risky)
```

### 4.3 CRM as Data Bus

CRM is the central exchange point. All agents read and write:

```
                    ┌─────────────┐
                    │  TWENTY CRM │
                    │             │
     Hunter ──write──►  Lead      ◄──read── SDR
     SDR ────write──►  status    ◄──read── Closer
     Closer ─write──►  status    ◄──read── Onboarding
     Finance ─write──► Invoice   ◄──read── CEO
     Contract─write──► renewal   ◄──read── SDR
                    │             │
                    └─────────────┘
```

**Lead fields for synchronization:**

| Field | Written By | Read By |
|-------|-----------|---------|
| name, industry, location, icpScore | Hunter | SDR, CEO, Closer |
| decisionMaker, decisionMakerEmail | Hunter | SDR |
| status | Hunter → SDR → Closer → Onboarding | All |
| outreachStatus | SDR | SDR (follow-up), CEO (reports), Closer |
| lastContactDate | SDR | SDR (follow-up timing), CEO |
| notes | All (append only) | All |
| signals, signalSources | Hunter | SDR (personalization), Closer |
| estimatedMrr | Hunter | CEO, Finance |

---

## 5. Orchestrator (Paperclip)

### 5.1 How It Works

Paperclip is an open-source platform for orchestrating AI agents. Started via `pnpm dev:once` (NOT `pnpm dev` — watch mode is prohibited in production).

**Key concepts:**
- **Company** — AmriTech (id: `YOUR_COMPANY_ID`)
- **Agent** — AI employee with an adapter (claude_local), heartbeat, budget
- **Issue** — task (todo/in_progress/in_review/blocked/done)
- **Skill** — markdown instruction bound to an agent
- **Heartbeat** — periodic agent wake-up

### 5.2 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/companies/{id}/agents` | GET | List agents |
| `/api/agents/{id}` | PATCH | Update agent (name, config) |
| `/api/agents/{id}/skills` | GET | Agent skills |
| `/api/agents/{id}/skills/sync` | **POST** | Bind skills (NOT PUT!) |
| `/api/agents/{id}/wakeup` | POST | Wake up an agent |
| `/api/companies/{id}/issues` | GET/POST | Tasks |
| `/api/issues/{id}/checkout` | POST | Check out a task |
| `/api/companies/{id}/skills` | GET | All company skills |
| `/api/companies/{id}/skills/import` | POST | Import skill from local path |
| `/api/companies/{id}/skills/scan` | POST | Scan projects for skills |

### 5.3 How Paperclip Wakes Agents

1. **Timer (heartbeat)** — every N seconds (interval in agent config)
2. **Task assignment** — when a task is assigned to the agent
3. **Wakeup API** — `POST /api/agents/{id}/wakeup` (used by the webhook and other agents)
4. **Comment mention** — when someone mentions the agent in a comment

### 5.4 Agent Adapter Config

Each agent has an `adapterConfig`:

```json
{
  "cwd": "/Users/timur/paperclip",
  "model": "claude-sonnet-4-6",
  "extraArgs": ["--mcp-config", "/Users/timur/paperclip/mcp-servers/agent-mcp-config.json"],
  "instructionsFilePath": ".../.paperclip/.../instructions/AGENTS.md",
  "instructionsRootPath": ".../.paperclip/.../instructions",
  "instructionsBundleMode": "managed",
  "dangerouslySkipPermissions": true,
  "paperclipSkillSync": {
    "desiredSkills": ["skill/key/1", "skill/key/2"]
  }
}
```

**IMPORTANT:** Agent instruction files are stored in TWO locations:
1. **Source:** `amritech-hq/agents/{slug}/` — our source files
2. **Runtime:** `~/.paperclip/instances/default/companies/{company-id}/agents/{agent-id}/instructions/` — what Paperclip actually reads

When source changes → copy to runtime:
```bash
cp amritech-hq/agents/{slug}/*.md ~/.paperclip/.../agents/{agent-id}/instructions/
```

---

## 6. Sales Pipeline

### 6.1 Full Pipeline

```
DISCOVERY → QUALIFICATION → OUTREACH → ENGAGEMENT → MEETING → CLOSE → ONBOARD → REVENUE
  Hunter      Hunter/CRM      SDR         SDR        Closer    Alex   Onboard   Finance
                                                     +Alex            +Contract
```

### 6.2 CRM Statuses

| Status | OutreachStatus | What Happens | Owner |
|--------|---------------|-------------|-------|
| new | pending | Hunter created, no email | Hunter enrichment |
| qualified | pending | ICP 60+, email available | SDR picks it up |
| contacted | email_sent | Day 0 email sent | SDR waits |
| contacted | follow_up_1 | Day 3 follow-up | SDR waits |
| contacted | follow_up_2 | Day 7 follow-up | SDR waits |
| engaged | replied_interested | Positive reply | Alex decides |
| engaged | replied_question | Question from lead | SDR prepares response |
| engaged | replied_objection | Objection | SDR handles it |
| meeting_set | meeting_scheduled | Call scheduled | Closer + Alex |
| closed_won | — | Became a client | Onboarding + Contract |
| closed_lost | — | Declined | Archive |
| nurture | no_response | No response, will revisit | Hunter rescans |

### 6.3 Email Sending Schedule

- **Window:** Mon-Thu, 8:00-10:00 AM ET
- **Fri/weekends/evenings:** Queued for Monday 9 AM
- **Approval:** SDR asks Alex before initial emails
- **Follow-ups Day 3/7:** Automatic during business hours without approval
- **BCC required:** cto@example.com, founder@example.com, cofounder@example.com

---

## 7. Demand System

### 7.1 Principle

Agents do not wait silently. If they need action from a human or another agent, they demand it. Politely but persistently. With each passing hour/day — louder.

### 7.2 SDR → Alex (Lead Replies)

| Elapsed | Tier | Message |
|---------|------|---------|
| 0-2h | 1 | Standard notification |
| 2-4h | 2 | "@founder_handle, decision needed — do we reply?" |
| 4-8h | 3 | "@founder_handle, lead is going cold!" |
| 8+h | 4 | "@founder_handle @cto_handle URGENT!" |

### 7.3 Contract Manager → Sam (Renewals)

| Until Expiry | Message |
|-------------|---------|
| 30 days | "@cofounder_handle, call the client" |
| 15 days | "SDR outreach with no response" |
| 7 days | "CRITICAL! Contract expires in 7 days!" |

### 7.4 Finance → All (Overdue Payments)

| Days | Action |
|------|--------|
| 7 | SDR reminder email |
| 14 | "@founder_handle, decision?" |
| 30 | "@cofounder_handle, make the call!" |
| 45 | Repeat if no CRM record |
| 60 | "Formal notice? Pause service?" |

### 7.5 Staff Manager → All (CRM Discipline)

| Issue | Demand |
|-------|--------|
| Alex hasn't entered clients | "@founder_handle, {N} clients in CRM missing data" |
| Sam didn't log a call | "@cofounder_handle, no CRM record after the call" |
| CRM data is stale | "{N} records not updated in >30 days" |

### 7.6 Agent → Agent (Accountability)

- Hunter → SDR: "3 qualified leads without outreach. Leads are going cold."
- SDR → Hunter: "Lead has no email. Cannot start outreach."
- Closer → Alex: "Briefing has been ready for 2 days. Making the call?"
- CEO → All: Weekly report with human KPIs

---

## 8. Telegram Integration

### 8.1 Architecture

```
TG Group Chat
    │
    ▼
Cloudflare Tunnel (webhook URL)
    │
    ▼
telegram-webhook (port 3088)
    ├── Text message → parseCommand → route to agent
    ├── /status, /pipeline, /leads → CRM query → instant reply
    ├── /fix → IT Chef task
    ├── /help → help message (2 parts)
    ├── Photo/Document → download → save → create task → wake agent
    └── No command → CEO (default)

telegram-send MCP (stdio)
    ├── send_message(text) → TG API sendMessage
    ├── send_document(file_path) → TG API sendDocument
    └── send_photo(file_path) → TG API sendPhoto
```

### 8.2 Commands

**Quick (instant):** `/status`, `/pipeline`, `/leads`, `/fix`, `/help`

**Agent (wakes agent):** `/ceo`, `/staff`, `/hunter`, `/sdr`, `/closer`, `/gov`, `/proposal`, `/contract`, `/finance`, `/legal`, `/onboard`, `/chef`

### 8.3 Files and Photos

**Incoming (humans → agents):**
1. Webhook receives `message.photo` or `message.document`
2. Downloads via TG API `getFile` → download
3. Saves to `/tmp/amritech-tg-files/`
4. Creates a task for the agent with the file path
5. Caption determines routing: `/hunter business card` → Hunter

**Outgoing (agents → humans):**
- `send_document` — DOCX, PDF, any file
- `send_photo` — PNG, JPG

---

## 9. Email System

### 9.1 Configuration

| Parameter | Value |
|-----------|-------|
| SMTP | smtp.ionos.com:587 (STARTTLS) |
| IMAP | imap.ionos.com:993 (TLS) |
| From | agent@yourcompany.example.com |
| Name | YourCompany LLC |
| BCC | cto@example.com, founder@example.com, cofounder@example.com |

### 9.2 Email Template

- **Layout:** Table-based (email-safe)
- **Header:** Gradient #003D8F → #1474C4, white logo `Main_logo-email.png`
- **Accent:** Gold stripe #EC9F00
- **CTA:** "Book a 15-min Phone Call" → Calendly
- **Signature:** Alex Founder, Co-Founder & CEO, with gold stripe
- **Footer:** "Just reply to this email — we read and respond to every message."
- **All styles inline** — no email client will break the layout

### 9.3 Email Types

| Type | Template | Tone |
|------|----------|------|
| Cold outreach | Full (header + CTA) | Helpful, direct |
| Follow-up Day 3 | Plain reply | New angle, value add |
| Follow-up Day 7 | Plain reply | Gracious close |
| Welcome (onboarding) | Full + sections | Warm, excited |
| Renewal reminder | Full | Appreciative |
| Invoice reminder | Plain reply | Friendly, zero pressure |

---

## 10. CRM Sync Service

### 10.1 How It Works

`crm-sync/index.js` — Node.js service on port 3089.

1. Every 60 seconds polls Paperclip API for `[LEAD]` and `[HOT]` tasks
2. Parses task description (markdown) → extracts lead fields
3. Searches for lead in CRM by name → create or update
4. ICP 60+ with email → `status: "qualified"` (auto-queue for SDR)
5. Safety net: every 5 min checks for `replied_interested` without a [BRIEFING] task

### 10.2 Hunter Task Format (for parsing)

```markdown
## {Company} — {Niche} — ICP Score: {XX}/100

**Fit Score:** {XX}/100 | **Intent Score:** {XX}/100
**Estimated MRR:** ${X,XXX}/mo
**Employees:** ~{N}
**Location:** {City, State}
**Website:** {URL}
**Current IT:** {Competitor or "Unknown"}

### Decision Maker
- **Name:** {First Last}
- **Email:** {email}
- **Phone:** {XXX-XXX-XXXX}

### Signals
1. **{Signal}** — {Evidence} — **Source:** {URL}
```

---

## 11. Watchdog

### 11.1 Location

- **Script:** `~/.paperclip/watchdog.sh` (outside the Paperclip project to avoid triggering the RESTART banner)
- **Source copy:** `scripts/watchdog.sh` (in git for backup)
- **launchd:** `~/Library/LaunchAgents/com.amritech.paperclip-watchdog.plist`

### 11.2 What It Monitors

| Service | Check | On Failure |
|---------|-------|-----------|
| Paperclip (4444) | lsof port check | `pnpm dev:once` |
| Twenty CRM (5555) | docker ps | `docker compose restart` |
| TG Webhook (3088) | lsof port check | `node index.js` |
| CRM Sync (3089) | lsof port check | `node index.js` |
| Cloudflare Tunnel | pgrep cloudflared | `cloudflared tunnel run` |

### 11.3 Cycle

Every 60 seconds:
1. Rotate log (if >10MB)
2. Check Paperclip
3. Check Twenty CRM
4. Check TG Webhook
5. Check CRM Sync
6. Check Cloudflare Tunnel
7. Check agent health
8. Sleep 60

### 11.4 launchd

```
RunAtLoad: true
KeepAlive: true
```
Auto-starts on Mac boot. If watchdog dies — launchd restarts it.

---

## 12. Self-Improvement System

### 12.1 Principle

Agents DO NOT modify their own files. They propose changes via `[IMPROVEMENT]` tasks. IT Chef reviews.

### 12.2 Workflow

```
Agent notices a pattern
    ↓
Creates [IMPROVEMENT] task for IT Chef
(file, current behavior, proposed change, data, expected outcome)
    ↓
IT Chef reviews:
├── Safe? → Approves, applies change, reports in TG
├── Risky? → Escalates to Tim
└── Not justified? → Rejects with explanation
```

### 12.3 What IT Chef Can Approve

- New patterns for a specific agent
- Clarifications to instructions
- New CRM query examples
- Step optimizations
- Read-only skills

### 12.4 What Only Tim Can Approve

- Removing the BCC rule
- Changing approval gates
- Changing the escalation cascade
- New agents
- CRM schema changes
- Infrastructure changes

---

## 13. IT Chef — Detailed

### 13.1 Auto-Fix Playbooks (without asking Tim)

| Issue | Fix | Report |
|-------|-----|--------|
| Service down | Restart | "Auto-fix: {service} restarted" |
| Docker restart loop | docker compose restart | "Auto-fix: containers restarted" |
| Stale task >48h | Unlock, reset to todo | "Auto-fix: task unblocked" |
| Duplicate lead in CRM | Merge | "Auto-fix: duplicate removed" |
| Disk >80% | docker system prune, clear logs | "Auto-fix: cleaned {N}GB" |

### 13.2 Known Issues Database

`it-chef/known-issues.md` — after every incident:
```
### {date} — {description}
- Symptom: {what was observed}
- Root Cause: {why}
- Fix: {what was done}
- Prevention: {how to prevent}
- Auto-fixable: Yes/No
```

### 13.3 Proactive Monitoring

| Metric | Warning | Critical |
|--------|---------|----------|
| Disk | >70% | >85% |
| Docker restarts | >2/hr | >5/hr |
| CRM response | >3s | >10s |
| Agent success rate | <50%/day | <20% |
| Stale tasks | >3 per agent | >10 total |

---

## 14. Security

### 14.1 Current State

| Aspect | Status |
|--------|--------|
| CRM data | Local (Docker on Tim's Mac) |
| Email | IONOS (own domain, TLS) |
| Telegram | Private group, bot with dedup |
| Paperclip access | localhost:4444 (Tim only for now) |
| CRM access | localhost:5555 (Tim only for now) |
| API keys | In env vars and configs (not in git) |

### 14.2 Cloudflare Access (planned)

- `crm.yourcompany.example.com` and `dispatch.yourcompany.example.com` via named tunnel
- Cloudflare Access: login via email + one-time code
- Allowed emails: founder@example.com, cofounder@example.com, cto@example.com
- Free plan (up to 50 users)

### 14.3 What Agents CANNOT Do

- Modify their own SOUL/HEARTBEAT files (only via [IMPROVEMENT] → IT Chef)
- Delete data from CRM
- Contact clients directly (only via Email MCP with BCC)
- Make financial decisions
- Sign contracts

---

## 15. Calendly

- **URL:** https://calendly.com/amritech/15-min-it-discovery-call
- **Type:** One-on-one, 15 min, Phone call
- **Availability:** Mon-Fri, 9 AM - 5 PM ET
- **In emails:** "Book a 15-min Phone Call" button links to Calendly
- **Client selects a time → Alex receives a calendar invite**

---

## 16. Contacts and Config

### Agent IDs (Paperclip)

| Agent | ID |
|-------|----|
| CEO | AGENT_UUID_CEO |
| Hunter | AGENT_UUID_HUNTER |
| SDR | AGENT_UUID_SDR |
| Closer | AGENT_UUID_CLOSER |
| Staff Manager | AGENT_UUID_STAFF_MGR |
| Contract Manager | AGENT_UUID_CONTRACT_MGR |
| Finance Tracker | AGENT_UUID_FINANCE |
| IT Chef | AGENT_UUID_IT_CHEF |
| Proposal Writer | AGENT_UUID_PROPOSAL |
| Legal Assistant | AGENT_UUID_LEGAL |
| Onboarding | AGENT_UUID_ONBOARDING |
| Gov Scout | AGENT_UUID_GOV_SCOUT |

### Company ID
`YOUR_COMPANY_ID`

### Ports
| Service | Port |
|---------|------|
| Paperclip | 4444 |
| Twenty CRM | 5555 |
| TG Webhook | 3088 |
| CRM Sync | 3089 |

---

*Documentation current as of March 22, 2026. Update this file when changes are made.*
