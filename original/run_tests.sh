#!/bin/sh
# Runs the six exported tests against modal-sketchpad.html. Needs Node only; there is nothing to npm install.
#
# The tests were written in a sandbox and hard-code two absolute paths:
#   /home/claude/modaltoy/index.html   (the app)
#   /home/claude/inner_regress.js      (the app's script body, generated from the app)
# This runner rebuilds that layout in a temp folder and points COPIES of the tests at it,
# so the files in tests/ stay exactly as they were written.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/modaltoy" "$WORK/tests"
cp "$HERE/modal-sketchpad.html" "$WORK/modaltoy/index.html"
node "$HERE/tools/make_inner.js" "$WORK/modaltoy/index.html" "$WORK/inner_regress.js" || exit 1
status=0
for t in "$HERE"/tests/test_*.js; do
  name="$(basename "$t")"
  sed "s#/home/claude/#$WORK/#g" "$t" > "$WORK/tests/$name"
  out="$(cd "$WORK" && node "tests/$name" 2>&1)"
  if echo "$out" | grep -q -E '^FAIL|SOME FAILED' || ! echo "$out" | grep -q 'ALL PASSED'; then
    echo "FAIL  $name"
    echo "$out" | grep -E '^FAIL|SOME FAILED' | head -5
    status=1
  else
    echo "ok    $name"
  fi
done
exit $status
