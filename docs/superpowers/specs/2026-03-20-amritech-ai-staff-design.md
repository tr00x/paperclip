# AmriTech AI HQ v2 — Design Document

**Date:** 2026-03-20
**Company:** AmriTech IT Solutions & Business Services
**Platform:** Paperclip (Mac local -> VPS migration planned)
**Runtime:** claude_local (Claude Code Max subscription, unlimited tokens)
**Team:** Berik (CEO/Tech), Ula (Account Mgr/Tech), Timur (AI/Automation)

---

## 1. Mission

Вывести AmriTech на $100k MRR силами трёх человек через AI штаб, который делает операционку, лидген и продажи автоматически.

**Принцип:** Berik и Ula бегают по клиентам и делают техническую работу. Timur строит машину, которая их кормит лидами и снимает рутину. Штаб работает пока все трое заняты делом.

---

## 2. Deployment Strategy

- **Подход:** Agent Company Package (agentcompanies/v1) — git-first
- **Формат:** Полный пакет в git, импорт в Paperclip
- **Сейчас:** Локально на Mac
- **Потом:** Переезд на Hostinger VPS для общего доступа (Berik, Ula, Timur)
- **Будущее:** CRM-интеграция агентов
- **MCP серверы:** Плейсхолдеры сейчас, подключение позже (Gmail, Telegram, Twilio)

### Wave 1 режим работы (без MCP)

До подключения MCP серверов агенты работают в режиме "draft":
- **Hunter:** готовит досье лидов, складывает в задачи. Web search через встроенные возможности Claude.
- **SDR:** пишет черновики писем в комментариях задачи. Berik/Ula копируют и отправляют вручную.
- **CEO:** координация через задачи. Эскалации — комментарий с пометкой "@Berik" (Telegram подключается позже).

После подключения MCP — переключение на автоматическую отправку.

---

## 3. Org Chart

```
Board of Directors (Timur, Berik)
│
└── CEO Agent
    ├── Hunter
    ├── SDR
    ├── Closer
    ├── Gov Scout
    ├── Proposal Writer
    ├── Contract Manager
    ├── Finance Tracker
    ├── Legal Assistant
    └── Onboarding Agent
```

**Плоская структура** — все репортят CEO. Для 9 агентов глубокая иерархия — лишняя сложность.

### Волны найма

| Волна | Агенты | Цель | Покрывает флоу |
|---|---|---|---|
| **1** | CEO + Hunter + SDR | Core лидген — от поиска до первого письма | Флоу 1 (до звонка), Флоу 3, Флоу 4 (частично) |
| **2** | Closer + Gov Scout + Proposal Writer | Полный цикл продаж — брифинг, тендеры, документы | Флоу 1-4 (полностью) |
| **3** | Contract Manager + Finance Tracker + Legal Assistant + Onboarding | Операционка — контракты, деньги, онбординг | Флоу 5 + полный lifecycle клиента |

---

## 4. Company Package Structure

```
amritech-hq/
├── COMPANY.md                    # schema: agentcompanies/v1
├── TEAM.md                       # org chart
├── agents/
│   ├── ceo/
│   │   ├── AGENTS.md             # инструкции + adapter config
│   │   ├── HEARTBEAT.md          # чеклист каждого heartbeat
│   │   ├── SOUL.md               # личность, принципы, эскалации
│   │   └── TOOLS.md              # доступные инструменты
│   ├── hunter/
│   │   ├── AGENTS.md
│   │   ├── HEARTBEAT.md
│   │   ├── SOUL.md
│   │   └── TOOLS.md
│   ├── sdr/
│   │   ├── AGENTS.md
│   │   ├── HEARTBEAT.md
│   │   ├── SOUL.md
│   │   └── TOOLS.md
│   ├── closer/
│   │   ├── ...
│   ├── gov-scout/
│   │   ├── ...
│   ├── proposal-writer/
│   │   ├── ...
│   ├── contract-manager/
│   │   ├── ...
│   ├── finance-tracker/
│   │   ├── ...
│   ├── legal-assistant/
│   │   ├── ...
│   └── onboarding-agent/
│       ├── ...
└── .paperclip.yaml               # adapter defaults, heartbeat settings
```

---

## 5. Heartbeat Configuration

