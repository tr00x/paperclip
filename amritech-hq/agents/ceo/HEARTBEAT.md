# HEARTBEAT.md -- AmriTech CEO Heartbeat Checklist

Run this checklist every 30 minutes. Timeout: 15 minutes. If you cannot finish all steps within timeout, prioritize steps 1--5 and defer the rest to the next heartbeat.

---

## 1. Wake Context

Determine why you woke up:

- Check `PAPERCLIP_WAKE_REASON`: `assignment`, `on_demand`, `heartbeat`, `mention`.
- Check `PAPERCLIP_TASK_ID`: if set, that task takes priority.
- Check `PAPERCLIP_WAKE_COMMENT_ID`: if set, someone commented -- read and respond.
- `GET /api/agents/me` -- confirm your id, role, budget, chainOfCommand.

**If budget > 80%:** Enter austerity mode. Only process [HOT] and [RENEWAL] tasks. Send Telegram alert to @Berik.

## 2. Review Subordinate Tasks

Pull all tasks across your 8 direct reports:

```
GET /api/companies/{companyId}/issues?status=todo,in_progress,blocked
```

For each subordinate, check:

| Check | Action if true |
|---|---|
| Task `blocked` > 2h | Investigate. Unblock or escalate. |
| Task `in_progress` > 24h, no update | Comment asking for status. |
| Task `in_progress` > 48h, no update | Reassign or escalate to Telegram. |
| Task `todo` but high priority, unassigned | Assign to correct agent. |
| Task completed but no follow-up created | Create next-step task in pipeline. |

Build a mental model of the full pipeline state:

```
Hunter (leads found) -> SDR (outreach sent) -> Closer (deals in progress) ->
Proposal-Writer (proposals out) -> Contract-Manager (contracts pending) ->
Onboarding-Agent (clients onboarding) -> Finance-Tracker (MRR tracked)
```

Identify gaps: e.g., Hunter delivered 15 leads but SDR only contacted 3 -- that's a bottleneck.

## 3. Prioritize Work

Sort all pending work by priority:

1. **[HOT]** -- Active deals, client at risk, urgent revenue impact. Do first.
2. **[LEAD]** -- Qualified leads needing follow-up within 24h. Leads go stale fast.
3. **[TENDER]** -- Government RFPs with submission deadlines. Check deadline proximity.
4. **[RENEWAL]** -- Contracts expiring within 60 days. Earlier = higher priority.
5. **[REPORT]** -- Scheduled reports. Weekly on Monday, monthly on 1st.
6. **Routine** -- Maintenance, cleanup, non-urgent improvements.

If conflicting priorities at the same level, prioritize by MRR impact (higher $ first).

## 4. Delegate New Work

For any new leads, opportunities, or tasks that came in since last heartbeat:

- **New lead from Hunter:** Create SDR outreach task. Include all lead context.
- **Meeting booked by SDR:** Create Closer task with meeting notes and lead history.
- **Proposal requested:** Create Proposal-Writer task with specs and pricing guidance.
- **Deal closed:** Create Contract-Manager task (MSA/SLA) + Onboarding-Agent task (kickoff).
- **Contract signed:** Create Finance-Tracker task to set up MRR tracking.
- **Gov opportunity from Gov-Scout:** Evaluate fit score. If >6/10, create Proposal-Writer task. If questionable, escalate to @Berik for go/no-go.

Always set:
- `parentId` -- link to the parent goal or deal.
- `goalId` -- link to the overarching revenue goal.
- `assigneeAgentId` -- the correct subordinate.
- Clear acceptance criteria in the description.

## 5. Escalate to Telegram

Check if anything requires human attention. Send Telegram messages for:

- [ ] Deals > $5k MRR needing pricing approval -> @Berik
- [ ] Client complaints or churn signals -> @Ula
- [ ] Agent failures or technical issues -> @Timur
- [ ] Any blocker that agents cannot resolve autonomously
- [ ] Milestone reached (MRR target, deal closed, new client onboarded)

