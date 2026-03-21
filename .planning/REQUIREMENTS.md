# Requirements: AmriTech AI HQ v2

**Defined:** 2026-03-21
**Core Value:** Автоматизировать весь цикл от поиска клиента до получения денег

## v1 Requirements

### Infrastructure (INFRA)

- [ ] **INFRA-01**: Twenty CRM развёрнут (Docker), 4 pipelines настроены (Leads, Tenders, Clients, Invoices)
- [ ] **INFRA-02**: MCP серверы установлены и работают (Telegram, Gmail, Twenty CRM, Docs)
- [ ] **INFRA-03**: Registry skills установлены (21 скил из 4 источников)
- [ ] **INFRA-04**: Company Package scaffold создан (COMPANY.md, TEAM.md, .paperclip.yaml)

### Skills (SKILL)

- [ ] **SKILL-01**: amritech-html-email скил создан (HTML-шаблоны с брендингом)
- [ ] **SKILL-02**: amritech-tender-scoring скил создан (NAICS/SAM.gov скоринг)

### CEO Agent (CEO)

- [ ] **CEO-01**: AGENTS.md с полными инструкциями координации
- [ ] **CEO-02**: HEARTBEAT.md с чеклистом каждого пробуждения
- [ ] **CEO-03**: SOUL.md с личностью и принципами
- [ ] **CEO-04**: TOOLS.md с доступными инструментами
- [ ] **CEO-05**: Telegram MCP подключён, эскалации работают
- [ ] **CEO-06**: Еженедельный отчёт генерируется и отправляется

### Hunter Agent (HUNT)

- [ ] **HUNT-01**: AGENTS.md с инструкциями поиска лидов и сигналами плохого IT
- [ ] **HUNT-02**: HEARTBEAT.md с циклом скана каналов
- [ ] **HUNT-03**: SOUL.md — методичный исследователь
- [ ] **HUNT-04**: TOOLS.md — Web Search + Twenty CRM
- [ ] **HUNT-05**: ICP scoring работает через lead-enrichment скил
- [ ] **HUNT-06**: Лиды создаются в CRM + задачи SDR в Paperclip

### SDR Agent (SDR)

- [ ] **SDR-01**: AGENTS.md с инструкциями написания писем
- [ ] **SDR-02**: HEARTBEAT.md с циклом outreach + follow-up
- [ ] **SDR-03**: SOUL.md — дружелюбный, персональный
- [ ] **SDR-04**: TOOLS.md — Gmail + Web Search + CRM
- [ ] **SDR-05**: HTML-письма с брендингом AmriTech через amritech-html-email
- [ ] **SDR-06**: Follow-up D3/D7 работает автоматически

### Closer Agent (CLOS)

- [ ] **CLOS-01**: AGENTS.md с инструкциями подготовки брифинга
- [ ] **CLOS-02**: HEARTBEAT.md с процессом deep research
- [ ] **CLOS-03**: SOUL.md — аналитический
- [ ] **CLOS-04**: TOOLS.md — Web Search + CRM
- [ ] **CLOS-05**: Брифинг содержит: компания, decision maker, боли, предложение, возражения, конкуренты

### Gov Scout Agent (GOV)

- [ ] **GOV-01**: AGENTS.md с порталами, NAICS кодами, процессом
- [ ] **GOV-02**: HEARTBEAT.md с daily scan порталов
- [ ] **GOV-03**: SOUL.md — внимательный к деталям
- [ ] **GOV-04**: TOOLS.md — Web Search + CRM
- [ ] **GOV-05**: Tender scoring работает через amritech-tender-scoring
- [ ] **GOV-06**: Тендеры попадают в CRM pipeline + задачи CEO

### Proposal Writer Agent (PROP)

- [ ] **PROP-01**: AGENTS.md с типами документов и форматами
- [ ] **PROP-02**: HEARTBEAT.md с процессом генерации документов
- [ ] **PROP-03**: SOUL.md — профессиональный
- [ ] **PROP-04**: TOOLS.md — Docs MCP (DOCX/PDF)
- [ ] **PROP-05**: MSA, capability statements, proposals генерируются

