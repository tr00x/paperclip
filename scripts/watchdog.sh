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
CHECK_INTERVAL=30

# Telegram config
TG_BOT_TOKEN="8651584857:AAHRriyGLbrkziN-jggPn_ST-mMilgayInY"
TG_COMPANY_ID="b51fd9ff-23e1-44cb-81d3-0238aa9be76c"
TG_CHAT_ID="-5126282144"

# Track cloudflare tunnel URL to detect changes
TUNNEL_URL_FILE="/tmp/paperclip-tunnel-url"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/timur/.local/bin:$PATH"

# Prevent sleep — keeps system awake even with lid closed (if on power)
# -s = prevent sleep on AC power, -i = prevent idle sleep
if ! pgrep -f "caffeinate -si" > /dev/null 2>&1; then
  caffeinate -si &
fi

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
# 7. Named Cloudflare tunnels (static URLs — no more random trycloudflare)
#    dispatch.amritech.us → localhost:4444 (Paperclip)
#    tg.amritech.us       → localhost:3088 (TG webhook)
#    crm.amritech.us      → localhost:5555 (Twenty CRM)
# ---------------------------------------------------------------------------
DISPATCH_TOKEN="eyJhIjoiODkxOTI1ZjM0MWFkODk1M2ExNDI2ODM3MjFjNTM4YWQiLCJzIjoiTVdVNFpUQTVOVEF0TlRBM01DMDBNbU0yTFRrNFptTXRaRFEyTVRWaE5tRTNZVFZtIiwidCI6ImJlMTVhZDE4LTlkNmYtNDZiOS1iMDc1LThmZjBiOTY4YWUyNiJ9"
TG_TUNNEL_TOKEN="eyJhIjoiODkxOTI1ZjM0MWFkODk1M2ExNDI2ODM3MjFjNTM4YWQiLCJzIjoiWlRJMk1EUmtaV010Wm1RMFppMDBOak14TFRneU5HTXROR0UwWldFNE1qazNMVFk0WXpndE5Ea3dOUzA1TW1GaExUQTBaamxoTXpBMU1qSTVOQT09IiwidCI6ImE0ZWE4Mjk3LTY4YzgtNDkwNS05MmFhLTA0ZjlhMzA1MjI5NCJ9"
CRM_TUNNEL_TOKEN="eyJhIjoiODkxOTI1ZjM0MWFkODk1M2ExNDI2ODM3MjFjNTM4YWQiLCJzIjoiTlRKak9XRTFaall0Wm1ZeU15MDBabU01TFRrd01XWXRaalkzWWpNMlkyUTBNelZqWW1VeE1qRTBaVGt0TVRkaE5DMDBaV1ZtTFRreVkySXRPRFkyT1RZek5USXpPRGRsIiwidCI6IjBkZWNmMTI1LTlkYzMtNDE3ZS05MjllLWQ1NDllNzAxMzY0NiJ9"

ensure_named_tunnel() {
  local NAME="$1"
  local TOKEN="$2"
  local CHECK_URL="$3"
  local LOG_FILE="/tmp/cloudflared-${NAME}.log"
  local PID_FILE="/tmp/cloudflared-${NAME}.pid"

  # Check if tunnel process is alive via PID file
  if [ -f "$PID_FILE" ]; then
    local PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      # Process alive — probe to verify tunnel actually works
      PROBE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "$CHECK_URL" 2>/dev/null)
      # 200 = direct access, 302 = Cloudflare Access redirect (both mean tunnel works)
      if [ "$PROBE" = "200" ] || [ "$PROBE" = "302" ] || [ "$PROBE" = "403" ]; then
        return 0
      fi
      log "${NAME} tunnel probe=$PROBE — killing PID $PID"
      kill "$PID" 2>/dev/null
      sleep 1
      kill -9 "$PID" 2>/dev/null
    fi
  fi

  # Also kill any orphan cloudflared with this token
  pkill -f "${TOKEN:0:30}" 2>/dev/null
  sleep 1

  log "${NAME} tunnel starting..."
  nohup cloudflared tunnel --no-autoupdate run --token "$TOKEN" >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  log "${NAME} tunnel started (PID: $!)"
  sleep 2

  # Verify it came up
  PROBE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$CHECK_URL" 2>/dev/null)
  if [ "$PROBE" = "200" ] || [ "$PROBE" = "302" ] || [ "$PROBE" = "403" ]; then
    log "${NAME} tunnel verified (probe=$PROBE)"
  else
    log "${NAME} tunnel may not be ready yet (probe=$PROBE) — will retry next cycle"
  fi
}

