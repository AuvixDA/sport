// Минимальный service worker — нужен, чтобы браузер считал сайт
// полноценным PWA и предлагал "Установить приложение" / работу с рабочего стола.
// Кэширования не делает: все страницы всегда идут напрямую в сеть,
// чтобы не показывать устаревшие данные о записях и расписании.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