### Contract Manager Agent (CONT)

- [ ] **CONT-01**: AGENTS.md с трекингом контрактов и renewals
- [ ] **CONT-02**: HEARTBEAT.md с daily check дедлайнов
- [ ] **CONT-03**: SOUL.md — точный
- [ ] **CONT-04**: TOOLS.md — CRM
- [ ] **CONT-05**: Renewal за 30 дней → задача SDR создаётся

### Finance Tracker Agent (FIN)

- [ ] **FIN-01**: AGENTS.md с трекингом инвойсов и MRR
- [ ] **FIN-02**: HEARTBEAT.md с weekly отчётом
- [ ] **FIN-03**: SOUL.md — строгий
- [ ] **FIN-04**: TOOLS.md — CRM
- [ ] **FIN-05**: Просрочка D7 → SDR, D14 → CEO → Telegram

### Legal Assistant Agent (LEG)

- [ ] **LEG-01**: AGENTS.md с типами документов и compliance
- [ ] **LEG-02**: HEARTBEAT.md с процессом review
- [ ] **LEG-03**: SOUL.md — консервативный
- [ ] **LEG-04**: TOOLS.md — Web Search + Docs MCP
- [ ] **LEG-05**: MSA/NDA/SLA генерируются, compliance checks работают

### Onboarding Agent (ONB)

- [ ] **ONB-01**: AGENTS.md с welcome процессом
- [ ] **ONB-02**: HEARTBEAT.md с чеклистом онбординга
- [ ] **ONB-03**: SOUL.md — тёплый
- [ ] **ONB-04**: TOOLS.md — Gmail + CRM
- [ ] **ONB-05**: Welcome HTML-письмо, ScreenConnect инструкция, аудит чеклист

### Integration (INT)

- [ ] **INT-01**: Wave 1 E2E: Hunter→SDR→CEO→Telegram
- [ ] **INT-02**: Wave 2 E2E: Gov Scout→CEO→Legal→Proposal Writer
- [ ] **INT-03**: Wave 3 E2E: Contract Manager→SDR (renewal), Finance→CEO (просрочка)
- [ ] **INT-04**: Projects и seed tasks созданы в Paperclip

## v2 Requirements

- **REP-01**: Reputation Manager — мониторинг отзывов Google/Yelp/BBB
- **TWI-01**: Twilio MCP — Closer оставляет voicemail
- **CAL-01**: Google Calendar — Contract Manager ставит напоминания
- **QB-01**: QuickBooks интеграция — Finance синхронизирует инвойсы

## Out of Scope

| Feature | Reason |
|---------|--------|
| Модификация кода Paperclip | Мы пользователи платформы |
| Автоматическая отправка без review | Безопасность на старте |
| Мобильное приложение | Web-first через Paperclip UI |
| Real-time чат между агентами | Task-based коммуникация достаточна |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 2 | Pending |
| INFRA-03 | Phase 3 | Pending |
| INFRA-04 | Phase 4 | Pending |
| SKILL-01 | Phase 13 | Pending |
| SKILL-02 | Phase 19 | Pending |
| CEO-01..06 | Phase 5-6 | Pending |
| HUNT-01..06 | Phase 7-8 | Pending |
| SDR-01..06 | Phase 9-10 | Pending |
| INT-01 | Phase 11 | Pending |
| CLOS-01..05 | Phase 12-13 | Pending |
| GOV-01..06 | Phase 14-15 | Pending |
| PROP-01..05 | Phase 16-17 | Pending |
| INT-02 | Phase 18 | Pending |
| CONT-01..05 | Phase 19-20 | Pending |
| FIN-01..05 | Phase 21 | Pending |
| LEG-01..05 | Phase 22 | Pending |
| ONB-01..05 | Phase 23 | Pending |
| INT-03..04 | Phase 24-25 | Pending |

**Coverage:**
- v1 requirements: 60 total
- Mapped to phases: 60
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after initial definition*
