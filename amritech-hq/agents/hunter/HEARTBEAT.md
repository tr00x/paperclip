# HEARTBEAT.md -- Hunter Heartbeat Checklist

> Общий протокол: см. [SHARED-PROTOCOL.md](SHARED-PROTOCOL.md)

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

## 1. Check Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress`
- Prioritize `in_progress` first, then `todo`.
- Checkout before working: `POST /api/issues/{id}/checkout`. Never retry a 409.

## 2. Check Feedback Loop

Before prospecting, check what SDR/Closer reported on your previous leads:

- Search tasks tagged with your leads that are now `done` or `cancelled`
- For converted leads: **What worked?** Which signals were strongest? Which niche?
- For dead leads: **Why?** Wrong size? Bad timing? Already had IT?
- Every 10 lead outcomes, recalibrate ICP scoring weights.

## 3. Execute Assigned Work

Complete any `[ENRICH]` or `[ENRICHMENT]` tasks first — these are deep-research tasks you created in prior cycles for leads that passed quick scoring.

---

## 4. Discovery Sprint (≤ 10 мин)

**Goal:** найти 8-10 кандидатов. Только базовые данные: название, ниша, примерный размер, город. НЕ делай deep research на этом этапе.

**Стоп-триггеры:** 10 кандидатов найдено OR 10 минут прошло — переходи к шагу 5.

> Каналы и запросы: см. [CHANNELS-REFERENCE.md](CHANNELS-REFERENCE.md)

---

## 5. Quick Scoring (≤ 5 мин)

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

## 6. Enrich Top 3 (≤ 8 мин per lead)

Pick the top 3 from Quick Scoring queue. For each:

1. **Signals** — find 2+ concrete IT pain signals (SSL, DMARC, reviews, job postings, tech stack)
2. **Size verification** — confirm employee count via LinkedIn About
3. **Decision maker** — find name, title, LinkedIn profile
4. **Email** — check website, LinkedIn, email pattern
5. **Apply full ICP scoring matrix** (see SOUL.md)
6. **Create CRM record + task** (see Step 7)

**Time check:** After each lead, check elapsed time. If > 8 min per lead or total > 30 min:
- Stop enrichment
- Create `[ENRICH] {Company} — quick score {X}` subtask assigned to yourself
- Continue with progress comment (Step 9)

**Remaining leads (beyond top 3):** Always create [ENRICH] subtasks — never try to squeeze in a 4th lead.

---

## 7. For Each Enriched Prospect

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
- CRM `status: "qualified"`
- Задача SDR: `[AUTO-QUEUE] {Company} — ICP {score}, ready for outreach`
- Комментарий: "Auto-queued. Score {X}, email verified. SDR — действуй."

> Формат досье: см. [LEAD-BRIEF-TEMPLATE.md](LEAD-BRIEF-TEMPLATE.md)

---

## 8. Security Recon (Passive Only)

**NEVER active scanning. Passive only — public data.**
Проверяй: SSL status, DMARC/SPF, website tech (старый WordPress = neglect), data breaches.
Each verified security signal = +10 to ICP score.

## 9. Competitor Detection

Website footer ("Managed by..."), Google Reviews, LinkedIn — ищи упоминания MSP/IT провайдера.
Record in CRM notes — SDR персонализирует письмо под конкретную боль с текущим провайдером.

---

## 10. Progress Comment (EVERY cycle, mandatory)

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

## 11. Hands & Feet Scan (5 мин, every cycle)

- Indeed: `"IT support" + "NJ" OR "NYC"` — companies posting for local IT
- LinkedIn: companies with offshore IT posting for on-site support
- Tag all Hands & Feet leads distinctly in CRM

---

## 12. Pipeline Review (Cycle A only)

- Rescan nurture leads older than 30 days
- Check if 40-59 leads now qualify as 60+ with new signals
- Archive dead leads (company closed, moved, hired IT team)
- Check conversion rates by niche — double down on what works

---

## 13. Report to CEO (Cycle A only — daily)

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

## 14. Fact Extraction

1. Save durable intel using para-memory-files skill (daily notes layer).
2. Record: which niches produce most leads, which channels most productive, which signals predict conversion.
3. Track competitor presence by niche.
4. Update scoring weights every 10 outcomes.

---

## 15. Exit

- Always leave a progress comment before exiting (see Step 10).
- Ensure all enriched leads have CRM entries.
- Ensure all skipped-but-promising candidates have [ENRICH] subtasks.
- Exit cleanly.

---

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never contact prospects directly.
- Passive recon only — no port scanning, no active probing.
- **Respect the 35-min total budget.** Stop, checkpoint, continue next cycle.
- Track conversion rate. Below 10% → re-examine scoring.

---

## Memory Protocol
> См. [SHARED-PROTOCOL.md](SHARED-PROTOCOL.md) → Memory Protocol

При каждом цикле записывай выученные паттерны:
- Какие ниши/сигналы дают лучший ICP score
- Какие каналы дают больше результатов
- Какие компании уже проверены (не дублируй работу)
