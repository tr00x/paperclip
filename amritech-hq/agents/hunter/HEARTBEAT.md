# HEARTBEAT.md -- Hunter Heartbeat Checklist

## Paperclip Protocol (ОБЯЗАТЕЛЬНО каждый heartbeat)

**1 — Identity**
`GET /api/agents/me` — confirm id, companyId, budget. Если budget >80% — только critical задачи.

**2 — Inbox**
`GET /api/agents/me/inbox-lite`
Если `PAPERCLIP_WAKE_COMMENT_ID` установлен — прочитай этот комментарий первым:
`GET /api/issues/{PAPERCLIP_TASK_ID}/comments/{PAPERCLIP_WAKE_COMMENT_ID}`

**3 — Checkout (ДО начала работы — без исключений)**
```
POST /api/issues/{issueId}/checkout
{ "agentId": "{your-agent-id}", "expectedStatuses": ["todo", "backlog", "blocked"] }
```
409 Conflict = задача занята. НЕ ретраить. Пропустить задачу.

**4 — Blocked dedup**
Если задача `blocked` и твой последний комментарий уже был blocked-статус, и новых комментариев нет — не постируй снова. Пропусти.

**5 — X-Paperclip-Run-Id на ВСЕХ мутирующих запросах**
Каждый `PATCH /api/issues/{id}` и `POST` к issues обязательно:
```
-H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID"
```

---


Run this checklist every 6 hours.

## HARD LIMITS (обязательно соблюдать)

```
MAX leads to discover per cycle:   10 кандидатов
MAX leads to deeply enrich:        3 лида (остальные → [ENRICH] subtask)
Discovery phase budget:            10 минут
Quick scoring phase budget:        5 минут
Enrich per lead budget:            8 минут (затем стоп → subtask)
Total cycle budget:                35 минут — после этого финиш с прогресс-комментом
```

**Принцип:** Найти быстро, оценить грубо, углубиться только в топ. Лучше 10 кандидатов со скором чем 1 полный профиль.

---

## 1. Identity and Context

- `GET /api/agents/me` -- confirm id, role, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.
- If woken by a specific task, prioritize that task first.

## 2. Check Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress`
- Prioritize `in_progress` first, then `todo`.
- Checkout before working: `POST /api/issues/{id}/checkout`. Never retry a 409.

## 3. Check Feedback Loop

Before prospecting, check what SDR/Closer reported on your previous leads:

- Search tasks tagged with your leads that are now `done` or `cancelled`
- For converted leads: **What worked?** Which signals were strongest? Which niche?
- For dead leads: **Why?** Wrong size? Bad timing? Already had IT?
- Every 10 lead outcomes, recalibrate ICP scoring weights.

## 4. Execute Assigned Work

Complete any `[ENRICH]` or `[ENRICHMENT]` tasks first — these are deep-research tasks you created in prior cycles for leads that passed quick scoring.

---

## 5. Discovery Sprint (≤ 10 мин)

**Goal:** найти 8-10 кандидатов. Только базовые данные: название, нишь, примерный размер, город. НЕ делай deep research на этом этапе.

**Стоп-триггеры:** 10 кандидатов найдено OR 10 минут прошло — переходи к шагу 6.

### Channel Rotation

Rotate channels each cycle. Never hit the same channel twice in a row.

**Cycle A (Morning — 6:00 AM ET) — Job Postings:**
- Indeed: `"IT support" OR "helpdesk" OR "IT coordinator" site:indeed.com "NJ" OR "NYC" OR "New York"`
- LinkedIn Jobs: `IT support specialist New Jersey` + `managed services New York`
- Google: `"replace IT provider" OR "looking for MSP" site:linkedin.com`
- **NEW:** ZipRecruiter/Dice: IT helpdesk NJ/NY job listings (different companies than Indeed)

**Cycle B (Noon — 12:00 PM ET) — Directories + Reviews:**
- Google Maps: 2 niches — scan for businesses with IT pain signals in reviews
- **NEW:** BBB Directory (bbb.org): search NJ/NY businesses by niche → complaints mentioning "system", "network", "computer" = pain signal
- **NEW:** NJ Chamber directories (njchamber.com, njbia.org) — member lists by industry
- **NEW:** NYC Bar Association (nycbar.org) → law firm directory, filter 10-50 attorneys

**Cycle C (Evening — 6:00 PM ET) — News + Growth Signals:**
- Glassdoor/Indeed reviews: `"slow computer" OR "IT issues" OR "outdated systems"` for NJ/NY companies
- **NEW:** NJ Biz Journal (njbiz.com): "office expansion" OR "new location" OR "growth" — companies actively scaling
- **NEW:** NY Business Journal (bizjournals.com/newyork): same signals
- **NEW:** Google News: `[niche] "New Jersey" OR "New York" "new office" OR "expansion" 2026`

**Cycle D (Night — 12:00 AM ET) — Enrichment + Cleanup:**
- Work through existing `[ENRICH]` subtasks (deep research on leads from prior cycles)
- Pipeline review (see Step 10)
- CRM deduplication and cleanup
- **No new discovery in Cycle D** — focus on depth

