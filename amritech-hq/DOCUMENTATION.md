# AmriTech AI HQ — Полная документация

> Версия: HQ v2 | Дата: 2026-03-22 | Автор: Tim (@cto_handle) + Claude Opus

---

## 1. Архитектура системы

### 1.1 Обзор

AmriTech AI HQ — автономный AI-штаб из 12 агентов + 3 человека, работающий на платформе Paperclip. Агенты ищут клиентов, пишут email'ы, готовят briefing'и, следят за контрактами и деньгами. Люди звонят, закрывают сделки, и ведут CRM.

### 1.2 Стек технологий

| Компонент | Технология | Порт | Назначение |
|-----------|-----------|------|------------|
| Оркестратор | Paperclip | 4444 | Управление агентами, задачами, heartbeat'ами |
| CRM | Twenty CRM (Docker) | 5555 | Единый источник данных — лиды, клиенты, контракты |
| Email | IONOS SMTP/IMAP | — | Отправка/приём email через agent@yourcompany.example.com |
| Telegram Bot | Custom webhook | 3088 | Двусторонняя связь: люди ↔ агенты |
| CRM Sync | Custom service | 3089 | Автосинхронизация Paperclip задач → CRM лидов |
| Tunnel | Cloudflare | — | Удалённый доступ (crm.yourcompany.example.com, dispatch.yourcompany.example.com) |
| Watchdog | Bash + launchd | — | Автоматический мониторинг и перезапуск всех сервисов |
| AI Engine | Claude (Anthropic) | — | Мозг каждого агента (claude_local adapter) |

### 1.3 Схема взаимодействия

```
┌─────────────────────────────────────────────────────────────────┐
│                        TELEGRAM GROUP                           │
│  Alex (@founder_handle) | Sam (@cofounder_handle) | Tim (@cto_handle)              │
│  /commands → webhook → Paperclip → agent wakeup                │
│  ← notifications, demands, reports, files                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   TG WEBHOOK    │
                    │   (port 3088)   │
                    │ Routes commands │
                    │ Downloads files │
                    │ Quick queries   │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │        PAPERCLIP            │
              │       (port 4444)           │
              │  Orchestrator — manages:    │
              │  • 12 agents               │
              │  • Tasks/issues            │
              │  • Heartbeat scheduling    │
              │  • Skills sync             │
              │  • Agent wakeup/sleep      │
              └──────┬───────────┬─────────┘
                     │           │
          ┌──────────▼──┐  ┌────▼──────────┐
          │  AGENTS     │  │   CRM SYNC    │
          │ (Claude AI) │  │  (port 3089)  │
          │ 12 instances│  │ Paperclip →   │
          │ Each has:   │  │ Twenty CRM    │
          │ • SOUL.md   │  │ Auto-create   │
          │ • HEARTBEAT │  │ leads from    │
          │ • Skills    │  │ [LEAD] tasks  │
          │ • MCP tools │  └────┬──────────┘
          └──────┬──────┘       │
                 │              │
          ┌──────▼──────────────▼──────┐
          │       TWENTY CRM           │
          │       (port 5555)          │
          │  Docker: server + DB +     │
          │  Redis + worker            │
          │                            │
          │  Objects:                   │
          │  • Lead (28 fields)        │
          │  • Client                  │
          │  • Invoice                 │
          │  • Tender                  │
          │                            │
          │  GraphQL API               │
          └────────────────────────────┘
                 │
          ┌──────▼──────┐
          │  EMAIL MCP  │
          │  IONOS SMTP │
          │  agent@     │
          │ yourcompany.example.com │
          └─────────────┘
```

### 1.4 Файловая структура