| Агент | Interval | Wake On | Timeout |
|---|---|---|---|
| **CEO** | 30 мин | assignment, on_demand | 15 мин |
| **Hunter** | 6 часов | on_demand | 20 мин |
| **SDR** | 2 часа | assignment | 15 мин |
| **Closer** | Нет расписания | assignment, on_demand | 15 мин |
| **Gov Scout** | 1 раз/день (утро) | on_demand | 20 мин |
| **Proposal Writer** | Нет расписания | assignment | 30 мин |
| **Contract Manager** | 1 раз/день | assignment | 15 мин |
| **Finance Tracker** | 1 раз/нед (пн) | assignment | 15 мин |
| **Legal Assistant** | Нет расписания | assignment | 20 мин |
| **Onboarding Agent** | Нет расписания | assignment | 15 мин |

---

## 6. Agent Communication & Delegation

### Механизм

Paperclip task system: создание задач, sub-tasks, комментарии, atomic checkout.

### Цепочки делегирования

```
Hunter → создаёт sub-task для SDR (с контекстом лида)
SDR → комментарий "лид ответил" → CEO просыпается (assignment)
CEO → создаёт задачу Closer (с линком на лида)
CEO → создаёт задачу Proposal Writer + Onboarding (параллельно)
Contract Manager → за 30 дней до renewal → создаёт задачу SDR
Finance Tracker → день 7 без оплаты → создаёт задачу SDR
Finance Tracker → день 14 → эскалирует CEO (urgent comment)
Gov Scout → создаёт задачу CEO с саммари тендера
CEO → апрув → задачи Legal + Proposal Writer (параллельно)
```

### Эскалация к людям

**Всё через общий Telegram-бот** с @упоминаниями (вся команда видит):

```
CEO → Telegram бот: "@Berik горячий лид — {Company}. Звони ASAP."
CEO → Telegram бот: "@Berik тендер ${сумма}k, дедлайн {дата}. Апрувишь?"
CEO → Telegram бот: "@Ula онбординг {Client} запущен."
CEO → Telegram бот: "@Berik @Ula @Timur еженедельный отчёт: {summary}"
Finance → через CEO → "@Berik инвойс {Client} просрочен 14 дней"
```

### Отчётность

- **CEO:** еженедельный брифинг — собирает данные от всех агентов, формирует отчёт, постит в Telegram бот
- **Finance Tracker:** еженедельный отчёт (пн) — MRR, ждём оплаты, просрочено

---

## 7. SOUL Principles (общие для всех агентов)

### Общие правила

- Язык внутренней коммуникации (комментарии в задачах): **русский**
- Язык клиентских писем и документов: **английский**
- Эскалации: только через общий Telegram-бот с @упоминаниями и контекстом
- Не дублировать работу — всегда проверять историю задачи
- Комментировать каждое действие в задаче (audit trail)
- Не знаешь что делать → эскалируй CEO, не принимай решение сам

### Характер по агентам

| Агент | Тон | Ключевой принцип |
|---|---|---|
| CEO | Деловой, чёткий | Приоритезируй по деньгам. Горячий лид > всё |
| Hunter | Методичный | Качество > количество. Не спамь лидами без сигналов |
| SDR | Дружелюбный, персональный | Каждое письмо уникально. Никаких шаблонов |
| Closer | Аналитический | Дай Berik всё чтобы закрыть за один звонок |
| Gov Scout | Внимательный к деталям | Только подходящие тендеры. Лучше пропустить чем подать не тот |
| Proposal Writer | Профессиональный | Адаптируй под клиента, не generic templates |
| Contract Manager | Точный | Ни один дедлайн не пропущен |
| Finance Tracker | Строгий | Деньги должны быть на счету. Эскалируй раньше, не позже |
| Legal Assistant | Консервативный | Лучше перестраховаться в документах |
| Onboarding | Тёплый | Первое впечатление клиента = всё |

---

## 8. Услуги AmriTech (полный спектр)

AmriTech = полный спектр IT. Есть Timur (автоматизация, код, AI) + ребята (любая IT инженерия).

### Managed IT Services (core)
- 24/7 мониторинг и поддержка
- Help desk (remote + on-site NJ/NY/PA)
- Endpoint management (MDM, patch management)
- Server administration (Windows, Linux)
- Network design, setup, troubleshooting
- Firewall / router / switch management
- WiFi design и оптимизация
- Print / scanner infrastructure

### Cybersecurity
- Endpoint protection (EDR/XDR deployment)
- Email security (gateway, phishing simulation)
- MFA / Zero Trust setup
- Vulnerability scanning и remediation
- Security awareness training
- Incident response
- Penetration testing
- SIEM / log monitoring
- Compliance audits (SOC2, HIPAA-lite)

