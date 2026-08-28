// Offline app shell cache. Bump CACHE_VERSION whenever any precached file
// changes so returning devices pick up the update instead of serving stale
// JS forever — that's the whole point of the cache-first strategy below.

const CACHE_VERSION = 'hi-v27';
const CACHE_NAME = `hernando-inspections-${CACHE_VERSION}`;

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/print.css',
  'icons/icon-32.png',
  'icons/icon-152.png',
  'icons/icon-167.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/core/backup.js',
  'js/core/db.js',
  'js/core/media.js',
  'js/core/merge.js',
  'js/core/router.js',
  'js/core/signingClient.js',
  'js/core/store.js',
  'js/core/ui.js',
  'js/forms/crosspopulate.js',
  'js/forms/engine.js',
  'js/forms/fourpoint.js',
  'js/forms/windmit.js',
  'js/core/reportClient.js',
  'js/report/agreement.js',
  'js/report/comments.js',
  'js/report/emailTemplates.js',
  'js/report/export.js',
  'js/report/pdf.js',
  'js/report/render.js',
  'js/report/template.js',
  'js/views/agreement.js',
  'js/views/annotate.js',
  'js/views/checklist.js',
  'js/views/checklist-nav.js',
  'js/views/clients.js',
  'js/views/contacts.js',
  'js/views/dashboard.js',
  'js/views/forms-view.js',
  'js/views/inspection.js',
  'js/views/inspections.js',
  'js/views/library.js',
  'js/views/photos.js',
  'js/views/report.js',
  'js/views/settings.js',
  'js/views/signature.js',
  // Vendored so real PDF export works fully offline, same as everything else —
  // ~560KB one-time download on install, worth it for guaranteed offline PDF.
  'js/vendor/jspdf.umd.min.js',
  'js/vendor/html2canvas.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept CDN/API calls — there are none, but stay explicit

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match('index.html'));
      return cached || network;
    }),
  );
});
