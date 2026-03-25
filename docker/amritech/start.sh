#!/bin/bash
# =============================================================================
# AmriTech Docker Stack — Start Script
# Usage: ./start.sh          (normal start)
#        ./start.sh migrate   (migrate data from embedded PG first)
# =============================================================================

set -e
cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[amritech]${NC} $1"; }
warn() { echo -e "${YELLOW}[amritech]${NC} $1"; }
err() { echo -e "${RED}[amritech]${NC} $1"; }

# ─── Step 0: Kill existing processes ──────────────────────────────
log "Stopping existing processes..."
pkill -f "pnpm.*dev" 2>/dev/null || true
pkill -f "tsx.*server.*src/index" 2>/dev/null || true
pkill -f "node.*telegram-webhook" 2>/dev/null || true
pkill -f "node.*crm-sync" 2>/dev/null || true
# Don't kill cloudflared yet — let Docker take over
sleep 2

# ─── Step 1: Build Paperclip image ───────────────────────────────
log "Building Paperclip image..."
docker compose build paperclip

# ─── Step 2: Start databases first ───────────────────────────────
log "Starting databases..."
docker compose up -d paperclip-db twenty-db twenty-redis
log "Waiting for databases to be healthy..."
docker compose exec paperclip-db sh -c 'until pg_isready -U paperclip; do sleep 1; done'

# ─── Step 3: Migrate data if requested ───────────────────────────
if [ "$1" = "migrate" ]; then
  log "Migrating data from embedded Postgres..."

  # Dump current embedded PG
  PGPASSWORD=paperclip pg_dump -h 127.0.0.1 -p 54329 -U paperclip -d paperclip \
    --no-owner --no-privileges > /tmp/paperclip-migrate.sql 2>/dev/null

  if [ -f /tmp/paperclip-migrate.sql ] && [ -s /tmp/paperclip-migrate.sql ]; then
    log "Dump created ($(wc -l < /tmp/paperclip-migrate.sql) lines)"

    # Copy dump into container and restore
    docker compose cp /tmp/paperclip-migrate.sql paperclip-db:/tmp/migrate.sql
    docker compose exec paperclip-db sh -c \
      'PGPASSWORD=$POSTGRES_PASSWORD psql -U paperclip -d paperclip -f /tmp/migrate.sql' 2>&1 | tail -5

    log "Data migrated successfully!"
  else
    warn "No data to migrate (embedded PG not running or empty)"
  fi
fi

# ─── Step 4: Stop remaining host processes ────────────────────────
log "Killing remaining host cloudflared processes..."
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 2

# ─── Step 5: Start everything ────────────────────────────────────
log "Starting all services..."
docker compose up -d

# ─── Step 6: Wait and verify ─────────────────────────────────────
log "Waiting for services to come up..."
sleep 10

echo ""
log "=== Service Status ==="
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
log "=== Health Checks ==="
PAPERCLIP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4444/api/health 2>/dev/null)
TG=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3088/health 2>/dev/null)
CRM=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5555/healthz 2>/dev/null)

[ "$PAPERCLIP" = "200" ] && log "Paperclip:  ✅ OK" || err "Paperclip:  ❌ ($PAPERCLIP)"
[ "$TG" = "200" ] && log "TG Webhook: ✅ OK" || err "TG Webhook: ❌ ($TG)"
[ "$CRM" = "200" ] && log "Twenty CRM: ✅ OK" || err "Twenty CRM: ❌ ($CRM)"

echo ""
log "Done! All services running with restart: always"
log "Logs: docker compose -f $(pwd)/docker-compose.yml logs -f"
