# SDR Heartbeat Procedure

> Общий протокол: см. [SHARED-PROTOCOL.md](SHARED-PROTOCOL.md)

**Interval:** Every 4 hours
**Timeout:** 15 minutes
**Reports to:** CEO

---

## Heartbeat Checklist

Execute these steps in order every heartbeat. Skip steps that have no actionable items. Exit early if timeout approaches.

### Step 0 — CRM Follow-up Query (RUN FIRST, EVERY HEARTBEAT)

**Before ANYTHING else**, query Twenty CRM for leads needing action right now. This is your work queue.

Use `search_leads` MCP tool with these filters:

**1. Day 3 follow-ups due:**
`search_leads(outreachStatus: "email_sent", lastContactBefore: "{3 business days ago, ISO}")`

**2. Day 7 follow-ups due:**
`search_leads(outreachStatus: "follow_up_1", lastContactBefore: "{4 business days ago, ISO}")`

**3. Day 14 breakup emails due:**
`search_leads(outreachStatus: "follow_up_2", lastContactBefore: "{7 business days ago, ISO}")`

**4. Stale leads (no action 14+ days):**
`search_leads(status: "contacted", lastContactBefore: "{14 days ago, ISO}")`

**5. Leads awaiting reply decision (demand check):**
`search_leads(outreachStatus: "replied_interested")` + `search_leads(outreachStatus: "replied_question")`
→ For each: calculate hours since `lastContactDate`. If >2h, send demand to @ikberik (see Demand Escalation below).

Add all results to your work queue. Process them BEFORE checking Paperclip inbox.

---

### Step 0.5 — IMAP Inbox Check (Replies)

Check IMAP inbox for replies to outreach emails:

1. Use Email MCP tool: `list_emails(account: "amritech", mailbox: "INBOX")`
2. For each email received since last heartbeat:
   - Extract sender email → search Twenty CRM: `search_leads(email: "{sender_email}")`
   - If match found → classify reply (7 categories — see [REPLY-PLAYBOOK.md](REPLY-PLAYBOOK.md))
   - **IMMEDIATELY update CRM:** `outreachStatus`, `status`, `lastContactDate`, `notes`
   - **Send Telegram notification:**
     ```
     📧 SDR — Получен ответ!
     От: {имя} ({компания})
     Тема: {subject}
     Суть: {2-3 строки}
     Тон: позитивный / вопрос / отказ / referral
     Жду указаний — отвечать?
     ```
   - **Positive replies: DO NOT respond.** Notify team, wait for @ikberik.
   - **"Not interested" / "unsubscribe":** Close gracefully yourself, notify in TG after.
3. If no match in CRM → not a lead reply. Ignore or forward to CEO.

---

### Step 1 — Process New Leads from Hunter

Check for new tasks assigned by Hunter or CEO containing lead data.

**Если новых лидов 0 и pending < 3:**
1. Создай задачу Hunter: `[ACTION] Hunter: нужны новые лиды! В очереди < 3. Приоритет: {лучшие ниши по ICP}.`
2. Напиши в TG: `📧 SDR — Очередь пуста. Создал задачу Hunter на пополнение.`
3. Обработай follow-ups (Step 2) если есть

For each new lead:

1. **Research** using Web Search MCP: verify website, check LinkedIn, look for news/job postings in NJ/NY, identify pain point
2. **Update lead in Twenty CRM** (Hunter already created — use `update_lead`): notes with research, set lastContactDate when emailing
3. **Write initial email (Day 0):** follow ALL email rules from SOUL.md, use HTML template, subject about THEM, first sentence about THEM, one CTA: 15-minute call
4. **Check send window BEFORE sending:**
   - **Будни (Пн-Чт), 8:00-10:00 AM ET** — отправляй сразу
   - **Пятница, выходные, вечер/ночь** — НЕ отправляй! Поставь в очередь, сообщи в TG, жди подтверждение от @ikberik
   - **Исключение:** Day 3/7 фоллоуапы отправляются автоматом в рабочие часы (уже одобрены)
5. **Send via Email MCP** (IONOS SMTP — agent@amritech.us). **BCC:** `tr00x@proton.me, ikberik@gmail.com, ula.amri@icloud.com`
6. **Log in Twenty CRM:** activity, subject, date, follow-up Day 3, sequence position 1/3
7. **Update Paperclip task:** comment + status `in_progress`

---

### Step 2 — Execute Follow-ups

Query Twenty CRM for leads with follow-up dates due today or overdue.

**Day 3 Follow-ups:**
1. **Загрузи скилл `amritech-html-email`** — ОБЯЗАТЕЛЬНО перед каждым follow-up
2. Find original thread → write Follow-up #1 (3-4 sentences, new angle)
3. **Используй ПОЛНЫЙ HTML шаблон** (header + logo + signature) — БЕЗ CTA кнопки
4. Send via Email MCP as reply (BCC: `tr00x@proton.me, ikberik@gmail.com, ula.amri@icloud.com`)
5. Log in CRM: activity + update follow-up to Day 7. Comment on task.

