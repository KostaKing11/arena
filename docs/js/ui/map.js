/* ═══════════════════════════════════════════════════════════════════════════
   MAPA — mapa JE ekran, ne widget.

   Dva režima:
   · minimapa (podrazumevana u igri) — vidiš samo krug oko sebe, magla rata
   · puna mapa — cela arena; imaju je duhovi, FINAL_TWO i mentor
   ═══════════════════════════════════════════════════════════════════════════ */
const TILES_NIGHT = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20, maxNativeZoom: 19, subdomains: 'abcd',
};
const TILES_DAY = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 20, maxNativeZoom: 19, subdomains: 'abcd',
};

function makeMap(elId, opts) {
  opts = opts || {};
  const map = L.map(elId, {
    zoomControl: false, attributionControl: true, tap: true,
    zoomSnap: 0.25, preferCanvas: true,
  }).setView([44.8125, 20.4612], opts.zoom || 17);

  let tiles = L.tileLayer(TILES_NIGHT.url, TILES_NIGHT).addTo(map);
  function applyTheme() {
    const day = document.documentElement.getAttribute('data-theme') === 'day';
    map.removeLayer(tiles);
    tiles = L.tileLayer(day ? TILES_DAY.url : TILES_NIGHT.url, day ? TILES_DAY : TILES_NIGHT).addTo(map);
  }
  window.addEventListener('arena:theme', applyTheme);
  applyTheme();

  const L_ = {
    zone: null, zoneNext: null, corn: null, me: null, meHead: null,
    items: new Map(), players: new Map(), traps: new Map(), start: null,
    fire: null, wasps: null,
  };
  let follow = true, lastMe = null, visionM = 15, fullMap = false;
  const div = (cls, html) => L.divIcon({ className: 'mk-wrap', html: `<div class="${cls}">${html || ''}</div>`, iconSize: [0, 0] });

  map.on('dragstart', () => { follow = false; window.dispatchEvent(new CustomEvent('arena:mapdrag')); });
  map.on('move zoom', drawFog);
  setTimeout(() => map.invalidateSize(), 150);

  /* Magla rata: rupa tačno oko igrača, sve dalje potamni. */
  function drawFog() {
    const fog = document.getElementById('fog');
    if (!fog) return;
    if (fullMap || !lastMe) { fog.style.background = 'transparent'; return; }
    const p = map.latLngToContainerPoint(lastMe);
    const mpp = 40075016.686 * Math.cos(U.toRad(lastMe.lat)) / (256 * Math.pow(2, map.getZoom()));
    const r = Math.max(46, visionM / mpp);
    const dark = getComputedStyle(document.documentElement).getPropertyValue('--fog').trim() || 'rgba(5,4,8,.88)';
    fog.style.background =
      `radial-gradient(circle ${r * 2.4}px at ${p.x}px ${p.y}px, rgba(0,0,0,0) 0, rgba(0,0,0,0) ${r}px,` +
      ` ${dark.replace(/[\d.]+\)$/, '.45)')} ${r * 1.15}px, ${dark} ${r * 1.75}px)`;
  }

  function setMe(pos, headingDeg) {
    if (!pos) return;
    lastMe = L.latLng(pos.lat, pos.lng);
    if (!L_.me) L_.me = L.marker(lastMe, { icon: div('mk-me'), zIndexOffset: 1000, interactive: false }).addTo(map);
    else L_.me.setLatLng(lastMe);
    if (headingDeg != null) {
      const n = L_.me.getElement() && L_.me.getElement().firstChild;
      if (n) n.style.transform = `rotate(${headingDeg}deg)`;
    }
    if (follow) map.setView(lastMe, map.getZoom(), { animate: true, duration: 0.35 });
    drawFog();
  }
  function recenter(z) {
    follow = true;
    if (lastMe) map.setView(lastMe, z || 17, { animate: true });
  }

  /* — zona: crta se glatko, bez skokova (§14) — */
  function drawZone(z, cfg) {
    if (!z || !cfg || !cfg.center) return;
    const c = [z.center.lat, z.center.lng];
    if (!L_.zone) {
      L_.zone = L.circle(c, { radius: z.radiusM, color: '#E8B64C', weight: 3, fillColor: '#FF6A1A', fillOpacity: 0.05, interactive: false }).addTo(map);
      L_.corn = L.circleMarker([cfg.center.lat, cfg.center.lng], { radius: 7, color: '#E8B64C', weight: 3, fillColor: '#FF6A1A', fillOpacity: 1, interactive: false }).addTo(map);
    } else { L_.zone.setLatLng(c); L_.zone.setRadius(z.radiusM); }
    L_.zone.setStyle({ color: z.shrinking ? '#E03131' : '#E8B64C', dashArray: z.shrinking ? '8 8' : null });
    // najavni prsten sledeće faze
    if (z.next && (z.warn || z.shrinking)) {
      const nc = [z.next.centerLat, z.next.centerLng];
      if (!L_.zoneNext) L_.zoneNext = L.circle(nc, { radius: z.next.radiusM, color: '#E03131', weight: 2, dashArray: '4 10', fill: false, interactive: false }).addTo(map);
      else { L_.zoneNext.setLatLng(nc); L_.zoneNext.setRadius(z.next.radiusM); }
    } else if (L_.zoneNext) { map.removeLayer(L_.zoneNext); L_.zoneNext = null; }
  }

  function drawFire(fw) {
    if (!fw) { if (L_.fire) { map.removeLayer(L_.fire); L_.fire = null; } return; }
    const pts = [[fw.a.lat, fw.a.lng], [fw.b.lat, fw.b.lng]];
    if (!L_.fire) L_.fire = L.polyline(pts, { color: '#FF3B00', weight: 14, opacity: .75, interactive: false }).addTo(map);
    else L_.fire.setLatLngs(pts);
  }
  function drawWasps(w) {
    if (!w) { if (L_.wasps) { map.removeLayer(L_.wasps); L_.wasps = null; } return; }
    if (!L_.wasps) L_.wasps = L.circle([w.lat, w.lng], { radius: w.radiusM, color: '#A855F7', weight: 2, fillColor: '#A855F7', fillOpacity: .18, interactive: false }).addTo(map);
  }

  function setStart(p) {
    if (!p) { if (L_.start) { map.removeLayer(L_.start); L_.start = null; } return; }
    if (!L_.start) L_.start = L.marker([p.lat, p.lng], { icon: div('mk-start'), interactive: false }).addTo(map);
    else L_.start.setLatLng([p.lat, p.lng]);
  }

  /* — predmeti: samo oni u dometu vida — */
  function drawItems(list, onTap) {
    const seen = new Set();
    for (const it of list) {
      seen.add(it.id);
      const cls = `mk-item rar-${it.rarity}${it.inReach ? ' reach' : ''}`;
      let m = L_.items.get(it.id);
      const html = icon(ITEM_ICON[it.type] || 'box', { size: 16 });
      if (!m) {
        m = L.marker([it.lat, it.lng], { icon: div(cls, html) }).addTo(map);
        m.on('click', () => onTap && onTap(it));
        L_.items.set(it.id, m);
      } else if (m._cls !== cls) m.setIcon(div(cls, html));
      m._cls = cls;
    }
    for (const [id, m] of L_.items) if (!seen.has(id)) { map.removeLayer(m); L_.items.delete(id); }
  }

  function drawPlayers(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      const cls = `mk-player ${p.kind}`;
      let m = L_.players.get(p.id);
      const html = p.kind === 'dead' ? icon('skull', { size: 13 }) : (p.kind === 'unconscious' ? icon('alert', { size: 13 }) : '');
      if (!m) { m = L.marker([p.lat, p.lng], { icon: div(cls, html), interactive: false }).addTo(map); L_.players.set(p.id, m); }
      else { m.setLatLng([p.lat, p.lng]); if (m._cls !== cls) m.setIcon(div(cls, html)); }
      m._cls = cls;
    }
    for (const [id, m] of L_.players) if (!seen.has(id)) { map.removeLayer(m); L_.players.delete(id); }
  }

  function drawTraps(list) {
    const seen = new Set();
    for (const t of list) {
      seen.add(t.id);
      let m = L_.traps.get(t.id);
      if (!m) { m = L.marker([t.lat, t.lng], { icon: div('mk-trap', icon('trap', { size: 13 })), interactive: false }).addTo(map); L_.traps.set(t.id, m); }
    }
    for (const [id, m] of L_.traps) if (!seen.has(id)) { map.removeLayer(m); L_.traps.delete(id); }
  }

  return {
    map, setMe, recenter, drawZone, drawFire, drawWasps, drawItems, drawPlayers, drawTraps, setStart, drawFog,
    setVision(v) { visionM = v; drawFog(); },
    setFull(v) { fullMap = v; drawFog(); },
    get isFull() { return fullMap; },
    get following() { return follow; },
    fitArena(cfg) {
      if (!cfg || !cfg.center) return;
      const c = L.latLng(cfg.center.lat, cfg.center.lng);
      map.fitBounds(L.latLngBounds(
        U.destPoint(cfg.center, 315, cfg.diameterM * 0.75),
        U.destPoint(cfg.center, 135, cfg.diameterM * 0.75)
      ));
    },
    refresh() { map.invalidateSize(); drawFog(); },
  };
}
