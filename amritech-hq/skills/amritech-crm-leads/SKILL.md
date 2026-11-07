---
name: amritech-crm-leads
description: Twenty CRM Lead management — create, update, search, and track outreach status for AmriTech leads
---

# Twenty CRM Lead Management

Twenty CRM доступен через MCP (twenty-crm). Лиды хранятся в кастомном объекте `Lead`.

## Lead Object Fields

| Поле | Тип | Описание |
|------|-----|----------|
| name | String | Название компании (обязательно) |
| companyName | String | = name |
| industry | String | Ниша: "Dental", "Law", "CPA", "CRE", "Auto Dealer", "Medical" |
| location | String | "City, State" или развёрнутый адрес |
| website | Links | { primaryLinkUrl: "https://..." } |
| employeeCount | Float | Кол-во сотрудников |
| icpScore | Float | ICP Score 0-100 |
| fitScore | Float | Fit Score 0-100 |
| intentScore | Float | Intent Score 0-100 |
| estimatedMrr | Currency | { amountMicros: N, currencyCode: "USD" } |
| currentIt | String | Текущий IT провайдер или "Unknown" |
| decisionMaker | String | ФИО decision maker'а |
| decisionMakerEmail | String | Email DM |
| decisionMakerPhone | String | Телефон DM |
| decisionMakerLinkedin | Links | LinkedIn URL |
| decisionMakerSource | String | Источник данных DM |
| signals | String | Список сигналов (текст) |
| signalCount | Float | Количество сигналов |
| signalSources | String | URLs источников сигналов |
| source | String | "Hunter Agent" |
| status | String | Статус лида (см. ниже) |
| outreachStatus | String | Статус outreach (см. ниже) |
| lastContactDate | DateTime | Дата последнего контакта |
| notes | String | Заметки |

## Lead Statuses

| status | Описание |
|--------|----------|
| new | Только создан, не обработан |
| qualified | Квалифицирован, готов к outreach |
| contacted | Первый email отправлен |
| engaged | Получили ответ |
| meeting_set | Звонок/встреча назначена |
| closed_won | Стал клиентом |
| closed_lost | Отказ |
| nurture | На паузе, пересканить через 30 дней |

## Outreach Statuses

| outreachStatus | Описание |
|----------------|----------|
| pending | Ждёт первый email |
| email_sent | Day 0 — отправлен первый email |
| follow_up_1 | Day 3 — отправлен первый follow-up |
| follow_up_2 | Day 7 — отправлен второй follow-up |
| replied_interested | Положительный ответ |
| replied_question | Вопрос от лида |
| replied_objection | Возражение |
| not_interested | Отказ |
| no_response | Нет ответа после всех follow-up |
| meeting_scheduled | Встреча назначена |

## GraphQL Примеры

### Создать лид
```graphql
mutation {
  createLead(data: {
    name: "Company Name"
    companyName: "Company Name"
    industry: "Dental"
    location: "Brooklyn, NY"
    employeeCount: 25
    icpScore: 65
    decisionMaker: "John Smith"
    decisionMakerEmail: "john@company.com"
    decisionMakerPhone: "718-555-1234"
    currentIt: "Unknown"
    source: "Hunter Agent"
    status: "new"
    outreachStatus: "pending"
  }) { id name }
}
```

### Найти лид по имени
```graphql
query {
  leads(filter: { name: { like: "%Company%" } }) {
    edges { node { id name status outreachStatus } }
  }
}
```

### Обновить статус после отправки email
```graphql
mutation {
  updateLead(id: "UUID", data: {
    outreachStatus: "email_sent"
    status: "contacted"
    lastContactDate: "2026-03-22T10:00:00Z"
    notes: "Day 0: Initial email sent. Subject: your IT setup"
  }) { id name outreachStatus }
}
```

### Обновить после ответа
```graphql
mutation {
  updateLead(id: "UUID", data: {
    outreachStatus: "replied_interested"
    status: "engaged"
    lastContactDate: "2026-03-23T14:00:00Z"
    notes: "Replied: interested in meeting next week"
  }) { id name outreachStatus }
}
```

