// Reads the app's single HTML file and returns the body of its <script>, without the outer
// wrapper, so a test can run it inside new Function(...) with a mock DOM and a mock Tone.
var fs = require('fs');
var path = require('path');

var APP = path.join(__dirname, '..', '..', 'app', 'index.html');

function innerCode() {
  var html = fs.readFileSync(APP, 'utf8');
  var m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('load-app: no <script> block found in ' + APP);
  var full = m[1];
  var a = full.indexOf('"use strict";');
  var b = full.lastIndexOf('})();');
  if (a < 0 || b < 0) throw new Error('load-app: the wrapper markers were not found in ' + APP);
  return full.slice(a + '"use strict";'.length, b);
}

module.exports = { innerCode: innerCode, APP: APP };