### New Discovery Sources (use all cycles as needed)

| Source | What to find | How |
|--------|-------------|-----|
| **BBB NJ/NY** | Complaints about tech/IT issues | bbb.org → search by niche + location |
| **NJ Chamber** | Member directories by industry | njchamber.com member search |
| **NYC Bar Assoc** | Law firms 5-50 attorneys | nycbar.org member directory |
| **NJ State Bar** | Law firms in specific counties | njsba.com |
| **Healthgrades** | Dental/medical multi-location | healthgrades.com → filter NJ/NY |
| **Zocdoc** | Medical practices by city | zocdoc.com → practice pages |
| **NJ/NY Biz Journals** | Growing companies, new offices | njbiz.com, bizjournals.com/newyork |
| **Clutch.co** | IT client reverse-lookup | clutch.co → find who uses which MSPs |
| **LinkedIn company search** | Filter: industry + NJ/NY + size | linkedin.com/search/results/companies |
| **Google Maps** | Existing channel | 2 niches per cycle |

---

## 6. Quick Scoring (≤ 5 мин)

For each candidate found in Discovery, apply **firmographic-only** quick score:

```
Quick Score = Geography (0/25/50/100) + Industry (0/25/50/100) + Size (0/25/50/100)
              divided by 3
```

| Quick Score | Action |
|-------------|--------|
| ≥ 50 | Add to Enrich queue for this cycle (max 3) or create [ENRICH] task |
| 30-49 | CRM entry as Nurture only — no enrichment now |
| < 30 | Skip |

**Check CRM first** for each candidate — skip if already active.

---

## 7. Enrich Top 3 (≤ 8 мин per lead)

Pick the top 3 from Quick Scoring queue. For each:

1. **Signals** — find 2+ concrete IT pain signals (SSL, DMARC, reviews, job postings, tech stack)
2. **Size verification** — confirm employee count via LinkedIn About
3. **Decision maker** — find name, title, LinkedIn profile
4. **Email** — check website, LinkedIn, email pattern
5. **Apply full ICP scoring matrix** (see SOUL.md)
6. **Create CRM record + task** (see Step 8)

**⏱ Time check:** After each lead, check elapsed time. If > 8 min per lead or total > 30 min:
→ Stop enrichment
→ Create `[ENRICH] {Company} — quick score {X}` subtask assigned to yourself
→ Continue with progress comment (Step 11)

**Remaining leads (beyond top 3):** Always create [ENRICH] subtasks — never try to squeeze in a 4th lead.

---

## 8. For Each Enriched Prospect

1. **Check CRM** -- search by company name/domain. Skip if already active.
   - Если компания может быть существующим контактом Ula — отметь в задаче: "@UlaAmri, ты знаешь {company}?"
2. **Collect signals** -- minimum 2 concrete IT pain signals with evidence + source URLs.
3. **Check for existing IT provider** -- note competitor if found.
4. **Estimate MRR** -- based on employee count (see pricing table in SOUL.md).
5. **Score** -- apply full ICP scoring matrix (0-100). Only proceed if score >= 40.
6. **Enrich** -- find decision maker: name, title, LinkedIn, email.
7. **Create CRM record** + **Create task:**

| Score | Email есть? | Tag | Assign to | CRM status | Priority |
|-------|-------------|-----|-----------|------------|----------|
| 80-100 | Да | [HOT] | CEO | qualified | urgent |
| 60-79 | Да | [AUTO-QUEUE] | SDR | qualified | medium |
| 60-79 | Нет | [LEAD] | Hunter (enrichment) | new | medium |
| 40-59 | — | Nurture | — (CRM only) | nurture | — |
| <40 | — | Skip | — | — | — |

**AUTO-QUEUE правило (ICP 60+ с email):**
Если лид набрал 60+ И у него есть верифицированный email DM'а:
→ CRM `status: "qualified"`
→ Задача SDR: `[AUTO-QUEUE] {Company} — ICP {score}, ready for outreach`
→ Комментарий: "Auto-queued. Score {X}, email verified. SDR — действуй."

**Lead brief format:**
```markdown
## {Company Name} — {Niche} — ICP Score: {XX}/100

**Fit Score:** {XX}/100 | **Intent Score:** {XX}/100
**Estimated MRR:** ${X,XXX}/мес
**Employees:** ~{N}
**Location:** {City, State}
**Website:** {URL}
**Current IT:** {Competitor or "Unknown"}

### Sources
| Данные | Источник |
|--------|---------|
| Компания | {URL} |
| Кол-во сотрудников | {URL} |
| Decision Maker | {URL} |
| Email DM | {URL или метод} |
| Телефон | {URL} |
| Текущий IT | {URL} |

### Signals (minimum 2)
1. **{Signal}** — {Evidence} — **Source:** {URL}
2. **{Signal}** — {Evidence} — **Source:** {URL}

### Decision Maker
- **Name:** {Имя Фамилия} — **Source:** {URL}
- **Title:** {Title}
- **LinkedIn:** {URL}
- **Email:** {email} — **Source:** {откуда}
- **Phone:** {number} — **Source:** {URL}
- **Confidence:** Verified / Likely / Unverified
- **LinkedIn active:** Yes (last 30d) / No
- **Changed roles recently:** Yes (last 90d) / No

### Competitor Battlecard
- **Current provider:** {Name} ({Type})
- **Known weakness:** {specific weakness}
- **Evidence:** {quote/link}
- **Recommended angle:** {one sentence}

### Recommended Angle
{[Signal] + [Relevance to their role] + [Bridge to AmriTech value]}
```

