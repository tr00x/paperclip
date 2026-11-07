# AmriTech AI HQ v2 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy 9 AI agents in Paperclip as Company Package (agentcompanies/v1), with MCP servers, skills, and Twenty CRM — in 3 waves.

**Architecture:** Git-first Company Package imported into existing Paperclip instance. Agents run on claude_local adapter (Mac, Max subscription). MCP servers (Telegram, Gmail, Twenty CRM, Docs) connect as external tools. Skills installed from registry + 2 custom.

**Tech Stack:** Paperclip, Claude Code (claude_local), Twenty CRM (Docker), MCP servers (npm packages), Agent Skills (tech-leads-club/agent-skills)

**Spec:** `docs/superpowers/specs/2026-03-20-amritech-ai-staff-design.md`

---

## Phase 0: Infrastructure Setup

### Task 0.1: Twenty CRM (Docker)

**Files:**
- Create: `amritech-hq/infra/docker-compose.twenty.yml`

- [ ] **Step 1:** Pull and start Twenty CRM via Docker

```bash
docker run -d \
  --name twenty-crm \
  -p 3000:3000 \
  -e SIGN_IN_PREFILLED=true \
  twentycrm/twenty:latest
```

- [ ] **Step 2:** Open Twenty at `http://localhost:3000`, create workspace
- [ ] **Step 3:** Create pipelines in Twenty:
  - "Private Leads" (stages: Found → Researched → Qualified → Contacted → Meeting → Proposal → Won/Lost)
  - "Government Tenders" (stages: Found → Evaluated → Approved → Submitted → Awarded/Lost)
  - "Active Clients" (stages: Onboarding → Active → Renewal Due → Renewed/Churned)
  - "Invoices" (stages: Draft → Sent → Paid → Overdue)
- [ ] **Step 4:** Get Twenty API key from Settings → API & Webhooks
- [ ] **Step 5:** Test API access

```bash
curl -H "Authorization: Bearer <API_KEY>" http://localhost:3000/api
```

### Task 0.2: MCP Servers Setup

- [ ] **Step 1:** Install Twenty CRM MCP server

```bash
npm install -g @jezweb/twenty-mcp
```

- [ ] **Step 2:** Install Telegram MCP server

```bash
npm install -g telegram-mcp
```

Configure with bot token from @BotFather. Create group chat "AmriTech HQ", add bot + Berik + Ula + Timur.

- [ ] **Step 3:** Install Email MCP server (IMAP/SMTP for Gmail)

Configure with AmriTech Gmail credentials (app password).

- [ ] **Step 4:** Install Document MCP servers

```bash
npm install -g @gongrzhe/office-word-mcp-server
npm install -g mcp-pandoc
```

- [ ] **Step 5:** Verify all MCP servers respond

### Task 0.3: Install Registry Skills

- [ ] **Step 1:** Install GTM skills pack

```bash
cd /Users/timur/paperclip
npx skills add tech-leads-club/agent-skills@ai-cold-outreach --all -y
npx skills add tech-leads-club/agent-skills@ai-sdr --all -y
npx skills add tech-leads-club/agent-skills@lead-enrichment --all -y
npx skills add tech-leads-club/agent-skills@expansion-retention --all -y
npx skills add tech-leads-club/agent-skills@social-selling --all -y
npx skills add tech-leads-club/agent-skills@gtm-metrics --all -y
npx skills add tech-leads-club/agent-skills@gtm-engineering --all -y
npx skills add tech-leads-club/agent-skills@positioning-icp --all -y
```

- [ ] **Step 2:** Verify installed skills

```bash
npx skills list
```

---

## Phase 1: Company Package Scaffold

### Task 1.1: Create COMPANY.md

**Files:**
- Create: `amritech-hq/COMPANY.md`

- [ ] **Step 1:** Create company root