### Cloud & Infrastructure
- Microsoft 365 / Google Workspace admin
- Azure / AWS / GCP setup и management
- Cloud migration (on-prem -> cloud)
- Hybrid cloud architecture
- Backup & Disaster Recovery (BDR)
- Business continuity planning
- Virtualization (Hyper-V, VMware)

### Networking
- SD-WAN deployment
- VPN setup (site-to-site, remote access)
- Network segmentation
- VLAN configuration
- Bandwidth optimization
- ISP management и failover
- Structured cabling, fiber

### VoIP & Communications
- VoIP deployment и management
- Phone system migration
- SIP trunking
- Call center setup
- Teams / Zoom room integration
- Intercom / paging systems

### Development & Automation
- Custom software development
- API integrations
- Workflow automation (Zapier, Power Automate, custom)
- Database design и admin
- Web application development
- Mobile app development
- DevOps / CI-CD pipelines
- Infrastructure as Code (Terraform, Ansible)
- AI/ML solutions и automation
- RPA (Robotic Process Automation)
- Custom reporting и dashboards
- Legacy modernization

### Industry-Specific
- Юрфирмы: case management integration, eDiscovery support
- Автодилеры: DMS integration (CDK, Reynolds), camera systems
- Бухгалтерия: tax software integration, secure file sharing
- CRE: building management systems, tenant WiFi
- Архитектура: large file storage, CAD workstation optimization

### On-Site / Hands & Feet
- Hardware installation (servers, networking, workstations)
- Office moves и buildouts
- Cable runs и infrastructure
- Data center work
- Emergency on-site response (<4 часа NJ/NY)

### Consulting
- IT strategy и roadmap (CTO-as-a-Service)
- Technology assessment
- Vendor management
- Budget planning
- Project management
- Compliance consulting
- Digital transformation
- M&A IT due diligence

---

## 9. Target Markets

### Приоритет 1 — Hands & Feet (самые быстрые деньги)

Компании с удалённым IT (Индия, Украина, Филиппины) или out-of-state MSP которым нужен физический человек в NJ/NY.

**Цены:** $175-225/час разовые | $1,400/мес ретейнер (8 часов) | $3,000/мес ретейнер (20 часов)

### Приоритет 2 — Основные ниши

| Ниша | MRR | Почему работает |
|---|---|---|
| Юридические фирмы (5-20 человек) | $2,500-5,000 | Платят стабильно, боятся потери данных |
| Автодилеры | $3,000-7,000 | Сложный стек: DMS, камеры, VoIP |
| Бухгалтерские фирмы | $1,500-3,000 | Простой стек, лояльные клиенты |
| Коммерческая недвижимость | $2,000-4,000 | Стабильно, долгосрочные отношения |
| Архитектура / инжиниринг | $3,000-6,000 | Большие файлы, сложные сети |

### Избегать (для активного лидгена)
- Рестораны — низкий бюджет, высокий churn
- Ритейл — сезонный, price-sensitive
- Стартапы — хотят всё бесплатно, быстро уходят

### Дополнительные ниши (Hunter ищет активно)

| Ниша | MRR | Почему работает |
|---|---|---|
| Клиники / медцентры | $3,000-6,000 | HIPAA compliance = sticky клиент, высокий MRR |
| Стоматология | $2,000-4,000 | Practice management + imaging + HIPAA |
| Ветклиники | $1,500-3,000 | Practice mgmt, imaging, лояльные |

---

## 10. Сигналы плохого IT (Hunter)

### Веб-инфраструктура
- HTTP без SSL / expired cert
- Mixed content warnings
- WordPress без обновлений
- Сайт не адаптивный
- Wix/Squarespace для компании 20+ человек
- Нет privacy policy / terms
- Broken links, 404
- Сайт грузится >5 сек

### Email и домен
- Бизнес-email на @gmail.com / @yahoo.com
- Нет SPF/DKIM/DMARC
- Domain expires скоро
- Нет email gateway / spam protection

### Security (пассивная разведка)
- Open ports (Shodan/Censys)
- RDP открыт наружу (3389)
- Старый Exchange / OWA без MFA
- VPN с известными CVE
- Default credentials на networking gear
- Нет WAF / DDoS protection
- Self-signed certs на публичных сервисах

### Бизнес-сигналы
- Плохие IT-отзывы на Google/Yelp
- Нет Google Business профиля (>10 человек)
- Вакансия "IT support" / "help desk"
- IT менеджер в LinkedIn в другой стране
- Компания растёт но IT тот же
- Жалобы сотрудников на IT в Glassdoor
- Устаревший софт в вакансиях ("Windows 7", "Server 2012")

