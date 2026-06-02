#!/bin/bash

###############################################################################
# Release hygiene gate
# Blocks common local/debug artifacts from entering a commercial release.
# Usage: ./scripts/check-release-hygiene.sh
###############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAIL_COUNT=0
WARN_COUNT=0

fail() {
  echo -e "${RED}FAIL${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  echo -e "${YELLOW}WARN${NC} $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

pass() {
  echo -e "${GREEN}PASS${NC} $1"
}

tracked_patterns='(^|/)(\.env|\.env\.local|\.env\.production)$|(^|/)deployment-output/|(^|/)playwright-report/|(^|/)test-results/|eslint-report\.json$|health-report\.txt$|implicit-any-errors\.txt$|lint-output\.txt$|\.bak$|\.tmp$'

echo "== Tracked artifact scan =="
tracked_artifacts_all=$(git ls-files | grep -E "$tracked_patterns" || true)
tracked_artifacts=''
deleted_tracked_artifacts=''

if [ -n "$tracked_artifacts_all" ]; then
  while IFS= read -r artifact; do
    if [ -z "$artifact" ]; then
      continue
    fi

    if [ -e "$artifact" ]; then
      tracked_artifacts+="${artifact}"$'\n'
    else
      deleted_tracked_artifacts+="${artifact}"$'\n'
    fi
  done <<< "$tracked_artifacts_all"
fi

if [ -n "$tracked_artifacts" ]; then
  fail "Tracked debug/deployment artifacts found:"
  printf '%s' "$tracked_artifacts" | sed '/^$/d; s/^/  - /'
else
  pass "No tracked debug/deployment artifacts found"
fi

if [ -n "$deleted_tracked_artifacts" ]; then
  warn "Tracked artifacts are deleted in the working tree; stage/commit deletions before building from git archive:"
  printf '%s' "$deleted_tracked_artifacts" | sed '/^$/d; s/^/  - /'
fi

echo ""
echo "== Working tree artifact scan =="
working_artifacts=$(find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './.next' -prune -o \
  -path './deployment-output' -prune -o \
  -path './bushu' -prune -o \
  -type f \( \
    -name 'eslint-report.json' -o \
    -name 'health-report.txt' -o \
    -name 'implicit-any-errors.txt' -o \
    -name 'lint-output.txt' -o \
    -name '*.bak' -o \
    -name '*.tmp' \
  \) -print)

if [ -n "$working_artifacts" ]; then
  warn "Local debug artifacts present. Keep them out of release packages:"
  printf '%s' "$working_artifacts" | sed '/^$/d; s/^/  - /'
else
  pass "No local debug artifacts found in working tree"
fi

echo ""
echo "== Secret file scan =="
secret_files=$(git ls-files | grep -E '(^|/)\.env(\.|$)|\.pem$|\.key$' | grep -Ev '\.example$|\.template$' || true)
if [ -n "$secret_files" ]; then
  fail "Potential secret files are tracked:"
  printf '%s' "$secret_files" | sed '/^$/d; s/^/  - /'
else
  pass "No tracked env/private-key files found"
fi

echo ""
echo "Warnings: $WARN_COUNT"
echo "Failures: $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
