# AmriTech AI HQ v2

## What This Is

AI штаб для AmriTech IT Solutions — 9 автономных агентов в Paperclip, которые делают лидген, продажи, госконтракты и операционку пока команда из 3 человек (Berik, Ula, Timur) занимается техническими выездами и клиентами. Агенты работают как Company Package (agentcompanies/v1) на claude_local adapter с Max подпиской.

## Core Value

Автоматизировать весь цикл от поиска клиента до получения денег — Hunter находит, SDR пишет, Closer готовит, Berik закрывает, система онбордит и трекает.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Инфраструктура:**
- [ ] Twenty CRM развёрнут локально (Docker), pipelines настроены
- [ ] MCP серверы подключены: Telegram, Gmail, Twenty CRM, Docs, Web Search
- [ ] Registry skills установлены (23 скила из 5 источников)
- [ ] Company Package scaffold создан (COMPANY.md, TEAM.md, .paperclip.yaml)

**Wave 1 — Core лидген:**
- [ ] CEO Agent: координация, приоритизация, Telegram эскалации, еженедельные отчёты
- [ ] Hunter Agent: поиск лидов с сигналами плохого IT, ICP scoring, CRM
- [ ] SDR Agent: персонализированные HTML-письма, follow-up D3/D7, CRM
- [ ] Wave 1 работает end-to-end: Hunter→SDR→CEO→Telegram

**Wave 2 — Полный цикл продаж:**
- [ ] Closer Agent: брифинг Berik перед звонком, competitive intel
- [ ] Gov Scout Agent: мониторинг тендеров SAM.gov/NJ/NY, scoring
- [ ] Proposal Writer Agent: MSA, capability statements, PDF/DOCX генерация
- [ ] Wave 2 работает: тендеры и брифинги end-to-end

**Wave 3 — Операционка:**
- [ ] Contract Manager Agent: трекинг контрактов, renewals за 30 дней
- [ ] Finance Tracker Agent: инвойсы, MRR, просрочки D7/D14
- [ ] Legal Assistant Agent: MSA/NDA/SLA, compliance, тендерные проверки
- [ ] Onboarding Agent: welcome HTML-пакет, аудит чеклист, ScreenConnect
- [ ] Wave 3 работает: полный lifecycle клиента

**Кастомные скилы:**
- [ ] amritech-html-email: HTML-шаблоны с брендингом AmriTech
- [ ] amritech-tender-scoring: NAICS/set-aside/SAM.gov скоринг

### Out of Scope

- Модификация кода Paperclip — мы пользователи платформы, не разработчики
- Reputation Manager — настроить позже, не в текущем scope
- Twilio MCP (voicemail) — future integration
- QuickBooks интеграция — future
- Автоматическая отправка писем без review — Wave 1 работает в draft mode

## Context

**Компания:** AmriTech IT Solutions & Business Services, MSP из Бруклина
**Регион:** NYC, NJ, PA
**Команда:** Berik (CEO/Tech), Ula (Account Mgr/Tech), Timur (AI/Automation)
**Цель:** $100k MRR

**Целевые ниши:** юрфирмы, автодилеры, бухгалтерия, CRE, архитектура, клиники, стоматология, ветклиники + Hands & Feet
**Избегать для лидгена:** рестораны, ритейл, стартапы

**Полный спек:** `docs/superpowers/specs/2026-03-20-amritech-ai-staff-design.md`
**План имплементации:** `docs/superpowers/plans/2026-03-21-amritech-hq-v2-plan.md`

**Платформа:** Paperclip (localhost, Mac → потом VPS)
**Adapter:** claude_local (Claude Code Max subscription, безлимит)
**CRM:** Twenty (open-source, Docker, GraphQL API)

**MCP серверы (готовые с GitHub):**
- Telegram: chigwell/telegram-mcp
- Gmail: IMAP/SMTP email MCP
- Twenty CRM: jezweb/twenty-mcp (29 тулов)
- Docs: Office-Word-MCP + mcp-pandoc
- Web Search: встроенный в Claude Code

**Скилы (23 штуки из 5 источников):**
- Paperclip: paperclip, para-memory-files
- tech-leads-club: ai-cold-outreach, ai-sdr, lead-enrichment, expansion-retention, social-selling, gtm-metrics, gtm-engineering, positioning-icp, sales-motion-design
- seb1n/awesome-ai-agent-skills: proposal-generation, competitive-battlecard-creation, lead-scoring, sales-email-sequences, crm-data-enrichment, invoice-processing, financial-report-generation
- lawvable/awesome-legal-skills: tech-contract-negotiation, compliance-anthropic, vendor-due-diligence
- Кастомные: amritech-html-email, amritech-tender-scoring

**Принцип коммуникации:** Только CEO пишет в Telegram бот с @упоминаниями. Все остальные передают через задачи.

## Constraints

- **Platform:** Paperclip agentcompanies/v1 формат — Company Package в git
- **Adapter:** claude_local only (Mac, Max subscription)
- **CRM:** Twenty (open-source, self-hosted Docker)
- **Deploy:** Сначала локально Mac, потом VPS с общим доступом
- **MCP:** Плейсхолдеры на старте Wave 1, подключение по ходу
- **Каждый агент = отдельная фаза** — полный контекст для промптов, SOUL, HEARTBEAT, связей

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Company Package (git-first) | Портативность, версионирование, переезд на VPS | — Pending |
| claude_local для всех | Max подписка безлимит, лучшее качество рассуждений | — Pending |
| Twenty CRM (не HubSpot) | Open-source, self-hosted, бесплатно, GraphQL API | — Pending |
| Плоская оргструктура (все → CEO) | 9 агентов — глубокая иерархия лишняя | — Pending |
| Только CEO в Telegram | Единая точка контроля, фильтрация шума | — Pending |
| 25 фаз (агент = фаза) | Каждый агент нужен полный контекст для качественных промптов | — Pending |
| Ресёрч скилов перед каждым агентом | Найти готовые скилы вместо написания с нуля | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 after initialization*
