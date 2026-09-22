#!/usr/bin/env bash
# Treasure Academy regression runner - suites covering batches 2..44 (1360 checks).
# Setup once: npm install jsdom --no-audit --no-fund
# Usage:    bash tools/run-all-tests.sh
set -u
cd "$(dirname "$0")/tests"
tot=0
fail=0
for f in verify-batch2.js verify-batch3.js verify-batch4.js verify-batch5.js verify-batch6.js verify-batch7.js verify-batch8.js verify-batch9.js verify-batch10.js verify-batch11.js verify-batch12.js verify-batch13.js verify-batch14.js verify-batch15.js verify-batch16.js verify-batch17.js verify-batch18.js verify-batch19.js verify-batch20.js verify-batch21.js verify-batch22.js verify-batch23.js verify-batch24.js verify-batch25.js verify-batch26.js verify-batch27.js verify-batch28.js verify-batch29.js verify-batch30.js verify-batch31.js verify-batch32.js verify-batch33.js verify-batch34.js verify-batch35.js verify-batch36.js verify-batch37.js verify-batch38.js verify-batch39.js verify-batch40.js verify-batch41.js verify-batch43.js verify-batch44.js; do
  out=$(node "$f" 2>&1) || fail=1
  n=$(echo "$out" | grep -oE "[0-9]+ passed" | head -1 | cut -d' ' -f1)
  tot=$((tot + ${n:-0}))
  printf "%-22s %s\n" "$f" "${n:-CRASH}"
done
echo "GRAND TOTAL: $tot checks${fail:+ (SOME SUITES FAILED)}"
exit $fail