### Social proof отсутствия
- Нет упоминания IT партнёра
- Нет SOC2 / compliance badges
- Нет backup/DR упоминания для чувствительных ниш

---

## 11. Тендерный гайд (Gov Scout)

### Порталы

1. **SAM.gov** — федеральные контракты (NAICS 541512, 541513, 541519 + др.)
2. **NY Empire State Development** — MWBE opportunities
3. **NJ Treasury** — State contracts и IT blanket P.O.
4. **NYC Procurement (PASSPort)** — City agency contracts
5. **NJ Local Government** — County/municipal contracts, school districts
6. **Port Authority NY/NJ**
7. **NJ Transit**

### NAICS коды AmriTech

**Primary:**
- 541512 — Computer Systems Design Services
- 541513 — Computer Facilities Management
- 541519 — Other Computer Related Services
- 518210 — Data Processing & Hosting
- 541511 — Custom Computer Programming
- 541611 — Administrative Management Consulting

**Secondary:**
- 561621 — Security Systems Services
- 517311 — Wired Telecommunications
- 611420 — Computer Training

### Что AmriTech МОЖЕТ брать
- IT support & help desk contracts
- Network installation & management
- Cybersecurity services
- Cloud migration projects
- VoIP deployments
- Custom software development
- Data center management
- Endpoint management fleets
- IT consulting & assessment
- Disaster recovery planning

### Что AmriTech НЕ МОЖЕТ (пока)
- Крупные системные интеграции (>$500k) — нет track record
- Federal classified / clearance required
- Контракты требующие >20 сотрудников on-site
- Specialized ERP implementations (SAP, Oracle)

### Скоринг тендера

| Фактор | Вес | Оценка |
|---|---|---|
| Размер ($) | 20% | Sweet spot: $15k-$100k |
| Срок подачи | 15% | Минимум 10 рабочих дней до дедлайна |
| Сложность | 20% | Стандартные IT services > узкоспециализированное |
| Конкуренция | 15% | Small business set-aside = меньше конкурентов |
| Географическое преимущество | 15% | NJ/NY on-site = наше преимущество |
| Track record match | 15% | Есть ли похожий опыт |

Скор > 70% -> рекомендовать CEO. 50-70% -> упомянуть с оговорками. < 50% -> пропустить.

### Документы для подачи
- SAM.gov registration (UEI number)
- Capability statement (1-2 стр)
- Past performance references (мин 3)
- Technical approach / SOW response
- Pricing (T&M или fixed price)
- Resumes ключевых сотрудников
- Proof of insurance
- Certifications
- Small business self-certification

---

## 12. Project Structure in Paperclip

```
Workspace: AmriTech Operations

├── Project: "Лидген — Частные клиенты"
│   ├── Milestone: "Юрфирмы NJ (5-20 человек)"
│   ├── Milestone: "Автодилеры NJ"
│   ├── Milestone: "Бухгалтерские фирмы"
│   ├── Milestone: "Коммерческая недвижимость"
│   └── Milestone: "Архитектура / инжиниринг"
│
├── Project: "Hands & Feet"
│   ├── Milestone: "Компании с offshore IT"
│   └── Milestone: "Вакансии IT support NJ от нелокальных"
│
├── Project: "Госконтракты"
│   ├── Milestone: "SAM.gov — активный мониторинг"
│   ├── Milestone: "NY Empire State Development"
│   ├── Milestone: "NJ Treasury IT"
│   └── Milestone: "NYC Procurement"
│
├── Project: "Клиенты — Активные"
│   ├── Milestone: "Онбординг"
│   ├── Milestone: "Контракты и Renewals"
│   └── Milestone: "Биллинг и инвойсы"
│
├── Project: "Документы и шаблоны"
│   ├── Milestone: "Шаблоны для частных клиентов"
│   └── Milestone: "Госконтракты — документы"
│
└── Project: "Штаб — Операционка"
    ├── Milestone: "Еженедельные отчёты"
    ├── Milestone: "KPI и метрики"
    └── Milestone: "Инфра и MCP интеграции"
```

---

## 13. Workflow States

```
[triage] → [backlog] → [todo] → [in_progress] → [in_review] → [done]
                                       ↓
                                   [blocked]
                                       ↓
                                  [cancelled]
```

