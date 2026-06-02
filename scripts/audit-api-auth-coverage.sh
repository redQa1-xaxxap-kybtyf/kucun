#!/bin/bash

###############################################################################
# API auth coverage audit
# Produces a CSV-style matrix for manual review.
#
# Usage:
#   ./scripts/audit-api-auth-coverage.sh > .audit-api-auth.csv
###############################################################################

set -euo pipefail

printf "route,classification,signals\n"

find app/api -path '*/route.ts' -type f | sort | while read -r route; do
  content="$(cat "$route")"
  classification="review"
  signals=()

  if grep -q "withAuth" "$route"; then
    classification="authenticated"
    signals+=("withAuth")
  fi

  if grep -q "requireAdmin: true" "$route"; then
    classification="admin-only"
    signals+=("requireAdmin")
  fi

  if grep -Eq "permissions:|anyPermissions:|allPermissions:" "$route"; then
    classification="permissioned"
    signals+=("permissions")
  fi

  if grep -q "withRateLimit" "$route"; then
    signals+=("rate-limit")
  fi

  if [[ "$route" == app/api/auth/* || "$route" == app/api/captcha/route.ts || "$route" == app/api/address/* || "$route" == app/api/health/route.ts ]]; then
    classification="public-known"
    signals+=("known-public")
  fi

  if [[ "$route" == app/api/miniprogram/catalog/route.ts || "$route" == app/api/miniprogram/groups/* || "$route" == app/api/miniprogram/products/* ]]; then
    classification="public-miniprogram-read"
    signals+=("middleware-public-get")
  fi

  if [[ "$route" == app/api/monitoring/* ]]; then
    classification="token-protected"
    signals+=("monitoring-token")
  fi

  if [[ "$route" == app/api/internal/* ]]; then
    classification="internal-token"
    signals+=("internal-key")
  fi

  if grep -q "ENABLE_TEST_DATA_API" "$route"; then
    classification="admin-switch-protected"
    signals+=("danger-switch")
  fi

  if grep -q "ENABLE_DEMO_CLEAR_API" "$route"; then
    classification="admin-switch-protected"
    signals+=("danger-switch")
  fi

  if [ "${#signals[@]}" -eq 0 ]; then
    signals+=("no-wrapper-detected")
  fi

  printf "%s,%s,%s\n" "$route" "$classification" "$(IFS='|'; echo "${signals[*]}")"
done