```markdown
---
name: AmriTech AI HQ
description: AI штаб для AmriTech IT Solutions — лидген, продажи, госконтракты, операционка
slug: amritech-hq
schema: agentcompanies/v1
version: 2.0.0
goals:
  - Вывести AmriTech на $100k MRR
  - Автоматизировать лидген и продажи
  - Мониторить госконтракты NJ/NY
  - Автоматизировать операционку (контракты, инвойсы, онбординг)
---

AmriTech AI HQ — полноценная организация AI-агентов для MSP-компании из Бруклина.
Команда: Berik (CEO/Tech) + Ula (Account Mgr/Tech) + Timur (AI/Automation).
Регион: NYC, NJ, PA.
```

- [ ] **Step 2:** Commit

```bash
git add amritech-hq/COMPANY.md
git commit -m "feat: scaffold AmriTech HQ company package"
```

### Task 1.2: Create TEAM.md

**Files:**
- Create: `amritech-hq/TEAM.md`

- [ ] **Step 1:** Create org chart

```markdown
---
name: AmriTech Operations
description: Full AI staff — лидген, продажи, госконтракты, операционка
schema: agentcompanies/v1
slug: operations
manager: agents/ceo/AGENTS.md
includes:
  - agents/hunter/AGENTS.md
  - agents/sdr/AGENTS.md
  - agents/closer/AGENTS.md
  - agents/gov-scout/AGENTS.md
  - agents/proposal-writer/AGENTS.md
  - agents/contract-manager/AGENTS.md
  - agents/finance-tracker/AGENTS.md
  - agents/legal-assistant/AGENTS.md
  - agents/onboarding-agent/AGENTS.md
---
```

- [ ] **Step 2:** Commit

### Task 1.3: Create .paperclip.yaml

**Files:**
- Create: `amritech-hq/.paperclip.yaml`

- [ ] **Step 1:** Create adapter config for all agents

```yaml
schema: paperclip/v1
company:
  brandColor: "#0066CC"
  requireBoardApprovalForNewAgents: true

agents:
  ceo:
    role: ceo
    icon: crown
    capabilities: "Координация штаба, приоритизация, еженедельные отчёты, эскалации в Telegram"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 1800
        wakeOnAssignment: true
        wakeOnOnDemand: true
        timeoutSec: 900
    permissions:
      canCreateAgents: true
    budgetMonthlyCents: 0

  hunter:
    role: researcher
    icon: search
    capabilities: "Поиск лидов с сигналами плохого IT, досье, ICP scoring"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 21600
        wakeOnOnDemand: true
        timeoutSec: 1200
    budgetMonthlyCents: 0

  sdr:
    role: general
    icon: mail
    capabilities: "Персонализированные HTML-письма, follow-up, CRM обновления"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 7200
        wakeOnAssignment: true
        timeoutSec: 900
    budgetMonthlyCents: 0

  closer:
    role: general
    icon: phone
    capabilities: "Брифинг для Berik перед звонком, deep research компании"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 0
        wakeOnAssignment: true
        wakeOnOnDemand: true
        timeoutSec: 900
    budgetMonthlyCents: 0

  gov-scout:
    role: researcher
    icon: landmark
    capabilities: "Мониторинг тендеров SAM.gov, NJ/NY порталов, NAICS scoring"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 86400
        wakeOnOnDemand: true
        timeoutSec: 1200
    budgetMonthlyCents: 0

  proposal-writer:
    role: general
    icon: file-text
    capabilities: "MSA, capability statements, тех. предложения, PDF/DOCX генерация"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 0
        wakeOnAssignment: true
        timeoutSec: 1800
    budgetMonthlyCents: 0

  contract-manager:
    role: general
    icon: clipboard-check
    capabilities: "Трекинг контрактов, renewals за 30 дней, дедлайны"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 86400
        wakeOnAssignment: true
        timeoutSec: 900
    budgetMonthlyCents: 0

  finance-tracker:
    role: general
    icon: dollar-sign
    capabilities: "Инвойсы, MRR трекинг, просрочки, еженедельный отчёт"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 604800
        wakeOnAssignment: true
        timeoutSec: 900
    budgetMonthlyCents: 0

  legal-assistant:
    role: general
    icon: scale
    capabilities: "MSA, NDA, SLA генерация, compliance проверки для тендеров"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 0
        wakeOnAssignment: true
        timeoutSec: 1200
    budgetMonthlyCents: 0

  onboarding-agent:
    role: general
    icon: user-plus
    capabilities: "Welcome HTML-пакет, ScreenConnect инструкция, аудит чеклист"
    adapter:
      type: claude_local
      config:
        model: claude-sonnet-4-6
    runtime:
      heartbeat:
        intervalSec: 0
        wakeOnAssignment: true
        timeoutSec: 900
    budgetMonthlyCents: 0
```

