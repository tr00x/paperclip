#!/bin/bash
# =============================================================================
# AmriTech Auto-Backup — Paperclip DB + Twenty CRM
# Runs every 6 hours via watchdog
# =============================================================================

BACKUP_DIR="/Users/timur/.paperclip/backups"
PAPERCLIP_BACKUP_DIR="$BACKUP_DIR/paperclip"
CRM_BACKUP_DIR="$BACKUP_DIR/twenty-crm"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
MAX_BACKUPS=20

mkdir -p "$PAPERCLIP_BACKUP_DIR" "$CRM_BACKUP_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [BACKUP] $1" >> /tmp/paperclip-watchdog.log
}

# ---------------------------------------------------------------------------
# 1. Paperclip DB (PostgreSQL on port 54329 — local, no pg_dump on mac)
# ---------------------------------------------------------------------------
backup_paperclip() {
  local file="$PAPERCLIP_BACKUP_DIR/paperclip-$TIMESTAMP.sql.gz"
  # Try pg_dump first (faster, cleaner)
  if PGPASSWORD=paperclip /usr/local/opt/libpq/bin/pg_dump -h 127.0.0.1 -p 54329 -U paperclip -d paperclip 2>/dev/null | gzip > "$file"; then
    if [ "$(stat -f%z "$file" 2>/dev/null)" -gt 100 ]; then
      local size=$(ls -lh "$file" 2>/dev/null | awk '{print $5}')
      log "Paperclip backup (pg_dump): $file ($size)"
      return 0
    fi
  fi
  rm -f "$file" 2>/dev/null
  # Fallback to node dump
  file="$PAPERCLIP_BACKUP_DIR/paperclip-$TIMESTAMP.sql.gz"
  node -e '
const pg = require("/Users/timur/paperclip/node_modules/.pnpm/pg@8.18.0/node_modules/pg");
const fs = require("fs");
const zlib = require("zlib");
async function main() {
  const c = new pg.Client({host:"127.0.0.1", port:54329, user:"paperclip", password:"paperclip", database:"paperclip"});
  await c.connect();

  const tables = await c.query("SELECT tablename FROM pg_tables WHERE schemaname = '\''public'\'' ORDER BY tablename");
  let dump = "-- Paperclip backup " + new Date().toISOString() + "\n";

  for (const row of tables.rows) {
    const t = row.tablename;
    const data = await c.query("SELECT * FROM \"" + t + "\"");
    if (data.rows.length === 0) continue;

    dump += "\n-- Table: " + t + " (" + data.rows.length + " rows)\n";
    dump += "DELETE FROM \"" + t + "\";\n";

    for (const r of data.rows) {
      const cols = Object.keys(r).map(k => "\"" + k + "\"").join(", ");
      const vals = Object.values(r).map(v => {
        if (v === null) return "NULL";
        if (typeof v === "object") return "'\''" + JSON.stringify(v).replace(/'\''/, "'\'''\''") + "'\''";
        return "'\''" + String(v).replace(/'\''/, "'\'''\''") + "'\''";
      }).join(", ");
      dump += "INSERT INTO \"" + t + "\" (" + cols + ") VALUES (" + vals + ");\n";
    }
  }

  await c.end();
  const gz = zlib.gzipSync(Buffer.from(dump));
  fs.writeFileSync("'"$file"'", gz);
  console.log("OK:" + gz.length);
}
main().catch(e => { console.error("FAIL:" + e.message); process.exit(1); });
' 2>/dev/null

  if [ -f "$file" ] && [ "$(stat -f%z "$file" 2>/dev/null)" -gt 100 ]; then
    local size=$(ls -lh "$file" 2>/dev/null | awk '{print $5}')
    log "Paperclip backup: $file ($size)"
  else
    log "ERROR: Paperclip backup failed"
    rm -f "$file" 2>/dev/null
  fi
}

# ---------------------------------------------------------------------------
# 2. Twenty CRM DB (PostgreSQL in Docker — has pg_dump)
# ---------------------------------------------------------------------------
backup_twenty() {
  local file="$CRM_BACKUP_DIR/twenty-crm-$TIMESTAMP.sql.gz"
  if docker exec twenty-db-1 pg_dump -U postgres -d default 2>/dev/null | gzip > "$file"; then
    if [ "$(stat -f%z "$file" 2>/dev/null)" -gt 100 ]; then
      local size=$(ls -lh "$file" 2>/dev/null | awk '{print $5}')
      log "Twenty CRM backup: $file ($size)"
    else
      log "ERROR: Twenty CRM backup empty"
      rm -f "$file"
    fi
  else
    log "ERROR: Twenty CRM backup failed"
    rm -f "$file"
  fi
}

# ---------------------------------------------------------------------------
# 3. Cleanup old backups
# ---------------------------------------------------------------------------
cleanup() {
  for dir in "$PAPERCLIP_BACKUP_DIR" "$CRM_BACKUP_DIR"; do
    local count=$(ls -1 "$dir"/*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
    if [ "$count" -gt "$MAX_BACKUPS" ]; then
      local to_delete=$((count - MAX_BACKUPS))
      ls -1t "$dir"/*.sql.gz | tail -n "$to_delete" | xargs rm -f
      log "Cleaned $to_delete old backups from $dir"
    fi
  done
}

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
backup_paperclip
backup_twenty
cleanup