```
paperclip/
├── amritech-hq/
│   ├── agents/
│   │   ├── ceo/           (SOUL.md, HEARTBEAT.md, TOOLS.md, AGENTS.md)
│   │   ├── hunter/
│   │   ├── sdr/
│   │   ├── closer/
│   │   ├── staff-manager/
│   │   ├── contract-manager/
│   │   ├── finance-tracker/
│   │   ├── it-chef/       (+ known-issues.md)
│   │   ├── proposal-writer/
│   │   ├── legal-assistant/
│   │   ├── onboarding-agent/
│   │   └── gov-scout/
│   ├── skills/
│   │   ├── amritech-crm-leads/       CRM queries и мутации
│   │   ├── amritech-html-email/       Email шаблон (gradient, logo, Calendly)
│   │   ├── amritech-documents/        Создание и доставка документов
│   │   ├── amritech-team-contacts/    Контакты команды
│   │   ├── amritech-self-improvement/ Система саморазвития [IMPROVEMENT]
│   │   ├── amritech-infra-diagnostics/ IT Chef чеклисты + API reference
│   │   └── amritech-tender-scoring/   Скоринг тендеров
│   ├── knowledge-base/    База знаний (7 документов)
│   └── assets/            Логотипы
├── mcp-servers/
│   ├── telegram-webhook/  TG webhook (команды, файлы, quick queries)
│   ├── telegram-send/     TG MCP (send_message, send_document, send_photo)
│   ├── crm-sync/          Автосинхронизация Paperclip → CRM
│   └── agent-mcp-config.json  MCP конфиг для агентов
├── twenty-crm/            Docker compose для Twenty CRM
├── scripts/
│   └── watchdog.sh        (копия в ~/.paperclip/watchdog.sh)
└── DOCUMENTATION.md       ← этот файл
```

---

## 2. Команда

### 2.1 Люди

| Имя | Роль | TG | Email | Обязанности |
|-----|------|----|-------|------------|
| **Alex Founder** | Co-Founder & CEO | @founder_handle | founder@example.com | Решения по сделкам, цены, звонки клиентам, одобрение email'ов, CRM — клиенты |
| **Sam Cofounder** | Co-Founder & Account Manager | @cofounder_handle | cofounder@example.com | Звонки клиентам, renewals, collection, on-site, CRM — результаты звонков |
| **Tim** | AI/Automation & Dev | @cto_handle | cto@example.com | Строит и обслуживает штаб, автоматизация. Часто offline — IT Chef замена |

### 2.2 AI-агенты

| # | Агент | Роль | Heartbeat | Model | Ключевые скиллы |
|---|-------|------|-----------|-------|----------------|
| 1 | **CEO** | Координатор штаба, лидер | 4ч + events | Opus | gtm-metrics, report-generation, data-analysis |
| 2 | **Hunter** | Поиск лидов | 6ч (4 цикла/день) | Sonnet | deep-research, lead-scoring, lead-enrichment, crm-data-enrichment |
| 3 | **SDR** | Cold email + follow-ups | 2ч | Sonnet | ai-sdr, ai-cold-outreach, sales-email-sequences, copywriting |
| 4 | **Closer** | Briefing для звонков | По задаче | Sonnet | competitive-battlecard-creation, deep-research |
| 5 | **Staff Manager** | Надзиратель штаба | 4ч | Sonnet | report-generation |
| 6 | **Contract Manager** | Контракты, renewals | 24ч | Sonnet | contract-review, expansion-retention, churn-analysis |
| 7 | **Finance Tracker** | MRR, инвойсы, оплаты | Неделя (Пн) | Sonnet | invoice-processing, financial-report-generation, budget-planning |
| 8 | **IT Chef** | DevOps, починка системы | 1ч | Sonnet | docker-compose, cloud-monitoring, database-backup, security-audit, task-automation |
| 9 | **Proposal Writer** | Proposals, КП, RFP | По задаче | Sonnet | proposal-generation, technical-writing, presentation-creation |
| 10 | **Legal Assistant** | Контракты, compliance | По задаче | Sonnet | contract-review-anthropic, compliance-anthropic, nda-triage |
| 11 | **Onboarding Agent** | Онбординг клиентов | По задаче | Sonnet | onboarding-playbook-creation, customer-feedback-analysis |
| 12 | **Gov Scout** | Гос. тендеры | 24ч | Sonnet | deep-research, compliance-checklist, tender-scoring |

**Общие скиллы у ВСЕХ агентов:**
- `amritech-crm-leads` — CRM queries и мутации
- `amritech-team-contacts` — контакты команды
- `amritech-self-improvement` — система саморазвития
- `amritech-html-email` — email шаблон
- `amritech-documents` — создание документов
- `paperclip-create-plugin` — Paperclip API
- `para-memory-files` — persistent memory

### 2.3 Иерархия