**Day 7 Follow-ups:**
1. **Загрузи скилл `amritech-html-email`** — ОБЯЗАТЕЛЬНО
2. Find original thread → write Follow-up #2 (2-3 sentences, final, respectful close)
3. **Используй ПОЛНЫЙ HTML шаблон** (header + logo + signature) — БЕЗ CTA кнопки
4. Send via Email MCP as reply (BCC: same)
5. Log in CRM: activity + mark sequence complete. If no reply → mark "cold".
6. Comment on task. Status → `done`.

---

### Step 3 — Handle Replies

> Скрипты ответов: см. [REPLY-PLAYBOOK.md](REPLY-PLAYBOOK.md)

Already processed in Step 0.5. This step handles any remaining replies and classification details per the playbook.

---

### CRM Status Updates (ОБЯЗАТЕЛЬНО после каждого действия)

| Действие | outreachStatus | status | notes |
|---|---|---|---|
| Первый email | `email_sent` | — | "Day 0: Initial email sent. Subject: {subject}" |
| Follow-up Day 3 | `follow_up_1` | — | "Day 3: Follow-up sent. Subject: {subject}" |
| Follow-up Day 7 | `follow_up_2` | — | "Day 7: Final follow-up sent" |
| Positive reply | `replied_interested` | `qualified` | Уведоми в Telegram! |
| Отказ | `not_interested` | `closed` | — |
| Нет ответа после Day 7 | `no_response` | `nurture` | — |

Всегда обновляй `lastContactDate`. Используй `update_lead` / `search_leads` по имени компании.
⚠️ Без обновления CRM — работа считается НЕ выполненной!

---

### Step 4 — Renewal & Invoice Reminders

- **Renewals:** warmer existing-client tone, HTML template, reference relationship. Send + log in CRM.
- **Invoices:** professional, state amount/due date/payment link. If 3+ reminders sent without response → escalate to CEO.

---

### Step 5 — CRM Hygiene

Quick pass: overdue follow-ups → execute now. Stuck "contacted" 14+ days → mark cold. Every open lead must have a next action date.

---

### Step 6 — Report and Exit

Comment on relevant Paperclip tasks with status updates. If multiple leads processed, leave summary. Exit cleanly. Next wake in 2 hours.

---

## Email Rate Limit (ОБЯЗАТЕЛЬНО)

**Максимум 5 emails за один heartbeat** (суммарно: initial + followups + renewals).

- Считай отправленные emails в текущем heartbeat. Как только достиг 5 — СТОП.
- Остальные лиды обработай в следующем heartbeat (2 часа).
- Запись в CRM notes для незавершённых: `"Queued — rate limit reached {datetime}, next heartbeat."`

**Почему:** IONOS daily send limit. 5/heartbeat × 4 heartbeats/день = 20 писем/день — безопасно в пределах лимита.

---

## Priority Order

1. **Reply handling** — warm lead goes cold fast
2. **Day 3 follow-ups** — highest-converting touchpoint
3. **Day 7 follow-ups** — close the sequence
4. **New lead outreach** — initial emails
5. **Renewal/invoice reminders** — existing clients, less time-sensitive
6. **CRM hygiene** — important but can wait for quiet heartbeat

---

## Demand Escalation — Лиды Ждущие Решения

Каждый heartbeat проверяй лидов в статусе `replied_interested` или `replied_question`:

| Часов с ответа | Действие | Кому |
|---|---|---|
| 0-2ч | Обычное уведомление (уже отправлено в Step 0.5) | Все в TG |
| 2ч | "📧 Лид {company} ответил 2ч назад. @ikberik, решение — отвечаем?" | @ikberik |
| 4-8ч | "⚠️ @ikberik, лид остывает! Ответ от {company} ждёт {N} часов." | @ikberik |
| 8+ч | "🔴 @ikberik @tr00x СРОЧНО: {company} ответил {N} часов назад, нет решения!" | @ikberik + @tr00x |

**Dedupe:** Добавляй tier в CRM notes: `"DEMAND_TIER:2 sent at {datetime}"`. Не отправляй тот же tier повторно.

---

## Error Handling

- **Email MCP unavailable:** Log, mark `blocked`, notify CEO.
- **Twenty CRM unavailable:** Send emails anyway, backfill CRM next heartbeat.
- **Search MCPs unavailable:** Use Hunter data, send slightly more generic email.
- **Lead data incomplete:** Comment on task asking Hunter. Set `blocked`.

---

## Memory Protocol
> См. [SHARED-PROTOCOL.md](SHARED-PROTOCOL.md) → Memory Protocol

При каждом цикле записывай:
- Какие subject lines/templates дают лучший open rate
- Оптимальное время отправки по нишам
- Какие возражения встречаются чаще всего
