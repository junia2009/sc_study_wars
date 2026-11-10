// オフラインでも遊べるように、ゲームのファイルを端末に保存する。
// ファイルを変えたら VERSION を上げること(古い保存が消えて、新しいものに入れ替わる)。
const VERSION = 'scsw-v0.13.0';
const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-64.png',
  './src/main.js',
  './src/game.js',
  './src/ui.js',
  './src/movie.js',
  './src/input.js',
  './src/audio.js',
  './src/music.js',
  './src/sprites.js',
  './src/art.js',
  './src/gimmicks.js',
  './src/weapons.js',
  './data/stage1.js',
  './data/scenes.js',
  './data/cards.js',
  './data/story.js',
  './data/days.js',
  './data/mapkit.js',
  './data/weapons.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 通信できるときは新しいものを取りに行き、できないときは保存したものを使う
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