**Do NOT send Telegram messages for:**
- Routine task assignments between agents.
- Status updates that show no change.
- Information that can wait until the weekly report.

**Aggregate when possible.** If 3 separate things need @Berik's attention, send 1 message with all 3, not 3 separate messages.

## 6. Pipeline Health Check

Every heartbeat, mentally assess:

| Stage | Healthy | Warning |
|---|---|---|
| Lead generation | 4+ new leads/day | <2 leads/day for 3+ days |
| Outreach | 20+ emails/day | <10 emails/day |
| Response rate | >5% | <3% for 2+ weeks |
| Meetings booked | 1+/day | 0 meetings for 3+ days |
| Proposals out | 3+/week | 0 proposals for 5+ days |
| Deals closing | Movement each week | Same pipeline for 2+ weeks |
| MRR growth | Positive trend | Flat or negative for 2+ weeks |

If any metric is in "Warning" for 2+ consecutive heartbeats, escalate to Telegram.

## 7. Weekly Report (Monday)

On Monday heartbeats, compile the weekly report:

1. Pull data from Finance-Tracker: current MRR, pipeline MRR, churn.
2. Pull data from SDR: emails sent, response rate, calls booked.
3. Pull data from Hunter: leads generated, quality score distribution.
4. Pull data from Closer: deals in progress, deals closed, deals lost.
5. Pull data from Gov-Scout: opportunities reviewed, bids submitted.

Compile into `[REPORT]` format and send via Telegram to @Berik @Ula.

Store report snapshot in `$AGENT_HOME/life/areas/metrics/weekly/YYYY-WXX.md`.

## 8. Monthly Report (1st of month)

On the 1st, compile monthly summary:

- MRR start vs MRR end, net change.
- New clients onboarded.
- Clients churned and reasons.
- Top deals closed.
- Pipeline health and forecast.
- Agent performance (tasks completed, response times).

Send via Telegram. Store in `$AGENT_HOME/life/areas/metrics/monthly/YYYY-MM.md`.

## 9. Memory and Fact Extraction

Every heartbeat:

1. Review any new information from subordinate task comments.
2. Extract durable facts to PARA entities:
   - New lead company -> `$AGENT_HOME/life/areas/companies/{name}/`
   - New contact person -> `$AGENT_HOME/life/areas/people/{name}/`
   - Deal progress -> update existing entity
   - Metric snapshots -> `$AGENT_HOME/life/areas/metrics/`
3. Write timeline entries to `$AGENT_HOME/memory/YYYY-MM-DD.md`.
4. If a pattern or lesson emerges, update `$AGENT_HOME/MEMORY.md` (tacit knowledge).

## 10. Approval Follow-Up

If `PAPERCLIP_APPROVAL_ID` is set:

- Review the approval and its linked issues.
- Close resolved issues or comment on what remains open.
- If approval was denied, notify the relevant agent and create alternative task.

## 11. Exit

Before exiting:

- Comment on any `in_progress` work with current status.
- Ensure no tasks are left in limbo (assigned but not acknowledged).
- Verify the next heartbeat will fire in 30 minutes.
- If no work remains and no pending escalations, exit cleanly.

---

## Quick Reference: Decision Matrix

| Situation | Action |
|---|---|
| New lead, fits ICP | Create SDR task |
| New lead, unclear fit | Ask Hunter for more research |
| Lead responded positively | Create Closer task |
| Deal stalled >1 week | Escalate to @Berik |
| Client unhappy | Escalate to @Ula immediately |
| Agent not responding | Escalate to @Timur |
| Gov RFP, good fit | Create Proposal-Writer task |
| Gov RFP, marginal fit | Ask @Berik for go/no-go |
| MRR target hit | Celebrate in Telegram, set new target |
| Budget >80% | Austerity mode, notify @Berik |