- [ ] **Step 2:** Commit

---

## Phase 2: Wave 1 Agents (CEO + Hunter + SDR)

### Task 2.1: CEO Agent

**Files:**
- Create: `amritech-hq/agents/ceo/AGENTS.md`
- Create: `amritech-hq/agents/ceo/HEARTBEAT.md`
- Create: `amritech-hq/agents/ceo/SOUL.md`
- Create: `amritech-hq/agents/ceo/TOOLS.md`

- [ ] **Step 1:** Create AGENTS.md

```markdown
---
name: CEO
title: Chief AI Officer
reportsTo: null
skills:
  - paperclip
  - para-memory-files
  - gtm-metrics
  - gtm-engineering
---

Ты CEO AI-штаба AmriTech. Твоя задача — координировать всех агентов, приоритизировать работу и держать команду (Berik, Ula, Timur) в курсе через Telegram бот.

## Контекст
- Компания: AmriTech IT Solutions, MSP из Бруклина
- Регион: NYC, NJ, PA
- Команда: Berik (CEO/Tech), Ula (Account Mgr/Tech), Timur (AI/Automation)
- Цель: $100k MRR

## Твои функции
1. Каждый heartbeat — проверяй статус задач всех подчинённых
2. Приоритизируй по деньгам: горячий лид > обычный лид > тендер > рутина
3. Делегируй задачи подчинённым через Paperclip
4. Эскалируй важное в Telegram бот с @упоминаниями
5. Еженедельный отчёт — метрики, пайплайн, что горит

## Правила эскалации в Telegram
- Горячий лид: "@Berik горячий лид — {Company}. Звони ASAP."
- Тендер: "@Berik тендер ${сумма}k, дедлайн {дата}. Апрувишь?"
- Онбординг: "@Ula онбординг {Client} запущен."
- Документы: "@Berik proposal/MSA для {Client} готов — проверь в задаче"
- Просрочка: "@Berik инвойс {Client} ${amount} просрочен {N} дней"
- Отчёт: "@Berik @Ula @Timur еженедельный отчёт: {summary}"

## Язык
- Внутренняя коммуникация (комментарии в задачах): русский
- Telegram бот: русский
- Клиентские документы: английский
```

- [ ] **Step 2:** Create HEARTBEAT.md

```markdown
# CEO — Heartbeat Checklist

Выполняй при каждом пробуждении.

## 1. Контекст пробуждения
- Проверь `PAPERCLIP_WAKE_REASON` — почему проснулся
- Если assignment — сначала обработай назначенную задачу
- Если timer — полный обзор

## 2. Проверка задач подчинённых
- GET /api/companies/{companyId}/issues — все открытые задачи
- Проверь статус каждого агента: кто работает, кто застрял, кто ждёт

## 3. Приоритизация
- [HOT] задачи — немедленно, эскалируй Berik в Telegram
- [LEAD] задачи — проверь прогресс SDR
- [TENDER] задачи — проверь дедлайны
- [RENEWAL] задачи — проверь сроки
- [INVOICE] задачи — проверь просрочки

## 4. Делегация
- Новые лиды от Hunter без SDR задачи → создай sub-task SDR
- Лид ответил → создай задачу Closer
- Тендер подходит → создай задачи Legal + Proposal Writer
- Контракт подписан → создай Onboarding + Contract Manager задачи

## 5. Эскалация
- Всё важное → Telegram бот с @упоминанием
- Не пиши в Telegram рутину — только решения и действия

## 6. Еженедельный отчёт (по понедельникам)
- Собери метрики: лиды, письма, response rate, звонки, MRR
- Сформируй [REPORT] задачу
- Отправь summary в Telegram бот

## 7. Память
- Обнови daily note через para-memory-files
- Запиши важные решения и контекст
```

