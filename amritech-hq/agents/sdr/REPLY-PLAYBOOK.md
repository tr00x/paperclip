# SDR Reply Playbook — Скрипты обработки ответов

## Классификация ответов (7 категорий)

| Тип ответа | % ответов | Действие |
|---|---|---|
| **Positive interest** ("Tell me more", "Let's talk") | 25-35% | Route to CEO immediately. Speed matters — respond within 1 hour. |
| **Question about offer** ("What do you charge?", "How does it work?") | 20-30% | Answer with specifics, re-CTA. Draft response for CEO review. |
| **Objection — timing** ("Not now", "Maybe later") | 15-20% | Acknowledge, set 30-day follow-up in CRM. |
| **Objection — budget** ("Too expensive", "No budget") | 5-10% | Share value/ROI angle, offer smaller entry point (security audit). |
| **Referral** ("Talk to our office manager") | 10-15% | Thank them, create Hunter task for referred contact. |
| **Not interested** ("Remove me", "Not interested") | 10-15% | Gracious close. Remove from all sequences immediately. |
| **Out of office / Auto-reply** | 5-10% | Pause sequence, re-send after return date. |

---

## Positive Interest (ответ в течение 1 часа)

1. Update Twenty CRM: `outreachStatus` → `replied_interested`, `status` → `engaged`, `lastContactDate` → now
2. **Telegram:** уведомление команде (формат из Step 0.5 HEARTBEAT)
3. **Жди подтверждения @founder_handle** — Alex подтверждает, двигаемся ли дальше
4. **После подтверждения — AUTO-HANDOFF (2 задачи):**
   1. Задача Closer'у: `[BRIEFING] {Company} — positive reply, meeting prep needed`
      - Описание: CRM ID лида, суть ответа, сигналы Hunter, email thread
      - Assign: Closer agent
   2. Задача для @cofounder_handle: `[CALL] {Company} — intro/discovery call`
      - Описание: "Лид ответил положительно. Sam — позвони, познакомься, выясни потребности. Запиши результат в CRM."
      - Telegram: "@cofounder_handle, новый горячий лид {Company}! Позвони — intro call. Closer готовит briefing параллельно."
5. **НЕ отвечай сам** на email — Sam звонит, Alex решает
6. Draft a suggested response for Alex if the reply contains specific questions

---

## Question About Offer

- Draft a response that answers specifically (no generic brochure language)
- Include one relevant proof point for their niche
- End with CTA: "Want me to put together a quick overview for {Company}?"
- Route to CEO for approval before sending

---

## Objection — Timing

- Reply: "Totally understand — timing matters. I'll check back in [30 days]. In the meantime, if IT ever becomes a headache, we're a quick call away."
- Set 30-day follow-up in CRM
- Do NOT close the task — set to `paused`

---

## Objection — Budget

- Reply with value angle: "Totally fair. Quick context — most {niche} our size spend $X-Y/month on reactive IT fixes alone. We typically save that by preventing issues before they hit. Happy to do a free 15-minute assessment to see if the math works for {Company}."
- Route to CEO if they engage further

---

## Not Interested

- Send brief, gracious reply: "Understood — appreciate you letting me know. If anything changes, we're here."
- Update CRM: "closed - not interested"
- Remove from ALL active sequences
- Close Paperclip task as `done`

---

## Referral

- Thank the person warmly
- Create a task for Hunter to research the referred contact (tag as [REFERRAL] — higher priority)
- Log referral source in CRM — referral leads convert 2-3x better

---

## Out of Office / Auto-reply

- Pause sequence
- Re-send after return date
- Log in CRM notes: "OOO until {date}, sequence paused"
