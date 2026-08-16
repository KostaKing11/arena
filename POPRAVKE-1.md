> 🗄️ **Istorijski fajl — sve iz njega je odradjeno.** Ostavljen je jer objasnjava zasto neke
> stvari izgledaju kako izgledaju. Za trenutno stanje idi na [`STANJE.md`](STANJE.md).

# ARENA — popravke posle prvih 5 promptova

Kod prolazi `npm test` (172 provere) i sintaksa je čista. Sve što sledi su stvari koje
testovi ne hvataju jer testiraju funkcije pojedinačno, a ne ponašanje kroz vreme.

Poređano po težini. **Prva je blokirajuća** — sve ostalo može i posle.

---

## PROMPT A — BLOKER: iskre se teleportuju dok se zona skuplja

Ovo obara ceo duhovski sistem tokom otprilike **četvrtine partije**.

```
BAG: iskre menjaju položaj svake sekunde dok se zona skuplja. Izmereno na seedu 's1',
arena 500 m, 45 min: ista iskra (isti id) pomera se do 634 m tokom jednog skupljanja.
Domet kupljenja je 10 m, pa je iskra u tom periodu praktično nemoguća za skupiti.

Skupljanje traje 162 s i dešava se 4 puta po partiji — dakle skoro 11 minuta od 45
duhovi jure iskre koje beže. Van skupljanja sve radi normalno, zato se ne primeti odmah.

UZROK: u docs/js/core/rules.js, generateSparks(seed, cfg, playerCount, zonePhase, zone)
računa prsten iz ŽIVIH vrednosti zone:

  const center = (zone && zone.center) || cfg.center;
  const inner  = (zone ? zone.radiusM : cfg.diameterM / 2) + SPARK_ZONE_MARGIN_M;

Ali zoneAt() tokom skupljanja vraća radiusM i center kao LERP koji se menja svake
sekunde, dok `phase` ostaje isti. Identitet iskre (id, iz rng seedovanog fazom) je
stabilan, a geometrija nije. Gore od pomeranja: U.scatter koristi
pointInCircle(rng, center, maxR, minR) — kad se minR promeni, ceo niz nasumičnih brojeva
se drugačije preslika, pa se iskre ne pomere nego POTPUNO promešaju.

ISPRAVKA: geometrija prstena mora da bude čista funkcija FAZE, ne trenutka.

U docs/js/core/rules.js dodaj pomoćnu funkciju i izvezi je:

  /* Zakovana geometrija zone za datu fazu — ono na šta se zona SLEGLA, ne ono
     kroz šta trenutno prolazi. Duhovski prsten mora da stoji dok faza traje. */
  function zoneAtPhaseSettled(schedule, cfg, phase) {
    const z = (schedule && schedule.zone) || [];
    if (!phase || !z[phase - 1]) return { center: cfg.center, radiusM: cfg.diameterM / 2 };
    const ph = z[phase - 1];
    return { center: { lat: ph.centerLat, lng: ph.centerLng }, radiusM: ph.radiusM };
  }

Pazi na indeks: zoneAt vraća phase = i + 1 kad je faza gotova, a phase = i dok se
skuplja U nju. Znači faza N opisuje stanje POSLE zone[N-1]. Faza 0 = puna arena.

generateSparks menja potpis na (seed, cfg, playerCount, zonePhase, schedule) i unutra
zove zoneAtPhaseSettled da dobije center i radiusM. Ne prima više živi `zone` objekat.

U docs/js/game/items.js, sparks(d): prosledi Store.schedule() umesto d.zone, a fazu i
dalje iz (d.zone && d.zone.phase) || 0.

Proveri i FINAL_TWO: docs/js/game/engine.js u derive() polovi radiusM u FINAL_TWO bez
promene faze — posle ove ispravke to više ne dira iskre, što je i ispravno.

TEST u test/simulate.js, sekcija o duhovima — dodaj proveru koja bi ovo uhvatila:
  Za svaku fazu uzmi zoneAt na startMs i na atMs-500 (dakle početak i kraj skupljanja),
  generiši iskre za obe i proveri da je pomeraj svake iskre TAČNO 0 m.
  Ovo je provera kroz vreme, ne provera jedne funkcije — zato je stara nije uhvatila.
```

---

## PROMPT B — isplata za event ide samo poslednjem glasaču