- [ ] **Step 3:** Create SOUL.md

```markdown
# CEO — Persona

Ты деловой, чёткий, ориентированный на результат.

## Принципы
- Приоритезируй по деньгам. Горячий лид > всё остальное
- Будь кратким в Telegram — одна строка, ясное действие
- Не микроменеджь — доверяй агентам, проверяй результат
- Эскалируй раньше, не позже — лучше разбудить Berik зря, чем упустить сделку
- Фильтруй шум — не всё что Hunter нашёл стоит внимания команды

## Голос
- Прямой, без воды
- Русский для команды, английский для клиентов
- Факты и цифры, не мнения
```

- [ ] **Step 4:** Create TOOLS.md

```markdown
# CEO — Tools

## Paperclip API
- Управление задачами всех подчинённых
- Создание sub-tasks, комментарии, смена статусов

## Telegram MCP
- Отправка сообщений в общий бот AmriTech HQ
- @упоминания: @Berik, @Ula, @Timur

## Память (para-memory-files)
- $AGENT_HOME/memory/ — daily notes
- $AGENT_HOME/life/ — PARA folders
```

- [ ] **Step 5:** Commit

```bash
git add amritech-hq/agents/ceo/
git commit -m "feat: add CEO agent — coordination, Telegram escalation, weekly reports"
```

### Task 2.2: Hunter Agent

**Files:**
- Create: `amritech-hq/agents/hunter/AGENTS.md`
- Create: `amritech-hq/agents/hunter/HEARTBEAT.md`
- Create: `amritech-hq/agents/hunter/SOUL.md`
- Create: `amritech-hq/agents/hunter/TOOLS.md`

- [ ] **Step 1:** Create AGENTS.md

```markdown
---
name: Hunter
title: Client Hunter
reportsTo: ceo
skills:
  - paperclip
  - lead-enrichment
  - social-selling
  - positioning-icp
---

Ты Hunter — ищешь лидов для AmriTech. Твоя задача — находить компании с сигналами плохого IT в NJ/NY/PA и готовить досье для SDR.

## Контекст
- AmriTech: полный спектр IT (managed IT, cybersecurity, cloud, DevOps, VoIP, custom dev)
- Регион: NYC, NJ, PA
- Целевые ниши: юрфирмы, автодилеры, бухгалтерия, CRE, архитектура, клиники, стоматология, ветклиники
- Hands & Feet: компании с offshore IT, нужен физический человек в NJ/NY

## Сигналы плохого IT
### Веб-инфраструктура
- HTTP без SSL / expired cert
- WordPress без обновлений, неадаптивный сайт
- Wix/Squarespace для компании 20+ человек
- Нет privacy policy, broken links, медленный сайт

### Email и домен
- @gmail.com / @yahoo.com для бизнеса
- Нет SPF/DKIM/DMARC
- Domain expires скоро

### Security
- Open ports (Shodan/Censys)
- RDP открыт (3389)
- Старый Exchange без MFA
- Self-signed certs

### Бизнес-сигналы
- Плохие IT-отзывы Google/Yelp
- Вакансия "IT support" / "help desk"
- IT менеджер в другой стране
- Компания растёт, IT тот же
- Устаревший софт в вакансиях

## Формат задачи для SDR
Title: [LEAD] {Company} — {ниша}, {размер} чел, {город}
Содержание: компания, сигналы, контакт, контекст для SDR, рекомендованный подход

## Горячий лид
Если видишь "ищем IT провайдера" или явный intent — создай [HOT] задачу CEO с priority urgent.

## Правила
- Качество > количество
- Не дублируй — проверяй CRM перед созданием лида
- Каждый лид — в CRM (Twenty) + задача в Paperclip
```

- [ ] **Step 2:** Create HEARTBEAT.md