| Переход | Кто | Когда |
|---|---|---|
| triage -> backlog | CEO | Оценил приоритет |
| backlog -> todo | CEO | Назначил агенту |
| todo -> in_progress | Агент | Atomic checkout |
| in_progress -> in_review | Агент | Нужен человек |
| in_review -> done | Berik/Ula | Подтвердили результат |
| in_progress -> blocked | Агент | Ждёт ответа |
| * -> cancelled | CEO / Berik | Лид не подошёл |

---

## 14. Task Templates

### [LEAD] Лид от Hunter

```
Title: [LEAD] {Company} — {ниша}, {размер} чел, {город}
Priority: normal | high | urgent
Labels: lead, {ниша}, {источник}, wave-{номер}
Assignee: SDR

## Компания
- Название: {name}
- Сайт: {url}
- Google Business: {есть/нет, рейтинг, отзывов}
- LinkedIn: {url}
- Размер: {employees}
- Ниша: {ниша}
- Город/район: {location}

## Сигналы плохого IT
- {чеклист из секции 10 — что конкретно нашёл}
- Заметки: {детали}

## Контакт
- Имя: {decision maker}
- Должность: {title}
- Email: {email}
- Телефон: {phone}
- LinkedIn: {url}
- Как нашли: {Google Maps / LinkedIn / Indeed вакансия}

## Контекст для SDR
- Рекомендованный подход: {какую боль давить}
- Сервисы AmriTech под них: {VPN setup, endpoint management, VoIP и т.д.}
- Ценовой диапазон: ${min}-${max}/мес
- Конкуренты: {если известны}
- Timing: {почему СЕЙЧАС}

## Действия SDR
1. Изучить сайт и соцсети (5 мин)
2. Написать персонализированное письмо — НЕ шаблон
3. Follow-up день 3
4. Follow-up день 7 финальный
5. Ответили → комментарий + in_review → CEO решает
6. Не ответили → done, "no response after 2 follow-ups"
```

### [HOT] Горячий лид

```
Title: [HOT] {Company} — {сигнал}
Priority: urgent
Labels: hot-lead, {ниша}, immediate-action
Assignee: CEO

## СРОЧНО
Время обнаружения: {timestamp}
Источник: {пост LinkedIn, Reddit, Google, вакансия}
Дословно: "{цитата}"

## Компания
{полные данные как в [LEAD]}

## Почему горячий
- {обоснование}
- Срочность: {оценка}

## План действий CEO
1. Telegram бот: "@Berik горячий лид — {Company}. Звони ASAP."
2. Sub-task Closer: экспресс-брифинг (15 мин)
3. Berik подтвердил → Closer делает брифинг
4. После звонка → Berik пишет комментарий
5. Закрыли → CEO создаёт Proposal Writer + Onboarding задачи
```

### [OUTREACH] Письмо SDR

```
Title: [OUTREACH] Письмо → {Contact} @ {Company}
Priority: {inherit}
Labels: outreach, email, {initial/follow-up-1/follow-up-2}
Assignee: SDR
Parent: {LEAD issue ID}

## Получатель
{имя, email, должность, компания}

## Контекст из Hunter
{копия "Контекст для SDR"}

## Письмо
- Тема: {subject}
- Тело: {text}
- Отправлено: {timestamp}

## Правила написания
- Максимум 5-7 предложений
- Первое предложение — про НИХ, не про AmriTech
- Конкретная боль от Hunter
- Один CTA: "15-minute call this week?"
- Подпись: Berik + AmriTech + телефон
- ЗАПРЕЩЕНО: "I noticed your company...", "As a leading MSP...", generic BS

## Follow-up
- Day 3: reply-to + value add (case study, статистика)
- Day 7: финальный, предложить альтернативу
- После day 7 без ответа: close task
```

### [TENDER] Госконтракт

```
Title: [TENDER] {RFP} — {описание}, ${сумма}k, дедлайн {дата}
Priority: high
Labels: gov-contract, {портал}, naics-{код}
Assignee: CEO

## Тендер
- Номер: {RFP/solicitation ID}
- Портал: {SAM.gov / NY Empire / NJ Treasury / NYC}
- URL: {ссылка}
- Публикация: {дата}
- Дедлайн: {дата и время}
- Дней до дедлайна: {N}

## Требования
- NAICS: {код}
- Set-aside: {SB / 8(a) / HUBZone / none}
- Сертификации: {нужны}
- Опыт: {минимум}
- Страховка: {требования}
- Security clearance: {если есть}

## Scope of Work
{3-5 строк}

## Оценка AmriTech
- Подходим: {да/нет/частично}
- Шансы: {высокие/средние/низкие}
- Обоснование: {почему}
- Риски: {что может помешать}
- Рекомендованная цена: ${range}

## Если CEO апрувит
1. CEO → "GO" + sub-task Legal: compliance check
2. Legal → проверка, compliance summary
3. CEO → sub-task Proposal Writer: полный пакет
4. Proposal Writer → capability statement + тех. предложение + цены
5. Telegram бот: "@Berik proposal готов к review — ${сумма}k"
6. Berik → review, правки, подача
7. Contract Manager → трек результата
```

