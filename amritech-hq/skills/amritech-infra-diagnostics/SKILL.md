---
name: amritech-infra-diagnostics
description: Infrastructure diagnostics checklists for IT Chef — how to check and fix each service
---

# AmriTech Infrastructure Diagnostics

## Quick Health Check (все сервисы за 30 секунд)

```bash
echo "=== Paperclip ===" && curl -s http://localhost:4444/api/health | head -1 || echo "DOWN"
echo "=== Twenty CRM ===" && curl -s http://localhost:5555/healthz | head -1 || echo "DOWN"
echo "=== CRM Sync ===" && curl -s http://localhost:3089/health | head -1 || echo "DOWN"
echo "=== TG Webhook ===" && curl -s http://localhost:3088/health | head -1 || echo "DOWN"
echo "=== Docker ===" && docker ps --format "{{.Names}}: {{.Status}}"
echo "=== Watchdog ===" && pgrep -f watchdog.sh > /dev/null && echo "OK" || echo "DOWN"
```

## Сервис: Paperclip (порт 4444)

**Health:** `curl http://localhost:4444/api/health`
**Логи:** stdout (если запущен через watchdog, нет файла логов)
**Как запускается:** `cd /Users/timur/paperclip && pnpm dev:once`
**Частые проблемы:**
- "Process lost — server may have restarted" → watchdog перезапустил, агенты потеряли контекст. Нормально, сами перезапустятся.
- tsx watch mode → ЗАПРЕЩЁН в production. Только `dev:once`.
- Порт занят → `lsof -i :4444` → kill → restart

## Сервис: Twenty CRM (порт 5555)

**Health:** `curl http://localhost:5555/healthz`
**Docker:** `docker ps --filter name=twenty`
**Логи:** `docker logs twenty-server-1 --tail 50`
**Compose:** `/Users/timur/paperclip/twenty-crm/docker-compose.yml`

**Перезапуск:**
```bash
cd /Users/timur/paperclip/twenty-crm && docker compose restart
```

**Частые проблемы:**
- Server unhealthy → check DB: `docker logs twenty-db-1 --tail 20`
- "duplicate key" → stale data, нужна чистка
- Медленные запросы → check Redis: `docker logs twenty-redis-1`

## Сервис: CRM Sync (порт 3089)

**Health:** `curl http://localhost:3089/health`
**Логи:** `/tmp/crm-sync.log`
**Код:** `/Users/timur/paperclip/mcp-servers/crm-sync/index.js`

**Перезапуск:** Watchdog сделает автоматом. Или вручную:
```bash
kill $(lsof -ti :3089); sleep 2
# Watchdog поднимет через ~60 сек
```

**Частые проблемы:**
- GraphQL error → check Twenty CRM is running
- "Failed to create lead" → check lead data format
- Не парсит описание → формат задачи Hunter'а изменился

## Сервис: Telegram Webhook (порт 3088)

**Health:** `curl http://localhost:3088/health`
**Логи:** `/tmp/telegram-webhook.log`
**Код:** `/Users/timur/paperclip/mcp-servers/telegram-webhook/index.js`

**Частые проблемы:**
- SyntaxError → JS код сломан, проверь: `node --check index.js`
- Agents not found → Paperclip down или агенты не загружены
- Webhook не получает сообщения → проверь Cloudflare tunnel: `pgrep cloudflared`

## Сервис: Email (IONOS)

**SMTP:** smtp.ionos.com:587 (STARTTLS)
**IMAP:** imap.ionos.com:993 (TLS)
**Account:** agent@yourcompany.example.com

**Проверка SMTP:**
```bash
curl -v --connect-timeout 10 smtp://smtp.ionos.com:587 2>&1 | head -10
```

**Проверка IMAP:**
```bash
curl --connect-timeout 10 imaps://imap.ionos.com:993 --user "agent@yourcompany.example.com:PASSWORD" -X "EXAMINE INBOX" 2>&1 | tail -10
```

**Частые проблемы:**
- Connection refused → IONOS down (внешняя проблема, ждать)
- Auth failed → пароль изменился, проверь `.claude.json` и `agent-mcp-config.json`

## Сервис: Watchdog

**PID:** `pgrep -f watchdog.sh`
**Логи:** `/tmp/paperclip-watchdog.log`
**Код:** `/Users/timur/paperclip/scripts/watchdog.sh`
**launchd:** `com.amritech.paperclip-watchdog`

**Перезапуск:**
```bash
launchctl kickstart -kp system/com.amritech.paperclip-watchdog
```

## Paperclip API — Skills Management

**Правильный endpoint для привязки скиллов к агентам:**

```bash
# Получить текущие скиллы агента
curl -s "http://localhost:4444/api/agents/{AGENT_ID}/skills"
# → { desiredSkills: [...], entries: [...] }

# Привязать скиллы (POST /skills/sync, НЕ PUT!)
curl -s -X POST "http://localhost:4444/api/agents/{AGENT_ID}/skills/sync" \
  -H "Content-Type: application/json" \
  -d '{"desiredSkills": ["existing/skill/key", "new/skill/key"]}'
```

**ВАЖНО:** Используй POST `/skills/sync`, не PUT. PUT не существует!

**Получить список всех скиллов компании:**
```bash
curl -s "http://localhost:4444/api/companies/{COMPANY_ID}/skills"
```

**Импортировать новый скил из local path:**
```bash
curl -s -X POST "http://localhost:4444/api/companies/{COMPANY_ID}/skills/import" \
  -H "Content-Type: application/json" \
  -d '{"source": "/path/to/skill/directory"}'
```

**Ключи скиллов (формат):**
- Local: `local/{hash}/slug`
- Company: `company/{company-id}/slug`
- GitHub: `owner/repo/slug`

**Agent IDs (AmriTech):**
| Агент | ID |
|-------|-----|
| CEO | AGENT_UUID_CEO |
| Hunter | AGENT_UUID_HUNTER |
| SDR | AGENT_UUID_SDR |
| Closer | AGENT_UUID_CLOSER |
| Staff Manager | AGENT_UUID_STAFF_MGR |
| Contract Manager | AGENT_UUID_CONTRACT_MGR |
| Finance Tracker | AGENT_UUID_FINANCE |
| Proposal Writer | AGENT_UUID_PROPOSAL |
| Legal | AGENT_UUID_LEGAL |
| Gov Scout | AGENT_UUID_GOV_SCOUT |
| Onboarding | AGENT_UUID_ONBOARDING |

**Company ID:** YOUR_COMPANY_ID

---

## CRM Diagnostics

**Все лиды:**
```graphql
{ leads { edges { node { id name status outreachStatus lastContactDate decisionMakerEmail } } } }
```

**Broken state (email sent but CRM not updated):**
```graphql
{ leads(filter: { status: { eq: "new" }, outreachStatus: { eq: "pending" } }) { edges { node { id name } } } }
```

**Дубли:** Query all leads, group by name, flag duplicates.

**Fix lead status:**
```graphql
mutation { updateLead(id: "UUID", data: { status: "contacted", outreachStatus: "email_sent" }) { id name } }
```
