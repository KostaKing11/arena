/* Leaflet omotac: mapa arene, magla rata (fog of war), markeri. */

/* ─────────────────────────────────────────────────────────────────────────
   IZVOR MAPE
   Podrazumevano: CARTO dark (besplatno, bez API kljuca, tamna estetika).
   Ako jednog dana hoces Google mape:
     1) uzmi kljuc na console.cloud.google.com (Maps Tile / Static API, traze karticu)
     2) zameni TILES ispod nekim Google-kompatibilnim slojem
   Google Maps JS SDK ne radi kroz Leaflet bez plugina, pa je Carto ovde
   i lepsi i jednostavniji izbor.
   ───────────────────────────────────────────────────────────────────────── */
const TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  maxZoom: 20, maxNativeZoom: 19, subdomains: 'abcd',
};
const TILES_SAT = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Esri, Maxar, Earthstar Geographics',
  maxZoom: 20, maxNativeZoom: 18,
};

const MapView = (() => {
  const icon = (cls, html = '') => L.divIcon({ className: 'mk', html: `<div class="${cls}">${html}</div>`, iconSize: [0, 0] });

  /* ───────────── mapa u čekaonici (postavljanje arene) ───────────── */
  function initSetup(el, onPick) {
    const map = L.map(el, { zoomControl: false, attributionControl: true, tap: true })
      .setView([44.8125, 20.4612], 14);
    L.tileLayer(TILES.url, TILES).addTo(map);
    let ring = null, dot = null, center = null, radius = 400;

    const draw = () => {
      if (!center) return;
      if (!ring) {
        ring = L.circle(center, { radius, color: '#e8b64c', weight: 2, dashArray: '6 8', fillColor: '#ff6a1a', fillOpacity: 0.07 }).addTo(map);
        dot = L.marker(center, { icon: icon('mk-loot', '🏛️') }).addTo(map);
      } else { ring.setLatLng(center).setRadius(radius); dot.setLatLng(center); }
    };
    map.on('click', (e) => { center = e.latlng; draw(); onPick && onPick(center); });
    setTimeout(() => map.invalidateSize(), 250);

    return {
      map,
      setCenter(c, fly = true) { center = L.latLng(c.lat, c.lng); draw(); if (fly) map.setView(center, Math.max(map.getZoom(), 15)); onPick && onPick(center); },
      setRadius(r) { radius = r; draw(); if (center) map.fitBounds(ring.getBounds().pad(0.25)); },
      get center() { return center ? { lat: center.lat, lng: center.lng } : null; },
      refresh() { map.invalidateSize(); },
    };
  }

  /* ───────────── mapa u igri ───────────── */
  function initGame(el) {
    const map = L.map(el, { zoomControl: false, attributionControl: true, tap: true })
      .setView([44.8125, 20.4612], 17);
    const base = L.tileLayer(TILES.url, TILES).addTo(map);
    let sat = null, satOn = false;

    const layers = {
      arena: null, arena0: null, corn: null, vision: null, me: null, spawn: null,
      hazards: new Map(), loot: new Map(), contacts: new Map(), finale: null,
    };
    let follow = true, lastMe = null, onLootClick = null, onMapTap = null;

    map.on('dragstart', () => { follow = false; document.getElementById('btnCenter')?.classList.add('badge'); });
    map.on('move zoom', () => drawFog());
    map.on('click', (e) => onMapTap && onMapTap({ lat: e.latlng.lat, lng: e.latlng.lng }));
    setTimeout(() => map.invalidateSize(), 200);

    let visionM = 150, night = false;
    function drawFog() {
      const fog = document.getElementById('fog');
      if (!fog || !lastMe) return;
      const p = map.latLngToContainerPoint(lastMe);
      const mpp = 40075016.686 * Math.cos((lastMe.lat * Math.PI) / 180) / (256 * Math.pow(2, map.getZoom()));
      const r = Math.max(40, visionM / mpp);
      const dark = night ? 0.93 : 0.86;
      fog.style.background =
        `radial-gradient(circle ${r * 2.2}px at ${p.x}px ${p.y}px,` +
        `rgba(0,0,0,0) 0, rgba(0,0,0,0) ${r}px,` +
        `rgba(4,4,7,.55) ${r * 1.12}px, rgba(4,4,7,${dark}) ${r * 1.6}px)`;
    }

    function setMe(pos) {
      lastMe = L.latLng(pos.lat, pos.lng);
      if (!layers.me) layers.me = L.marker(lastMe, { icon: icon('mk-me'), zIndexOffset: 1000 }).addTo(map);
      else layers.me.setLatLng(lastMe);
      if (follow) map.setView(lastMe, map.getZoom(), { animate: true, duration: 0.4 });
      drawFog();
    }

    function recenter() {
      follow = true;
      document.getElementById('btnCenter')?.classList.remove('badge');
      if (lastMe) map.setView(lastMe, 17, { animate: true });
    }

    function update(s, myPos) {
      visionM = s.vision || 150;
      night = !!s.night;

      if (s.arena) {
        const c = [s.arena.center.lat, s.arena.center.lng];
        if (!layers.arena) {
          layers.arena0 = L.circle(c, { radius: s.arena.radius0 || s.arena.radius, color: '#4a4438', weight: 1, dashArray: '3 9', fill: false, interactive: false }).addTo(map);
          layers.arena = L.circle(c, { radius: s.arena.radius, color: '#e8b64c', weight: 2, dashArray: '8 10', fillColor: '#ff6a1a', fillOpacity: 0.04, interactive: false }).addTo(map);
          layers.corn = L.marker(c, { icon: icon('mk-loot', '🏛️'), interactive: false }).addTo(map);
        } else layers.arena.setLatLng(c).setRadius(s.arena.radius);
      }

      // opasne zone
      const seenH = new Set();
      for (const h of s.hazards || []) {
        seenH.add(h.id);
        const active = s.now >= h.activeAt;
        let c = layers.hazards.get(h.id);
        if (!c) {
          c = L.circle([h.center.lat, h.center.lng], { radius: h.radius, color: '#c0392b', weight: 2, fillColor: '#c0392b', fillOpacity: 0.12, interactive: false }).addTo(map);
          layers.hazards.set(h.id, c);
        }
        c.setStyle({ dashArray: active ? null : '6 8', fillOpacity: active ? 0.26 : 0.1 });
      }
      for (const [id, c] of layers.hazards) if (!seenH.has(id)) { map.removeLayer(c); layers.hazards.delete(id); }

      // startna pozicija
      if (s.phase === 'deploy' && s.you.spawn) {
        const sp = [s.you.spawn.lat, s.you.spawn.lng];
        if (!layers.spawn) layers.spawn = L.marker(sp, { icon: icon('mk-spawn'), interactive: false }).addTo(map);
        else layers.spawn.setLatLng(sp);
      } else if (layers.spawn) { map.removeLayer(layers.spawn); layers.spawn = null; }

      // finale — meta u centru
      if ((s.phase === 'finale' || s.phase === 'ended') && s.arena) {
        const c = [s.arena.center.lat, s.arena.center.lng];
        if (!layers.finale) layers.finale = L.circle(c, { radius: s.cfg.finaleReachM || 30, color: '#ffcf6b', weight: 3, fillColor: '#ffcf6b', fillOpacity: 0.18, interactive: false }).addTo(map);
      } else if (layers.finale) { map.removeLayer(layers.finale); layers.finale = null; }

      // plen
      const seenL = new Set();
      for (const l of s.loot || []) {
        seenL.add(l.id);
        let m = layers.loot.get(l.id);
        const cls = `mk-loot r${l.rarity}${l.inReach ? ' reach' : ''}`;
        const glyph = l.feast ? '🎁' : l.isCorn ? '📦' : '🎒';
        if (!m) {
          m = L.marker([l.lat, l.lng], { icon: icon(cls, glyph) }).addTo(map);
          m.on('click', () => onLootClick && onLootClick(l));
          layers.loot.set(l.id, m);
        } else if (m._cls !== cls) m.setIcon(icon(cls, glyph));
        m._cls = cls;
      }
      for (const [id, m] of layers.loot) if (!seenL.has(id)) { map.removeLayer(m); layers.loot.delete(id); }

      // kontakti
      const seenC = new Set();
      (s.contacts || []).forEach((c, i) => {
        const key = c.id || `blip${i}`;
        seenC.add(key);
        let pos;
        if (c.lat != null) pos = [c.lat, c.lng];
        else if (myPos) {
          // priblizna tacka na osnovu smera i grube udaljenosti
          const rad = (c.brg * Math.PI) / 180, R = 6371000;
          const la = (myPos.lat * Math.PI) / 180;
          pos = [
            myPos.lat + ((c.dist * Math.cos(rad)) / R) * (180 / Math.PI),
            myPos.lng + ((c.dist * Math.sin(rad)) / (R * Math.cos(la))) * (180 / Math.PI),
          ];
        } else return;
        const cls = c.band === 'ally' ? 'mk-ally' : c.band === 'near' ? 'mk-blip' :
                    c.band === 'dead' ? 'mk-dead' : 'mk-foe';
        const glyph = c.band === 'dead' ? '💀' : '';
        let m = layers.contacts.get(key);
        if (!m) { m = L.marker(pos, { icon: icon(cls, glyph), interactive: false }).addTo(map); layers.contacts.set(key, m); }
        else { m.setLatLng(pos); if (m._cls !== cls) m.setIcon(icon(cls, glyph)); }
        m._cls = cls;
      });
      for (const [id, m] of layers.contacts) if (!seenC.has(id)) { map.removeLayer(m); layers.contacts.delete(id); }

      if (myPos) setMe(myPos);
    }

    function toggleSat() {
      satOn = !satOn;
      if (satOn) { sat = L.tileLayer(TILES_SAT.url, TILES_SAT).addTo(map); map.removeLayer(base); }
      else { if (sat) map.removeLayer(sat); base.addTo(map); }
    }

    return {
      map, update, recenter, drawFog, toggleSat,
      set onLoot(f) { onLootClick = f; },
      set onTap(f) { onMapTap = f; },
      refresh() { map.invalidateSize(); drawFog(); },
    };
  }

  return { initSetup, initGame };
})();
