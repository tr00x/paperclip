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

## 3. Check Feedback Loop

Before prospecting, check what SDR/Closer reported on your previous leads:

- Search tasks tagged with your leads that are now `done` or `cancelled`
- For converted leads: **What worked?** Which signals were strongest? Which niche? Note in memory.
- For dead leads: **Why?** Wrong size? Bad timing? Already had IT? Not decision maker? Note in memory.
- Every 10 lead outcomes, recalibrate your ICP scoring weights.

```
## Feedback Tracker
| Lead | Outcome | Reason | Lesson |
|------|---------|--------|--------|
| ABC Law | Converted → $3k MRR | SSL expired, no MFA, replied to email #2 | Law firms respond to compliance angle |
| XYZ Dental | Dead | Already has MSP (Dataprise) | Check for existing MSP before scoring high |
```

## 4. Execute Assigned Work

Complete any assigned research, enrichment, or re-scoring tasks before prospecting.

## 5. Prospect -- Channel Rotation

Rotate through channels each cycle. Do not hit the same channel twice in a row unless assigned.

**Cycle A (Morning -- 6:00 AM ET):**
- Google Maps: 2 niches, scan for new businesses and reviews
- LinkedIn: check for IT job postings (signal: they need IT help)

**Cycle B (Noon -- 12:00 PM ET):**
- Passive security recon on prospects from pipeline (see Security Recon below)
- Indeed/Glassdoor: IT support job postings + employee reviews mentioning tech problems

**Cycle C (Evening -- 6:00 PM ET):**
- Yelp/Google Reviews: service businesses with reviews mentioning tech issues, slow systems, downtime
- Industry directories: check for new listings in target niches

**Cycle D (Night -- 12:00 AM ET):**
- Deep research on top 3 prospects from previous cycles
- Signal validation and enrichment on existing pipeline
- CRM cleanup and deduplication
- Competitor research: who serves our target companies now?

## 6. Security Recon (Passive Only)

**NEVER do active scanning. Passive recon only — public data.**

For each serious prospect, check:

| Check | How | What it tells you |
|-------|-----|-------------------|
| SSL status | Search: `"{domain}" site:ssllabs.com` or check browser | Expired/missing = IT neglect |
| DMARC/SPF | Search: `"{domain}" DMARC` or use web tools | Missing = email spoofing risk, no IT governance |
| Website tech | Check page source, meta tags | WordPress 4.x, old jQuery = neglected site |
| Security headers | Search: `"{domain}" site:securityheaders.com` | F grade = no security awareness |
| Data breaches | Search: `"{company}" "data breach" OR "security incident"` | Past incident = high awareness of need |
| Job postings | Search: `"{company}" "IT support" OR "helpdesk" site:indeed.com` | Hiring IT = pain point is real |

**Score bonus:** Each verified security signal adds +10 to ICP score.

## 7. Competitor Detection

When researching a prospect, look for signs of existing IT provider:

- Website footer: "Managed by..." or "IT by..."
- Google Reviews: mentions of IT company name
- LinkedIn: check if company has IT staff or MSP relationship
- Job posting: "replace current IT provider" = HOT signal

**Record competitor in CRM notes.** SDR will use this for personalization:
- "We noticed you're with [Competitor] — our clients who switched from them typically see [specific benefit]"

## 8. For Each Prospect Found

1. **Check CRM** -- search by company name, domain, decision maker. Skip if already active.
2. **Collect signals** -- gather at least 2 concrete IT pain signals with evidence and source URLs.
3. **Check for existing IT provider** -- note competitor if found.
4. **Estimate MRR** -- based on employee count and services needed (see pricing table in SOUL.md).
5. **Score** -- apply ICP scoring matrix (0-100). Only proceed if score >= 40.
6. **Enrich** -- find decision maker: name, title, LinkedIn, email (if public).
7. **Create CRM record** -- company + person in Twenty CRM with all signals.
8. **Create task:**

| Score | Tag | Assign to | Priority |
|-------|-----|-----------|----------|
| 80-100 | [HOT] | CEO | urgent |
| 60-79 | [LEAD] | SDR | medium |
| 40-59 | Nurture | — (CRM only) | — |
| <40 | Skip | — | — |

