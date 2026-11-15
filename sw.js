// ネットなしで動かすための係（サービスワーカー）。
// アプリのファイルをまとめて端末（iPad・iPhone）に置き、次からはそこから出す。お客さんのデータには触らない。
// ★ ファイルを直したら VERSION を上げる（js/version.js と同じ数字に）。
const VERSION = '0.8.0';
const CACHE = 'salon-karte-' + VERSION;
const FILES = ['./', './index.html', './manifest.webmanifest', './css/app.css', './icons/icon-180.png', './icons/icon-512.png',
  './js/app.js', './js/db.js', './js/logic.js', './js/seed.js', './js/state.js', './js/ui.js', './js/bodymap.js', './js/parts.js', './js/scopepick.js', './js/figedit.js', './js/signpad.js', './js/backup.js', './js/sample.js', './js/version.js', './js/update.js',
  './js/views/home.js', './js/views/customer.js', './js/views/visit.js', './js/views/progress.js', './js/views/guest.js', './js/views/settings.js', './js/views/guide.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('salon-karte-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' && (await c.match('./index.html'))) || fetch(e.request)));
});
