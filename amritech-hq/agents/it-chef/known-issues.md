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

### 2026-03-22 — Duplicate key errors в Paperclip
- **Симптом:** "duplicate key" errors в логах при создании heartbeat_run_events
- **Root Cause:** Ручной restore бэкапа БД с данными которые уже существуют
- **Fix:** Очистка stale events из БД
- **Prevention:** При restore — сначала очистить целевые таблицы
- **Auto-fixable:** No — DB операция
