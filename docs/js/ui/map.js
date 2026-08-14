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
    zoomControl: false, attributionControl: false, tap: true,
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

  /* Magla rata je atmosfera, a NE pravilo — šta se stvarno vidi određuju podaci
     (Items.visible). Zato je otvor mnogo širi od dometa vida: ranije je pri
     vidu od 15 m rupa bila ~46 px na ekranu od 740, pa je mapa izgledala
     pokvareno. Sada se vidi teren, a plen i dalje samo u pravom dometu. */
  const FOG_REVEAL = 3.2;
  function drawFog() {
    // Magla je čvor ekrana igre; pomoćne mape (podešavanje, puna mapa arene)
    // je ne smeju dirati — inače bi je gasile dok su otvorene.
    if (opts.noFog) return;
    const fog = document.getElementById('fog');
    if (!fog) return;
    if (fullMap || !lastMe) { fog.style.background = 'transparent'; return; }
    const p = map.latLngToContainerPoint(lastMe);
    const r = Math.max(110, visionM / metersPerPx() * FOG_REVEAL);
    const dark = getComputedStyle(document.documentElement).getPropertyValue('--fog').trim() || 'rgba(6,5,10,.72)';
    const soft = dark.replace(/[\d.]+\)$/, '.28)');
    fog.style.background =
      `radial-gradient(circle ${r * 2.1}px at ${p.x}px ${p.y}px, rgba(0,0,0,0) 0, rgba(0,0,0,0) ${r * .55}px,`
      + ` ${soft} ${r * .9}px, ${dark} ${r * 1.5}px)`;
  }
  const metersPerPx = () =>
    40075016.686 * Math.cos(U.toRad(lastMe ? lastMe.lat : 45)) / (256 * Math.pow(2, map.getZoom()));

  /** Zum se bira tako da krug vidljivosti zauzme razuman deo ekrana. */
  function autoZoom() {
    if (!lastMe || fullMap) return;
    const px = Math.min(map.getSize().x, map.getSize().y) * 0.34;
    const want = visionM * FOG_REVEAL * 0.55;
    let z = Math.log2(40075016.686 * Math.cos(U.toRad(lastMe.lat)) * px / (256 * want));
    z = U.clamp(Math.round(z * 4) / 4, 15, 19);
    if (Math.abs(map.getZoom() - z) > 0.3) map.setZoom(z, { animate: false });
  }

  function setMe(pos, headingDeg) {
    if (!pos) return;
    const first = !lastMe;
    lastMe = L.latLng(pos.lat, pos.lng);
    if (!L_.me) L_.me = L.marker(lastMe, { icon: div('mk-me', '<i class="dir"></i>'), zIndexOffset: 1000, interactive: false }).addTo(map);
    else L_.me.setLatLng(lastMe);
    const node = L_.me.getElement() && L_.me.getElement().querySelector('.dir');
    if (node) node.style.display = headingDeg == null ? 'none' : '';
    if (node && headingDeg != null) {
      const el2 = L_.me.getElement().firstChild;
      el2.style.transform = `rotate(${headingDeg}deg)`;
    }
    if (first) autoZoom();
    if (follow) map.setView(lastMe, map.getZoom(), { animate: !first, duration: 0.3 });
    drawFog();
  }
  function recenter(z) {
    follow = true;
    autoZoom();
    if (lastMe) map.setView(lastMe, z || map.getZoom(), { animate: true });
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
    /* Najavni prsten sledeće faze. Normalno se pali tek uz upozorenje, ali
       Karta zone (`z.peek`) ga pokazuje 5 min ranije — u igri gde je hodanje
       skupo, ta prednost u kretanju vredi više od pune flaše vode. */
    if (z.next && (z.warn || z.shrinking || z.peek)) {
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

  /* Zone dima — u njima kamera ne radi nikome. Moraju da se vide na mapi,
     inače igrač ne zna zašto mu se meta odjednom ne pojavljuje u kadru. */
  function drawSmoke(list) {
    const want = list || [];
    L_.smoke = L_.smoke || [];
    while (L_.smoke.length > want.length) map.removeLayer(L_.smoke.pop());
    want.forEach((z, i) => {
      const c = [z.lat, z.lng];
      if (!L_.smoke[i]) {
        L_.smoke[i] = L.circle(c, {
          radius: z.radiusM, color: '#9CA3AF', weight: 2, dashArray: '6 6',
          fillColor: '#9CA3AF', fillOpacity: .22, interactive: false,
        }).addTo(map);
      } else { L_.smoke[i].setLatLng(c); L_.smoke[i].setRadius(z.radiusM); }
    });
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

  /* Ti si zelen, protivnici crveni, saveznici plavi — bez razmišljanja. */
  function drawPlayers(list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      const cls = `mk-p ${p.kind}`;
      let m = L_.players.get(p.id);
      if (!m) { m = L.marker([p.lat, p.lng], { icon: div(cls), interactive: false }).addTo(map); L_.players.set(p.id, m); }
      else { m.setLatLng([p.lat, p.lng]); if (m._cls !== cls) m.setIcon(div(cls)); }
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
    map, setMe, recenter, drawZone, drawFire, drawWasps, drawSmoke, drawItems, drawPlayers, drawTraps, setStart, drawFog,
    setVision(v) { if (v === visionM) return; visionM = v; autoZoom(); drawFog(); },
    setFull(v) { if (v === fullMap) return; fullMap = v; drawFog(); },
    /** Pun pregled arene ne sme da juri igrača — inače se vraća na zum oko tebe. */
    setFollow(v) { follow = !!v; },
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
