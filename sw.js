/* 신혼여행 앱 오프라인 저장
   - 화면 파일(앱 껍데기)은 설치할 때 받아 두고, 인터넷이 되면 새 판을 받아 바꿔요.
   - 지도 조각은 한 번 본 것을 남겨 두고 다시 써요(최대 900개, 오래된 것부터 지워요).
   - 준비 탭의 '오프라인용으로 받기'로 받은 지도는 따로(map-pre-v1) 두고 지우지 않아요. 받는 일은 화면 쪽에서 하고,
     그때 붙는 ?ofmpre=1 요청은 여기서 저장하지 않고 그대로 넘겨요(같은 조각을 두 번 저장하지 않게).
   - 지도 글자(fonts)와 아이콘 그림(sprites)은 몇 개 안 되니 지우지 않는 곳에 둬요. 지도 조각에 밀려 지워지면 지명이 안 보여서예요.
   - 지도 스타일과 타일 목록(TileJSON)은 인터넷이 되면 새로 받고, 안 되면 미리 받은 판을 먼저 써요(그 판의 조각 주소와 맞으니까). */
const VER = 'v2-202611082111';
const SHELL = 'shell-' + VER, MAP = 'map-v1', PRE = 'map-pre-v1', STILL = 'map-still-v1', FONTS = 'fonts-v1';
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
// 미리 받은 것(PRE)과 본 것(MAP, STILL) 어디에 있든 먼저 쓴다
async function cacheFirst(req, name, max) {
  const hit = await caches.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { const c = await caches.open(name); c.put(req, res.clone()); if (max) trim(name, max); }
  return res;
}
async function networkFirst(req, name, preFirst) {
  const c = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const pre = preFirst ? await (await caches.open(PRE)).match(req, { ignoreSearch: true, ignoreVary: true }) : null;
    const hit = pre || await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('index.html') : null);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname === 'tiles.openfreemap.org') {
    if (u.searchParams.has('ofmpre')) { u.searchParams.delete('ofmpre'); e.respondWith(fetch(u.href, { mode: 'cors' })); return; }
    // 스타일과 TileJSON은 새로, 타일·글자·아이콘 그림은 남은 것 먼저
    const fresh = u.pathname.startsWith('/styles/') || /^\/(planet|natural_earth)\/?$/.test(u.pathname);
    const still = /^\/(fonts|sprites)\//.test(u.pathname);
    e.respondWith(fresh ? networkFirst(req, MAP, true) : still ? cacheFirst(req, STILL, 0) : cacheFirst(req, MAP, 900));
    return;
  }
  if (u.hostname === 'tile.openstreetmap.org') { e.respondWith(cacheFirst(req, MAP, 900)); return; }
  if (u.hostname === 'cdn.jsdelivr.net' || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req, FONTS, 300)); return; }
  if (u.origin === self.location.origin) e.respondWith(networkFirst(req, SHELL, false));
});
