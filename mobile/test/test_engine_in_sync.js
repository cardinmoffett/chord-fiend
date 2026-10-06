// The app carries a copy of the shared engine (engine/src/engine.js). Fails if that copy is stale.
var cp = require('child_process');
var path = require('path');
var r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'sync-engine.js'), '--check'], {encoding: 'utf8'});
process.stdout.write(r.stdout || '');
if (r.status === 0) console.log('ALL PASSED');
else { console.log('FAIL the engine block in index.html does not match engine/src/engine.js; run npm run sync-engine'); console.log('SOME FAILED'); }
