/* ═══════════════════════════════════════════════════════════════════════════
   SUSRET — slikanje umesto QR koda (§7).

   Tri filtera rade zajedno:
   1. PRAVAC — iz kompasa znaš kuda kamera gleda, iz GPS-a azimut do kandidata.
      Prolaze samo oni u konusu ±30° (kompas na telefonu greši 15–20°).
   2. OSOBA U KADRU — MediaPipe detektor objekata, samo klasa `person`.
      Ne prepoznavanje lica: lice na 25 m je 20 piksela.
   3. RANGIRANJE — visina okvira osobe daje procenu razdaljine; poredi se sa
      GPS razdaljinom. Rang = razlika azimuta (glavno) + poklapanje razdaljine.
   ═══════════════════════════════════════════════════════════════════════════ */
const Encounter = (() => {
  'use strict';

  let stream = null, video = null, detector = null, detectorState = 'idle';
  let lastShotMs = 0, zoom = 1;

  /* — kamera — */
  async function openCamera(videoEl, facing) {
    video = videoEl;
    if (stream) stop();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing || 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    return true;
  }
  function stop() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  function setZoom(z) {
    zoom = U.clamp(z, 1, 3);
    if (video) video.style.transform = `scale(${zoom})`;
    return zoom;
  }

  /* — detektor osoba; ako ne uspe da se učita, radimo bez njega — */
  async function loadDetector() {
    if (detectorState === 'ready' || detectorState === 'loading') return detectorState === 'ready';
    detectorState = 'loading';
    try {
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
      const files = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      detector = await vision.ObjectDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
        },
        scoreThreshold: 0.35, runningMode: 'IMAGE', maxResults: 12,
      });
      detectorState = 'ready';
      return true;
    } catch (e) {
      console.warn('detektor osoba nije dostupan:', e);
      detectorState = 'failed';
      return false;
    }
  }
  const detectorReady = () => detectorState === 'ready';

  /** Vrati okvire detektovanih osoba na slici. */
  function detectPersons(canvas) {
    if (!detector) return null;
    try {
      const res = detector.detect(canvas);
      return (res.detections || [])
        .filter((d) => (d.categories || []).some((c) => c.categoryName === 'person'))
        .map((d) => ({
          x: d.boundingBox.originX, y: d.boundingBox.originY,
          w: d.boundingBox.width, h: d.boundingBox.height,
          score: d.categories[0].score,
        }));
    } catch { return null; }
  }

  /** Procena razdaljine iz visine okvira. Visina se deli faktorom zuma (§7). */
  function estimateDistance(boxH, frameH) {
    if (!boxH || !frameH) return null;
    const h = boxH / zoom;
    // gruba pinhole procena: čovek 1.7 m, vidno polje ~55°
    const fPx = frameH / (2 * Math.tan(U.toRad(55 / 2)));
    return U.clamp((1.7 * fPx) / h, 1, 120);
  }

  /* — kandidati —
     Konus se računa uživo, bez slikanja: ekran nišanjenja stalno pokazuje ko
     ti je u pravcu i na kojoj razdaljini. Slika i detekcija osobe se traže tek
     kad se pritisne dugme za nišanjenje. */
  function candidatesInCone(d) {
    const me = d.me, pos = Geo.pos, heading = Compass.heading;
    if (!me || !pos) return { list: [], noHeading: true };
    const now = Clock.now();
    // dokle vidiš zavisi od TVOG oružja — sa pesnicama nemaš šta da tražiš na 30 m
    const maxM = R.visibleRangeM(R.weaponOf(me));
    /* Dim: u zoni od 20 m kamera ne detektuje NIKOGA — ni onog ko ju je
       bacio. Zato se ovde izbacuju i meta u dimu i sve mete ako si ti u
       dimu: nije pasivni buff nego zona u kojoj borbe nema. */
    const smoke = R.smokeZones(Store.players(), now);
    if (R.inSmoke(smoke, pos)) return { list: [], inSmoke: true };
    const out = [];
    for (const [pid, p] of Object.entries(Store.players())) {
      if (pid === Store.myId || p.alive === false || !p.pos) continue;
      if (p.hiddenUntilMs > now) continue;                 // kamuflažni ogrtač
      if (R.inSmoke(smoke, p.pos)) continue;               // meta je u dimu
      if (p.classId === 'shadow' && p.allianceId !== me.allianceId) continue;   // Senka je nevidljiva (§5)
      const m = U.dist(pos, p.pos);
      if (m > maxM) continue;
      const brg = U.bearing(pos, p.pos);
      const diff = heading == null ? 0 : Math.abs(U.angleDiff(heading, brg));
      if (heading != null && diff > R.PHOTO_CONE_DEG) continue;
      out.push({
        pid, p, distM: m, bearing: brg, angleDiff: diff,
        ally: !!(p.allianceId && p.allianceId === me.allianceId),
      });
    }
    out.sort((a, b) => a.angleDiff - b.angleDiff);
    return { list: out, noHeading: heading == null, inSmoke: false };
  }

  /* — savezi — */
  async function proposeAlliance(pid) {
    const me = Store.me();
    const size = R.maxAllianceSize(Store.playerCount());
    const aid = me.allianceId;
    if (aid) {
      const n = Object.values(Store.players()).filter((p) => p.allianceId === aid && p.alive !== false).length;
      if (n >= size) { toast(T('allianceFull'), 'danger'); return; }
    }
    await Store.ref(`players/${pid}/allyOffer`).set({ from: Store.myId, atMs: Clock.now() });
    toast(T('actAlliance'), 'good', 'handshake');
  }
  async function respondAlliance(fromId, accept) {
    await Store.ref(`players/${Store.myId}/allyOffer`).remove();
    if (!accept) return;
    const from = Store.players()[fromId];
    let aid = from.allianceId || Store.me().allianceId;
    if (!aid) {
      const used = new Set(Object.values(Store.players()).map((p) => p.allianceId).filter(Boolean));
      let n = 1; while (used.has('t' + n)) n++;
      aid = 't' + n;
      await Store.ref(`players/${fromId}/allianceId`).set(aid);
    }
    await Store.updateMe({ allianceId: aid });
    await Store.pushFeed({ type: 'alliance', subjectId: Store.myId, scope: 'self' });
    toast(T('allianceAccepted'), 'good', 'handshake');
  }

  /* ═══════════════════ NIŠANJENJE ═══════════════════
     Jedini način napada. Držiš dugme onoliko koliko oružje traži; ako se
     pomeriš preko 5 m, promašaj. Oružja sa upozorenjem u tom trenutku javljaju
     žrtvi odakle je gađaju, pa ona ima priliku da se pomeri preko 8 m.

     Vraća objekat sa `promise` i `cancel()` — otpuštanje dugmeta pre vremena
     prekida nišanjenje bez ispaljivanja. */
  function startAim(d, targetId, opts) {
    opts = opts || {};
    const me = d.me;
    const w = opts.weapon || R.weaponOf(me);
    const aimMs = opts.aimMs != null ? opts.aimMs : w.aimMs;
    const startPos = Geo.pos;
    const target = Store.players()[targetId];
    let cancelled = false, done = false;

    if (!startPos || !target || !target.pos) {
      return { cancel() {}, promise: Promise.resolve({ ok: false, reason: 'gps' }) };
    }
    const targetStart = { ...target.pos };
    const warns = opts.warns != null ? opts.warns : R.warnsAt(w, U.dist(startPos, targetStart));

    // upozorenje kreće ODMAH, ne na kraju — žrtva mora da ima šta da uradi
    if (warns) {
      Store.ref(`players/${targetId}/incomingAim`).set({
        from: Store.myId, weapon: w.id, atMs: Clock.now(),
        aimMs, bearing: U.bearing(targetStart, startPos),
      }).catch(() => {});
    }

    const t0 = Date.now();
    const promise = new Promise((res) => {
      const iv = setInterval(async () => {
        if (cancelled) { clearInterval(iv); await clean(); res({ ok: false, reason: 'cancelled' }); return; }
        const el = Date.now() - t0;
        if (opts.onProgress) opts.onProgress(Math.min(1, el / aimMs));

        // napadač se pomerio → promašaj
        if (Geo.pos && U.dist(startPos, Geo.pos) > R.AIM_SELF_MOVE_M) {
          clearInterval(iv); done = true; await clean();
          res({ ok: true, miss: true, reason: 'moved', distM: U.dist(Geo.pos, targetStart) });
          return;
        }
        if (el >= aimMs) {
          clearInterval(iv); done = true;
          await clean();
          const now = Store.players()[targetId];
          const nowPos = (now && now.pos) || targetStart;
          const dodged = U.dist(targetStart, nowPos) > R.AIM_DODGE_M;
          const distM = Geo.pos ? U.dist(Geo.pos, nowPos) : U.dist(startPos, nowPos);
          if (dodged) { res({ ok: true, miss: true, reason: 'dodged', distM }); return; }
          res({ ok: true, miss: false, distM });
        }
      }, 100);

      async function clean() {
        if (!warns) return;
        try { await Store.ref(`players/${targetId}/incomingAim`).remove(); } catch {}
      }
    });

    return { promise, cancel() { if (!done) cancelled = true; } };
  }

  /** Uslikaj kadar i potvrdi da u njemu ZAISTA ima osobe (filter 2 iz §3). */
  async function confirmPerson(canvas) {
    const now = Clock.now();
    if (now - lastShotMs < R.PHOTO_COOLDOWN_MS) {
      return { ok: false, reason: 'cooldown', waitS: Math.ceil((R.PHOTO_COOLDOWN_MS - (now - lastShotMs)) / 1000) };
    }
    if (!video || !video.videoWidth) return { ok: false, reason: 'nocamera' };

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    // Pregled je uvećan CSS-om, pa i snimak mora biti isečen na isti deo slike
    const sw = video.videoWidth / zoom, sh = video.videoHeight / zoom;
    const sx = (video.videoWidth - sw) / 2, sy = (video.videoHeight - sh) / 2;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const shot = canvas.toDataURL('image/jpeg', 0.5);

    if (!detectorReady()) return { ok: true, photo: shot, usedDetector: false };
    const boxes = detectPersons(canvas);
    if (boxes && boxes.length === 0) {
      lastShotMs = now;                     // 15 s da se kamera ne koristi kao radar
      return { ok: false, reason: 'noperson', photo: shot };
    }
    return { ok: true, photo: shot, usedDetector: true, boxes };
  }

  return {
    openCamera, stop, setZoom, get zoom() { return zoom; },
    loadDetector, detectorReady, get detectorState() { return detectorState; },
    detectPersons, estimateDistance, candidatesInCone,
    confirmPerson, startAim,
    proposeAlliance, respondAlliance,
    get lastShotMs() { return lastShotMs; },
  };
})();