**Lead brief format (in task description):**
```markdown
## {Company Name} — {Niche} — ICP Score: {XX}/100

**Fit Score:** {XX}/100 | **Intent Score:** {XX}/100
**Estimated MRR:** ${X,XXX}/мес
**Employees:** ~{N}
**Location:** {City, State}
**Website:** {URL}
**Current IT:** {Competitor or "Unknown"}

### Sources (ОБЯЗАТЕЛЬНО — ссылки на ВСЁ)
| Данные | Источник |
|--------|---------|
| Компания | {URL — Google Maps, LinkedIn company page, website} |
| Кол-во сотрудников | {URL — LinkedIn About, website team page} |
| Decision Maker | {URL — LinkedIn profile, company About page, Indeed listing} |
| Email DM | {URL или метод — website contact, LinkedIn, email pattern guess} |
| Телефон | {URL — website, Google Maps, Yelp listing} |
| Текущий IT | {URL — review, job posting, website footer} |

### Signals (minimum 2, aim for 3+) — каждый с ссылкой!
1. {Signal} — {Evidence} — **Source:** {URL}
2. {Signal} — {Evidence} — **Source:** {URL}
3. {Signal} — {Evidence} — **Source:** {URL}

### Decision Maker (КОНКРЕТНОЕ имя, не TBD!)
- **Name:** {Имя Фамилия} — **Source:** {URL где нашёл}
- **Title:** {Title}
- **LinkedIn:** {URL профиля}
- **Email:** {email} — **Source:** {откуда: website, pattern, LinkedIn}
- **Phone:** {direct or company} — **Source:** {URL}
- **Confidence:** Verified (>85%) / Likely (70-85%) / Unverified (<70%)
- **LinkedIn active:** Yes (posted in last 30d) / No
- **Changed roles recently:** Yes (last 90d) / No

**ПРАВИЛО: Если не можешь найти конкретное имя DM — НЕ пиши TBD. Ищи глубже: LinkedIn company page → People, Google "{company name} office manager", website About/Team page. Если реально не нашёл — напиши "Not found after: LinkedIn, website, Google search" с URL каждой попытки.**

### Enrichment Data (for SDR personalization)
- **Recent company news:** {funding, new office, award, hire} — **Source:** {URL}
- **Tech signals:** {SSL status, DMARC, website tech} — **Source:** {URL проверки}
- **Hiring signals:** {IT-related job postings} — **Source:** {Indeed/LinkedIn URL}
- **Review mentions:** {Glassdoor/Google reviews mentioning IT} — **Source:** {URL отзыва}

### Competitor Battlecard
- **Current provider:** {Name} ({Type: Large MSP / Break-fix / Offshore / In-house})
- **Known weakness:** {specific to this competitor type}
- **Evidence:** {review quote, job posting text, website mention}
- **Recommended angle:** {one sentence — what SDR should lead with}
- **Landmine question:** {question for the meeting to steer evaluation}

### Recommended Angle
{Why this company needs AmriTech right now. Connect the signal to their pain to our value. Use this formula:}
{[Signal observation] + [Relevance to their role/industry] + [Bridge to AmriTech value]}
```

## 9. Hands & Feet Scan

Every cycle, spend 5 minutes checking:
- Indeed: "IT support" + "NJ" OR "NYC" OR "PA" job postings
- LinkedIn: companies with offshore IT teams posting for local support
- Tag all Hands & Feet leads distinctly in CRM and tasks

## 10. Pipeline Review (Cycle A only — daily)

- Review nurture leads older than 30 days -- rescan for new signals
- Check if 40-59 leads now qualify as 60+ with new evidence
- Archive dead leads (company closed, moved out of region, hired IT team)
- Check conversion rates by niche — double down on what works

## 11. Report to CEO

At the end of each cycle, comment on your standing report issue:

```
## Hunter Report -- {Date} {Cycle}

**Leads found this cycle:** {count}
- [HOT]: {count} (est. ${X}k MRR total)
- [LEAD]: {count} (est. ${X}k MRR total)
- Nurture: {count}
- Skipped: {count}

**Pipeline status:**
- Active leads in CRM: {count} (est. ${X}k total pipeline MRR)
- Awaiting SDR outreach: {count}
- Hands & Feet: {count}

**Conversion feedback:**
- Leads converted this week: {count} (which niches, which signals worked)
- Leads dead this week: {count} (why)

**Competitor intel:**
- {Any new competitor sightings, patterns}

**Notable findings:**
- {Big opportunity, market signal, pattern}

**Next cycle focus:**
- {Channels/niches to prioritize}
```

## 12. Fact Extraction

1. Save durable intel to `$AGENT_HOME/memory/YYYY-MM-DD.md`.
2. Record patterns: which niches produce most leads, which channels most productive, which signals predict conversion.
3. Track competitor presence by niche and region.
4. Update scoring weights when you have 10+ outcomes.

## 13. Exit

- Comment on any in-progress work before exiting.
- Ensure all new leads have CRM entries.
- If no work remains and no assignments pending, exit cleanly.

---

## Cold Start (Day 1 — Empty Pipeline)

If no leads in CRM and no assignments:

1. Start with Tier 1 niches: юрфирмы + медклиники в Manhattan/Brooklyn/Jersey City
2. Run Google Maps scan for each niche — find 10 businesses
3. Quick security recon on each (SSL, DMARC, website age)
4. Score and create CRM entries for all
5. Create [LEAD] tasks for score 60+, [HOT] for 80+
6. Report to CEO with findings

**Goal Day 1:** 10 leads in CRM, 3+ tasks created for SDR.

---

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets + links.
- Never contact prospects directly -- you research and qualify only.
- Passive recon only — no port scanning, no active probing.
- Stay within the 20-minute timeout. Break deep research into subtasks.
- Track your conversion rate. If it drops below 10%, re-examine your scoring.
