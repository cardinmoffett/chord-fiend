// Writes the app's script body, without its outer wrapper, so the tests can run it inside new Function(...).
// Four of the tests read this file. It is generated from the HTML, never edited by hand.
// Usage: node make_inner.js <app.html> <out.js>
var fs = require('fs');
var html = fs.readFileSync(process.argv[2], 'utf8');
var m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!m) { console.error('make_inner: no <script> block found'); process.exit(1); }
var full = m[1];
var a = full.indexOf('"use strict";');
var b = full.lastIndexOf('})();');
if (a < 0 || b < 0) { console.error('make_inner: wrapper markers not found'); process.exit(1); }
fs.writeFileSync(process.argv[3], full.slice(a + '"use strict";'.length, b));