```
CEO (агент — головной центр)
├── Staff Manager (надзиратель за агентами И людьми)
│   └── Мониторит здоровье, CRM дисциплину, отчитывается CEO
├── IT Chef (devops)
│   └── Чинит всё, ревьюит [IMPROVEMENT], замена Tim'а
├── Sales Pipeline:
│   ├── Hunter → находит лидов
│   ├── SDR → шлёт email'ы, follow-ups
│   └── Closer → готовит briefing → Alex звонит
├── Revenue:
│   ├── Contract Manager → renewals, churn risk
│   └── Finance Tracker → MRR, инвойсы, collection
├── Delivery:
│   ├── Onboarding Agent → welcome, IT audit, 30-day plan
│   └── Legal Assistant → контракты, compliance, red flags
├── Expansion:
│   ├── Gov Scout → тендеры
│   └── Proposal Writer → КП, RFP
└── Люди:
    ├── Alex — решения, звонки, подписи
    ├── Sam — звонки клиентам, collection, on-site
    └── Tim — инфраструктура, автоматизация
```

---

## 3. Как агенты устроены

### 3.1 Анатомия агента

Каждый агент — это Claude AI инстанс с набором файлов:

| Файл | Назначение |
|------|------------|
| **SOUL.md** | Характер, правила, контекст компании, принципы принятия решений. "Кто ты и как ты думаешь." |
| **HEARTBEAT.md** | Пошаговая процедура каждого цикла. "Что ты делаешь когда просыпаешься." |
| **TOOLS.md** | Доступные MCP инструменты и API. "Чем ты пользуешься." |
| **AGENTS.md** | Миссия и ссылки на файлы. Entry point для Paperclip. |

### 3.2 Жизненный цикл агента

```
launchd → watchdog → Paperclip (port 4444)
                         │
                    ┌─────▼─────┐
                    │  SLEEP    │ ← агент спит
                    └─────┬─────┘
                          │ heartbeat timer ИЛИ task assigned ИЛИ wakeup API
                    ┌─────▼─────┐
                    │  WAKE     │ ← агент просыпается
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ READ SOUL │ ← читает свои инструкции
                    │ READ HB   │
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ EXECUTE   │ ← выполняет HEARTBEAT чеклист
                    │ HEARTBEAT │   шаг за шагом
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ USE TOOLS │ ← CRM, Email, TG, Web Search
                    │ (MCP)     │
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │ REPORT    │ ← комментарии в задачах, TG
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │  SLEEP    │ ← засыпает до следующего цикла
                    └───────────┘
```

### 3.3 MCP Tools (Model Context Protocol)

Каждый агент имеет доступ к MCP серверам:

| MCP Server | Tools | Кто использует |
|------------|-------|---------------|
| **twenty-crm** | 29 tools — leads, contacts, companies, notes | Все кроме Legal |
| **telegram** | send_message, send_document, send_photo | Все |
| **email** | send_email, list_emails, search_emails, get_email | SDR, Onboarding, CEO |
| **word-docs** | create_document, add_heading, add_table, format_text | Proposal Writer, Contract Manager, Legal |
| **pandoc** | convert between formats (MD↔DOCX↔PDF) | Proposal Writer, Legal |
| **ddg-search** | web_search (DuckDuckGo) | Hunter, SDR, Closer, Gov Scout |
| **web-search** | search_web, fetch_url | Hunter, SDR, Closer |

### 3.4 Skills (привязаны через Paperclip API)

Skills — это markdown файлы с инструкциями. Paperclip синхронизирует их к агентам автоматически.

**Привязка:** `POST /api/agents/{id}/skills/sync` с `desiredSkills[]`

**Типы скиллов:**
- `local/...` — наши кастомные (amritech-crm-leads и т.д.)
- `company/...` — привязаны к компании
- `owner/repo/slug` — из GitHub marketplace (80+ скиллов)

---

## 4. Обмен информацией между агентами

### 4.1 Каналы обмена

