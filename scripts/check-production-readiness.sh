#!/bin/bash

###############################################################################
# Production readiness gate
# Usage: ./scripts/check-production-readiness.sh [.env.production]
###############################################################################

set -euo pipefail

ENV_FILE="${1:-.env.production}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  echo -e "${GREEN}PASS${NC} $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "${RED}FAIL${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  echo -e "${YELLOW}WARN${NC} $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

section() {
  echo ""
  echo -e "${BLUE}== $1 ==${NC}"
}

is_placeholder() {
  local value="${1:-}"
  [[ -z "$value" || "$value" == *"<"* || "$value" == *"your-"* || "$value" == *"change-in-production"* ]]
}

is_true() {
  local value="${1:-}"
  [[ "$value" == "true" || "$value" == "1" ]]
}

is_false_or_empty() {
  local value="${1:-}"
  [[ -z "$value" || "$value" == "false" || "$value" == "0" ]]
}

section "Load environment"

if [ ! -f "$ENV_FILE" ]; then
  fail "Environment file not found: $ENV_FILE"
else
  NORMALIZED_ENV_FILE="$(mktemp)"
  trap 'rm -f "$NORMALIZED_ENV_FILE"' EXIT
  sed 's/\r$//' "$ENV_FILE" > "$NORMALIZED_ENV_FILE"

  # shellcheck disable=SC1090
  set -a
  source "$NORMALIZED_ENV_FILE"
  set +a
  pass "Loaded $ENV_FILE"
fi

section "Required production config"

if [ "${NODE_ENV:-}" = "production" ]; then
  pass "NODE_ENV=production"
else
  fail "NODE_ENV must be production"
fi

nextauth_secret="${NEXTAUTH_SECRET:-}"
if is_placeholder "$nextauth_secret" || [ "${#nextauth_secret}" -lt 32 ]; then
  fail "NEXTAUTH_SECRET must be a real secret with at least 32 characters"
else
  pass "NEXTAUTH_SECRET is configured"
fi

if [[ "${NEXTAUTH_URL:-}" == https://* ]]; then
  pass "NEXTAUTH_URL uses HTTPS"
else
  fail "NEXTAUTH_URL must be an HTTPS production URL"
fi

if [[ "${DATABASE_URL:-}" == mysql://* || "${DATABASE_URL:-}" == postgresql://* ]]; then
  pass "DATABASE_URL uses a server database"
elif [[ "${DATABASE_URL:-}" == file:* || "${DATABASE_URL:-}" == sqlite:* ]]; then
  fail "DATABASE_URL must not use SQLite/file storage in production"
else
  fail "DATABASE_URL is missing or uses an unsupported scheme"
fi

storage_encryption_key="${STORAGE_ENCRYPTION_KEY:-}"
if is_placeholder "$storage_encryption_key" || [ "${#storage_encryption_key}" -lt 32 ]; then
  fail "STORAGE_ENCRYPTION_KEY must be configured with at least 32 characters"
else
  pass "STORAGE_ENCRYPTION_KEY is configured"
fi

section "Dangerous production switches"

if is_false_or_empty "${ENABLE_DEMO_CLEAR_API:-}"; then
  pass "ENABLE_DEMO_CLEAR_API is disabled"
else
  fail "ENABLE_DEMO_CLEAR_API must be disabled in production"
fi

if is_false_or_empty "${ENABLE_TEST_DATA_API:-}"; then
  pass "ENABLE_TEST_DATA_API is disabled"
else
  fail "ENABLE_TEST_DATA_API must be disabled in production"
fi

if [ -z "${ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM:-}" ]; then
  pass "ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM is empty"
else
  fail "ENABLE_TEST_DATA_API_PRODUCTION_CONFIRM must be empty in production"
fi

if [ "${RATE_LIMIT_ENABLED:-true}" = "true" ]; then
  pass "RATE_LIMIT_ENABLED=true"
else
  fail "RATE_LIMIT_ENABLED must remain true in production"
fi

section "Monitoring and alerting switches"

if is_true "${ENABLE_MEMORY_MONITOR:-false}"; then
  monitoring_token="${MONITORING_TOKEN:-}"
  if is_placeholder "$monitoring_token" || [ "${#monitoring_token}" -lt 32 ]; then
    fail "MONITORING_TOKEN must be a strong token when memory monitoring is enabled"
  else
    pass "Memory monitoring token is configured"
  fi
else
  warn "ENABLE_MEMORY_MONITOR is disabled; ensure external host/process monitoring exists"
fi

if [ -n "${LOG_LEVEL:-}" ] && [[ "${LOG_LEVEL}" =~ ^(warn|error|info)$ ]]; then
  pass "LOG_LEVEL=${LOG_LEVEL}"
else
  warn "LOG_LEVEL should be warn, error, or info"
fi

section "Backup and restore readiness"

if is_true "${AUTO_DB_BACKUP_ENABLED:-false}"; then
  pass "AUTO_DB_BACKUP_ENABLED=true"
else
  warn "AUTO_DB_BACKUP_ENABLED is disabled; confirm an external scheduled backup exists"
fi

if [ -n "${DB_BACKUP_DIR:-}" ]; then
  pass "DB_BACKUP_DIR is configured: ${DB_BACKUP_DIR}"
else
  warn "DB_BACKUP_DIR is not configured"
fi

if command -v mysqldump >/dev/null 2>&1; then
  pass "mysqldump is available"
else
  warn "mysqldump is not available on this machine"
fi

if command -v mysql >/dev/null 2>&1; then
  pass "mysql client is available"
else
  warn "mysql client is not available on this machine"
fi

section "Summary"

echo "Passed: $PASS_COUNT"
echo "Warnings: $WARN_COUNT"
echo "Failed: $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}Production readiness check failed.${NC}"
  exit 1
fi

echo -e "${GREEN}Production readiness check passed.${NC}"
