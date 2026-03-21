# Roadmap: AmriTech AI HQ v2

**Created:** 2026-03-21
**Milestone:** v1.0 — Full AI Staff (9 agents, 3 waves)

## Phase Overview

| Phase | Name | Status | Requirements |
|-------|------|--------|-------------|
| 1 | Twenty CRM Setup | ○ Pending | INFRA-01 |
| 2 | MCP Servers Setup | ○ Pending | INFRA-02 |
| 3 | Registry Skills Install | ○ Pending | INFRA-03 |
| 4 | Company Package Scaffold | ○ Pending | INFRA-04 |
| 5 | CEO — Research & Skills | ○ Pending | CEO-01..04 |
| 6 | CEO — Build & Config | ○ Pending | CEO-05..06 |
| 7 | Hunter — Research & Skills | ○ Pending | HUNT-01..04 |
| 8 | Hunter — Build & Config | ○ Pending | HUNT-05..06 |
| 9 | SDR — Research & Skills | ○ Pending | SDR-01..04 |
| 10 | SDR — Build & Config | ○ Pending | SDR-05..06 |
| 11 | Wave 1 Import & E2E Test | ○ Pending | INT-01 |
| 12 | Closer — Research & Skills | ○ Pending | CLOS-01..04 |
| 13 | Closer — Build + HTML Email Skill | ○ Pending | CLOS-05, SKILL-01 |
| 14 | Gov Scout — Research & Skills | ○ Pending | GOV-01..04 |
| 15 | Gov Scout — Build & Config | ○ Pending | GOV-05..06 |
| 16 | Proposal Writer — Research & Skills | ○ Pending | PROP-01..04 |
| 17 | Proposal Writer — Build & Config | ○ Pending | PROP-05 |
| 18 | Wave 2 Import & E2E Test | ○ Pending | INT-02 |
| 19 | Contract Mgr — Research + Tender Skill | ○ Pending | CONT-01..04, SKILL-02 |
| 20 | Contract Manager — Build & Config | ○ Pending | CONT-05 |
| 21 | Finance Tracker — Build | ○ Pending | FIN-01..05 |
| 22 | Legal Assistant — Build | ○ Pending | LEG-01..05 |
| 23 | Onboarding Agent — Build | ○ Pending | ONB-01..05 |
| 24 | Wave 3 Import & E2E Test | ○ Pending | INT-03 |
| 25 | Projects & Seed Tasks | ○ Pending | INT-04 |

---

## Phase Details

### Phase 1: Twenty CRM Setup
**Goal:** Twenty CRM работает локально с 4 pipelines
**Requirements:** INFRA-01
**Plans:** 1 plan
Plans:
- [x] 01-01-PLAN.md — Deploy Twenty CRM via Docker, create workspace, configure 4 pipelines, get API key
**Tasks:**
- Docker pull + start Twenty
- Create workspace
- Create pipelines: Leads, Tenders, Clients, Invoices
- Get API key, test access

### Phase 2: MCP Servers Setup
**Goal:** Все MCP серверы установлены и отвечают
**Requirements:** INFRA-02
**Plans:** 2 plans
Plans:
- [x] 02-01-PLAN.md — Install pandoc, Twenty CRM MCP, Office-Word-MCP, mcp-pandoc (no credentials needed)
- [x] 02-02-PLAN.md — Configure Telegram bot MCP + Email MCP (requires user credentials)
**Tasks:**
- Install pandoc binary via Homebrew
- Install + register Twenty CRM MCP server
- Install + register Office-Word-MCP + mcp-pandoc
- User creates Telegram bot + Gmail App Password
- Register Telegram + Email MCP servers
- Verify all 5 servers in Claude Code

### Phase 3: Registry Skills Install
**Goal:** 21 скил из 4 источников установлен
**Requirements:** INFRA-03
**Plans:** 1 plan
Plans:
- [ ] 03-01-PLAN.md — Install 19 skills from 3 external sources (tech-leads-club, seb1n, lawvable) + verify all 21 with existing paperclip ecosystem skills
**Tasks:**
- Install tech-leads-club skills (9 скилов)
- Install seb1n/awesome-ai-agent-skills (7 скилов)
- Install lawvable/awesome-legal-skills (3 скила)
- Verify paperclip + para-memory-files already installed (2 скила)
- Verify all 21 skills via `npx skills list`

### Phase 4: Company Package Scaffold
**Goal:** amritech-hq/ структура готова для агентов
**Requirements:** INFRA-04
**Tasks:**
- Create COMPANY.md (agentcompanies/v1)
- Create TEAM.md (org chart)
- Create .paperclip.yaml (adapter configs для всех 9 агентов)
- Commit scaffold

