const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const geo = require('../geo.js');

const { R, D2R } = geo;
/* haversine-afstand (m) tussen [lat,lng]-punten — onafhankelijke check */
function hav(a, b) {
  const dφ = (b[0] - a[0]) * D2R, dλ = (b[1] - a[1]) * D2R;
  const s = Math.sin(dφ / 2) ** 2 + Math.cos(a[0] * D2R) * Math.cos(b[0] * D2R) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

test('dest legt de juiste afstand af', () => {
  const p = geo.dest(51, 3, 90, 500);
  assert.ok(Math.abs(hav([51, 3], p) - 500) < 1, 'afstand ~500 m');
});

test('bearing: oost ≈ 90°, noord ≈ 0°', () => {
  assert.ok(Math.abs(geo.bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 90) < 0.01);
  const n = geo.bearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(n < 0.01 || n > 359.99, 'noord ≈ 0/360');
});

test('dest + bearing zijn elkaars omgekeerde', () => {
  const start = { lat: 51.1, lng: 3.3 };
  const p = geo.dest(start.lat, start.lng, 137, 250);
  assert.ok(Math.abs(geo.bearing(start, { lat: p[0], lng: p[1] }) - 137) < 0.5);
  assert.ok(Math.abs(hav([start.lat, start.lng], p) - 250) < 1);
});

test('compName geeft juiste kompasrichting', () => {
  assert.strictEqual(geo.compName(0), 'N');
  assert.strictEqual(geo.compName(90), 'O');
  assert.strictEqual(geo.compName(180), 'Z');
  assert.strictEqual(geo.compName(270), 'W');
  assert.strictEqual(geo.compName(45), 'NO');
  assert.strictEqual(geo.compName(360), 'N');
  assert.strictEqual(geo.compName(-90), 'W');
});

test('angDiff is het kleinste hoekverschil', () => {
  assert.strictEqual(geo.angDiff(350, 10), 20);
  assert.strictEqual(geo.angDiff(10, 350), 20);
  assert.strictEqual(geo.angDiff(0, 180), 180);
  assert.strictEqual(geo.angDiff(0, 190), 170);
});

test('polygonAreaM2: 100 m × 100 m ≈ 10 000 m²', () => {
  const a = [51, 3];
  const b = geo.dest(a[0], a[1], 90, 100);
  const c = geo.dest(b[0], b[1], 0, 100);
  const d = geo.dest(a[0], a[1], 0, 100);
  assert.ok(Math.abs(geo.polygonAreaM2([a, b, c, d]) - 10000) < 200);
});

test('polygonAreaM2: echte GRB-gebouwomtrek ≈ 3,6k m²', () => {
  const ring = [[51.12917012, 3.34339065], [51.12960018, 3.34287113], [51.12927411, 3.34218822], [51.12884378, 3.34270717]];
  const area = geo.polygonAreaM2(ring);
  assert.ok(area > 3400 && area < 3800, 'area=' + area);
});

test('pointInPoly herkent binnen/buiten', () => {
  const poly = [[0, 0], [0, 2], [2, 2], [2, 0]]; // [lat,lng]
  assert.strictEqual(geo.pointInPoly(1, 1, poly), true);
  assert.strictEqual(geo.pointInPoly(3, 3, poly), false);
});

test('geoContains: polygoon met gat', () => {
  const outer = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]; // [lon,lat]
  const hole = [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]];
  const geom = { type: 'Polygon', coordinates: [outer, hole] };
  assert.strictEqual(geo.geoContains(geom, 0.5, 0.5), true, 'binnen, buiten gat');
  assert.strictEqual(geo.geoContains(geom, 2, 2), false, 'in het gat = niet bevat');
  assert.strictEqual(geo.geoContains(geom, 5, 5), false, 'buiten');
});

test('geoPolys normaliseert Polygon en MultiPolygon', () => {
  assert.strictEqual(geo.geoPolys({ type: 'Polygon', coordinates: [[[0, 0]]] }).length, 1);
  assert.strictEqual(geo.geoPolys({ type: 'MultiPolygon', coordinates: [[[[0, 0]]], [[[1, 1]]]] }).length, 2);
});

test('simplifyCollinear verwijdert bijna-rechte punten, behoudt echte hoeken', () => {
  // vierkant met een extra (collineair) middenpunt (0,1) op de eerste zijde
  const ring = [[0, 0], [0, 1], [0, 2], [2, 2], [2, 0], [0, 0]]; // gesloten [lat,lng]
  const out = geo.simplifyCollinear(ring, true);
  assert.strictEqual(out.length, 5, '4 hoeken + sluitpunt'); // (0,1) verdwijnt
  // open lijn met een echte hoek van 90° blijft volledig
  assert.strictEqual(geo.simplifyCollinear([[0, 0], [0, 2], [2, 2]], false).length, 3);
});

test('index.html laadt geo.js en heeft één inline-script (refactor-regressie)', () => {
  const h = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(h.includes('<script src="geo.js"></script>'), 'geo.js wordt ingeladen');
  const inline = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.strictEqual(inline.length, 1, 'precies één inline-script');
  assert.ok(!/function dest\(/.test(inline[0][1]), 'dest niet gedupliceerd in index.html');
  assert.ok(!/function polygonAreaM2\(/.test(inline[0][1]), 'polygonAreaM2 niet gedupliceerd in index.html');
});
