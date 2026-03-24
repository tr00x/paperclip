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

### 2026-03-24 — Cloudflare Named Tunnels (static subdomains)
- **Architecture:** 3 named tunnels, all managed by watchdog
  - `dispatch.amritech.us` → `localhost:4444` (Paperclip UI + API)
  - `tg.amritech.us` → `localhost:3088` (Telegram webhook)
  - `crm.amritech.us` → `localhost:5555` (Twenty CRM)
- **How they run:** `cloudflared tunnel --no-autoupdate run --token $TOKEN`
- **Tokens:** in `scripts/watchdog.sh` (DISPATCH_TOKEN, TG_TUNNEL_TOKEN, CRM_TUNNEL_TOKEN)
- **Monitoring:** watchdog probes each URL every 60s, restarts if probe fails
- **TG Webhook:** permanently set to `https://tg.amritech.us/webhook` (no more random trycloudflare URLs)
- **Auth:** Cloudflare Access on dispatch + crm (Zero Trust, email OTP). TG has no auth (Telegram needs raw access)
- **If tunnel dies:** watchdog restarts automatically. If watchdog is also down → manually run:
  ```bash
  cloudflared tunnel --no-autoupdate run --token "$(cloudflared tunnel token dispatch)" &
  cloudflared tunnel --no-autoupdate run --token "$(cloudflared tunnel token tg)" &
  cloudflared tunnel --no-autoupdate run --token "$(cloudflared tunnel token crm)" &
  ```
- **If DNS broken:** Check Cloudflare dashboard → Tunnels → verify routes exist with correct hostnames
- **Logs:** `/tmp/cloudflared-dispatch.log`, `/tmp/cloudflared-tg.log`, `/tmp/cloudflared-crm.log`
- **Auto-fixable:** Yes — watchdog handles restart. DNS/route issues need dashboard.

### 2026-03-22 — Duplicate key errors в Paperclip
- **Симптом:** "duplicate key" errors в логах при создании heartbeat_run_events
- **Root Cause:** Ручной restore бэкапа БД с данными которые уже существуют
- **Fix:** Очистка stale events из БД
- **Prevention:** При restore — сначала очистить целевые таблицы
- **Auto-fixable:** No — DB операция
