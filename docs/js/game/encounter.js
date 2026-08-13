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

  /* — kandidati — */
  function candidatesInCone(d) {
    const me = d.me, pos = Geo.pos, heading = Compass.heading;
    if (!me || !pos) return { list: [], noHeading: true };
    const isArcher = me.classId === 'archer';
    const maxM = isArcher ? R.PHOTO_MAX_ARCHER_M : R.PHOTO_MAX_M;
    const now = Clock.now();
    const out = [];
    for (const [pid, p] of Object.entries(Store.players())) {
      if (pid === Store.myId || p.alive === false || !p.pos) continue;
      if (p.hiddenUntilMs > now) continue;                 // kamuflažni ogrtač
      if (p.classId === 'shadow' && p.allianceId !== me.allianceId) continue;   // Senka je nevidljiva (§5)
      if ((me.immuneTo || {})[pid] > now) continue;        // 60 s posle bekstva (§9)
      const m = U.dist(pos, p.pos);
      if (m > maxM) continue;
      const brg = U.bearing(pos, p.pos);
      const diff = heading == null ? 0 : Math.abs(U.angleDiff(heading, brg));
      if (heading != null && diff > R.PHOTO_CONE_DEG) continue;
      out.push({ pid, p, distM: m, bearing: brg, angleDiff: diff });
    }
    return { list: out, noHeading: heading == null };
  }

  /** Uslikaj i rangiraj. Vraća {ok, reason, candidates, shotDataUrl}. */
  async function shoot(d, canvas) {
    const now = Clock.now();
    if (now - lastShotMs < R.PHOTO_COOLDOWN_MS) {
      return { ok: false, reason: 'cooldown', waitS: Math.ceil((R.PHOTO_COOLDOWN_MS - (now - lastShotMs)) / 1000) };
    }
    if (!video || !video.videoWidth) return { ok: false, reason: 'nocamera' };

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    // Pregled je uvećan CSS-om, pa i snimak mora da bude isečen na isti deo
    // slike — inače detektor gleda jedno a igrač vidi drugo, a procena
    // razdaljine (koja deli visinu zumom) ispadne dvostruko pogrešna.
    const sw = video.videoWidth / zoom, sh = video.videoHeight / zoom;
    const sx = (video.videoWidth - sw) / 2, sy = (video.videoHeight - sh) / 2;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const shot = canvas.toDataURL('image/jpeg', 0.5);

    const { list, noHeading } = candidatesInCone(d);
    if (!list.length) {
      lastShotMs = now;
      return { ok: false, reason: noHeading ? 'nocone' : 'nocone', shotDataUrl: shot };
    }

    let boxes = null;
    if (detectorReady()) boxes = detectPersons(canvas);
    // Ako detektor nije dostupan, preskačemo filter 2 umesto da blokiramo igru.
    if (boxes && boxes.length === 0) {
      lastShotMs = now;
      return { ok: false, reason: 'noperson', shotDataUrl: shot };
    }

    const estM = boxes && boxes.length
      ? boxes.map((b) => estimateDistance(b.h, canvas.height)).sort((a, b) => a - b)
      : null;

    const ranked = list.map((c) => {
      let score = 100 - c.angleDiff * 2.2;                       // pravac je glavni kriterijum
      if (estM && estM.length) {
        const best = estM.reduce((m, e) => Math.min(m, Math.abs(e - c.distM)), Infinity);
        score += Math.max(0, 30 - best * 1.5);                   // poklapanje razdaljine
      }
      return { ...c, score };
    }).sort((a, b) => b.score - a.score);

    lastShotMs = now;
    return { ok: true, candidates: ranked, shotDataUrl: shot, usedDetector: !!boxes };
  }

  /* — akcije posle izbora — */
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

  /** Pokreni borbu iz slikanja. Razdaljina se računa iz GPS-a, nikad iz zuma. */
  async function startFight(pid, distM, betrayal) {
    const me = Store.me();
    const band = R.distanceBand(distM, me.classId === 'archer');
    if (band < 0) { toast(T('aimTooFar'), 'danger'); return null; }
    const last = (me.lastFight || {})[pid] || 0;
    if (Clock.now() - last < R.FIGHT_COOLDOWN_MS) { toast(T('photoCooldown'), 'danger'); return null; }
    const fid = await Store.openFight(pid, band, { betrayal });
    if (!fid) { toast(T('aimBlocked'), 'danger'); return null; }
    if (betrayal) {
      await Store.pushFeed({ type: 'betrayal', subjectId: Store.myId, targetId: pid, scope: 'all' });
      // izdaja nožem: 25 štete odmah (§10)
      if (me.weapon === 'knife') {
        const f = Store.fights()[fid];
        const isA = f && f.a === Store.myId;
        await Store.fightRef(fid).update(isA ? { hpB: Math.max(0, f.hpB - 25) } : { hpA: Math.max(0, f.hpA - 25) });
      }
      await Store.updateMe({ allianceId: null });
    }
    Haptics.fire('hit');
    return fid;
  }

  /* — napad na daljinu, samo Strelac (§7) — */
  function rangedBlocked(d, target) {
    const me = d.me;
    if (me.classId !== 'archer' || me.weapon !== 'bow') return 'class';
    if ((me.arrows || 0) <= 0) return 'ammo';
    if (Clock.now() - (me.lastShotMs || 0) < R.RANGED_COOLDOWN_MS) return 'cooldown';
    if (d.outsideZone) return 'zone';
    const acc = Geo.accuracy;
    if (acc == null || acc > R.RANGED_MIN_ACC_M) return 'gps';
    if (target && (target.pos.accM || 99) > R.RANGED_MIN_ACC_M) return 'gpsTarget';
    // ako se strelac nije pomerio 20 m u poslednjih 5 min — kamperisanje
    if (me.lastMoveMs && Clock.now() - me.lastMoveMs > 300000) return 'stale';
    return null;
  }

  async function fireRanged(targetId, onProgress) {
    const me = Store.me();
    const startPos = Geo.pos;
    const target = Store.players()[targetId];
    if (!startPos || !target || !target.pos) return { hit: false, reason: 'gps' };
    const targetStart = { ...target.pos };

    await Store.ref(`players/${targetId}/incomingShot`).set({
      from: Store.myId, atMs: Clock.now(),
      bearing: U.bearing(target.pos, startPos),
    });

    const t0 = Date.now();
    return new Promise((res) => {
      const iv = setInterval(async () => {
        const el = Date.now() - t0;
        onProgress && onProgress(el / R.RANGED_AIM_MS);
        if (Geo.pos && U.dist(startPos, Geo.pos) > R.RANGED_SELF_MOVE_M) {
          clearInterval(iv); await finish(false, 'moved'); return;
        }
        if (el >= R.RANGED_AIM_MS) {
          clearInterval(iv);
          const now = Store.players()[targetId];
          const dodged = now && now.pos && U.dist(targetStart, now.pos) > R.RANGED_DODGE_M;
          await finish(!dodged, dodged ? 'dodged' : null);
        }
      }, 200);

      async function finish(hit, reason) {
        await Store.ref(`players/${targetId}/incomingShot`).remove();
        await Store.updateMe({ lastShotMs: Clock.now(), arrows: Math.max(0, (me.arrows || 0) - 1) });
        if (hit) {
          const t = Store.players()[targetId];
          const dmg = R.ownsWeapon(me) ? 30 : 22;
          const hp = Math.max(0, (t.hp || 0) - dmg);
          await Store.ref(`players/${targetId}`).update({ hp });
          await Store.updateMe({ damageDone: (me.damageDone || 0) + dmg });
          if (hp <= 0) {
            await Store.ref(`players/${targetId}`).update({ alive: false, deathAtMs: Clock.now(), killedBy: Store.myId, deathCause: 'shot' });
            await Store.pushFeed({ type: 'death', subjectId: targetId, killerId: Store.myId, scope: 'all', cause: 'shot' });
          }
          // strela pada kod žrtve (§6)
          if (t.pos) await Store.dropItem('arrows', 'uncommon', t.pos.lat, t.pos.lng, 1);
        }
        // svaki hitac ide u feed vidljiv duhovima, sa slikom-dokazom (§7)
        await Store.pushFeed({ type: 'shot', subjectId: Store.myId, targetId, hit: !!hit, scope: 'ghosts' });
        res({ hit, reason });
      }
    });
  }

  return {
    openCamera, stop, setZoom, get zoom() { return zoom; },
    loadDetector, detectorReady, get detectorState() { return detectorState; },
    detectPersons, estimateDistance, candidatesInCone, shoot,
    proposeAlliance, respondAlliance, startFight, rangedBlocked, fireRanged,
    get lastShotMs() { return lastShotMs; },
  };
})();
