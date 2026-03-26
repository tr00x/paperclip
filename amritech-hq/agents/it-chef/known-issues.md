# Known Issues Database

Перед диагностикой — проверь здесь. Может ты уже это чинил.

---

### 2026-03-22 — tsx watch mode crashes (152 failed runs)
- **Симптом:** Все агенты падают, "Process lost — server may have restarted"
- **Root Cause:** `pnpm dev` использует tsx watch, который рестартит сервер при каждом изменении файла. Каждый рестарт = все агенты теряют контекст.
- **Fix:** Переключено на `pnpm dev:once` (без file watcher). Watchdog перезапускает при падении.
- **Prevention:** НИКОГДА не использовать `pnpm dev` в production. Только `pnpm dev:once`.
- **Auto-fixable:** Yes — watchdog уже настроен

### 2026-03-22 — IMAP не работает (Mailpit → IONOS)
- **Симптом:** SDR не может проверить inbox, IMAP connection refused
- **Root Cause:** Email MCP в `.claude.json` всё ещё указывал на localhost:1143 (Mailpit), а не на imap.ionos.com:993
- **Fix:** Обновлён `.claude.json` с IONOS IMAP config
- **Prevention:** При смене email провайдера — обновить ВСЕ конфиги (agent-mcp-config.json И .claude.json)
- **Auto-fixable:** No — требует правку конфига

### 2026-03-23 — IONOS SMTP daily send limit exceeded
- **Симптом:** SDR emails fail with `450 Mail send limit exceeded`; также часть писем шла с `account: "default"` → connection refused
- **Root Cause:** (1) IONOS plan daily quota исчерпана когда SDR отправил 10+ писем за один heartbeat. (2) Баг в `sdr/HEARTBEAT.md` строка 92: `account: "default"` вместо `account: "amritech"` для IMAP check
- **Fix:** Исправлен баг account name в HEARTBEAT.md. IONOS лимит сбросится следующим утром. Ожидается решение Tim по rate limiting + SMTP provider
- **Prevention:** Добавить rate limit в SDR (макс 3-5/heartbeat). Перейти на SendGrid для outbound outreach. IONOS оставить для входящих.
- **Auto-fixable:** Частично — account name фикс. SMTP provider — бизнес-решение Tim'а.

### 2026-03-25 — Docker Migration (Hybrid Architecture)
- **Что в Docker:** TG webhook, CRM sync, Twenty CRM (server+worker+db+redis), 3 CF tunnels
- **Что на хосте:** Paperclip server + embedded PG (порт 54329) + agents
- **Docker compose:** `/Users/timur/paperclip/docker/amritech/docker-compose.yml`
- **Все Docker сервисы** имеют `restart: always` — поднимаются сами
- **Paperclip** на хосте управляется watchdog v2 (launchd `com.amritech.watchdog`)
- **Агенты работают НА ХОСТЕ** — обращаются к CRM через `localhost:5555` (Docker port mapping)
- **НЕ ПЫТАЙСЯ** перенести агентов в Docker — им нужны MCP серверы и API ключи с хоста
- **Логи Docker:** `docker compose -f /Users/timur/paperclip/docker/amritech/docker-compose.yml logs <service>`

### 2026-03-25 — Cloudflare Tunnels (in Docker)
- **Architecture:** 3 named tunnels, all in Docker с `restart: always`
  - `tunnel-tg` → `tg.yourcompany.example.com` → `telegram-webhook:3088` (Docker internal)
  - `tunnel-dispatch` → `dispatch.yourcompany.example.com` → `host.docker.internal:4444` (Paperclip on host)
  - `tunnel-crm` → `crm.yourcompany.example.com` → `twenty-server:3000` (Docker internal)
- **Routing:** configured in Cloudflare Dashboard (Zero Trust → Tunnels), NOT local config files
- **Tokens:** in `.env` file at `/Users/timur/paperclip/docker/amritech/.env`
- **If tunnel dies:** Docker `restart: always` handles it. If stuck: `docker compose restart tunnel-tg`
- **Auth:** Cloudflare Access on dispatch + crm (Zero Trust, email OTP). TG has no auth
- **Auto-fixable:** Yes — Docker handles restart

### 2026-03-25 — Twenty DB WAL Corruption
- **Симптом:** `PANIC: could not locate a valid checkpoint record` в логах twenty-db
- **Root Cause:** Жёсткая остановка контейнера (docker kill) без graceful shutdown
- **Fix:** `docker run --rm -u postgres -v twenty_db-data:/var/lib/postgresql/data postgres:16 pg_resetwal -f /var/lib/postgresql/data`
- **Prevention:** Всегда `docker compose stop`, не `docker kill`. Исключение: restart loop
- **Auto-fixable:** Yes — добавлено в Auto-Fix Playbook

### 2026-03-22 — Duplicate key errors в Paperclip
- **Симптом:** "duplicate key" errors в логах при создании heartbeat_run_events
- **Root Cause:** Ручной restore бэкапа БД с данными которые уже существуют
- **Fix:** Очистка stale events из БД
- **Prevention:** При restore — сначала очистить целевые таблицы
- **Auto-fixable:** No — DB операция