| Канал | Как работает | Примеры |
|-------|-------------|---------|
| **CRM (Twenty)** | Агенты читают и пишут в одну БД. Один агент обновляет поле — другой видит. | Hunter создаёт лид → SDR читает и шлёт email → обновляет outreachStatus → Closer видит |
| **Paperclip Tasks** | Агент создаёт задачу другому агенту. Paperclip будит получателя. | SDR создаёт [BRIEFING] → Closer просыпается и готовит briefing |
| **Paperclip Comments** | Комментарии в задачах — агенты читают историю. | Hunter оставляет сигналы → SDR читает перед email |
| **Telegram** | Агенты пишут в общий чат. Люди видят и реагируют. | CEO шлёт дайджест → Alex одобряет → SDR продолжает |
| **Memory (PARA)** | Каждый агент хранит свою память. Не делится напрямую, но IT Chef может прочитать. | Hunter запоминает "dental ниша конвертится лучше" |

### 4.2 Протоколы передачи

#### Hunter → SDR (Auto-queue)
```
Условие: ICP 60+ И email DM заполнен
Действие:
  1. Hunter ставит CRM status: "qualified"
  2. Hunter создаёт задачу: [AUTO-QUEUE] {Company} — ICP {score}
  3. Paperclip будит SDR
  4. SDR читает задачу + CRM запись → пишет email
```

#### SDR → Closer (Positive Reply)
```
Условие: SDR классифицировал ответ как replied_interested
Действие:
  1. SDR обновляет CRM: outreachStatus → replied_interested, status → engaged
  2. SDR создаёт задачу: [BRIEFING] {Company}
  3. SDR пишет в TG: "📧 Лид ответил!"
  4. Closer просыпается → готовит BANT briefing
```

#### Closer → Onboarding + Contract (Closed Won)
```
Условие: Alex подтвердил closed_won
Действие:
  1. Closer обновляет CRM: status → closed_won
  2. Closer создаёт [ONBOARD] для Onboarding Agent
  3. Closer создаёт [CONTRACT] для Contract Manager
  4. TG: "🎉 Новый клиент!"
```

#### Onboarding → Finance (Completion)
```
Условие: 30-дневный онбординг завершён
Действие:
  1. Onboarding создаёт [INVOICE] для Finance Tracker
  2. Onboarding обновляет CRM: Client record
```

#### Any Agent → IT Chef (Tech Issue)
```
Условие: Любая техническая ошибка (MCP fail, CRM down, email error)
Действие:
  1. Агент создаёт [TECH-ISSUE] {Agent}: {описание}
  2. IT Chef просыпается → диагностирует → чинит или спрашивает Tim
```

#### Any Agent → IT Chef (Improvement)
```
Условие: Агент заметил паттерн или возможность улучшения
Действие:
  1. Агент создаёт [IMPROVEMENT] {Agent}: {описание} с diff'ом
  2. IT Chef ревьюит → одобряет (безопасное) или передаёт Tim'у (рискованное)
```

### 4.3 CRM как шина данных

CRM — центральная точка обмена. Все агенты читают и пишут:

```
                    ┌─────────────┐
                    │  TWENTY CRM │
                    │             │
     Hunter ──write──►  Lead      ◄──read── SDR
     SDR ────write──►  status    ◄──read── Closer
     Closer ─write──►  status    ◄──read── Onboarding
     Finance ─write──► Invoice   ◄──read── CEO
     Contract─write──► renewal   ◄──read── SDR
                    │             │
                    └─────────────┘
```

**Lead поля для синхронизации:**

| Поле | Кто пишет | Кто читает |
|------|----------|-----------|
| name, industry, location, icpScore | Hunter | SDR, CEO, Closer |
| decisionMaker, decisionMakerEmail | Hunter | SDR |
| status | Hunter → SDR → Closer → Onboarding | Все |
| outreachStatus | SDR | SDR (follow-up), CEO (reports), Closer |
| lastContactDate | SDR | SDR (follow-up timing), CEO |
| notes | Все (append only) | Все |
| signals, signalSources | Hunter | SDR (personalization), Closer |
| estimatedMrr | Hunter | CEO, Finance |

---

## 5. Оркестратор (Paperclip)

### 5.1 Как работает

Paperclip — open-source платформа для оркестрации AI-агентов. Запускается через `pnpm dev:once` (НЕ `pnpm dev` — watch mode запрещён в production).

**Ключевые концепции:**
- **Company** — AmriTech (id: `YOUR_COMPANY_ID`)
- **Agent** — AI сотрудник с адаптером (claude_local), heartbeat, budget
- **Issue** — задача (todo/in_progress/in_review/blocked/done)
- **Skill** — markdown инструкция, привязанная к агенту
- **Heartbeat** — периодическое пробуждение агента

