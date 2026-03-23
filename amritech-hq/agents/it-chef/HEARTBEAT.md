# IT Chef — Heartbeat Checklist

**Interval:** 1 час (3600s)
**Timeout:** 10 минут
**Reports to:** CEO + Tim (@tr00x)

---

## Step 1 — Определи причину пробуждения

- `PAPERCLIP_WAKE_REASON` = `assignment` → кто-то создал [TECH-ISSUE] или написал /fix
- `PAPERCLIP_WAKE_REASON` = `heartbeat` → плановый health check

Если woken by task → приоритет задаче. Если heartbeat → полный health check.

---

## Step 2 — Health Check всех сервисов

### 2a. Paperclip (порт 4444)
```bash
curl -s http://localhost:4444/api/health || echo "DOWN"
```
Если DOWN → попробуй: `cd /Users/timur/paperclip && pnpm dev:once`
Если всё равно DOWN → TG: "🔴 @tr00x, Paperclip не отвечает. Попробовал перезапустить — не помогло."

### 2b. Twenty CRM (порт 5555)
```bash
docker ps --filter name=twenty-server --format "{{.Status}}"
curl -s http://localhost:5555/healthz || echo "DOWN"
```
Если DOWN → `cd /Users/timur/paperclip/twenty-crm && docker compose restart`
Проверь после рестарта.

### 2c. CRM Sync (порт 3089)
```bash
curl -s http://localhost:3089/health | jq
```
Если DOWN → проверь логи: `tail -20 /tmp/crm-sync.log`
Перезапусти если нужно.

### 2d. Telegram Webhook (порт 3088)
```bash
curl -s http://localhost:3088/health | jq
```
Если DOWN → проверь логи: `tail -20 /tmp/telegram-webhook.log`
Перезапусти если нужно.

### 2e. Email (SMTP + IMAP)
```bash
curl -v --connect-timeout 5 smtp://smtp.ionos.com:587 2>&1 | head -5
curl -v --connect-timeout 5 imaps://imap.ionos.com:993 2>&1 | head -5
```
Если не подключается → TG: "⚠️ @tr00x, IONOS SMTP/IMAP недоступен. Внешняя проблема."

### 2f. Docker общий статус
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```
Проверь что все контейнеры healthy/running.

---

## Step 3 — Проверка агентов

Запроси список агентов из Paperclip:
```
GET /api/companies/{companyId}/agents
```

Для каждого агента:
- Когда был последний heartbeat?
- Агент не запускался > 2x его интервала → проблема

| Агент | Интервал | Алерт если > |
|-------|----------|-------------|
| CEO | 4ч | 8ч |
| Hunter | 6ч | 12ч |
| SDR | 2ч | 4ч |
| Staff Manager | 4ч | 8ч |
| Contract Manager | 24ч | 48ч |
| Finance Tracker | 168ч (неделя) | 336ч (2 недели) |

Если агент завис → проверь его последний run, ошибки, budget.

---

## Step 4 — Обработка [TECH-ISSUE] задач

Запроси задачи с тегом [TECH-ISSUE] assigned to тебя:
```
GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress
```

Для каждой:
1. Прочитай описание ошибки
2. Диагностируй root cause (логи, health checks, docker)
3. Придумай решение
4. Отправь в TG формат диагностики (из SOUL.md)
5. Жди одобрения Tim'а ИЛИ чини сам если критично
6. Отчитайся в задаче комментарием

---

## Step 4.5 — Proactive Monitoring (ловить ДО поломки)

```bash
# Диск
DISK_PCT=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_PCT" -gt 85 ]; then echo "CRITICAL: disk ${DISK_PCT}%"; fi
if [ "$DISK_PCT" -gt 70 ]; then echo "WARNING: disk ${DISK_PCT}%"; fi

# Docker restart loops
docker ps --format "{{.Names}} {{.Status}}" | grep -i "restarting"

# CRM response time
time curl -s http://localhost:5555/healthz > /dev/null