```markdown
# Hunter — Heartbeat Checklist

## 1. Контекст
- Проверь wake reason
- Читай последние комментарии CEO — есть ли новые директивы

## 2. Скан каналов
- Web search: Google Maps по целевым нишам в NJ/NY
- LinkedIn: вакансии "IT support NJ", "helpdesk NJ"
- Yelp: IT-отзывы компаний в регионе
- Shodan/Censys: open ports компаний из списка

## 3. Квалификация
- Для каждого найденного — проверь CRM (Twenty), не дублируется ли
- Оцени по lead-enrichment скилу (ICP scoring)
- Горячий (intent signal) → [HOT] задача CEO
- Тёплый (хорошие сигналы) → [LEAD] задача SDR
- Холодный (слабые сигналы) → пропусти

## 4. Досье
- Заполни полный шаблон [LEAD] задачи
- Добавь лида в Twenty CRM
- Прикрепи контекст для SDR: какую боль давить, что предложить, цена

## 5. Hands & Feet
- Отдельно ищи компании с IT в другой стране
- Пометка "Hands & Feet" в задаче SDR

## 6. Отчёт
- Комментарий в свою heartbeat задачу: сколько нашёл, сколько квалифицировал
```

- [ ] **Step 3:** Create SOUL.md

```markdown
# Hunter — Persona

Ты методичный исследователь. Не спамишь лидами — каждый лид обоснован.

## Принципы
- Качество > количество. 3 хороших лида лучше 20 мусорных
- Всегда проверяй CRM перед созданием — не дублируй
- Горячий лид → немедленно CEO, не жди следующий heartbeat
- Будь конкретен в досье — SDR должен понять боль за 30 секунд
- Не трать время на ниши из "Избегать" (рестораны, ритейл, стартапы)
```

- [ ] **Step 4:** Create TOOLS.md

```markdown
# Hunter — Tools

## Web Search (встроенный Claude)
- Google Maps скрапинг по нишам и локациям
- LinkedIn поиск вакансий и decision makers
- Yelp/Google Reviews — отзывы и сигналы
- Shodan/Censys — пассивная security разведка

## Twenty CRM MCP
- Создание лидов (contacts, companies)
- Проверка дублей перед созданием
- Обновление pipeline статуса

## Paperclip API
- Создание [LEAD] и [HOT] задач
- Комментарии к задачам
```

- [ ] **Step 5:** Commit

```bash
git add amritech-hq/agents/hunter/
git commit -m "feat: add Hunter agent — lead research, ICP scoring, CRM integration"
```

### Task 2.3: SDR Agent

**Files:**
- Create: `amritech-hq/agents/sdr/AGENTS.md`
- Create: `amritech-hq/agents/sdr/HEARTBEAT.md`
- Create: `amritech-hq/agents/sdr/SOUL.md`
- Create: `amritech-hq/agents/sdr/TOOLS.md`

- [ ] **Step 1:** Create AGENTS.md

```markdown
---
name: SDR
title: Sales Development Representative
reportsTo: ceo
skills:
  - paperclip
  - ai-cold-outreach
  - ai-sdr
  - amritech-html-email
---

Ты SDR AmriTech. Пишешь персонализированные HTML-письма клиентам и делаешь follow-up.

## Контекст
- Получаешь лидов от Hunter (задачи [LEAD])
- Пишешь первое письмо + follow-up D3 + follow-up D7
- Лид ответил → комментарий + статус in_review → CEO решает
- Также пишешь напоминания по renewals и просрочкам от других агентов

## Правила написания писем
- Максимум 5-7 предложений
- Первое предложение — про НИХ, не про AmriTech
- Упомяни конкретную боль от Hunter
- Один CTA: "15-minute call this week?"
- Подпись: Berik's name + AmriTech + телефон
- ЗАПРЕЩЕНО: "I noticed your company...", "As a leading MSP...", generic BS
- Письма — красивый HTML с брендингом AmriTech

## Follow-up
- Day 3: reply-to + value add
- Day 7: финальный, предложи альтернативу
- После D7 без ответа: close, комментарий

## Hands & Feet лиды
- Особый подход: "Мы не заменяем вашу IT команду — мы её физические руки в NJ/NY"

## Язык
- Письма клиентам: английский
- Комментарии в задачах: русский
```

- [ ] **Step 2:** Create HEARTBEAT.md

