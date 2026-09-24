#!/usr/bin/env bash
# Treasure Academy regression runner.
#
# Setup once:  npm install            (installs jsdom; node_modules is gitignored
#                                      and is wiped by workspace snapshots, so if
#                                      every suite reports CRASH, run this first)
# Usage:       bash tools/run-all-tests.sh
#
# Suites are discovered from disk rather than hardcoded, so adding
# tools/tests/verify-batchNN.js or tools/tests/*.test.js picks it up
# automatically. Suites are sorted numerically, not lexically.
set -u
cd "$(dirname "$0")/tests"

if [ ! -d ../../node_modules/jsdom ]; then
  echo "jsdom is missing - run:  npm install"
  echo
fi

shopt -s nullglob
mapfile -t batches < <(printf '%s\n' verify-batch*.js | sed -E 's/verify-batch([0-9]+)\.js/\1 &/' | sort -n | cut -d' ' -f2)
extras=( *.test.js )

tot=0
failed=()
for f in "${batches[@]}" "${extras[@]}"; do
  out=$(node "$f" 2>&1); rc=$?
  line=$(echo "$out" | grep -oE "[0-9]+ passed, [0-9]+ failed" | tail -1)
  n=$(echo "$line" | awk '{print $1}')
  nf=$(echo "$line" | awk '{print $3}')
  tot=$((tot + ${n:-0}))
  if [ "$rc" -ne 0 ] || [ -z "$line" ] || [ "${nf:-1}" -ne 0 ]; then
    failed+=("$f")
    printf "%-24s %s\n" "$f" "${line:-CRASH}"
    echo "$out" | grep -E "^FAIL" | head -5 | sed 's/^/      /'
  else
    printf "%-24s %s\n" "$f" "$n"
  fi
done

echo "---------------------------------------------"
echo "TOTAL: $tot checks passed across $(( ${#batches[@]} + ${#extras[@]} )) suites"
if [ ${#failed[@]} -ne 0 ]; then
  echo "Failing suites: ${failed[*]}"
  exit 1
fi
echo "All suites green."
