#!/bin/bash
# =============================================================================
# AmriTech Watchdog — полностью автономный мониторинг
# Поднимает всё автоматически, даже если Tim без сети
# launchd: KeepAlive=true, RunAtLoad=true
# =============================================================================

LOG="/tmp/paperclip-watchdog.log"
PAPERCLIP_DIR="/Users/timur/paperclip"
PAPERCLIP_PORT=4444
WEBHOOK_PORT=3088
CHECK_INTERVAL=60

# Telegram config
TG_BOT_TOKEN="8651584857:AAHRriyGLbrkziN-jggPn_ST-mMilgayInY"
TG_COMPANY_ID="b51fd9ff-23e1-44cb-81d3-0238aa9be76c"
TG_CHAT_ID="-5126282144"

# Track cloudflare tunnel URL to detect changes
TUNNEL_URL_FILE="/tmp/paperclip-tunnel-url"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/timur/.local/bin:$PATH"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG"
}

# Rotate log if > 10MB
rotate_log() {
  if [ -f "$LOG" ] && [ "$(stat -f%z "$LOG" 2>/dev/null || echo 0)" -gt 10485760 ]; then
    mv "$LOG" "${LOG}.old"
    log "Log rotated"
  fi
}

# ---------------------------------------------------------------------------
# 1. Docker Desktop
# ---------------------------------------------------------------------------
ensure_docker() {
  if ! docker info >/dev/null 2>&1; then
    log "Docker not running, starting Docker Desktop..."
    open -a Docker
    for i in $(seq 1 60); do
      docker info >/dev/null 2>&1 && break
      sleep 2
    done
    if ! docker info >/dev/null 2>&1; then
      log "ERROR: Docker failed to start after 2min"
      return 1
    fi
    log "Docker started"
  fi
}

# ---------------------------------------------------------------------------
# 2. Paperclip (port 4444) + embedded Postgres
# ---------------------------------------------------------------------------
ensure_paperclip() {
  if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PAPERCLIP_PORT/api/health" 2>/dev/null | grep -q "200"; then
    return 0
  fi

  log "Paperclip not responding, restarting..."
  pkill -f "pnpm.*dev" 2>/dev/null
  pkill -f "tsx.*server.*src/index" 2>/dev/null
  sleep 3

  cd "$PAPERCLIP_DIR"
  # Use dev:once (no file watcher) — tsx watch kills agent processes on restart
  PORT=$PAPERCLIP_PORT nohup pnpm dev:once >> /tmp/paperclip-dev.log 2>&1 &
  log "Paperclip started (PID: $!)"

  # Wait for it to come up
  for i in $(seq 1 30); do
    sleep 2
    if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PAPERCLIP_PORT/api/health" 2>/dev/null | grep -q "200"; then
      log "Paperclip ready"
      # After restart, fix stale agent states
      fix_stale_agents
      return 0
    fi
  done
  log "ERROR: Paperclip failed to start after 60s"
  return 1
}

# ---------------------------------------------------------------------------
# 3. Fix stale agents (running/error → idle, stale heartbeats)
# ---------------------------------------------------------------------------
fix_stale_agents() {
  log "Fixing stale agent states..."
  node -e '
const pg = require("/Users/timur/paperclip/node_modules/.pnpm/pg@8.18.0/node_modules/pg");
async function main() {
  const c = new pg.Client({host:"127.0.0.1", port:54329, user:"paperclip", password:"paperclip", database:"paperclip"});
  await c.connect();
  const t = "'"$TG_COMPANY_ID"'";

  // Fix stale running heartbeat_runs (crashed mid-run)
  const r1 = await c.query("UPDATE heartbeat_runs SET status = '\''error'\'', updated_at = NOW() WHERE status = '\''running'\'' AND company_id = $1 AND updated_at < NOW() - interval '\''5 minutes'\''", [t]);
  if (r1.rowCount > 0) console.log("Fixed " + r1.rowCount + " stale heartbeat_runs");

  // Reset error/failed agents to idle
  const r2 = await c.query("UPDATE agents SET status = '\''idle'\'', updated_at = NOW() WHERE company_id = $1 AND status IN ('\''error'\'', '\''failed'\'')", [t]);
  if (r2.rowCount > 0) console.log("Reset " + r2.rowCount + " agents to idle");

  // Reset stuck running agents (no heartbeat for 10+ min)
  const r3 = await c.query("UPDATE agents SET status = '\''idle'\'', updated_at = NOW() WHERE company_id = $1 AND status = '\''running'\'' AND updated_at < NOW() - interval '\''10 minutes'\''", [t]);
  if (r3.rowCount > 0) console.log("Reset " + r3.rowCount + " stuck running agents");

  // Unlock issues stuck on dead runs
  const r4 = await c.query("UPDATE issues SET checkout_run_id = NULL, execution_run_id = NULL, execution_locked_at = NULL, updated_at = NOW() WHERE company_id = $1 AND (checkout_run_id IS NOT NULL OR execution_run_id IS NOT NULL) AND (checkout_run_id NOT IN (SELECT id FROM heartbeat_runs WHERE status = '\''running'\'') OR execution_run_id NOT IN (SELECT id FROM heartbeat_runs WHERE status = '\''running'\'') OR checkout_run_id IS NULL)", [t]);
  if (r4.rowCount > 0) console.log("Unlocked " + r4.rowCount + " stale-locked issues");

  // Clean up old queued runs that never started
  const r5 = await c.query("UPDATE heartbeat_runs SET status = '\''error'\'', updated_at = NOW() WHERE status = '\''queued'\'' AND created_at < NOW() - interval '\''10 minutes'\'' AND company_id = $1", [t]);
  if (r5.rowCount > 0) console.log("Cleared " + r5.rowCount + " stale queued runs");

  await c.end();
}
main().catch(e => console.error(e.message));
' 2>> "$LOG"
}