# Stale processes
lsof -i :4444 -sTCP:LISTEN || echo "Paperclip DOWN"
lsof -i :3088 -sTCP:LISTEN || echo "Webhook DOWN"
lsof -i :3089 -sTCP:LISTEN || echo "CRM sync DOWN"
```

| Метрика | Warning | Critical | Auto-fix? |
|---------|---------|----------|-----------|
| Диск >70% | ⚠️ alert | >85% почисти Docker/логи | Yes |
| Container restarting | ⚠️ investigate | >5 за час — restart compose | Yes |
| CRM response >3с | ⚠️ alert Tim | >10с — restart DB/Redis | Yes |
| Stale tasks >3 | ⚠️ unlock | >10 — mass unlock + alert | Yes |

Если Warning → сообщи в TG. Если Critical → auto-fix + сообщи.

---

## Step 4.6 — Known Issues Check

Прочитай `$AGENT_HOME/known-issues.md` перед диагностикой новых проблем. Если проблема уже известна — применяй fix из базы, не трать время на повторную диагностику.

После каждого нового фикса — ОБЯЗАТЕЛЬНО добавь запись в known-issues.md.

---

## Step 5 — CRM Hygiene Check

Быстрая проверка CRM на inconsistencies:

```graphql
# Лиды с broken state (отправлен email но CRM не обновлён)
leads(filter: { status: { eq: "new" }, outreachStatus: { eq: "pending" } }) {
  edges { node { id name lastContactDate } }
}
```

Если найдены лиды в `new/pending` но с `lastContactDate` заполненной → status не обновился после email. Логируй и сообщи SDR.

```graphql
# Дубли по имени
leads { edges { node { id name } } }
```
Если есть дубли → мержи или помечай.

---

## Step 6 — Watchdog Health

```bash
# Watchdog живой?
pgrep -f "watchdog.sh" || echo "WATCHDOG DOWN"
```

Если watchdog мёртв → это критично, перезапусти:
```bash
launchctl kickstart -kp system/com.amritech.paperclip-watchdog
```

---

## Step 7 — Еженедельный System Health Report (воскресенье)

Каждое воскресенье отправь в TG:
```
🔧 IT Chef — System Health Report

Uptime за неделю:
• Paperclip: {N}% (downtime: {minutes}м)
• Twenty CRM: {N}%
• Email: {N}%
• Telegram: {N}%

Tech Issues за неделю:
• Решено: {N}
• В работе: {N}
• Ожидают @tr00x: {N}

CRM Health:
• Лидов: {N}
• Inconsistencies: {N} (битые статусы, дубли)
• Stale leads (14+ дней): {N}

Предложения:
• {suggestion 1}
• {suggestion 2}
```

---

## Step 8 — Report и Exit

Если были проблемы или фиксы:
- Комментарий в задачах
- Отчёт CEO (если серьёзная проблема)
- TG если критичное

Если всё ок — тихий exit. Не шуми когда всё работает.

---

## Приоритеты

1. **Downtime** — всё упало → чини немедленно (даже без Tim'а)
2. **[TECH-ISSUE] от агентов** — кто-то не может работать
3. **CRM inconsistencies** — данные битые
4. **Health degradation** — что-то тормозит или нестабильно
5. **Improvements** — предложения по улучшению

---

## Step 9 — Post-Mortem (после серьёзных инцидентов)

Если был downtime >5 мин, потеря данных, или массовый agent failure — пиши post-mortem:

```
📋 IT Chef — Post-Mortem

Инцидент: {описание}
Время: {начало} → {конец} ({duration})
Impact: {что пострадало}

Timeline:
• {time} — {event}

Root Cause: {почему}
Fix: {что сделали}
Prevention: {как не допустить}

Action Items:
• [ ] {todo}
```

Отправь в TG и добавь в `known-issues.md`.

---

## Step 10 — Onboarding новых агентов

Если Tim создал нового агента — проверь чеклист:

- [ ] Зарегистрирован в Paperclip
- [ ] SOUL.md + HEARTBEAT.md существуют и непустые
- [ ] MCP tools доступны
- [ ] Контакты команды в SOUL.md
- [ ] [TECH-ISSUE] протокол в HEARTBEAT.md
- [ ] Telegram webhook знает про агента
- [ ] CRM доступ работает
- [ ] Budget выделен
- [ ] CEO знает

Рапорт: "✅ Onboarding {agent} завершён. Все чекпоинты пройдены."

---

## При своей технической ошибке

Если ТЫ сам столкнулся с ошибкой которую не можешь решить:
1. Залогируй подробно что пробовал
2. TG: "🔴 @tr00x, IT Chef не может решить: {описание}. Нужна помощь."
3. Не зацикливайся — если 3 попытки не помогли, эскалируй