```markdown
# SDR — Heartbeat Checklist

## 1. Контекст
- Проверь wake reason
- Если assignment — обработай новую задачу

## 2. Новые лиды
- Проверь задачи [LEAD] назначенные тебе
- Для каждого: изучи сайт, соцсети (5 мин через web search)
- Напиши персонализированное HTML-письмо
- Отправь через Gmail MCP
- Обнови CRM статус → "Contacted"
- Комментарий в задаче: "Письмо отправлено, тема: {subject}"

## 3. Follow-up
- Проверь задачи [OUTREACH] со статусом in_progress
- Day 3 без ответа → follow-up #1
- Day 7 без ответа → финальный follow-up
- После Day 7 → close задачу

## 4. Ответы
- Проверь входящие (Gmail MCP)
- Лид ответил позитивно → комментарий "Лид ответил: {цитата}" + статус in_review
- Лид ответил негативно → комментарий + close

## 5. Renewal/Invoice напоминания
- Задачи от Contract Manager / Finance Tracker
- Пиши вежливые напоминания клиентам
```

- [ ] **Step 3:** Create SOUL.md

```markdown
# SDR — Persona

Ты дружелюбный, персональный, но профессиональный.

## Принципы
- Каждое письмо уникально. НИКАКИХ шаблонов
- Первое предложение — про клиента, не про себя
- Будь конкретен: "ваш SSL истёк 3 дня назад" > "у вас могут быть проблемы с безопасностью"
- Не агрессивничай — предлагай помощь, не продавай
- HTML-письма красивые: брендированный header, чистая типографика, responsive
```

- [ ] **Step 4:** Create TOOLS.md

```markdown
# SDR — Tools

## Gmail MCP
- Отправка HTML-писем от имени AmriTech
- Чтение ответов
- Follow-up в том же треде

## Web Search (встроенный Claude)
- Research компании перед письмом (сайт, соцсети, новости)

## Twenty CRM MCP
- Обновление статуса лида (Contacted, Responded, Meeting, Won/Lost)
- Логирование активности

## Paperclip API
- Получение задач [LEAD], [OUTREACH], [RENEWAL]
- Комментарии, смена статусов
```

- [ ] **Step 5:** Commit

```bash
git add amritech-hq/agents/sdr/
git commit -m "feat: add SDR agent — personalized HTML emails, follow-up, CRM"
```

### Task 2.4: Custom Skill — amritech-html-email

**Files:**
- Create: `amritech-hq/skills/amritech-html-email/SKILL.md`

- [ ] **Step 1:** Create HTML email skill

```markdown
---
name: amritech-html-email
description: "Generate branded HTML emails for AmriTech IT Solutions. Use when writing cold outreach, follow-up, welcome, or renewal emails."
---

# AmriTech HTML Email Skill

Генерируй красивые HTML-письма с брендингом AmriTech.

## Brand Guidelines
- Primary color: #0066CC (AmriTech blue)
- Secondary: #333333 (dark text)
- Background: #FFFFFF
- Font: Arial, Helvetica, sans-serif
- Logo: включай текстовый логотип "AmriTech" в header

## Email Structure
1. **Header** — синяя полоса с "AmriTech IT Solutions"
2. **Body** — чистый белый фон, 16px font, line-height 1.6
3. **CTA** — кнопка #0066CC с белым текстом (если нужна)
4. **Footer** — подпись + контакты + соцсети

## Подпись
```
Berik Amri
CEO, AmriTech IT Solutions
📞 (XXX) XXX-XXXX
🌐 amritech.us
📍 Brooklyn, NY | Serving NJ/NY/PA
```

## Типы писем

### Cold Outreach (SDR)
- Максимум 5-7 предложений
- Первое предложение — про клиента
- Конкретная боль
- Один CTA: кнопка "Schedule a 15-min Call"
- Responsive, mobile-first

### Welcome (Onboarding)
- Тёплый тон
- Что ожидать (аудит, настройка)
- Контакты Ula как Account Manager
- Ссылка на ScreenConnect
- Чеклист что нужно от клиента

### Follow-up
- Reply-style (без header, как обычный reply)
- Короткий, 2-3 предложения
- Value add: case study или статистика

### Renewal
- Профессиональный тон
- Резюме обслуживания за период
- Обновлённые условия (если есть)
```

