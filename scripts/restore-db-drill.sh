#!/bin/bash

###############################################################################
# Database restore drill
# Restores a .sql or .sql.gz backup into a non-production drill database and
# runs basic validation checks.
#
# Usage:
#   DRILL_DATABASE_URL="mysql://user:pass@host:3306/kucun_restore_drill" \
#     ./scripts/restore-db-drill.sh backups/kucun_20260522_010000.sql.gz
###############################################################################

set -euo pipefail

BACKUP_FILE="${1:-}"
DRILL_DATABASE_URL="${DRILL_DATABASE_URL:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  echo -e "${BLUE}[restore-drill]${NC} $1"
}

success() {
  echo -e "${GREEN}[restore-drill]${NC} $1"
}

die() {
  echo -e "${RED}[restore-drill]${NC} $1" >&2
  exit 1
}

parse_mysql_url() {
  local url="$1"
  if [[ "$url" =~ ^mysql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]:-3306}"
    DB_NAME="${BASH_REMATCH[5]}"
  else
    die "DRILL_DATABASE_URL must look like mysql://user:pass@host:3306/database"
  fi
}

if [ -z "$BACKUP_FILE" ]; then
  die "Backup file is required"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  die "Backup file not found: $BACKUP_FILE"
fi

if [ -z "$DRILL_DATABASE_URL" ]; then
  die "DRILL_DATABASE_URL is required and must point to a disposable drill database"
fi

if [[ "$DRILL_DATABASE_URL" == *"prod"* || "$DRILL_DATABASE_URL" == *"production"* ]]; then
  die "Refusing to restore into a database URL that looks like production"
fi

command -v mysql >/dev/null 2>&1 || die "mysql client is required"
command -v gzip >/dev/null 2>&1 || die "gzip is required"

parse_mysql_url "$DRILL_DATABASE_URL"

log "Restoring $BACKUP_FILE into $DB_HOST:$DB_PORT/$DB_NAME"
log "This script will drop and recreate the drill database."

mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gzip -dc "$BACKUP_FILE" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
else
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$BACKUP_FILE"
fi

table_count=$(mysql -N -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';")

if [ "${table_count:-0}" -le 0 ]; then
  die "Restore completed but no tables were found"
fi

success "Restore drill passed. Restored table count: $table_count"
