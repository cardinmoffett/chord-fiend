// Service worker: lets the app open with no connection.
// Every file is served from the cache straight away, then refreshed from the network in
// the background, so a new version shows up the next time the app is opened.
// Bump VERSION when the file list changes.
var VERSION = 'chord-fiend-v1';
var FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'vendor/Tone.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(req, {ignoreSearch: true}).then(function (hit) {
      var fresh = fetch(req).then(function (res) {
        if (res.ok) cache.put(req, res.clone());
        return res;
      });
      if (hit) { e.waitUntil(fresh.catch(function () {})); return hit; }
      return fresh;
    });
  }));
});
