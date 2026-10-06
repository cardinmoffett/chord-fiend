// Copies the shared chord engine (engine/src/engine.js) into the app's single HTML file,
// between the SHARED ENGINE markers, so the app stays one file with no build step.
//
//   npm run sync-engine          rewrite the block in index.html
//   node tools/sync-engine.js --check   exit 1 if the block is out of date (used by the tests)
var fs = require('fs');
var path = require('path');

var ENGINE = path.join(__dirname, '..', '..', 'engine', 'src', 'engine.js');
var APP = path.join(__dirname, '..', 'index.html');
var START = '/* ==== SHARED ENGINE START: copied from engine/src/engine.js by `npm run sync-engine`. Do not edit here. ==== */';
var END = '/* ==== SHARED ENGINE END ==== */';

function engineBlock() {
  var src = fs.readFileSync(ENGINE, 'utf8');
  var cut = src.search(/^export \{/m);
  if (cut < 0) throw new Error('sync-engine: no "export {" found in ' + ENGINE);
  return START + '\n' + src.slice(0, cut).replace(/\s+$/, '') + '\n' + END;
}

function current(html) {
  var a = html.indexOf(START);
  var b = html.indexOf(END);
  if (a < 0 || b < 0) throw new Error('sync-engine: the SHARED ENGINE markers are missing from ' + APP);
  return {a: a, b: b + END.length};
}

var html = fs.readFileSync(APP, 'utf8');
var span = current(html);
var want = engineBlock();
var inSync = html.slice(span.a, span.b) === want;

if (process.argv.indexOf('--check') >= 0) {
  console.log(inSync ? 'engine block is in sync' : 'engine block is OUT OF DATE: run npm run sync-engine');
  process.exit(inSync ? 0 : 1);
}
if (inSync) {
  console.log('index.html already has the current engine.');
} else {
  fs.writeFileSync(APP, html.slice(0, span.a) + want + html.slice(span.b));
  console.log('Updated the engine block in index.html.');
}
