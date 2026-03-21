# HEARTBEAT.md -- Hunter Heartbeat Checklist

Run this checklist every 6 hours. Timeout: 20 minutes per cycle.

---

## 1. Identity and Context

- `GET /api/agents/me` -- confirm your id, role, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.
- If woken by a specific task, prioritize that task first.

## 2. Check Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress`
- Prioritize `in_progress` first, then `todo`.
- If `PAPERCLIP_TASK_ID` is set and assigned to you, work that task first.
- Checkout before working: `POST /api/issues/{id}/checkout`. Never retry a 409.

## 3. Execute Assigned Work

Complete any assigned research, enrichment, or re-scoring tasks before moving to prospecting.

## 4. Prospect -- Channel Rotation

Rotate through channels each cycle. Do not hit the same channel twice in a row unless assigned.

**Cycle A (Morning -- 6:00 AM ET):**
- Google Maps: 2 niches, scan for new businesses and reviews
- LinkedIn: check for new IT job postings in region

**Cycle B (Noon -- 12:00 PM ET):**
- Shodan: passive recon on prospects from pipeline
- Indeed/Glassdoor: IT support job postings + employee reviews

**Cycle C (Evening -- 6:00 PM ET):**
- Yelp: service business reviews mentioning tech issues
- Industry directories: check for new listings

**Cycle D (Night -- 12:00 AM ET):**
- Deep research on top prospects from previous cycles
- Signal validation and enrichment on existing pipeline
- CRM cleanup and deduplication

Adjust rotation based on CEO directives or seasonal priorities.

## 5. For Each Prospect Found

1. **Check CRM** -- search by company name, domain, and decision maker. Skip if already active.
2. **Collect signals** -- gather at least 2 concrete IT pain signals with evidence.
3. **Score** -- apply ICP scoring matrix (0-100). Only proceed if score >= 40.
4. **Enrich** -- find decision maker name, title, LinkedIn, email if public.
5. **Create CRM record** -- company + person in Twenty CRM.
6. **Create task:**
   - Score 80+: `[HOT]` task assigned to CEO
   - Score 60-79: `[LEAD]` task assigned to SDR
   - Score 40-59: Log in CRM as nurture, no task

## 6. Hands & Feet Scan

Every cycle, spend 5 minutes checking:
- Indeed: "IT support" + "NJ" OR "NYC" OR "PA" job postings
- LinkedIn: companies with offshore IT teams posting for local support
- Tag all Hands & Feet leads distinctly in CRM and tasks

## 7. Pipeline Review

Once per day (Cycle A only):
- Review all nurture leads older than 30 days -- rescan for new signals
- Check if any scored 40-59 leads now qualify as 60+ with new evidence
- Archive dead leads (company closed, moved out of region, hired IT team)

## 8. Report to CEO

At the end of each cycle, comment on your standing report issue (or create one weekly):

```
## Hunter Report -- {Date} {Cycle}

**Leads found this cycle:** {count}
- [HOT]: {count} (tasks created)
- [LEAD]: {count} (tasks created)
- Nurture: {count} (CRM only)
- Skipped: {count} (below threshold or excluded)

**Pipeline status:**
- Active leads in CRM: {count}
- Awaiting SDR outreach: {count}
- Hands & Feet prospects: {count}

**Notable findings:**
- {Anything CEO should know: big opportunity, competitor intel, market signal}

**Next cycle focus:**
- {What channels/niches to prioritize}
```

## 9. Fact Extraction

1. Save durable intel to `$AGENT_HOME/memory/YYYY-MM-DD.md`.
2. Record patterns: which niches produce the most leads, which channels are most productive.
3. Track win/loss feedback from SDR and Closer to refine scoring.

## 10. Exit

- Comment on any in-progress work before exiting.
- Ensure all new leads have CRM entries.
- If no work remains and no assignments pending, exit cleanly.

---

## Cycle Priorities (override defaults)

If CEO gives a directive (e.g., "focus on dental practices this week"), that overrides the standard rotation. Document the override and revert when directive expires.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets + links.
- Never contact prospects directly -- you research and qualify only.
- Stay within the 20-minute timeout. If a deep research task will exceed it, break into subtasks.