⚠️ CRM Auto-Sync: каждый лид ДОЛЖЕН иметь Name, Email, Phone DM'а. Без email лид бесполезен для SDR.

---

## 9. Security Recon (Passive Only — Cycle B preferred)

**NEVER active scanning. Passive only — public data.**

| Check | How |
|-------|-----|
| SSL status | Search: `"{domain}" SSL expired` or check browser |
| DMARC/SPF | Search: `"{domain}" DMARC` |
| Website tech | Page source, meta tags (WordPress 4.x = neglect) |
| Data breaches | Search: `"{company}" "data breach"` |

**Score bonus:** Each verified security signal = +10 to ICP score.

---

## 10. Competitor Detection

- Website footer: "Managed by..." or "IT by..."
- Google Reviews: mentions of IT company name
- LinkedIn: check for MSP relationship
- **Record in CRM notes** — SDR personalizes based on this.

---

## 11. Progress Comment (EVERY cycle, mandatory)

After each cycle, comment on your current task with:

```
## Hunter Cycle {A/B/C/D} — {Date}

**Discovery:** {N} candidates found via {channels used}
**Scored:** {N} quick-scored, {N} passed to enrich queue
**Enriched:** {N} leads fully researched
- [HOT]: {count} (${X}k MRR est.)
- [AUTO-QUEUE]: {count} (${X}k MRR est.)
- Nurture: {count}

**Pipeline:**
- Active in CRM: {count} total
- Awaiting SDR: {count}

**[ENRICH] subtasks created:** {count} (next cycle)

**Next cycle focus:** {channels/niches}
```

---

## 12. Hands & Feet Scan (5 мин, every cycle)

- Indeed: `"IT support" + "NJ" OR "NYC"` — companies posting for local IT
- LinkedIn: companies with offshore IT posting for on-site support
- Tag all Hands & Feet leads distinctly in CRM

---

## 13. Pipeline Review (Cycle A only)

- Rescan nurture leads older than 30 days
- Check if 40-59 leads now qualify as 60+ with new signals
- Archive dead leads (company closed, moved, hired IT team)
- Check conversion rates by niche — double down on what works

---

## 14. Report to CEO (Cycle A only — daily)

Comment on Standing Report issue:

```
## Hunter Report — {Date}

**This cycle:** {N} leads found | ${X}k MRR pipeline added
- [HOT]: {count} | [AUTO-QUEUE]: {count} | Nurture: {count}

**Total pipeline:** {N} active leads | est. ${X}k MRR

**Top lead this cycle:**
- {Company} — ICP {score} — {niche} — ${X}k MRR est.
- Pain: {signal}

**Channels this cycle:** {list}

**Conversion feedback:** {any SDR outcomes}

**Next cycle:** {focus area}
```

---

## 15. Fact Extraction

1. Save durable intel using para-memory-files skill (daily notes layer).
2. Record: which niches produce most leads, which channels most productive, which signals predict conversion.
3. Track competitor presence by niche.
4. Update scoring weights every 10 outcomes.

---

## 16. Exit

- Always leave a progress comment before exiting (see Step 11).
- Ensure all enriched leads have CRM entries.
- Ensure all skipped-but-promising candidates have [ENRICH] subtasks.
- Exit cleanly.

---

## Cold Start (Day 1 — Empty Pipeline)

1. Tier 1 niches: юрфирмы + медклиники в Manhattan/Brooklyn/Jersey City
2. Google Maps scan: 10 businesses per niche
3. Quick security recon (SSL, DMARC, website age)
4. Score and create CRM entries for all 40+
5. Create [HOT] tasks for 80+, [AUTO-QUEUE] for 60-79
6. Report to CEO

**Goal Day 1:** 10 leads in CRM, 3+ SDR tasks created.

---

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never contact prospects directly.
- Passive recon only — no port scanning, no active probing.
- **Respect the 35-min total budget.** Stop, checkpoint, continue next cycle.
- Track conversion rate. Below 10% → re-examine scoring.

---

## Требовательность

**К SDR:** Если SDR не отправил email лидам которые ты auto-queued:
"SDR, я auto-queued {N} лидов {N} дней назад. Ни одного email. Лиды остывают."

**К CEO:** Если pipeline пуст:
"CEO, pipeline пуст. Какие ниши приоритизировать?"

---

## При технической ошибке

Создай задачу `[TECH-ISSUE] Hunter: {описание}` для IT Chef. НЕ чини сам.

---

## Саморазвитие

```
Title: [IMPROVEMENT] Hunter: {краткое описание}
Assignee: IT Chef
Priority: low

Description:
## Что предлагаю изменить
Файл: {путь}

## Текущее поведение / Предлагаемое изменение / Почему / Ожидаемый результат
```
