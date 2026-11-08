/* 신혼여행 앱 오프라인 저장
   - 화면 파일(앱 껍데기)은 설치할 때 받아 두고, 인터넷이 되면 새 판을 받아 바꿔요.
   - 지도 조각·글꼴은 한 번 본 것을 남겨 두고 다시 써요(지도 조각은 최대 900개).
   - 지도 스타일과 타일 목록(TileJSON)은 인터넷이 되면 새로 받고, 안 되면 남은 것을 써요. */
const VER = 'v2-202611081428';
const SHELL = 'shell-' + VER, MAP = 'map-v1', FONTS = 'fonts-v1';
const FILES = ['./', 'index.html', 'css/app.css', 'vendor/leaflet.css', 'vendor/leaflet.js', 'vendor/maplibre-gl.css', 'vendor/maplibre-gl.js', 'vendor/leaflet-maplibre-gl.js',
  'js/coast.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name), ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}
async function cacheFirst(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { c.put(req, res.clone()); if (max) trim(name, max); }
  return res;
}
async function networkFirst(req, name) {
  const c = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('index.html') : null);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname === 'tiles.openfreemap.org') {
    // 스타일과 TileJSON은 새로, 타일·글자·아이콘 그림은 남은 것 먼저
    const fresh = u.pathname.startsWith('/styles/') || /^\/(planet|natural_earth)\/?$/.test(u.pathname);
    e.respondWith(fresh ? networkFirst(req, MAP) : cacheFirst(req, MAP, 900));
    return;
  }
  if (u.hostname === 'tile.openstreetmap.org') { e.respondWith(cacheFirst(req, MAP, 900)); return; }
  if (u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req, FONTS, 300)); return; }
  if (u.origin === self.location.origin) e.respondWith(networkFirst(req, SHELL));
});
