// ===== 釧路津波避難所マップ Service Worker =====
const APP_CACHE  = 'kushiro-app-v1';
const TILE_CACHE = 'kushiro-tiles-v1';
const MAX_TILES  = 800; // タイルキャッシュ上限

// アプリシェル（オフライン必須リソース）
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './shelters-data.js',
  './all-shelters-data.js',
  './extra-shelters-data.js',
  './zones.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// インストール：アプリシェルをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== APP_CACHE && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// フェッチ：キャッシュ戦略
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // ===== 地図タイル・標高タイル（ランタイムキャッシュ）=====
  if (
    url.includes('tile.openstreetmap.org') ||
    url.includes('cyberjapandata.gsi.go.jp') ||
    url.includes('cyberjapandata2.gsi.go.jp') ||
    url.includes('unpkg.com/leaflet')
  ) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        try {
          const resp = await fetch(event.request);
          if (resp && (resp.ok || resp.type === 'opaque')) {
            // キャッシュ上限を超えたら古いものを削除
            const keys = await cache.keys();
            if (keys.length >= MAX_TILES) {
              await cache.delete(keys[0]);
            }
            cache.put(event.request, resp.clone());
          }
          return resp;
        } catch {
          // オフライン時：キャッシュ未命中はそのまま失敗させる（地図は空白）
          return new Response('', { status: 503, statusText: 'Offline' });
        }
      })
    );
    return;
  }

  // ===== アプリシェル（キャッシュ優先）=====
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp && resp.ok && event.request.method === 'GET') {
          caches.open(APP_CACHE).then(c => c.put(event.request, resp.clone()));
        }
        return resp;
      }).catch(() => {
        // HTMLページの場合はindex.htmlにフォールバック
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