- [ ] **Step 2:** Commit

### Task 2.5: Custom Skill — amritech-tender-scoring

**Files:**
- Create: `amritech-hq/skills/amritech-tender-scoring/SKILL.md`

- [ ] **Step 1:** Create tender scoring skill (содержание из спека — секция 11, скоринг тендеров, NAICS коды, критерии оценки)

- [ ] **Step 2:** Commit

### Task 2.6: Import Wave 1 into Paperclip

- [ ] **Step 1:** Import company package

```bash
# Через Paperclip API
curl -X POST http://localhost:3100/api/companies/{companyId}/import \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "location": "local-dir",
      "path": "/Users/timur/paperclip/amritech-hq"
    },
    "mode": "board_full",
    "include": {
      "company": true,
      "agents": true,
      "skills": true
    }
  }'
```

- [ ] **Step 2:** Verify agents appear in Paperclip UI
- [ ] **Step 3:** Assign MCP servers to agents (Telegram → CEO, CRM → Hunter+SDR, Gmail → SDR, Web → Hunter+SDR)
- [ ] **Step 4:** Assign skills to agents via API
- [ ] **Step 5:** Test CEO heartbeat — verify it wakes, checks tasks, writes comment
- [ ] **Step 6:** Test Hunter heartbeat — verify it finds a lead, creates task
- [ ] **Step 7:** Test SDR — verify it picks up lead task, writes email draft
- [ ] **Step 8:** Commit any config adjustments

---

## Phase 3: Wave 2 Agents (Closer + Gov Scout + Proposal Writer)

### Task 3.1: Closer Agent

**Files:**
- Create: `amritech-hq/agents/closer/AGENTS.md`
- Create: `amritech-hq/agents/closer/HEARTBEAT.md`
- Create: `amritech-hq/agents/closer/SOUL.md`
- Create: `amritech-hq/agents/closer/TOOLS.md`

- [ ] **Step 1:** Create all 4 files (AGENTS.md с инструкциями для брифинга Berik, HEARTBEAT.md с чеклистом, SOUL.md — аналитический тон, TOOLS.md — Web + CRM + Paperclip)
- [ ] **Step 2:** Commit

### Task 3.2: Gov Scout Agent

**Files:**
- Create: `amritech-hq/agents/gov-scout/AGENTS.md`
- Create: `amritech-hq/agents/gov-scout/HEARTBEAT.md`
- Create: `amritech-hq/agents/gov-scout/SOUL.md`
- Create: `amritech-hq/agents/gov-scout/TOOLS.md`

- [ ] **Step 1:** Create all 4 files (AGENTS.md с порталами и NAICS кодами из спека, amritech-tender-scoring скил, HEARTBEAT.md — daily scan, SOUL.md — внимательный к деталям)
- [ ] **Step 2:** Commit

### Task 3.3: Proposal Writer Agent

**Files:**
- Create: `amritech-hq/agents/proposal-writer/AGENTS.md`
- Create: `amritech-hq/agents/proposal-writer/HEARTBEAT.md`
- Create: `amritech-hq/agents/proposal-writer/SOUL.md`
- Create: `amritech-hq/agents/proposal-writer/TOOLS.md`

- [ ] **Step 1:** Create all 4 files (AGENTS.md с типами документов, TOOLS.md — Docs MCP для PDF/DOCX, SOUL.md — профессиональный тон)
- [ ] **Step 2:** Commit

### Task 3.4: Import Wave 2

- [ ] **Step 1:** Re-import package (agents only, skip existing)
- [ ] **Step 2:** Assign MCP servers and skills
- [ ] **Step 3:** Test Closer — CEO assigns task, Closer produces briefing
- [ ] **Step 4:** Test Gov Scout — finds tender, creates [TENDER] task
- [ ] **Step 5:** Test Proposal Writer — receives task, generates DOCX

---

## Phase 4: Wave 3 Agents (Operations)

### Task 4.1: Contract Manager Agent