### [RENEWAL] Продление контракта

```
Title: [RENEWAL] {Client} — ${MRR}/мес, renewal {дата}
Priority: high (30д) → urgent (7д)
Labels: renewal, {ниша}
Assignee: SDR

## Клиент
- Компания, контакт, клиент с {дата}, текущий MRR

## Контракт
- Тип, номер, даты, auto-renewal, notice period

## История обслуживания
- Тикетов за период, инциденты, satisfaction

## Рекомендации
- Upsell возможность
- Новая цена (если основания)
- Риск churn

## Действия
1. SDR → email про продление (за 30 дней)
2. Auto-renewal → информационное + upsell
3. Manual → письмо + обновлённый agreement
4. Нет ответа 7д → follow-up
5. Нет ответа 14д → "@Berik renewal {Client} молчит"
```

### [ONBOARD] Онбординг

```
Title: [ONBOARD] {Client} — старт {дата}, ${MRR}/мес
Priority: high
Labels: onboarding, {ниша}
Assignee: Onboarding Agent

## Клиент
{компания, контакт, ниша, размер, офис, контракт, MRR}

## Чеклист
- [ ] Welcome email
- [ ] ScreenConnect инструкция
- [ ] Credentials форма
- [ ] Первичный аудит чеклист (под ниша)
- [ ] "@Ula новый клиент {Company} — онбординг запущен"
- [ ] Telegram бот уведомление

## Welcome email
- Тон: тёплый, профессиональный
- Содержание: благодарность, план, контакты Ula, сроки

## После завершения
- Contract Manager → sub-task: контракт на учёт
- Finance Tracker → sub-task: трекинг инвойсов
```

### [INVOICE] Трекинг оплаты

```
Title: [INVOICE] {Client} — {месяц} {год}, ${amount}
Priority: normal → high (D+7) → urgent (D+14)
Labels: invoice, {sent/paid/overdue}
Assignee: Finance Tracker

## Инвойс
{номер, клиент, период, сумма, дата, payment terms}

## Эскалация (всё через CEO)
- День 7: sub-task SDR "вежливое напоминание"
- День 14: эскалация CEO (urgent comment) → CEO отправляет в Telegram "@Berik инвойс {Client} ${amount} просрочен 14 дней"
- Оплата: label paid, комментарий
```

### [BRIEFING] Брифинг Closer для Berik

```
Title: [BRIEFING] {Company} — звонок {дата/время}
Priority: high (обычный) | urgent (горячий лид)
Labels: briefing, {ниша}, {тип: cold/warm/hot}
Assignee: Closer
Parent: {LEAD или HOT issue ID}

## Компания
- Название: {name}
- Сайт: {url}
- Размер: {employees}
- Ниша: {тип бизнеса}
- Годовой доход (оценка): ${range}
- Местоположение: {город, штат}

## Decision Maker
- Имя: {name}
- Должность: {title}
- LinkedIn: {url}
- Стиль общения (по LinkedIn/Bio): {деловой/casual/технический}
- Предыдущий опыт: {релевантное из LinkedIn}

## Текущий IT
- Провайдер (если известен): {имя MSP или in-house}
- Сигналы проблем: {из досье Hunter — конкретные}
- Стек (если видно): {M365/Google, VPN, firewall brand, etc.}
- Последние IT-жалобы: {из отзывов, Glassdoor}

## Что предложить
- Primary service: {главная услуга под их боль}
- Secondary: {доп. услуги для upsell}
- Quick win: {что можно показать/сделать бесплатно для trust}
- Pricing: ${range}/мес — обоснование по размеру и нише

## Возражения и ответы
| Возможное возражение | Ответ |
|---|---|
| "У нас уже есть IT" | {конкретный ответ про их проблемы} |
| "Слишком дорого" | {value proposition + ROI} |
| "Мы маленькие, нам не нужно MSP" | {risk-based: что теряете без IT} |
| "Нужно подумать" | {urgency + free assessment offer} |

## Конкуренты в зоне
- {MSP конкуренты в их районе — если известны}
- Их слабые стороны: {из отзывов}

## Рекомендация Closer
- Тон звонка: {consultative/urgent/partnership}
- Главный hook: {одна фраза для открытия разговора}
- CTA звонка: {free assessment / pilot / meeting}
- Ожидаемая сделка: ${amount}/мес

## После звонка (Berik заполняет)
- Результат: {закрыли / перезвонить / отказ / думают}
- Дата перезвона: {если есть}
- Заметки: {что обсудили, что важно}
```

