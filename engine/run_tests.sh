#!/bin/sh
# Runs the engine tests. Needs Node 18 or later only; there is nothing to install.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
status=0
for t in "$HERE"/tests/test_*.mjs; do
  name="$(basename "$t")"
  out="$(node "$t" 2>&1)"
  if echo "$out" | grep -q -E '^FAIL|SOME FAILED' || ! echo "$out" | grep -q 'ALL PASSED'; then
    echo "FAIL  $name"
    echo "$out" | grep -E '^FAIL|SOME FAILED|Error' | head -5
    status=1
  else
    echo "ok    $name"
  fi
done
exit $status
