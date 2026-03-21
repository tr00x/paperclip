# TOOLS.md -- AmriTech CEO Available Tools

## 1. Paperclip API

Your primary coordination tool. All task management, delegation, and agent orchestration happens through this API.

### Identity

```
GET /api/agents/me
```
Returns your agent id, role, budget, chain of command. Call this at the start of every heartbeat.

### Task Management

**Get your assignments:**
```
GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked
```

**Get all company tasks (for subordinate review):**
```
GET /api/companies/{companyId}/issues?status=todo,in_progress,blocked
```

**Checkout a task before working on it:**
```
POST /api/issues/{id}/checkout
```
Never retry a 409 -- that task belongs to someone else.

**Create a task (delegation):**
```
POST /api/companies/{companyId}/issues
{
  "title": "[TAG] Concise description",
  "description": "Full context, acceptance criteria, deadline",
  "priority": "urgent|high|medium|low",
  "assigneeAgentId": "hunter|sdr|closer|proposal-writer|contract-manager|onboarding-agent|finance-tracker|gov-scout",
  "parentId": "parent-issue-id",
  "goalId": "goal-id"
}
```

**Update task status:**
```
PATCH /api/issues/{id}
{ "status": "todo|in_progress|blocked|done|cancelled" }
```

**Comment on a task:**
```
POST /api/issues/{id}/comments
{ "body": "Status update in markdown" }
```

### Rules

- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Always set `parentId` and `goalId` when creating tasks.
- Comments should be concise markdown: status line + bullets + links.
- Self-assign via checkout only when explicitly @-mentioned.

## 2. Telegram MCP

You are the **only agent** with Telegram access. All human communication goes through you.

### Sending Messages

Use the Telegram MCP tool to send messages to the team bot. Every message must:

1. Start with a tag: `[HOT]`, `[LEAD]`, `[TENDER]`, `[RENEWAL]`, `[REPORT]`.
2. Include @mentions for the intended recipient(s): `@Berik`, `@Ula`, `@Timur`.
3. Be written in Russian (internal team language).
4. Have a clear ask or action item.

### Recipients

| Person | Role | When to @mention |
|---|---|---|
| @Berik | CEO / Senior Tech | Pricing decisions, big deals (>$5k MRR), strategy, budget, go/no-go |
| @Ula | Account Mgr / Tech | Client relationships, renewals, churn risk, technical projects |
| @Timur | AI / Automation | Agent issues, technical problems, automation requests, system failures |

### Guidelines

- **Aggregate:** If multiple things need the same person's attention, send 1 message, not 5.
- **No noise:** Don't send routine updates that can wait for the weekly report.
- **Urgency:** [HOT] messages should be genuinely urgent. Overusing [HOT] trains people to ignore it.
- **Context:** Always include enough context that the recipient can act without asking follow-up questions.
- **No English in messages** (exception: quoting client emails or external documents).

### Reading Messages

Check for incoming Telegram messages at each heartbeat. If the team sent instructions or questions:
- Parse the intent.
- If it's a task assignment, create a Paperclip task and delegate.
- If it's a question, answer or investigate and respond.
- If it's a decision (e.g., "go ahead with that deal"), execute accordingly.

## 3. para-memory-files

File-based persistent memory using PARA method. Use this for all knowledge storage and retrieval.

### Three Layers

**Layer 1: Knowledge Graph** (`$AGENT_HOME/life/`)
```
life/
  projects/          # Active deals, campaigns, initiatives
    deal-{company}/
      summary.md
      items.yaml
  areas/
    people/          # Contacts: leads, clients, team
      {name}/
        summary.md
        items.yaml
    companies/       # Companies in pipeline or portfolio
      {name}/
        summary.md
        items.yaml
    metrics/         # KPI tracking
      weekly/
      monthly/
  resources/         # Templates, reference data, market research
  archives/          # Completed deals, churned clients, old data
  index.md
```

**Layer 2: Daily Notes** (`$AGENT_HOME/memory/YYYY-MM-DD.md`)
- Raw timeline of everything that happened.
- Write continuously during heartbeats.
- Extract durable facts to Layer 1 during fact extraction step.

**Layer 3: Tacit Knowledge** (`$AGENT_HOME/MEMORY.md`)
- Patterns about how the team operates.
- Lessons learned from deals won and lost.
- What works and what doesn't in outreach, pricing, proposals.

### Key Operations

**Save a fact:** Write to the relevant entity's `items.yaml`.
**Recall context:** Use `qmd query "question"` for semantic search.
**Search exact phrase:** Use `qmd search "phrase"` for keyword search.
**Index your memory:** Run `qmd index $AGENT_HOME` periodically.

### What to Store

| Event | Where to store |
|---|---|
| New lead discovered | `life/areas/companies/{name}/` + `life/areas/people/{contact}/` |
| Deal progressed | `life/projects/deal-{company}/items.yaml` |
| Deal closed (won) | Move to `life/archives/`, update metrics |
| Deal closed (lost) | Move to `life/archives/`, note reason in items.yaml |
| Client churned | Move to `life/archives/`, escalate reason to Telegram |
| Weekly metrics | `life/areas/metrics/weekly/YYYY-WXX.md` |
| Monthly metrics | `life/areas/metrics/monthly/YYYY-MM.md` |
| Lesson learned | `$AGENT_HOME/MEMORY.md` |

## 4. GTM Skills

### gtm-metrics
Track go-to-market metrics: lead velocity, conversion rates, pipeline coverage, MRR growth. Use for weekly and monthly reporting.

### gtm-engineering
Engineering-driven growth tactics: automation of outreach, lead scoring models, pipeline optimization.

### positioning-icp
Ideal Customer Profile and positioning framework. Use when evaluating lead quality, refining target niches, or creating messaging for specific verticals (healthcare, legal, finance, etc.).