### [COMPLIANCE] Legal check

```
Title: [COMPLIANCE] {RFP/Client} — {тип проверки}
Priority: high
Labels: compliance, legal, {gov/private}
Assignee: Legal Assistant
Parent: {TENDER или ONBOARD issue ID}

## Объект проверки
- Тип: {госконтракт / частный клиент / renewal}
- Документ: {RFP номер / contract name}
- Дедлайн: {дата}

## Для госконтрактов — Compliance checklist
- [ ] SAM.gov registration active
- [ ] UEI number valid
- [ ] NAICS codes match requirements
- [ ] Set-aside eligibility confirmed
- [ ] Required certifications in place
- [ ] Insurance requirements met (general liability, cyber, workers comp)
- [ ] Bonding requirements (если есть)
- [ ] Past performance references available (мин 3)
- [ ] No debarment / exclusion (SAM check)
- [ ] State-specific registrations (NJ/NY/PA business license)
- [ ] Subcontracting plan (если >$750k)

## Для частных клиентов — Contract review
- [ ] MSA terms review (liability caps, indemnification)
- [ ] SLA terms realistic (response times, uptime guarantees)
- [ ] Payment terms acceptable (Net 30/45/60)
- [ ] Termination clause fair (notice period, penalties)
- [ ] NDA scope appropriate
- [ ] Data handling / privacy clauses
- [ ] Insurance requirements met
- [ ] NY/NJ law governing law clause

## Findings
- Risks: {список рисков}
- Blockers: {что мешает подаче/подписанию}
- Recommendations: {что исправить/добавить}

## Verdict
- GO / GO WITH CONDITIONS / NO-GO
- Условия (если GO WITH CONDITIONS): {список}
```

### [CONTRACT] Трекинг контракта (Contract Manager)

```
Title: [CONTRACT] {Client} — ${MRR}/мес, {тип}, до {дата}
Priority: normal
Labels: contract, {active/expiring/expired}, {ниша}
Assignee: Contract Manager

## Клиент
- Компания: {name}
- Контакт: {person, email, phone}
- Account Manager: Ula

## Контракт
- Тип: {MSA / retainer / per-incident / gov contract}
- Номер: {ID}
- Дата начала: {дата}
- Дата окончания: {дата}
- Auto-renewal: {да/нет}
- Notice period: {дней}
- MRR: ${amount}
- Payment terms: {Net 30/etc}

## Условия
- SLA: {response time, uptime}
- Scope: {covered services}
- Out-of-scope: {что не входит}
- Price escalation: {условия повышения цены}

## Renewal трекинг
- 60 дней до: review contract performance
- 30 дней до: создать [RENEWAL] задачу SDR
- 14 дней до: если нет ответа — эскалация CEO
- Дата renewal: {дата}

## История
- Тикетов: {count за период}
- Инцидентов: {крупные}
- Upsell: {что добавили}
- Жалобы: {если были}
```

### [REPORT] Еженедельный отчёт CEO

```
Title: [REPORT] Неделя {N} — {даты}
Priority: normal
Labels: report, weekly
Assignee: CEO

## Метрики
| Метрика | Факт | Цель |
|---|---|---|
| Новые лиды | {N} | 20 |
| Писем отправлено | {N} | 15 |
| Response rate | {%} | 5% |
| Звонков назначено | {N} | 2 |
| Тендеров найдено | {N} | 3/мес |
| MRR текущий | ${N} | трек $100k |
| Просроченных инвойсов | {N} | 0 |

## Пайплайн
- Активные лиды / В переговорах / Ожидают звонка / Готовы к подписи

## Что горит / Что сделано / План

## Telegram: "@Berik @Ula @Timur еженедельный отчёт: {summary}"
```

---

## 15. IT Audit Checklist (Onboarding Agent)

### 1. Инфраструктура
- Inventory оборудования (серверы, свитчи, AP, UPS, принтеры)
- Возраст и warranty status
- Rack/server room условия
- UPS/power protection
- ISP контракт и failover
- Cabling (Cat5e/6/6a)

