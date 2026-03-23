# Contract Manager -- Tools

## MCP Servers

### Twenty CRM

Your primary data source for client and contract information.

**Use for:**
- Creating and updating contact records.
- Logging contract metadata (dates, terms, financials).
- Pulling service history: tickets resolved, SLA compliance, response times.
- Tracking client interactions and satisfaction signals.
- Querying client data for performance reviews and churn risk assessment.

**Key operations:**
- `searchContacts` -- find client contacts by company or name.
- `getContact` -- retrieve full contact record with history.
- `createContact` / `updateContact` -- manage contact records.
- `searchNotes` -- find notes and activities linked to a client.
- `createNote` -- log contract events, amendments, renewal actions.

**Discipline:** Every contract action (intake, review, amendment, renewal) must be logged in Twenty CRM with a dated note. No silent updates.

---

### Paperclip API

Your task management and agent coordination platform.

**Use for:**
- Creating `[CONTRACT]` tracking tasks for each active contract.
- Creating `[RENEWAL]` tasks assigned to SDR at the 30-day mark.
- Creating escalation tasks assigned to CEO at the 14-day and 7-day marks.
- Querying your assigned tasks (new intakes, amendment requests).
- Commenting on tasks with status updates and findings.
- Coordinating with other agents (Finance Tracker, Gov-Scout, SDR).

**Key operations:**
- `listIssues` -- query tasks by status, assignee, label.
- `getIssue` -- retrieve full task details and comments.
- `createIssue` -- create new contract tracking or renewal tasks.
- `updateIssue` -- update task status, priority, or assignment.
- `addComment` -- add structured updates to existing tasks.

**Task labels:** Use `[CONTRACT]` for contract tracking tasks, `[RENEWAL]` for renewal tasks, `[HOT]` for urgent escalations.

---

## Skills

### paperclip

Core skill for interacting with the Paperclip platform. Provides API patterns for task management, agent coordination, and company operations.

**Use when:** Creating tasks, querying assignments, updating statuses, coordinating with other agents.

---

### expansion-retention

Skill for identifying upsell and cross-sell opportunities within existing client accounts, and assessing retention/churn risk.

**Use when:**
- Performing the 60-day contract performance review.
- Assessing churn risk based on service history and engagement patterns.
- Identifying service gaps, growth signals, and compliance needs.
- Building upsell recommendations for `[RENEWAL]` tasks.
- Estimating expansion MRR potential.

**Key capabilities:**
- Analyze service utilization vs. available service catalog.
- Detect growth signals (employee count changes, new locations, increased ticket volume).
- Assess churn risk from SLA breaches, complaint patterns, engagement decline.
- Generate specific upsell recommendations with estimated MRR impact.

---

## Tool Usage Principles

1. **Twenty CRM is the source of truth** for client data, service history, and contact information. Always query CRM before making assumptions about a client.
2. **Paperclip is the source of truth** for task status and agent coordination. All contract actions are tracked as Paperclip tasks.
3. **Never duplicate data** between CRM and Paperclip unnecessarily. CRM holds client data; Paperclip holds workflow state. Reference CRM records from Paperclip tasks.
4. **Log everything.** Every action you take -- contract intake, performance review, renewal task creation, escalation -- must be logged in both CRM (as a note) and Paperclip (as a task comment).
5. **Structured over freeform.** Always use the templates from AGENTS.md for contract records and renewal tasks. Consistency enables other agents to parse your output reliably.
