#!/usr/bin/env bash
# Run every regression batch and print one clean summary.
# Usage: bash tools/run-all-tests.sh
#
# Tests live in tools/tests/ and locate the site themselves via
# SITE = resolve(__dirname, '..', '..'), so this works from any checkout path.

cd "$(dirname "$0")/.." || exit 1
TESTS="tools/tests"

total_pass=0; total_fail=0; bad=""
for n in 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23; do
  f="$TESTS/regression-$(printf %02d "$n").test.js"
  [ -f "$f" ] || continue
  out=$(node "$f" 2>&1); code=$?
  # Matches both "==== N passed, N failed ====" and "BATCHn: N passed, N failed"
  line=$(printf '%s' "$out" | grep -oE '[0-9]+ passed, [0-9]+ failed' | tail -1)
  if [ -z "$line" ]; then
    printf "regression-%02d CRASH (exit %s)\n" "$n" "$code"
    printf '%s\n' "$out" | tail -3 | sed 's/^/        /'
    bad="$bad $n"
    continue
  fi
  p=${line%% passed*}
  f2=${line#*passed, }; f2=${f2%% failed*}
  total_pass=$((total_pass + p)); total_fail=$((total_fail + f2))
  if [ "$f2" = "0" ] && [ "$code" = "0" ]; then st="ok  "; else st="FAIL"; bad="$bad $n"; fi
  printf "regression-%02d %s %4s passed %3s failed\n" "$n" "$st" "$p" "$f2"
done

# extra (non-batch) suites
for extra in seo.test; do
  f="$TESTS/$extra.js"
  [ -f "$f" ] || continue
  out=$(node "$f" 2>&1); code=$?
  line=$(printf '%s' "$out" | grep -oE '[0-9]+ passed, [0-9]+ failed' | tail -1)
  p=${line%% passed*}; f2=${line#*passed, }; f2=${f2%% failed*}
  total_pass=$((total_pass + p)); total_fail=$((total_fail + f2))
  if [ "$f2" = "0" ] && [ "$code" = "0" ]; then st="ok  "; else st="FAIL"; bad="$bad $extra"; fi
  printf "%-8s %s %4s passed %3s failed\n" "$extra" "$st" "$p" "$f2"
done

echo "---------------------------------------------"
echo "TOTAL: $total_pass passed, $total_fail failed"
if [ -n "$bad" ]; then echo "Failing suites:$bad"; exit 1; fi
echo "All suites green."
