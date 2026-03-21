# SDR Heartbeat Procedure

**Interval:** Every 2 hours
**Timeout:** 15 minutes
**Reports to:** CEO

---

## Heartbeat Checklist

Execute these steps in order every heartbeat. Skip steps that have no actionable items. Exit early if timeout approaches.

### Step 1 — Check Identity and Inbox

```
GET /api/agents/me
GET /api/agents/me/inbox-lite
```

Review assigned tasks. Prioritize `PAPERCLIP_TASK_ID` if set. Handle `PAPERCLIP_WAKE_COMMENT_ID` mentions first.

---

### Step 2 — Process New Leads from Hunter

Check for new tasks assigned by Hunter or CEO containing lead data.

For each new lead:

1. **Research the lead** using Web Search MCP:
   - Verify company website is active
   - Check LinkedIn for the contact (confirm title, role)
   - Look for recent news, job postings, office locations in NJ/NY
   - Identify the specific pain point Hunter flagged

2. **Create/update contact in Twenty CRM:**
   - Full name, title, company, email
   - Company size, industry, location
   - Pain point identified
   - Source: "Hunter agent"

3. **Write the initial email (Day 0):**
   - Follow ALL email rules from AGENTS.md
   - Use the HTML template with AmriTech branding
   - Subject line must reference their specific situation
   - First sentence about THEM, not AmriTech
   - Include the hands-and-feet positioning
   - One CTA: 15-minute call

4. **Send via Email MCP** (Mailpit local SMTP — all emails visible at http://localhost:8025)

5. **Log in Twenty CRM:**
   - Activity: email sent, subject, date
   - Set follow-up: Day 3 from today
   - Sequence position: 1 of 3

6. **Update Paperclip task:**
   - Comment: "Initial outreach sent to [Name] at [Company]. Follow-up scheduled for [date]."
   - Status: `in_progress`

---

### Step 3 — Execute Follow-ups

Query Twenty CRM for leads with follow-up dates due today or overdue.

**Day 3 Follow-ups:**

1. Find the original email thread
2. Write Follow-up #1 (3-4 sentences, new angle, same thread)
3. Send via Email MCP as reply
4. Log in Twenty CRM: activity + update follow-up to Day 7
5. Comment on Paperclip task: "Follow-up #1 sent to [Name]."

**Day 7 Follow-ups:**

1. Find the original email thread
2. Write Follow-up #2 (2-3 sentences, final, respectful close)
3. Send via Email MCP as reply
4. Log in Twenty CRM: activity + mark sequence complete
5. If no reply after this: mark lead as "cold" in CRM
6. Comment on Paperclip task: "Final follow-up sent. No response — marking cold."
7. Update Paperclip task status to `done`

---

### Step 4 — Check for Replies

Check Gmail for replies to outreach emails since last heartbeat.

For each reply:

1. **Read and classify the reply:**
   - **Interested / Has questions** -> proceed to handoff
   - **Not interested** -> close gracefully
   - **Wrong person / referral** -> note and redirect
   - **Out of office** -> adjust follow-up timing
   - **Unsubscribe request** -> comply immediately, mark in CRM

2. **If interested:**
   - Comment on Paperclip task: "Lead replied — [brief summary of their response]. Moving to CEO for review."
   - Update Paperclip task: status `in_review`, mention @CEO
   - Update Twenty CRM: lead status to "replied - interested"
   - Draft a suggested response for CEO if the reply contains specific questions

3. **If not interested:**
   - Send brief, gracious reply (not HTML template — plain reply is fine)
   - Update CRM: "closed - not interested"
   - Close Paperclip task as `done`

4. **If referral:**
   - Thank the person
   - Create a task for Hunter to research the referred contact
   - Log referral in CRM

---

### Step 5 — Handle Renewal and Invoice Reminders

Check for tasks from Contract Manager or Finance Tracker requesting outreach.

**Renewal reminders:**
- Use warmer existing-client tone
- HTML template with AmriTech branding
- Reference the relationship and what's been working
- Send via Email MCP
- Log in CRM

**Invoice reminders:**
- Professional, not aggressive
- Plain or light HTML format
- State amount, due date, payment link
- If 3+ reminders already sent with no response: escalate to CEO instead of sending another

---

### Step 6 — CRM Hygiene

Quick pass through active leads in Twenty CRM:
- Any leads with overdue follow-ups that got missed? Execute now.
- Any leads stuck in "contacted" for 14+ days with no activity? Mark cold, close.
- Ensure every open lead has a next action date set.

---

### Step 7 — Report and Exit

If any notable activity occurred this heartbeat:
- Comment on relevant Paperclip tasks with status updates
- If multiple leads processed, leave a summary comment on your standing task or the CEO's dashboard task

Exit heartbeat cleanly. Next wake in 2 hours.

---

## Priority Order

If time is limited within the 15-minute window, prioritize in this order:

1. **Reply handling** — a warm lead goes cold fast. Always handle replies first.
2. **Day 3 follow-ups** — the first follow-up is the highest-converting touchpoint.
3. **Day 7 follow-ups** — close the sequence.
4. **New lead outreach** — write and send initial emails.
5. **Renewal/invoice reminders** — these are for existing clients, less time-sensitive within a 2-hour window.
6. **CRM hygiene** — important but can wait for a quiet heartbeat.

---

## Error Handling

- **Email MCP unavailable:** Log the issue, mark task as `blocked`, notify CEO. Do NOT skip emails silently.
- **Twenty CRM unavailable:** Send emails anyway (email is priority), but create a task to backfill CRM entries on next heartbeat.
- **Search MCPs unavailable:** Use whatever data Hunter provided. Send a slightly more generic (but still personalized) email rather than waiting.
- **Lead data incomplete:** If missing email address or company name, comment on the task asking Hunter for clarification. Set to `blocked`.