ensure_cloudflare_tunnels() {
  ensure_named_tunnel "dispatch" "$DISPATCH_TOKEN" "https://dispatch.amritech.us/api/health"
  ensure_named_tunnel "tg" "$TG_TUNNEL_TOKEN" "https://tg.amritech.us/health"
  ensure_named_tunnel "crm" "$CRM_TUNNEL_TOKEN" "https://crm.amritech.us/healthz"
}

# ---------------------------------------------------------------------------
# 8. Auto-restart on "RESTART REQUIRED" (backend files changed)
# ---------------------------------------------------------------------------
check_restart_required() {
  HEALTH=$(curl -s "http://127.0.0.1:$PAPERCLIP_PORT/api/health" 2>/dev/null)
  if [ -z "$HEALTH" ]; then
    return 0
  fi

  RESTART_NEEDED=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('devServer',{}).get('restartRequired',False))" 2>/dev/null)
  ACTIVE_RUNS=$(echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('devServer',{}).get('activeRunCount',0))" 2>/dev/null)

  if [ "$RESTART_NEEDED" = "True" ]; then
    # Wait for active runs to finish (max 5 min)
    if [ "$ACTIVE_RUNS" != "0" ] && [ "$ACTIVE_RUNS" != "" ]; then
      log "Restart required but $ACTIVE_RUNS active runs — waiting..."
      return 0
    fi

    log "RESTART REQUIRED detected — backend files changed. Restarting Paperclip..."
    pkill -f "pnpm.*dev" 2>/dev/null
    pkill -f "tsx.*server.*src/index" 2>/dev/null
    sleep 3

    cd "$PAPERCLIP_DIR"
    PORT=$PAPERCLIP_PORT nohup pnpm dev:once >> /tmp/paperclip-dev.log 2>&1 &
    log "Paperclip restarted (PID: $!)"

    for i in $(seq 1 30); do
      sleep 2
      if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PAPERCLIP_PORT/api/health" 2>/dev/null | grep -q "200"; then
        log "Paperclip ready after restart"
        fix_stale_agents
        return 0
      fi
    done
    log "ERROR: Paperclip failed to restart after 60s"
  fi
}

# ---------------------------------------------------------------------------
# 9. Kill hung agent runs (> 35 min) — prevent Hunter/SDR zombie sessions
# ---------------------------------------------------------------------------
kill_hung_runs() {
  node -e '
const pg = require("/Users/timur/paperclip/node_modules/.pnpm/pg@8.18.0/node_modules/pg");
async function main() {
  const c = new pg.Client({host:"127.0.0.1", port:54329, user:"paperclip", password:"paperclip", database:"paperclip"});
  await c.connect();
  const t = "'"$TG_COMPANY_ID"'";

  // Find runs stuck running for > 35 minutes
  const r = await c.query(`
    SELECT hr.id, hr.agent_id, a.name, hr.created_at,
           EXTRACT(EPOCH FROM (NOW() - hr.created_at))/60 AS minutes_running
    FROM heartbeat_runs hr
    JOIN agents a ON a.id = hr.agent_id
    WHERE hr.company_id = $1
      AND hr.status = '\''running'\''
      AND hr.created_at < NOW() - interval '\''35 minutes'\''
  `, [t]);

  for (const row of r.rows) {
    const mins = Math.floor(row.minutes_running);
    console.log("HUNG RUN: " + row.name + " (run " + row.id + ") running for " + mins + "min — killing");

    // Mark run as error
    await c.query(
      "UPDATE heartbeat_runs SET status = '\''error'\'', updated_at = NOW() WHERE id = $1",
      [row.id]
    );

    // Reset agent to idle
    await c.query(
      "UPDATE agents SET status = '\''idle'\'', updated_at = NOW() WHERE id = $1",
      [row.agent_id]
    );

    // Unlock any issues locked by this run
    await c.query(
      "UPDATE issues SET checkout_run_id = NULL, execution_run_id = NULL, execution_locked_at = NULL, updated_at = NOW() WHERE company_id = $1 AND (checkout_run_id = $2 OR execution_run_id = $2)",
      [t, row.id]
    );
  }

  if (r.rowCount > 0) console.log("Killed " + r.rowCount + " hung runs");
  await c.end();
}
main().catch(e => console.error("kill_hung_runs:", e.message));
' 2>> "$LOG"
}

# ---------------------------------------------------------------------------
# 10. Periodic health check for agents (every 5 min)
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
  check_restart_required
  kill_hung_runs
  ensure_twenty
  ensure_telegram_webhook
  ensure_crm_sync
  ensure_cloudflare_tunnels
  check_agent_health
  sleep "$CHECK_INTERVAL"
done
