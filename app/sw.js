// Service worker: guarda o app para abrir rápido e funcionar sem internet (os anúncios e a compra precisam de internet).
const VERSION = 'ca3-web-17';
const SHELL = ['./', 'index.html', 'style.css', 'config.js', 'i18n.js', 'core.js', 'scene.js', 'audio.js', 'paint.js', 'tools.js', 'webads.js', 'ad.html', 'monet.js', 'cloud.js', 'tutorial.js', 'app.js', 'boot.js',
  'lib/jszip.min.js', 'lib/mp4-muxer.js', 'manifest.json', 'logo-light.png', 'telegram.svg', 'gtag.js', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// arquivos do app: rede primeiro (sempre a versão nova), cache se estiver sem internet
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
