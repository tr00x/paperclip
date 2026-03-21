# HEARTBEAT.md -- Onboarding Agent

This agent has **no scheduled heartbeat**. It wakes only on task assignment. Timeout: 15 minutes per execution.

When you wake, execute this checklist top to bottom. If you cannot finish within 15 minutes, prioritize steps 1--5 (deliver the onboarding package) and defer CRM updates and sub-task creation to the next wake.

---

## 1. Wake Context

Determine why you woke up:

- Check `PAPERCLIP_WAKE_REASON`: should be `assignment`.
- Check `PAPERCLIP_TASK_ID`: this is the [ONBOARD] task you need to process.
- `GET /api/agents/me` -- confirm your id, role, budget.

**If no task ID:** Log warning, exit. You should not wake without an assignment.

**If budget > 80%:** Proceed with current onboarding (never leave a client hanging), but notify CEO in task comment that budget is running low.

---

## 2. Read the [ONBOARD] Task

```
GET /api/companies/{companyId}/issues/{taskId}
```

Extract from the task description:

| Field | Variable |
|---|---|
| Client company name | `{clientName}` |
| Contact name | `{contactName}` |
| Contact email | `{contactEmail}` |
| Contact phone | `{contactPhone}` |
| Contact title | `{contactTitle}` |
| Industry niche | `{niche}` |
| Company size | `{size}` |
| Office address | `{office}` |
| Contract details | `{contract}` |
| MRR amount | `{mrr}` |

**Validation:** If any critical field is missing (client name, contact email, niche), add a comment to the task asking for the missing information and exit. Do not send an incomplete onboarding package.

---

## 3. Generate Welcome Email

Compose the HTML welcome email following the template in AGENTS.md:

1. **Personalize** every field -- client name, contact name, niche-specific language.
2. **Include 30/60/90 day plan** tailored to the niche:
   - Healthcare: mention HIPAA risk assessment in Week 1
   - Law firm: mention case management software review in Week 1
   - Auto dealer: mention DMS connectivity audit in Week 1
   - Accounting: mention tax software integration review in Week 1
   - General: standard IT audit language
3. **Include ScreenConnect instructions** -- remote access setup section.
4. **Include Ula's contact** as their Account Manager.
5. **Sign as Berik Amri, CEO.**
6. **Use `amritech-html-email` skill** for HTML formatting and branding.

---

## 4. Generate Audit Checklist

Select the appropriate checklist from AGENTS.md:

| Niche | Checklist |
|---|---|
| `law` | Universal + Law Firm |
| `auto-dealer` | Universal + Auto Dealership |
| `healthcare` | Universal + Healthcare / Medical Practice |
| `accounting` | Universal + Accounting / CPA Firm |
| `general` | Universal only |

Format the checklist as a clean, readable document. Include:
- AmriTech header
- Client name and date
- Section headers with checkboxes
- Space for technician notes next to each item
- Footer with "Prepared by AmriTech IT Solutions"

---

## 5. Generate Credentials Collection Form

Use the template from AGENTS.md. Customize for niche:

- **Healthcare:** Add EMR vendor, HIPAA officer contact, BAA status fields.
- **Law firm:** Add case management software, ethical wall requirements.
- **Auto dealer:** Add DMS vendor, camera system, POS provider fields.
- **Accounting:** Add tax software, client portal, e-filing details.
- **General:** Use base template as-is.

**Security:** Include a note that credentials should be shared via secure method (password manager, encrypted portal, phone call) -- never in plain email.

---

## 6. Send via Gmail MCP

Send the welcome email using Gmail MCP:

```
To: {contactEmail}
From: berik@amritechsolutions.com
CC: ula@amritechsolutions.com
Subject: Welcome to AmriTech IT Solutions, {clientName}!
Body: [HTML welcome email with all sections]
```

**Pre-send checklist:**
- [ ] Client name spelled correctly
- [ ] Contact email verified (valid format, no typos)
- [ ] All placeholder fields populated (no `{variable}` text visible)
- [ ] HTML renders correctly (test in skill if available)
- [ ] ScreenConnect link is current
- [ ] Ula's contact info is correct
- [ ] Berik's signature is complete

---

## 7. Update Twenty CRM

Using Twenty CRM MCP:

1. **Find or create company record** for `{clientName}`.
2. **Update company status** to "Onboarding".
3. **Log activity:**
   ```
   Type: Email
   Subject: Welcome onboarding package sent
   Date: {today}
   Notes: Welcome email, ScreenConnect instructions, {niche} audit checklist, and credentials form sent to {contactName} ({contactEmail}).
   ```
4. **Create follow-up task for Ula:**
   ```
   Title: Day 3 check-in call -- {clientName}
   Due: {today + 3 days}
   Assigned to: Ula
   Notes: Follow up on onboarding package. Confirm ScreenConnect installed. Ask about credentials form progress.
   ```

---

## 8. Notify Team via Task Comment

Add a completion comment to the [ONBOARD] task:

```
Onboarding package delivered to {clientName}.

Sent to: {contactName} ({contactEmail})
CC: ula@amritechsolutions.com

Package contents:
- Welcome email (HTML, branded)
- ScreenConnect remote access instructions
- IT audit checklist ({niche})
- Credentials collection form

CRM updated: company status = Onboarding
Follow-up: Ula Day 3 check-in call scheduled for {date}

Sub-tasks created:
- Contract Manager: File signed MSA
- Finance Tracker: MRR tracking setup (${mrr}/mo)
```

Update the task checklist items as completed.

---

## 9. Create Follow-Up Sub-Tasks

Create sub-tasks via Paperclip API:

**Sub-task 1: Contract Manager**
```json
{
  "title": "File signed MSA for {clientName}",
  "description": "New client onboarded. File and track the signed MSA.\n\nClient: {clientName}\nContract: {contract}\nMRR: ${mrr}/mo\nSigned date: {today}",
  "priority": "medium",
  "assigneeAgentId": "contract-manager",
  "parentId": "{onboardTaskId}"
}
```

**Sub-task 2: Finance Tracker**
```json
{
  "title": "Set up MRR tracking for {clientName} -- ${mrr}/mo",
  "description": "New client onboarded. Add to MRR tracking.\n\nClient: {clientName}\nMRR: ${mrr}/mo\nContract: {contract}\nStart date: {today}",
  "priority": "medium",
  "assigneeAgentId": "finance-tracker",
  "parentId": "{onboardTaskId}"
}
```

---

## 10. Mark Complete and Exit

1. Update [ONBOARD] task status to `done`.
2. Verify all checklist items are checked.
3. Exit cleanly.

**If any step failed:**
- Do NOT mark task as done.
- Add a comment explaining what failed and why.
- Leave task as `in_progress` for manual follow-up.

---

## Error Handling

| Error | Action |
|---|---|
| Gmail send fails | Retry once. If still fails, save email as draft, comment on task, exit. |
| CRM unreachable | Skip CRM update, note in task comment, continue with email send. |
| Missing client data | Comment on task requesting missing fields. Do not send incomplete package. |
| Budget exceeded | Complete current onboarding, notify CEO in comment. |
| Wrong niche specified | Use Universal checklist. Note mismatch in task comment. |
| Paperclip API down | Complete email send, defer sub-task creation, note in comment. |

---

## Quick Reference: Timing

| Step | Max Time |
|---|---|
| Read task + validate | 1 min |
| Generate email + checklist | 3 min |
| Send via Gmail | 1 min |
| Update CRM | 2 min |
| Notify + sub-tasks | 2 min |
| Buffer | 6 min |
| **Total** | **15 min** |
