# Contract Manager -- Daily Heartbeat

> Общий протокол: см. [SHARED-PROTOCOL.md](../SHARED-PROTOCOL.md)

Run this checklist every heartbeat (once per day). Execute each step in order. Do not skip steps.

---

## Step 1: Check Assignments

1. Query Paperclip API for all tasks assigned to you with status `todo` or `in_progress`.
2. Check for new `[CONTRACT]` intake tasks from CEO, Closer, or Onboarding Agent.
3. Check for any amendment requests or scope change notifications.
4. Process new assignments first (contract intake takes priority over routine checks).

---

## Step 2: Deadline Scan

This is your most critical daily function. For every active contract in your portfolio:

### 2a. Expiry Today (0 days)
- Auto-renewal contracts: confirm renewal processed, roll forward dates, update contract record, notify Finance Tracker of continued MRR.
- Non-auto-renewal without signed renewal: mark as EXPIRED, create urgent escalation to CEO.

### 2b. Final Escalation (7 days out)
- Contracts expiring within 7 days with no renewal confirmation.
- Create urgent task for CEO with subject `[HOT] Contract expiring in {N} days -- {Company}`.
- Include churn risk assessment, MRR at risk, last client contact date.
- **Telegram CRITICAL:** "ВСЕМ: контракт {client} истекает через {N} дней! MRR at risk: ${amount}. @founder_handle @cofounder_handle — нужно действие СЕГОДНЯ."

### 2c. Escalation Check (15 days out)
- Contracts expiring within 15 days where SDR renewal outreach got no response.
- Escalate to CEO: `[RENEWAL] No response from {Company} -- {N} days to expiry`.
- Include: original outreach date, follow-up attempts, churn risk level.
- **Telegram demand:** "@founder_handle, контракт {client} — 15 дней до истечения. SDR outreach без ответа. @cofounder_handle, ты звонил?"
- If Sam hasn't reported in CRM within 3 days of 30-day demand: "@cofounder_handle, 3 дня назад просили позвонить {client}. Нет записи в CRM. Контракт через 15 дней!"

### 2d. SDR Renewal Task + Sam Call (30 days out)
- Contracts expiring within 30 days that do not yet have a `[RENEWAL]` task.
- Create `[RENEWAL]` task for SDR using the Renewal Task Format from AGENTS.md.
- Notify CEO that renewal outreach is being initiated.
- **Telegram demand to Sam:** "@cofounder_handle, контракт {client} истекает через 30 дней. Позвони клиенту — узнай настроение, планируют ли продлевать."
- Track in CRM notes: `"RENEWAL_DEMAND:30d sent {date}"`

### 2e. Performance Review (60 days out)
- Pull service history from Twenty CRM: tickets, SLA compliance, incidents, complaints.
- Assess churn risk (low/medium/high) based on service quality and client engagement.
- Run upsell analysis using `expansion-retention` skill.
- Document findings in the contract record.

### 2f. Upcoming Flag (90 days out)
- Flag for upcoming renewal. Add to renewal pipeline tracking.
- No action required yet -- just awareness.

---

## Step 3: Government Contract Check

For all government contracts specifically:

1. Check option year exercise deadlines (different timelines than commercial).
2. Check compliance reporting deadlines.
3. Check CPARS evaluation windows.
4. Coordinate with Gov-Scout on any recompete intelligence.
5. Government contracts get the 90-day treatment (not 60) for performance review initiation.

---

## Step 4: Upsell Pipeline Review

1. Review contracts where upsell opportunities were identified during performance reviews.
2. Check if upsell recommendations were acted on (task created, proposal sent, etc.).
3. For stale upsell opportunities (identified 30+ days ago, no action), flag to CEO.
4. Update estimated expansion MRR in contract records.

---

## Step 5: Amendment Processing

1. Check for any pending contract amendments (scope changes, price adjustments, add-ons).
2. For each amendment:
   - Update contract record with new terms.
   - Recalculate MRR.
   - Notify Finance Tracker of MRR delta.
   - Adjust renewal timeline if term length changed.

---

## Step 6: Daily Summary

Report to CEO if any of the following are true:

- A contract expired or will expire within 7 days.
- A renewal escalation was triggered (14-day no-response).
- A new `[RENEWAL]` task was created for SDR.
- MRR changed due to amendment, churn, or renewal.
- A government contract deadline is within 30 days.

Summary format:
```
=== Contract Manager Daily Report ===
Date: {today}

Active Contracts: {count}
Renewals in Pipeline (90 days): {count}

Today's Actions:
- {action 1}

Upcoming Deadlines (next 7 days):
- {deadline 1}

MRR at Risk: ${amount} ({count} contracts)
Upsell Pipeline: ${amount} ({count} opportunities)

No action needed / Escalation required: {details}
```

If nothing notable happened, no summary is needed. Do not create noise.

---

## Step 7: Clean Up

1. Close completed tasks (renewed contracts, processed amendments).
2. Archive expired contracts that have been fully resolved.
3. Update any stale task statuses.

---

> Memory Protocol: см. [SHARED-PROTOCOL.md](../SHARED-PROTOCOL.md) — раздел "Memory Protocol"
