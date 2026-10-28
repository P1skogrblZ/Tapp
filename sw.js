/* Офлайн-режим для T/app.
   Страница: сначала сеть (чтобы обновления приходили сами), при отсутствии связи берётся копия из памяти.
   Остальные файлы приложения и шрифты Google: из памяти, обновляются в фоне. */
const SHELL_CACHE = 'trainlog-shell-v3';
const FONT_CACHE = 'trainlog-fonts-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'favicon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL_CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== SHELL_CACHE && k !== FONT_CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

function timeout(ms) { return new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); }); }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith(
        Promise.race([fetch(req), timeout(3500)])
          .then(function (res) {
            var copy = res.clone();
            caches.open(SHELL_CACHE).then(function (c) { c.put('index.html', copy); });
            return res;
          })
          .catch(function () {
            return caches.match('index.html').then(function (hit) { return hit || caches.match('./'); });
          })
      );
      return;
    }
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) { var copy = res.clone(); caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); }); }
          return res;
        });
      })
    );
    return;
  }

  if (FONT_HOSTS.indexOf(url.hostname) >= 0) {
    e.respondWith(
      caches.open(FONT_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
  }
});
