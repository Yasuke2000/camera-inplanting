/* Service worker: app-shell cachen zodat een bewaard plan ook zonder netwerk opent.
   Kaarttegels, geocoder en GRB-WFS gaan gewoon over het netwerk (niet gecachet).
   - navigatie (index.html): netwerk eerst, cache als offline-fallback — een nieuwe
     deploy is dus meteen zichtbaar;
   - overige shell-bestanden (app.js, geo.js, Leaflet): cache eerst + verversen op
     de achtergrond. */
const CACHE = 'infraplan-v4';
const SHELL = [
  './', './index.html', './app.js', './geo.js', './manifest.webmanifest', './icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    // cors-mode zodat de gecachte Leaflet-respons bruikbaar is voor de
    // <script integrity crossorigin>-tags (opaque responses zijn dat niet)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { mode: u.startsWith('http') ? 'cors' : 'same-origin' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = req.url.startsWith(self.location.origin);
  const leaflet = req.url.startsWith('https://unpkg.com/leaflet@1.9.4/');
  if (!sameOrigin && !leaflet) return; // tegels/API's: niet onderscheppen

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => {
      if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