### Phase 5: CEO — Research & Skills
**Goal:** Полный контекст для CEO agent собран, скилы подготовлены
**Requirements:** CEO-01..04
**Tasks:**
- Ресёрч: как лучшие AI CEO-оркестраторы работают
- Подготовить промпт CEO с учётом AmriTech контекста
- Написать AGENTS.md, HEARTBEAT.md, SOUL.md, TOOLS.md
- Скилы: paperclip, para-memory-files, gtm-metrics, gtm-engineering, positioning-icp

### Phase 6: CEO — Build & Config
**Goal:** CEO agent работает — координирует, эскалирует в Telegram
**Requirements:** CEO-05..06
**Tasks:**
- Подключить Telegram MCP к CEO
- Тест: CEO просыпается, проверяет задачи, пишет в Telegram
- Тест: еженедельный отчёт генерируется
- Fine-tune промпты по результатам тестов

### Phase 7: Hunter — Research & Skills
**Goal:** Полный контекст для Hunter собран
**Requirements:** HUNT-01..04
**Tasks:**
- Ресёрч: лучшие практики AI lead research
- Изучить lead-enrichment, lead-scoring, social-selling, crm-data-enrichment скилы
- Написать AGENTS.md с сигналами плохого IT, нишами, контекстом SDR
- HEARTBEAT.md, SOUL.md, TOOLS.md

### Phase 8: Hunter — Build & Config
**Goal:** Hunter находит лидов, создаёт задачи SDR, записывает в CRM
**Requirements:** HUNT-05..06
**Tasks:**
- Подключить Web Search + Twenty CRM к Hunter
- Назначить скилы: lead-enrichment, lead-scoring, social-selling, positioning-icp, crm-data-enrichment
- Тест: Hunter находит лид, создаёт [LEAD] задачу, записывает в CRM
- Fine-tune

### Phase 9: SDR — Research & Skills
**Goal:** Полный контекст для SDR собран
**Requirements:** SDR-01..04
**Tasks:**
- Ресёрч: AI cold outreach лучшие практики, deliverability
- Изучить ai-cold-outreach, ai-sdr, sales-email-sequences скилы
- Написать AGENTS.md с правилами писем, AmriTech контекстом
- HEARTBEAT.md, SOUL.md, TOOLS.md

### Phase 10: SDR — Build & Config
**Goal:** SDR пишет HTML-письма, делает follow-up, обновляет CRM
**Requirements:** SDR-05..06
**Tasks:**
- Подключить Gmail + Web Search + CRM к SDR
- Назначить скилы: ai-cold-outreach, ai-sdr, sales-email-sequences, amritech-html-email
- Тест: SDR берёт [LEAD] задачу, пишет письмо, follow-up D3/D7
- Fine-tune

### Phase 11: Wave 1 Import & E2E Test
**Goal:** CEO+Hunter+SDR работают end-to-end в Paperclip
**Requirements:** INT-01
**Tasks:**
- Import company package в Paperclip
- Verify все 3 агента в UI
- E2E тест: Hunter→SDR→CEO→Telegram
- Fix issues, re-test

### Phase 12: Closer — Research & Skills
**Goal:** Полный контекст для Closer собран
**Requirements:** CLOS-01..04
**Tasks:**
- Ресёрч: sales call prep, competitive intel, objection handling
- Изучить competitive-battlecard-creation, sales-motion-design скилы
- Написать AGENTS.md с форматом брифинга для Berik
- HEARTBEAT.md, SOUL.md, TOOLS.md

### Phase 13: Closer — Build + HTML Email Skill
**Goal:** Closer делает брифинги + amritech-html-email скил готов
**Requirements:** CLOS-05, SKILL-01
**Tasks:**
- Подключить Web Search + CRM к Closer
- Назначить скилы: competitive-battlecard-creation, sales-motion-design
- Создать amritech-html-email SKILL.md (для SDR и Onboarding)
- Тест: Closer получает задачу, делает брифинг

### Phase 14: Gov Scout — Research & Skills
**Goal:** Полный контекст для Gov Scout собран
**Requirements:** GOV-01..04
**Tasks:**
- Ресёрч: SAM.gov API, NJ/NY procurement порталы, RFP analysis
- Написать AGENTS.md с порталами, NAICS кодами, скорингом
- HEARTBEAT.md, SOUL.md, TOOLS.md