### 5.2 API Endpoints

| Endpoint | Method | Назначение |
|----------|--------|------------|
| `/api/companies/{id}/agents` | GET | Список агентов |
| `/api/agents/{id}` | PATCH | Обновить агента (имя, конфиг) |
| `/api/agents/{id}/skills` | GET | Скиллы агента |
| `/api/agents/{id}/skills/sync` | **POST** | Привязать скиллы (НЕ PUT!) |
| `/api/agents/{id}/wakeup` | POST | Разбудить агента |
| `/api/companies/{id}/issues` | GET/POST | Задачи |
| `/api/issues/{id}/checkout` | POST | Взять задачу |
| `/api/companies/{id}/skills` | GET | Все скиллы компании |
| `/api/companies/{id}/skills/import` | POST | Импорт скилла из local path |
| `/api/companies/{id}/skills/scan` | POST | Сканировать проекты на скиллы |

### 5.3 Как Paperclip будит агентов

1. **Timer (heartbeat)** — каждые N секунд (интервал в конфиге агента)
2. **Task assignment** — когда задача назначена агенту
3. **Wakeup API** — `POST /api/agents/{id}/wakeup` (используется webhook'ом и другими агентами)
4. **Comment mention** — когда кто-то упомянул агента в комментарии

### 5.4 Agent Adapter Config

Каждый агент имеет `adapterConfig`:

```json
{
  "cwd": "/Users/timur/paperclip",
  "model": "claude-sonnet-4-6",
  "extraArgs": ["--mcp-config", "/Users/timur/paperclip/mcp-servers/agent-mcp-config.json"],
  "instructionsFilePath": ".../.paperclip/.../instructions/AGENTS.md",
  "instructionsRootPath": ".../.paperclip/.../instructions",
  "instructionsBundleMode": "managed",
  "dangerouslySkipPermissions": true,
  "paperclipSkillSync": {
    "desiredSkills": ["skill/key/1", "skill/key/2"]
  }
}
```

**ВАЖНО:** Файлы инструкций агентов хранятся в ДВУХ местах:
1. **Source:** `amritech-hq/agents/{slug}/` — наши исходники
2. **Runtime:** `~/.paperclip/instances/default/companies/{company-id}/agents/{agent-id}/instructions/` — то что Paperclip реально читает

При изменении source → нужно скопировать в runtime:
```bash
cp amritech-hq/agents/{slug}/*.md ~/.paperclip/.../agents/{agent-id}/instructions/
```

---

## 6. Воронка продаж (Sales Pipeline)

### 6.1 Полная воронка

```
DISCOVERY → QUALIFICATION → OUTREACH → ENGAGEMENT → MEETING → CLOSE → ONBOARD → REVENUE
  Hunter      Hunter/CRM      SDR         SDR        Closer    Alex   Onboard   Finance
                                                     +Alex            +Contract
```

### 6.2 CRM статусы

| Status | OutreachStatus | Что происходит | Кто отвечает |
|--------|---------------|---------------|-------------|
| new | pending | Hunter создал, нет email | Hunter enrichment |
| qualified | pending | ICP 60+, email есть | SDR берёт в работу |
| contacted | email_sent | Day 0 email отправлен | SDR ждёт |
| contacted | follow_up_1 | Day 3 follow-up | SDR ждёт |
| contacted | follow_up_2 | Day 7 follow-up | SDR ждёт |
| engaged | replied_interested | Положительный ответ | Alex решает |
| engaged | replied_question | Вопрос от лида | SDR готовит ответ |
| engaged | replied_objection | Возражение | SDR обрабатывает |
| meeting_set | meeting_scheduled | Звонок назначен | Closer + Alex |
| closed_won | — | Стал клиентом | Onboarding + Contract |
| closed_lost | — | Отказ | Архив |
| nurture | no_response | Нет ответа, вернёмся | Hunter пересканирует |

### 6.3 Расписание отправки email'ов

- **Окно:** Пн-Чт, 8:00-10:00 AM ET
- **Пт/выходные/вечер:** В очередь на понедельник 9 AM
- **Подтверждение:** SDR спрашивает Alex перед первичными email'ами
- **Follow-ups Day 3/7:** Автоматом в рабочие часы без подтверждения
- **BCC обязательно:** cto@example.com, founder@example.com, cofounder@example.com

---

## 7. Demand система

### 7.1 Принцип

Агенты не ждут молча. Если нужно действие от человека или другого агента — требуют. Вежливо, но настойчиво. С каждым часом/днём — громче.

### 7.2 SDR → Alex (ответы лидов)

| Прошло | Tier | Сообщение |
|--------|------|----------|
| 0-2ч | 1 | Обычное уведомление |
| 2-4ч | 2 | "📧 @founder_handle, нужно решение — отвечаем?" |
| 4-8ч | 3 | "⚠️ @founder_handle, лид остывает!" |
| 8+ч | 4 | "🔴 @founder_handle @cto_handle СРОЧНО!" |

### 7.3 Contract Manager → Sam (renewals)

| До истечения | Сообщение |
|-------------|----------|
| 30 дней | "@cofounder_handle, позвони клиенту" |
| 15 дней | "⚠️ SDR outreach без ответа" |
| 7 дней | "🔴 КРИТИЧНО! Контракт через 7 дней!" |

### 7.4 Finance → все (просрочки)

| Дней | Действие |
|------|----------|
| 7 | SDR reminder email |
| 14 | "@founder_handle, решение?" |
| 30 | "@cofounder_handle, позвони!" |
| 45 | Повтор если нет записи в CRM |
| 60 | "🔴 Formal notice? Pause service?" |

### 7.5 Staff Manager → все (CRM дисциплина)

| Проблема | Demand |
|----------|--------|
| Alex не внёс клиентов | "📋 @founder_handle, в CRM {N} клиентов без данных" |
| Sam не записал звонок | "📋 @cofounder_handle, нет записи в CRM после звонка" |
| CRM данные устарели | "📋 {N} записей не обновлялись >30 дней" |

### 7.6 Agent → Agent (требовательность)

- Hunter → SDR: "3 qualified лида без outreach. Лиды остынут."
- SDR → Hunter: "Лид без email. Не могу начать outreach."
- Closer → Alex: "Briefing готов 2 дня. Позвонишь?"
- CEO → всем: Weekly report с KPIs людей

---

## 8. Telegram интеграция

### 8.1 Архитектура

```
TG Group Chat
    │
    ▼
Cloudflare Tunnel (webhook URL)
    │
    ▼
telegram-webhook (port 3088)
    ├── Text message → parseCommand → route to agent
    ├── /status, /pipeline, /leads → CRM query → instant reply
    ├── /fix → IT Chef task
    ├── /help → help message (2 parts)
    ├── Photo/Document → download → save → create task → wake agent
    └── No command → CEO (default)

telegram-send MCP (stdio)
    ├── send_message(text) → TG API sendMessage
    ├── send_document(file_path) → TG API sendDocument
    └── send_photo(file_path) → TG API sendPhoto
```

### 8.2 Команды

**Quick (мгновенные):** `/status`, `/pipeline`, `/leads`, `/fix`, `/help`

**Agent (будят агента):** `/ceo`, `/staff`, `/hunter`, `/sdr`, `/closer`, `/gov`, `/proposal`, `/contract`, `/finance`, `/legal`, `/onboard`, `/chef`

### 8.3 Файлы и фото

**Входящие (люди → агенты):**
1. Webhook получает `message.photo` или `message.document`
2. Скачивает через TG API `getFile` → download
3. Сохраняет в `/tmp/amritech-tg-files/`
4. Создаёт задачу агенту с путём к файлу
5. Caption определяет маршрутизацию: `/hunter визитка` → Hunter

**Исходящие (агенты → люди):**
- `send_document` — DOCX, PDF, любой файл
- `send_photo` — PNG, JPG

---

## 9. Email система

### 9.1 Конфигурация

| Параметр | Значение |
|----------|----------|
| SMTP | smtp.ionos.com:587 (STARTTLS) |
| IMAP | imap.ionos.com:993 (TLS) |
| From | agent@yourcompany.example.com |
| Name | YourCompany LLC |
| BCC | cto@example.com, founder@example.com, cofounder@example.com |

### 9.2 Email шаблон

- **Layout:** Table-based (email-safe)
- **Header:** Gradient #003D8F → #1474C4, белый лого `Main_logo-email.png`
- **Accent:** Золотая полоска #EC9F00
- **CTA:** "Book a 15-min Phone Call" → Calendly
- **Подпись:** Alex Founder, Co-Founder & CEO, с золотой полоской
- **Footer:** "Just reply to this email — we read and respond to every message."
- **Все стили inline** — ни один email клиент не сломает

### 9.3 Типы email'ов

| Тип | Шаблон | Tone |
|-----|--------|------|
| Cold outreach | Full (header + CTA) | Helpful, direct |
| Follow-up Day 3 | Plain reply | New angle, value add |
| Follow-up Day 7 | Plain reply | Gracious close |
| Welcome (onboarding) | Full + sections | Warm, excited |
| Renewal reminder | Full | Appreciative |
| Invoice reminder | Plain reply | Friendly, zero pressure |

---

## 10. CRM Sync Service

### 10.1 Как работает

`crm-sync/index.js` — Node.js сервис на порту 3089.

1. Каждые 60 секунд polls Paperclip API для задач `[LEAD]` и `[HOT]`
2. Парсит описание задачи (markdown) → извлекает поля лида
3. Ищет лид в CRM по имени → create или update
4. ICP 60+ с email → `status: "qualified"` (auto-queue для SDR)
5. Safety net: каждые 5 мин проверяет `replied_interested` без [BRIEFING] задачи

### 10.2 Формат задачи Hunter'а (для парсинга)

```markdown
## {Company} — {Niche} — ICP Score: {XX}/100

**Fit Score:** {XX}/100 | **Intent Score:** {XX}/100
**Estimated MRR:** ${X,XXX}/мес
**Employees:** ~{N}
**Location:** {City, State}
**Website:** {URL}
**Current IT:** {Competitor or "Unknown"}

### Decision Maker
- **Name:** {Имя Фамилия}
- **Email:** {email}
- **Phone:** {XXX-XXX-XXXX}

### Signals
1. **{Signal}** — {Evidence} — **Source:** {URL}
```

---

## 11. Watchdog

### 11.1 Расположение

- **Скрипт:** `~/.paperclip/watchdog.sh` (вне проекта Paperclip чтобы не триггерить плашку RESTART)
- **Source copy:** `scripts/watchdog.sh` (в git для бэкапа)
- **launchd:** `~/Library/LaunchAgents/com.amritech.paperclip-watchdog.plist`

### 11.2 Что мониторит

| Сервис | Проверка | При падении |
|--------|---------|------------|
| Paperclip (4444) | lsof port check | `pnpm dev:once` |
| Twenty CRM (5555) | docker ps | `docker compose restart` |
| TG Webhook (3088) | lsof port check | `node index.js` |
| CRM Sync (3089) | lsof port check | `node index.js` |
| Cloudflare Tunnel | pgrep cloudflared | `cloudflared tunnel run` |

### 11.3 Цикл

Каждые 60 секунд:
1. Rotate log (если >10MB)
2. Проверить Paperclip
3. Проверить Twenty CRM
4. Проверить TG Webhook
5. Проверить CRM Sync
6. Проверить Cloudflare Tunnel
7. Проверить здоровье агентов
8. Sleep 60

### 11.4 launchd

```
RunAtLoad: true
KeepAlive: true
```
Автостарт при загрузке Mac. Если watchdog умрёт — launchd перезапустит.

---

## 12. Система саморазвития

### 12.1 Принцип

Агенты НЕ меняют свои файлы. Они предлагают изменения через `[IMPROVEMENT]` задачи. IT Chef ревьюит.

### 12.2 Workflow

```
Агент замечает паттерн
    ↓
Создаёт [IMPROVEMENT] задачу IT Chef'у
(файл, текущее поведение, предлагаемое, данные, ожидаемый результат)
    ↓
IT Chef ревьюит:
├── Безопасно? → Одобряет, вносит изменение, рапорт в TG
├── Рискованно? → Передаёт Tim'у
└── Не обосновано? → Отклоняет с объяснением
```

### 12.3 Что IT Chef одобряет сам
- Новые паттерны для конкретного агента
- Уточнения к инструкциям
- Новые CRM query примеры
- Оптимизация шагов
- Read-only скиллы

### 12.4 Что только Tim
- Удаление BCC правила
- Изменение approval gates
- Изменение escalation каскада
- Новые агенты
- Изменение CRM schema
- Изменения инфраструктуры

---

## 13. IT Chef — подробно

### 13.1 Auto-Fix Playbooks (без спроса Tim'а)

| Проблема | Fix | Рапорт |
|----------|-----|--------|
| Сервис упал | Перезапуск | "🔧 Auto-fix: {service} перезапущен" |
| Docker restart loop | docker compose restart | "🔧 Auto-fix: containers перезапущены" |
| Stale задача >48ч | Unlock, reset to todo | "🔧 Auto-fix: задача разблокирована" |
| Дубль лида в CRM | Merge | "🔧 Auto-fix: дубль удалён" |
| Диск >80% | docker system prune, очистка логов | "🔧 Auto-fix: почистил {N}GB" |

### 13.2 Known Issues Database

`it-chef/known-issues.md` — после каждого инцидента:
```
### {дата} — {описание}
- Симптом: {что видели}
- Root Cause: {почему}
- Fix: {что сделали}
- Prevention: {как не допустить}
- Auto-fixable: Yes/No
```

### 13.3 Proactive Monitoring

| Метрика | Warning | Critical |
|---------|---------|----------|
| Диск | >70% | >85% |
| Docker restarts | >2/час | >5/час |
| CRM response | >3с | >10с |
| Agent success rate | <50%/день | <20% |
| Stale tasks | >3 у агента | >10 total |

---

## 14. Безопасность

### 14.1 Текущее состояние

| Аспект | Статус |
|--------|--------|
| CRM данные | Локальные (Docker на Mac Tim'а) |
| Email | IONOS (свой домен, TLS) |
| Telegram | Закрытая группа, бот с dedup |
| Доступ к Paperclip | localhost:4444 (пока только Tim) |
| Доступ к CRM | localhost:5555 (пока только Tim) |
| API ключи | В env vars и конфигах (не в git) |

### 14.2 Cloudflare Access (планируется)

- `crm.yourcompany.example.com` и `dispatch.yourcompany.example.com` через named tunnel
- Cloudflare Access: вход по email + одноразовый код
- Допущенные email'ы: founder@example.com, cofounder@example.com, cto@example.com
- Бесплатный план (до 50 юзеров)

### 14.3 Что агенты НЕ могут

- Менять свои SOUL/HEARTBEAT файлы (только через [IMPROVEMENT] → IT Chef)
- Удалять данные из CRM
- Контактировать клиентов напрямую (только через Email MCP с BCC)
- Принимать финансовые решения
- Подписывать контракты

---

## 15. Calendly

- **URL:** https://calendly.com/amritech/15-min-it-discovery-call
- **Тип:** One-on-one, 15 min, Phone call
- **Доступность:** Mon-Fri, 9 AM - 5 PM ET
- **В email'ах:** Кнопка "Book a 15-min Phone Call" ведёт на Calendly
- **Клиент выбирает время → Alex получает приглашение в календарь**

---

## 16. Контакты и конфиг

### Agent IDs (Paperclip)

| Агент | ID |
|-------|----|
| CEO | AGENT_UUID_CEO |
| Hunter | AGENT_UUID_HUNTER |
| SDR | AGENT_UUID_SDR |
| Closer | AGENT_UUID_CLOSER |
| Staff Manager | AGENT_UUID_STAFF_MGR |
| Contract Manager | AGENT_UUID_CONTRACT_MGR |
| Finance Tracker | AGENT_UUID_FINANCE |
| IT Chef | AGENT_UUID_IT_CHEF |
| Proposal Writer | AGENT_UUID_PROPOSAL |
| Legal Assistant | AGENT_UUID_LEGAL |
| Onboarding | AGENT_UUID_ONBOARDING |
| Gov Scout | AGENT_UUID_GOV_SCOUT |

### Company ID
`YOUR_COMPANY_ID`

### Ports
| Service | Port |
|---------|------|
| Paperclip | 4444 |
| Twenty CRM | 5555 |
| TG Webhook | 3088 |
| CRM Sync | 3089 |

---

*Документация актуальна на 22 марта 2026. При изменениях — обновлять этот файл.*