# ---------------------------------------------------------------------------
# 4. Twenty CRM (port 5555)
# ---------------------------------------------------------------------------
ensure_twenty() {
  ensure_docker || return 1
  if ! docker compose -f "$PAPERCLIP_DIR/twenty-crm/docker-compose.yml" ps --status running 2>/dev/null | grep -q "server"; then
    log "Twenty CRM down, restarting..."
    cd "$PAPERCLIP_DIR/twenty-crm" && docker compose up -d 2>> "$LOG"
    log "Twenty CRM started"
  fi
}

# ---------------------------------------------------------------------------
# 5. Telegram webhook (port 3088)
# ---------------------------------------------------------------------------
ensure_telegram_webhook() {
  if lsof -i :$WEBHOOK_PORT -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi

  log "Telegram webhook down, restarting..."
  cd "$PAPERCLIP_DIR/mcp-servers/telegram-webhook"
  TELEGRAM_BOT_TOKEN="$TG_BOT_TOKEN" \
  COMPANY_ID="$TG_COMPANY_ID" \
  TELEGRAM_CHAT_ID="$TG_CHAT_ID" \
  PAPERCLIP_URL="http://localhost:$PAPERCLIP_PORT" \
  TWENTY_URL="http://localhost:5555" \
  TWENTY_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlZGE1MWY1NS00YjAzLTQ5YzctYjBjOC1jMDcxNGE3ODBlY2QiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiZWRhNTFmNTUtNGIwMy00OWM3LWIwYzgtYzA3MTRhNzgwZWNkIiwiaWF0IjoxNzc0MTE3OTk3LCJleHAiOjQ5Mjc3MjE1OTYsImp0aSI6IjRlNjMzMDhlLTY0ZDctNDYzMC04ZjhmLWMyOTdkZjgxOTEzZCJ9.5UbvR_la3S2G1Iv0UqJyissxYgrUA5qSjsibz5gtXik" \
  PORT="$WEBHOOK_PORT" \
  nohup node index.js >> /tmp/telegram-webhook.log 2>&1 &
  log "Telegram webhook started (PID: $!)"
  sleep 2
}

# ---------------------------------------------------------------------------
# 6b. CRM Auto-Sync (port 3089)
# ---------------------------------------------------------------------------
ensure_crm_sync() {
  if lsof -i :3089 -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi

  log "CRM sync down, restarting..."
  cd "$PAPERCLIP_DIR/mcp-servers/crm-sync"
  TWENTY_API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlZGE1MWY1NS00YjAzLTQ5YzctYjBjOC1jMDcxNGE3ODBlY2QiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiZWRhNTFmNTUtNGIwMy00OWM3LWIwYzgtYzA3MTRhNzgwZWNkIiwiaWF0IjoxNzc0MTE3OTk3LCJleHAiOjQ5Mjc3MjE1OTYsImp0aSI6IjRlNjMzMDhlLTY0ZDctNDYzMC04ZjhmLWMyOTdkZjgxOTEzZCJ9.5UbvR_la3S2G1Iv0UqJyissxYgrUA5qSjsibz5gtXik" \
  COMPANY_ID="$TG_COMPANY_ID" \
  PAPERCLIP_URL="http://localhost:$PAPERCLIP_PORT" \
  TWENTY_URL="http://localhost:5555" \
  PORT="3089" \
  nohup node index.js >> /tmp/crm-sync.log 2>&1 &
  log "CRM sync started (PID: $!)"
}

