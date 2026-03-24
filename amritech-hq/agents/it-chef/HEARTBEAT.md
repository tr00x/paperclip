# IT Chef — Heartbeat Checklist

> Общий протокол: см. [SHARED-PROTOCOL.md](../SHARED-PROTOCOL.md)

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
Если всё равно DOWN → TG: "@tr00x, Paperclip не отвечает. Попробовал перезапустить — не помогло."

### 2b. Twenty CRM (порт 5555)
```bash
docker ps --filter name=twenty-server --format "{{.Status}}"
curl -s http://localhost:5555/healthz || echo "DOWN"
```
Если DOWN → `cd /Users/timur/paperclip/twenty-crm && docker compose restart`

### 2c. CRM Sync (порт 3089)
```bash
curl -s http://localhost:3089/health | jq
```
Если DOWN → проверь логи: `tail -20 /tmp/crm-sync.log`. Перезапусти если нужно.

### 2d. Telegram Webhook (порт 3088)
```bash
curl -s http://localhost:3088/health | jq
```
Если DOWN → проверь логи: `tail -20 /tmp/telegram-webhook.log`. Перезапусти если нужно.

### 2e. Email (SMTP + IMAP)
```bash
curl -v --connect-timeout 5 smtp://smtp.ionos.com:587 2>&1 | head -5
curl -v --connect-timeout 5 imaps://imap.ionos.com:993 2>&1 | head -5
```
Если не подключается → TG: "@tr00x, IONOS SMTP/IMAP недоступен. Внешняя проблема."

### 2f. Docker общий статус
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

## Step 3 — Проверка агентов

```
GET /api/companies/{companyId}/agents
```

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
| Диск >70% | alert | >85% почисти Docker/логи | Yes |
| Container restarting | investigate | >5 за час — restart compose | Yes |
| CRM response >3с | alert Tim | >10с — restart DB/Redis | Yes |
| Stale tasks >3 | unlock | >10 — mass unlock + alert | Yes |

---

## Step 4.6 — Known Issues Check

Перед диагностикой новых проблем — проверь известные инциденты через para-memory-files skill. Если проблема уже известна — применяй fix из базы.

После каждого нового фикса — ОБЯЗАТЕЛЬНО сохрани инцидент через para-memory-files skill.

---

## Step 5 — Watchdog Health

```bash
pgrep -f "watchdog.sh" || echo "WATCHDOG DOWN"
```
Если мёртв → `launchctl kickstart -kp system/com.amritech.paperclip-watchdog`

---

## Step 6 — Report и Exit

Если были проблемы или фиксы → комментарий в задачах, отчёт CEO, TG если критичное.
Если всё ок — тихий exit. Не шуми когда всё работает.

**Приоритеты:** Downtime (немедленно) → [TECH-ISSUE] → CRM inconsistencies → Health degradation → Improvements

---

## Step 7 — Еженедельный System Health Report (воскресенье)

Каждое воскресенье: uptime % по сервисам, tech issues (решено/в работе/ждут), CRM health, предложения. Формат в SOUL.md.

---

## Step 8 — Post-Mortem (downtime >5 мин, потеря данных, mass agent failure)

Формат: Инцидент → Timeline → Root Cause → Fix → Prevention → Action Items.
Отправь в TG и добавь в `known-issues.md`.

---

## Step 9 — Onboarding новых агентов

Чеклист: Paperclip registered, SOUL+HEARTBEAT exist, MCP tools ok, contacts added, TG webhook mapped, CRM access, budget, CEO notified.

---

## Memory Protocol
> См. [SHARED-PROTOCOL.md](../SHARED-PROTOCOL.md) → Memory Protocol