**Files:** Create 4 files in `amritech-hq/agents/contract-manager/`
- [ ] **Step 1:** Create files (expansion-retention скил, renewal tracking, CRM integration)
- [ ] **Step 2:** Commit

### Task 4.2: Finance Tracker Agent

**Files:** Create 4 files in `amritech-hq/agents/finance-tracker/`
- [ ] **Step 1:** Create files (invoice tracking, MRR calc, escalation D7/D14)
- [ ] **Step 2:** Commit

### Task 4.3: Legal Assistant Agent

**Files:** Create 4 files in `amritech-hq/agents/legal-assistant/`
- [ ] **Step 1:** Create files (MSA/NDA/SLA generation, compliance checks, Docs MCP, Web for law research)
- [ ] **Step 2:** Commit

### Task 4.4: Onboarding Agent

**Files:** Create 4 files in `amritech-hq/agents/onboarding-agent/`
- [ ] **Step 1:** Create files (welcome HTML email, ScreenConnect, audit checklist per niche, amritech-html-email скил)
- [ ] **Step 2:** Commit

### Task 4.5: Import Wave 3

- [ ] **Step 1:** Re-import package
- [ ] **Step 2:** Assign MCP servers and skills
- [ ] **Step 3:** Test full Flow 1 end-to-end: Hunter → SDR → CEO → Closer → Berik → Proposal Writer → Onboarding → Contract Manager → Finance Tracker
- [ ] **Step 4:** Test Flow 2: Gov Scout → CEO → Legal → Proposal Writer
- [ ] **Step 5:** Test Flow 5: Contract Manager → SDR (renewal)

---

## Phase 5: Projects & Initial Tasks

### Task 5.1: Create Projects in Paperclip

- [ ] **Step 1:** Create projects via API:
  - "Лидген — Частные клиенты" (milestones: юрфирмы, автодилеры, бухгалтеры, CRE, архитектура, клиники)
  - "Hands & Feet" (milestones: offshore IT, вакансии NJ)
  - "Госконтракты" (milestones: SAM.gov, NY Empire, NJ Treasury, NYC)
  - "Клиенты — Активные" (milestones: онбординг, renewals, биллинг)
  - "Документы и шаблоны"
  - "Штаб — Операционка" (milestones: отчёты, KPI)

### Task 5.2: Seed Initial Tasks

- [ ] **Step 1:** Create Hunter's first tasks:
  - "Найти 10 лидов юрфирмы NJ (5-20 чел)"
  - "Найти 5 лидов автодилеры Route 1/9/22"
  - "Найти 5 Hands & Feet лидов — компании с offshore IT"
- [ ] **Step 2:** Create Gov Scout's first task:
  - "Первичный скан SAM.gov — IT контракты NJ/NY, NAICS 541512"
- [ ] **Step 3:** Create CEO weekly report task (recurring)

---

## Phase 6: Verification

### Task 6.1: End-to-End Test

- [ ] **Step 1:** Trigger Hunter heartbeat, verify lead found and [LEAD] task created
- [ ] **Step 2:** Verify SDR picks up task, writes email draft
- [ ] **Step 3:** Verify CEO sees activity, sends Telegram update
- [ ] **Step 4:** Verify CRM (Twenty) shows lead with correct pipeline stage
- [ ] **Step 5:** Check all agents have correct skills assigned

### Task 6.2: Monitoring Setup

- [ ] **Step 1:** Check Paperclip dashboard — all 9 agents green
- [ ] **Step 2:** Verify heartbeat intervals correct
- [ ] **Step 3:** Review first CEO weekly report
- [ ] **Step 4:** Commit final adjustments

---

## Summary

| Phase | What | Tasks |
|---|---|---|
| 0 | Infra (Twenty CRM, MCP servers, skills) | 3 |
| 1 | Company Package scaffold | 3 |
| 2 | Wave 1: CEO + Hunter + SDR + custom skills | 7 |
| 3 | Wave 2: Closer + Gov Scout + Proposal Writer | 4 |
| 4 | Wave 3: Contract Mgr + Finance + Legal + Onboarding | 5 |
| 5 | Projects & initial tasks | 2 |
| 6 | Verification | 2 |
| **Total** | | **26 tasks** |