```
BAG: u docs/js/app.js, buyEvent() — kad ima više od 2 duha, event se kupuje glasanjem,
ali `buyerId: Store.myId` upisuje samo onaj duh koji je slučajno bacio POSLEDNJI glas.

Posledica: docs/js/game/engine.js (oko linije 413) proverava ev.buyerId !== Store.myId i
šalje 'myEvent' samo njemu. Svi ostali duhovi koji su glasali — i čije su iskre otišle u
zajednički bazen — ne dobiju ništa. To ruši baš onu petlju zbog koje je PROMPT 3 i
rađen: skupljaš iskre → kupiš event → vidiš šta si napravio.

ISPRAVKA:
1. U buyEvent(), pre clearVotes, pokupi sve glasače:
     const voters = Object.keys((Store.room.gmVotes || {})[type] || {});
     ev.buyerIds = voters.length ? voters : [Store.myId];
   Zadrži i ev.buyerId radi kompatibilnosti sa starim zapisima.

2. U docs/js/game/engine.js zameni proveru:
     const mine = (ev.buyerIds || []).includes(Store.myId) || ev.buyerId === Store.myId;
     if (!ev || !mine) continue;

3. Sitna trka koju usput popravi: spendSparks() i clearVotes() nisu atomični, pa dva
   duha koja istovremeno pređu prag mogu oba da kupe event i dvaput skinu iskre.
   Uslovi glasanja se čitaju iz lokalnog keša odmah posle upisa. Prebaci odluku u
   transakciju nad `gmVotes/{type}/committed` — ko prvi postavi, taj kupuje.
```

---

## PROMPT C — tri sitnije stvari odjednom

```
Tri nezavisne sitnice, sve u kodu koji je upravo dodat.

1. MAPA U GLEDANJU PRESTANE DA PRATI ZAUVEK.
   docs/js/ui/screens.js, oko linije 1723: `watchFollow` se postavlja na true samo
   unutar `if (!wmap) {...}`, dakle jednom u životu ekrana. Čim jednom prevučeš mapu
   prstom, watchFollow padne na false i VIŠE SE NIKAD ne vrati — ni kad zatvoriš ekran,
   ni kad počneš da gledaš drugog igrača.
   Ispravka: postavi watchFollow = true u openWatch(), uz watchSeenHit = null.

2. MRTAV TERNAR.
   docs/js/ui/screens.js oko linije 1823, u redu istorije udaraca:
     esc(mine ? nm(h.attackerId) : nm(h.attackerId))
   obe grane su iste. Verovatno je trebalo da bude nm(h.attackerId) uvek, ili da se
   moj/tuđi udarac razlikuju. Odluči šta je nameravano i skloni ternar.

3. NEMA LIMITA NA VELIČINU SLIKE U BAZI.
   firebase-rules.json: slike lica imaju ".validate": "newData.val().length < 200000",
   a `hits` čvor nema nikakvo ograničenje na photoRef — iako se tamo sad upisuje slika
   iz svakog napada. Dodaj pod "hits"/"$hid":
     "photoRef": { ".validate": "!newData.exists() || newData.val().length < 60000" }
   60 000 je taman za sličicu od 480 px pri kvalitetu 0.4 koja se sada šalje.
```

---

## Šta sam proverio a ISPRAVNO je

Da ne trošiš vreme na ponovnu proveru:

- **Smanjivanje slika radi.** `encounter.js` pravi `thumb` na 480 px / kvalitet 0.4, i
  `screens.js` šalje `conf.thumb || conf.photo` i u običnom napadu i u specijalu. Pun
  kadar ostaje lokalno.
- **Id-jevi iskri nose fazu** (`s0_0`, `s1_0`…), pa se skupljene iskre iz različitih faza
  ne sudaraju u `sparks/collected`.
- **Prsten prati centar zone**, ne centar arene — što je tačno, jer zona drifta.
- **`ghostInZone` je uvezan kako treba:** iskre se ne crtaju, dugmad za eventove su
  ugašena, baner se prikazuje, kompas duha pokazuje ka najbližoj iskri.
- **Mentorska sesija se pamti** u `localStorage` pod `arena.mentor`, i ime mentora ide i
  na `players/{pid}/mentorName` — igrač sada vidi da ga ima.
- **Podešavanja u igri** idu kroz `gameMenuSheet()`, pun ekran samo u lobiju i na kraju.
- **Svi CSS razredi koje JS pravi imaju pravila** — proverio sam svih pet CSS fajlova
  protiv svake `class="..."` u `screens.js` i `index.html`. Ništa ne fali.
- **Nijedan i18n ključ ne fali** ni u SR ni u EN, uključujući sve nove `fx_*`.
- **Nema `Screens.go()` ka ekranu koji ne postoji** u `index.html`.

## Jedna stvar koja nije bag ali će se osetiti

Kad zona pređe u sledeću fazu, **sve neskupljene iskre nestanu i pojave se novi komplet**
na drugom mestu. To je posledica dizajna koji smo hteli (prsten prati zonu), ali duh koji
je u tom trenutku pešačio ka iskri ostaje bez cilja bez ikakvog objašnjenja.

Ako se u testu pokaže neprijatno, najjeftinije rešenje je poruka duhu kad se faza
promeni — „zona se skupila, iskre su se premestile" — a ne menjanje mehanike. Ostavi za
posle, kad probaš uživo.

## Kako da ovo testiraš bez izlaska napolju

`npm run dev`, pa `/test` sa botovima. Za duhove: pusti se da umreš (ili preko
razvojnih opcija u podešavanjima), pa gledaj traku iskri dok se zona skuplja. **Pre
PROMPTA A** iskre će vidno skakati po mapi svake sekunde tokom skupljanja — to je
najbrži način da potvrdiš i bag i popravku.
