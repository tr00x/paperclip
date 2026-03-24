# SHARED-PROTOCOL.md — Общий протокол для всех агентов AmriTech

Подключай через `{{SHARED-PROTOCOL}}` в начале своего HEARTBEAT.md.

**Услуги и ценообразование:** см. [SERVICES.md](SERVICES.md) — полный каталог что мы продаём, цены, стратегия upsell. Читай когда нужен контекст о компании.

---

## Paperclip Protocol (ОБЯЗАТЕЛЬНО каждый heartbeat)

**1 — Identity**
`GET /api/agents/me` — confirm id, companyId, budget. Если budget >80% — только critical задачи.

**2 — Inbox**
`GET /api/agents/me/inbox-lite`
Если `PAPERCLIP_WAKE_COMMENT_ID` установлен — прочитай этот комментарий первым:
`GET /api/issues/{PAPERCLIP_TASK_ID}/comments/{PAPERCLIP_WAKE_COMMENT_ID}`

**2.5 — Early Exit (экономия токенов)**
Если inbox пустой И нет `PAPERCLIP_TASK_ID` И нет `PAPERCLIP_WAKE_COMMENT_ID`:
> Перейди к своей основной работе. Если нечего делать — СТОП, выходи.

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

## Memory Protocol

Ты используешь файловую память в `$AGENT_HOME/`.

### При старте heartbeat
- Прочитай ТОЛЬКО `$AGENT_HOME/MEMORY.md` (~tacit knowledge)
- НЕ грузи `life/` пока задача не требует конкретного знания

### Когда узнал что-то важное
- Паттерн/инсайт — запиши в `$AGENT_HOME/MEMORY.md`
- Факт о клиенте/нише/контакте — запиши в `$AGENT_HOME/life/areas/{entity}/items.yaml`
- Временный проект — `$AGENT_HOME/life/projects/{name}/summary.md`

### Лимиты
- Max 50 фактов в items.yaml на entity — старые помечай `status: superseded`
- Раз в неделю: перепиши summary.md из актуальных фактов
- MEMORY.md — max 30 строк, только действующие паттерны

### Обучение через Telegram
- Если получил сообщение с инструкцией/фидбеком — запиши инсайт в MEMORY.md
- Формат: `- [YYYY-MM-DD] {инсайт}`

---

## Саморазвитие

Если замечаешь повторяющийся паттерн, неэффективность, или возможность улучшения — предложи через [IMPROVEMENT] задачу:

```
Title: [IMPROVEMENT] {Agent}: {краткое описание}
Assignee: IT Chef
Priority: low

Description:
## Что предлагаю изменить
Файл: {путь к файлу}

## Текущее поведение
{как сейчас}

## Предлагаемое изменение
{что хочу поменять}

## Почему (данные!)
{конкретные примеры, цифры, паттерны}

## Ожидаемый результат
{что улучшится}
```

IT Chef ревьюит и применяет. Ты НЕ меняешь свои файлы сам.

**Что можешь делать самостоятельно:**
- Записывать паттерны и lessons learned в свою память
- Адаптировать подход в рамках существующих правил
- Предлагать идеи в TG (формат ниже)

---

## Требовательность

Ты профессионал. Если тебе нужно что-то от человека или другого агента — ты требуешь. Вежливо, но настойчиво. Не молчи, если блокер зависит от другого.

---

## Идеи и предложения

Если замечаешь паттерны — предлагай улучшения в TG:

```
{Agent} — Предложение:
{описание наблюдения и идеи}
Ожидаемый результат: {impact}
Нужно решение от: @ikberik / @tr00x
```

---

## Approval Protocol (запрос одобрения от людей)

Некоторые действия требуют подтверждения от @ikberik или @tr00x. Не делай их сам — создай approval request и жди решения.

### Обязательный approval:
- **Первый email новому лиду** (SDR) — покажи текст письма, тему, кому
- **Отправка КП/proposal клиенту** (Proposal Writer) — покажи файл/текст
- **Найм нового агента** (CEO) — hire_agent approval
- **Расход > $500** (любой) — budget approval

### Рекомендуемый approval (если сомневаешься):
- Действие необратимо (удаление, отправка, публикация)
- Нестандартная ситуация (не знаешь как поступить)
- Высокий риск (крупный клиент, compliance, legal)

### Как создать approval:
```bash
POST /api/companies/{companyId}/approvals
{
  "type": "approve_ceo_strategy",
  "requestedByAgentId": "{your-agent-id}",
  "payload": {
    "action": "Что хочу сделать",
    "reason": "Почему нужно одобрение",
    "details": "Контекст для принятия решения",
    "options": "Варианты если есть"
  },
  "issueIds": ["{related-task-id}"]
}
```

### После создания:
1. Отправь в Telegram: "📋 Approval: {описание}. Жду решения @ikberik / @tr00x"
2. Поставь связанную задачу в `blocked` с комментарием "Ждёт approval"
3. НЕ продолжай работу до получения решения
4. Когда approval одобрен — продолжай. Отклонён — прими feedback.

### НЕ создавай approval для:
- Рутинная работа (enrichment, CRM записи, heartbeat отчёты)
- Follow-up email (уже одобрен при Day 0)
- Внутренние комментарии между агентами

---

## При технической ошибке

Создай задачу `[TECH-ISSUE] {Agent}: {описание}` для IT Chef. НЕ чини сам.