### Найти лиды для follow-up
```graphql
query {
  leads(filter: {
    outreachStatus: { eq: "email_sent" }
    lastContactDate: { lt: "2026-03-20T00:00:00Z" }
  }) {
    edges { node { id name decisionMakerEmail lastContactDate } }
  }
}
```

### Найти лид по email (для IMAP reply matching)
```graphql
query {
  leads(filter: { decisionMakerEmail: { eq: "john@company.com" } }) {
    edges { node { id name decisionMaker outreachStatus lastContactDate notes } }
  }
}
```

### Day 3 follow-ups due (SDR: запускай каждый heartbeat)
```graphql
query {
  leads(filter: {
    outreachStatus: { eq: "email_sent" }
    lastContactDate: { lt: "2026-03-19T00:00:00Z" }
  }) {
    edges { node { id name decisionMaker decisionMakerEmail lastContactDate notes } }
  }
}
```
*Замени дату на "3 рабочих дня назад от сегодня".*

### Day 7 follow-ups due
```graphql
query {
  leads(filter: {
    outreachStatus: { eq: "follow_up_1" }
    lastContactDate: { lt: "2026-03-15T00:00:00Z" }
  }) {
    edges { node { id name decisionMaker decisionMakerEmail lastContactDate } }
  }
}
```

### Stale leads (14+ дней без действий)
```graphql
query {
  leads(filter: {
    status: { eq: "contacted" }
    lastContactDate: { lt: "2026-03-08T00:00:00Z" }
  }) {
    edges { node { id name lastContactDate outreachStatus } }
  }
}
```

### Leads awaiting human decision (для demand escalation)
```graphql
query {
  leads(filter: {
    outreachStatus: { in: ["replied_interested", "replied_question"] }
  }) {
    edges { node { id name decisionMaker lastContactDate } }
  }
}
```

### Bulk: все лиды с broken state (отправлен email но CRM не обновлён)
```graphql
query {
  leads(filter: {
    status: { eq: "new" }
    outreachStatus: { eq: "pending" }
  }) {
    edges { node { id name decisionMakerEmail lastContactDate } }
  }
}
```
*Если лид в `new/pending` но ему уже отправлен email — это broken state. Обнови CRM!*

### Update после каждого follow-up (Day 3)
```graphql
mutation {
  updateLead(id: "UUID", data: {
    outreachStatus: "follow_up_1"
    lastContactDate: "2026-03-25T09:00:00Z"
    notes: "Day 3: Follow-up sent. New angle: {description}. Subject: Re: {original subject}"
  }) { id name outreachStatus }
}
```

### Update после follow-up Day 7
```graphql
mutation {
  updateLead(id: "UUID", data: {
    outreachStatus: "follow_up_2"
    lastContactDate: "2026-03-29T09:00:00Z"
    notes: "Day 7: Final follow-up sent. Gracious close."
  }) { id name outreachStatus }
}
```

### Mark cold after no response
```graphql
mutation {
  updateLead(id: "UUID", data: {
    outreachStatus: "no_response"
    status: "nurture"
    notes: "No response after 3 emails. Marked cold. Rescan in 90 days."
  }) { id name status }
}
```

### Pipeline summary query (для CEO report)
```graphql
query {
  leads { edges { node { status outreachStatus } } }
}
```
*Group by status/outreachStatus в коде для подсчёта.*

---

## Правила

1. **ВСЕГДА обновляй CRM после действия** — отправил email → обнови outreachStatus + lastContactDate
2. **Не дублируй лиды** — перед созданием проверь по имени компании
3. **Notes — append, не перезаписывай** — добавляй новые записи к существующим
4. **Без email лид бесполезен** — если нет email DM, поставь задачу Hunter'у на enrichment
5. **Auto-sync работает** — CRM sync сервис автоматически создаёт Lead из [LEAD] задач в Paperclip. Но обновлять статусы outreach — обязанность SDR.
