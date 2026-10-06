// Runs every test/test_*.js and reports one line each. Exit code is 1 if any test fails.
// The tests print their own PASS/FAIL lines and end with "ALL PASSED" or "SOME FAILED";
// they do not set an exit code themselves, so this runner reads those markers.
//
//   npm test                   run everything
//   node test/run-all.js drops run only files whose name contains "drops"
//   node test/run-all.js -v    also print each test's full output
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var args = process.argv.slice(2);
var verbose = args.indexOf('-v') >= 0;
var filter = args.filter(function (a) { return a !== '-v'; })[0] || '';
var root = path.join(__dirname, '..');

var files = fs.readdirSync(__dirname)
  .filter(function (f) { return /^test_.*\.js$/.test(f) && f.indexOf(filter) >= 0; })
  .sort();
if (!files.length) { console.log('No tests match "' + filter + '".'); process.exit(1); }

var failed = 0;
files.forEach(function (f) {
  var r = cp.spawnSync(process.execPath, [path.join(__dirname, f)], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  var out = (r.stdout || '') + (r.stderr || '');
  var passed = r.status === 0 && /ALL PASSED/.test(out) && !/SOME FAILED/.test(out) && !/^FAIL/m.test(out);
  if (passed) {
    console.log('ok    ' + f);
  } else {
    failed++;
    console.log('FAIL  ' + f + (r.status ? '  (exit ' + r.status + ')' : ''));
    var bad = out.split('\n').filter(function (l) { return /^FAIL|Error/.test(l); }).slice(0, 5);
    if (!bad.length) bad = out.trim().split('\n').slice(-5);
    bad.forEach(function (l) { console.log('      ' + l); });
  }
  if (verbose) console.log(out);
});
console.log('\n' + (files.length - failed) + ' of ' + files.length + ' test files passed.');
process.exit(failed ? 1 : 0);