# ---------------------------------------------------------------------------
# 7. Cloudflare tunnel → auto-update Telegram webhook URL
# ---------------------------------------------------------------------------
ensure_cloudflare_tunnel() {
  if pgrep -f "cloudflared tunnel" >/dev/null 2>&1; then
    return 0
  fi

  log "Cloudflare tunnel down, restarting..."
  # Clear old log to capture new URL
  > /tmp/cloudflared-new.log
  nohup cloudflared tunnel --url "http://localhost:$WEBHOOK_PORT" >> /tmp/cloudflared-new.log 2>&1 &
  log "Cloudflare tunnel started (PID: $!)"

  # Wait for tunnel URL
  for i in $(seq 1 15); do
    sleep 2
    NEW_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cloudflared-new.log 2>/dev/null | tail -1)
    if [ -n "$NEW_URL" ]; then
      break
    fi
  done

  if [ -z "$NEW_URL" ]; then
    log "ERROR: Could not get tunnel URL"
    return 1
  fi

  OLD_URL=$(cat "$TUNNEL_URL_FILE" 2>/dev/null)
  echo "$NEW_URL" > "$TUNNEL_URL_FILE"
  log "Tunnel URL: $NEW_URL"

  # Update Telegram webhook if URL changed
  if [ "$NEW_URL" != "$OLD_URL" ]; then
    log "Tunnel URL changed, updating Telegram webhook..."
    # DNS needs time to propagate for quick tunnels — retry with backoff
    for attempt in $(seq 1 6); do
      sleep $((attempt * 10))
      WEBHOOK_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/setWebhook" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"${NEW_URL}/webhook\"}" 2>/dev/null)
      log "Telegram webhook attempt $attempt: $WEBHOOK_RESULT"
      echo "$WEBHOOK_RESULT" | grep -q '"ok":true' && break
    done

    # Append new log to main cloudflared log
    cat /tmp/cloudflared-new.log >> /tmp/cloudflared.log
  fi
}

# ---------------------------------------------------------------------------
# 8. Periodic health check for agents (every 5 min)
# ---------------------------------------------------------------------------
AGENT_CHECK_COUNTER=0
check_agent_health() {
  AGENT_CHECK_COUNTER=$((AGENT_CHECK_COUNTER + 1))
  # Only run every 5 cycles (5 min)
  if [ $((AGENT_CHECK_COUNTER % 5)) -ne 0 ]; then
    return 0
  fi

  # Fix stale agents without full restart
  fix_stale_agents

  # Auto-wake agents that should be running but aren't
  node -e '
async function main() {
  const pg = require("/Users/timur/paperclip/node_modules/.pnpm/pg@8.18.0/node_modules/pg");
  const c = new pg.Client({host:"127.0.0.1", port:54329, user:"paperclip", password:"paperclip", database:"paperclip"});
  await c.connect();
  const t = "'"$TG_COMPANY_ID"'";

  // Find agents with heartbeat interval > 0 that are idle and havent run recently
  const agents = await c.query(`
    SELECT a.id, a.name, a.runtime_config, a.last_heartbeat_at
    FROM agents a
    WHERE a.company_id = $1 AND a.status = '\''idle'\''
    AND NOT EXISTS (
      SELECT 1 FROM heartbeat_runs hr
      WHERE hr.agent_id = a.id
      AND hr.status IN ('\''running'\'', '\''queued'\'')
    )
  `, [t]);

  const now = Date.now();
  for (const a of agents.rows) {
    const rc = typeof a.runtime_config === "string" ? JSON.parse(a.runtime_config) : (a.runtime_config || {});
    const interval = rc?.heartbeat?.intervalSec || 0;
    if (interval <= 0) continue;

    const lastHb = a.last_heartbeat_at ? new Date(a.last_heartbeat_at).getTime() : 0;
    const elapsed = (now - lastHb) / 1000;

    // If overdue by 2x interval, wake up
    if (elapsed > interval * 2) {
      try {
        const res = await fetch("http://127.0.0.1:'"$PAPERCLIP_PORT"'/api/agents/" + a.id + "/wakeup", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({reason: "watchdog_overdue", context: "Agent overdue by " + Math.floor(elapsed) + "s (interval=" + interval + "s). Auto-waking."})
        });
        if (res.ok) console.log("Woke " + a.name + " (overdue " + Math.floor(elapsed/60) + "min)");
      } catch(e) {}
    }
  }
  await c.end();
}
main().catch(() => {});
' 2>> "$LOG"
}

# =============================================================================
# Main loop
# =============================================================================
log "========================================="
log "Watchdog started (PID $$)"
log "========================================="

while true; do
  rotate_log
  ensure_paperclip
  ensure_twenty
  ensure_telegram_webhook
  ensure_crm_sync
  ensure_cloudflare_tunnel
  check_agent_health
  sleep "$CHECK_INTERVAL"
done
