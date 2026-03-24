# HEARTBEAT.md -- Onboarding Agent

> Общий протокол: см. [SHARED-PROTOCOL.md](../SHARED-PROTOCOL.md)

This agent has **no scheduled heartbeat**. Wakes only on task assignment. Timeout: 15 min.

Execute this checklist top to bottom. If you cannot finish within 15 min, prioritize steps 1-5 (deliver the onboarding package) and defer CRM/sub-tasks to next wake.

---

## 1. Wake & Validate

- Check `PAPERCLIP_WAKE_REASON` (should be `assignment`) and `PAPERCLIP_TASK_ID`.
- **No task ID:** Log warning, exit.
- **Budget > 80%:** Complete current onboarding, notify CEO in comment.

---

## 2. Read the [ONBOARD] Task

```
GET /api/companies/{companyId}/issues/{taskId}
```

Extract: `{clientName}`, `{contactName}`, `{contactEmail}`, `{contactPhone}`, `{contactTitle}`, `{niche}`, `{size}`, `{office}`, `{contract}`, `{mrr}`.

**Validation:** If client name, contact email, or niche is missing -- comment requesting info and exit.

---

## 3. Generate Welcome Email

1. **Personalize** every field. No `{variable}` text in output.
2. **30/60/90 day plan** by niche:
   - Healthcare: HIPAA risk assessment Week 1
   - Law firm: case management review Week 1
   - Auto dealer: DMS connectivity audit Week 1
   - Accounting: tax software integration review Week 1
   - General: standard IT audit
3. Include **ScreenConnect instructions**, **Ula's contact** (Account Manager), sign as **Berik Amri, CEO**.
4. Use **`amritech-html-email` skill** for HTML formatting.

---

## 4. Generate Audit Checklist

| Niche | Checklist |
|---|---|
| `law` | Universal + Law Firm |
| `auto-dealer` | Universal + Auto Dealership |
| `healthcare` | Universal + Healthcare / Medical Practice |
| `accounting` | Universal + Accounting / CPA Firm |
| `general` | Universal only |

Include: AmriTech header, client name + date, section headers with checkboxes, space for notes, footer.

---

## 5. Generate Credentials Collection Form

Customize for niche (Healthcare: EMR/HIPAA/BAA fields; Law: case mgmt/ethical walls; Auto: DMS/cameras/POS; Accounting: tax software/portal/e-filing; General: base template).

Always include secure-sharing note (password manager, encrypted portal, phone -- never plain email).

---

## 6. Send via Gmail MCP

```
To: {contactEmail}
From: agent@amritech.us
BCC: tr00x@proton.me, ikberik@gmail.com, ula.amri@icloud.com
Subject: Welcome to AmriTech IT Solutions, {clientName}!
```

**Pre-send:** Verify client name spelling, email format, all placeholders filled, HTML renders, ScreenConnect link current, Ula/Berik info correct.

---

## 7. Update Twenty CRM

1. Find or create company record, set status "Onboarding".
2. Log activity: "Welcome onboarding package sent" with date, niche, recipient.
3. Create follow-up task for Ula: "Day 3 check-in call -- {clientName}", due {today + 3 days}.

---

## 8. Notify Team via Task Comment

Post completion comment on [ONBOARD] task:

```
Onboarding package delivered to {clientName}.
Sent to: {contactName} ({contactEmail})
BCC: tr00x@proton.me, ikberik@gmail.com, ula.amri@icloud.com
Contents: welcome email (HTML), ScreenConnect instructions, {niche} audit checklist, credentials form.
CRM: status = Onboarding. Ula Day 3 check-in scheduled {date}.
Sub-tasks: Contract Manager (file MSA), Finance Tracker (MRR ${mrr}/mo).
```

---

## 9. Create Follow-Up Sub-Tasks

Create via Paperclip API (see [TOOLS.md](./TOOLS.md) -> Sub-task Templates):

1. **Contract Manager:** "File signed MSA for {clientName}" -- include client, contract, MRR, date.
2. **Finance Tracker:** "Set up MRR tracking for {clientName} -- ${mrr}/mo" -- include client, MRR, contract, date.

Both: `priority: medium`, `parentId: {onboardTaskId}`.

---

## 10. Mark Complete and Exit

1. Update [ONBOARD] task status to `done`, verify all checklist items checked.
2. **If any step failed:** Do NOT mark done. Comment explaining failure. Leave as `in_progress`.

---

## Error Handling

| Error | Action |
|---|---|
| Gmail send fails | Retry once. If still fails, save draft, comment, exit. |
| CRM unreachable | Skip CRM, note in comment, continue. |
| Missing client data | Comment requesting fields. Do not send incomplete package. |
| Budget exceeded | Complete current onboarding, notify CEO. |
| Wrong niche | Use Universal checklist, note mismatch in comment. |
| Paperclip API down | Complete email send, defer sub-tasks, note in comment. |

---

## Quick Reference: Timing

| Step | Max Time |
|---|---|
| Read + validate | 1 min |
| Generate email + checklist | 3 min |
| Send via Gmail | 1 min |
| Update CRM | 2 min |
| Notify + sub-tasks | 2 min |
| Buffer | 6 min |
| **Total** | **15 min** |

---

## Авто-хендофф: Onboarding -> Finance

По завершении 30-дневного онбординга (все чекпоинты пройдены):
1. Создай задачу `[INVOICE] {Company} -- first month MRR ${amount}` для Finance Tracker
2. Обнови CRM: статус "Active" (если client record нет -- demand для CEO)
3. Telegram: "Onboarding {Company} завершён. Finance -- первый invoice."
4. Обнови Lead в CRM: `status` -> `closed_won`

---

## Memory Protocol
> См. [SHARED-PROTOCOL.md](../SHARED-PROTOCOL.md) -> Memory Protocol