### Phase 15: Gov Scout — Build & Config
**Goal:** Gov Scout мониторит тендеры, создаёт задачи CEO
**Requirements:** GOV-05..06
**Tasks:**
- Подключить Web Search + CRM
- Назначить amritech-tender-scoring скил
- Тест: Gov Scout находит тендер, скорит, создаёт [TENDER] задачу
- Fine-tune

### Phase 16: Proposal Writer — Research & Skills
**Goal:** Полный контекст для Proposal Writer собран
**Requirements:** PROP-01..04
**Tasks:**
- Ресёрч: MSP proposal best practices, capability statement формат
- Изучить proposal-generation скил
- Написать AGENTS.md с типами документов
- HEARTBEAT.md, SOUL.md, TOOLS.md

### Phase 17: Proposal Writer — Build & Config
**Goal:** Proposal Writer генерирует MSA, proposals, capability statements
**Requirements:** PROP-05
**Tasks:**
- Подключить Docs MCP
- Назначить proposal-generation скил
- Тест: получает задачу, генерирует DOCX/PDF
- Fine-tune

### Phase 18: Wave 2 Import & E2E Test
**Goal:** Closer+Gov Scout+Proposal Writer работают в Paperclip
**Requirements:** INT-02
**Tasks:**
- Re-import company package
- E2E тест: Gov Scout→CEO→Legal→Proposal Writer
- E2E тест: CEO→Closer→брифинг Berik
- Fix issues

### Phase 19: Contract Mgr — Research + Tender Skill
**Goal:** Contract Manager контекст + amritech-tender-scoring скил
**Requirements:** CONT-01..04, SKILL-02
**Tasks:**
- Ресёрч: contract lifecycle management, SLA tracking
- Изучить expansion-retention скил
- Создать amritech-tender-scoring SKILL.md
- Написать AGENTS.md, HEARTBEAT.md, SOUL.md, TOOLS.md

### Phase 20: Contract Manager — Build & Config
**Goal:** Contract Manager трекает контракты, создаёт renewal задачи
**Requirements:** CONT-05
**Tasks:**
- Подключить CRM
- Назначить expansion-retention скил
- Тест: контракт на учёте, renewal за 30 дней → SDR задача
- Fine-tune

### Phase 21: Finance Tracker — Build
**Goal:** Finance Tracker трекает инвойсы, MRR, эскалирует просрочки
**Requirements:** FIN-01..05
**Tasks:**
- Написать все 4 файла агента
- Подключить CRM
- Назначить invoice-processing, financial-report-generation скилы
- Тест: D7 → SDR, D14 → CEO → Telegram

### Phase 22: Legal Assistant — Build
**Goal:** Legal генерирует MSA/NDA/SLA, делает compliance checks
**Requirements:** LEG-01..05
**Tasks:**
- Написать все 4 файла агента
- Подключить Web Search + Docs MCP
- Назначить tech-contract-negotiation, compliance-anthropic, vendor-due-diligence скилы
- Тест: compliance check для тендера, MSA генерация

### Phase 23: Onboarding Agent — Build
**Goal:** Onboarding отправляет welcome пакет, создаёт аудит чеклист
**Requirements:** ONB-01..05
**Tasks:**
- Написать все 4 файла агента
- Подключить Gmail + CRM
- Назначить amritech-html-email скил
- Тест: welcome HTML-письмо, ScreenConnect инструкция, аудит чеклист

### Phase 24: Wave 3 Import & E2E Test
**Goal:** Все 9 агентов работают, полный lifecycle
**Requirements:** INT-03
**Tasks:**
- Re-import company package
- E2E: полный Flow 1 (Hunter→SDR→CEO→Closer→Proposal→Onboarding→Contract→Finance)
- E2E: Flow 2 (Gov Scout→CEO→Legal→Proposal)
- E2E: Flow 5 (Contract Manager→SDR renewal)

### Phase 25: Projects & Seed Tasks
**Goal:** Начальные проекты и задачи посеяны, штаб запущен
**Requirements:** INT-04
**Tasks:**
- Создать проекты в Paperclip (Лидген, Hands&Feet, Госконтракты, Клиенты, Штаб)
- Seed задачи Hunter: юрфирмы NJ, автодилеры, H&F
- Seed задача Gov Scout: первый скан SAM.gov
- Seed задача CEO: weekly report (recurring)
- Финальная верификация всей системы

---

**Total phases:** 25
**Estimated:** Phase 1-4 (infra) → Phase 5-11 (Wave 1) → Phase 12-18 (Wave 2) → Phase 19-25 (Wave 3)

---
*Roadmap created: 2026-03-21*
*Last updated: 2026-03-21 after phase 3 planning*