### 2. Серверы и виртуализация
- Модели, OS, uptime, patch level
- Виртуализация (Hyper-V/VMware)
- Storage: RAID, free space, health
- AD/Domain: version, GPO
- DNS/DHCP config

### 3. Сеть
- Network diagram
- Firewall: модель, firmware, rules, VPN
- Switches: VLANs, PoE
- WiFi: coverage, isolation, guest
- Bandwidth test

### 4. Endpoints
- Workstations: count, OS, age
- Antivirus/EDR coverage
- Patch management
- Local admin rights
- BitLocker/encryption
- Asset tagging

### 5. Backup & DR
- Solution, schedule, retention
- Targets: local, cloud, offsite
- Last successful backup
- Test restore date
- DR plan documented/tested
- RPO/RTO

### 6. Security
- Firewall rules review
- MFA: where enabled
- Password policy
- Admin accounts audit
- Email filtering
- Security awareness
- Incident response plan

### 7. Cloud & Email
- M365/Google: plan, licenses
- Email: SPF/DKIM/DMARC
- OneDrive/SharePoint usage
- Azure AD / Entra
- SaaS inventory

### 8. Compliance (ниша-специфичное)
- PII/PHI/financial data classification
- Retention policies
- Audit logging
- Regulatory requirements

### 9. Документация
- Network diagram current
- Password vault
- Vendor contacts
- License inventory
- Change management
- Runbooks/SOPs

### 10. User Experience
- Common complaints
- Ticket volume/pattern
- Response time
- Satisfaction level

---

## 16. KPI Dashboard

| Метрика | Цель | Кто считает |
|---|---|---|
| Новые лиды/нед | 20+ | Hunter |
| Писем отправлено/нед | 15+ | SDR |
| Response rate | >5% | SDR |
| Звонков назначено/нед | 2+ | CEO |
| Конверсия звонок->клиент | >25% | CEO |
| Тендеров найдено/мес | 3+ | Gov Scout |
| MRR текущий | трек к $100k | Finance Tracker |
| Просроченных инвойсов | 0 | Finance Tracker |
| Renewals вовремя | 100% | Contract Manager |

---

## 17. Business Flows

### Флоу 1 — Частный клиент (от нуля до денег)

```
Hunter (каждые 6ч) → находит лида → sub-task SDR
SDR → персонализированное письмо → follow-up D3, D7
Лид ответил → CEO → Telegram "@Berik" → sub-task Closer
Closer → брифинг Berik за 30 мин
BERIK звонит, комментирует результат
Закрыто: CEO → Proposal Writer + Onboarding параллельно
         Proposal Writer → MSA + service agreement
         Onboarding → welcome пакет
         Contract Manager → на учёт
         Finance Tracker → инвойсы
"Перезвонить": SDR → follow-up → Closer обновляет брифинг
```

### Флоу 2 — Госконтракт

```
Gov Scout (утро) → тендер → CEO
CEO → Telegram "@Berik тендер $Xk, дедлайн Y"
BERIK апрувит
Legal → compliance check
Proposal Writer → capability statement + тех. предложение + цены
BERIK → review, правки, подаёт
Contract Manager → трек исполнения
```

### Флоу 3 — Hands & Feet

```
Hunter → компания с IT в другой стране / вакансия IT support NJ
Sub-task SDR с пометкой "Hands & Feet"
SDR → "Мы не заменяем вашу IT команду — мы её физические руки в NJ/NY"
Ответили → Closer → Berik → ретейнер
```

### Флоу 4 — Горячий лид

```
Hunter → видит "ищем IT провайдера" → [HOT] CEO urgent
CEO → Telegram "@Berik горячий лид. ASAP." → sub-task Closer
Closer → брифинг за 15 мин
BERIK звонит пока горячо
```

### Флоу 5 — Renewal клиента

```
Contract Manager (за 30 дней) → CEO
SDR → письмо клиенту про продление
Proposal Writer → обновлённое предложение
Не платят D7 → SDR напоминает
Не платят D14 → "@Berik"
```

---

## 18. Future Integrations (после найма агентов)

- **Gmail MCP** — SDR отправляет письма, Onboarding отправляет welcome пакеты
- **Telegram MCP** — CEO эскалирует в общий бот с @упоминаниями
- **Twilio MCP** — Closer может оставлять voicemail
- **Web search MCP** — Hunter скрапит Google Maps, LinkedIn, SAM.gov
- **CRM интеграция** — агенты синхронизируют лидов с CRM
- **Reputation Manager** (настроить позже) — мониторинг отзывов

---

*AmriTech AI HQ v2.0 — Дизайн документ*
*Март 2026*
