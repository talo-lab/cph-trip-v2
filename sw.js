// Service Worker — CPH Trip Planner
const VERSION = 'cph-v1';
const STATIC = [
  '/',
  '/index.html',
  '/events-data.js',
  '/icon-192.png',
  '/icon-512.png',
  '/src/styles.css',
  '/src/app.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,400&family=Space+Mono:wght@400;700&family=Archivo:wght@400;500;600;700;800&display=swap',
];

// 설치: 핵심 앱 파일 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// 활성화: 이전 캐시 정리
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch 전략
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 지도 타일: Stale-While-Revalidate (오프라인에서도 마지막 타일 표시)
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    e.respondWith(
      caches.open('cph-tiles').then(async cache => {
        const cached = await cache.match(e.request);
        const fresh = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        return cached || fresh;
      })
    );
    return;
  }

  // API 호출: 항상 네트워크 우선 (캐시 안 함)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 정적 자산: Cache First
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          caches.open(VERSION).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => caches.match('/index.html')); // 오프라인 폴백
    })
  );
});
