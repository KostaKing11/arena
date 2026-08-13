# ARENA — radni spisak

Stanje na dan poslednje izmene. Merodavna je [`SPEC.md`](SPEC.md); ovde stoji **šta je
pokvareno i šta sledeće**, sa već utvrđenim uzrocima da se ne troši vreme na ponovno traženje.

Živo: https://kostaking11.github.io/arena/ · test sa botovima: dugme na početnom ekranu
(ili `/arena/test`) · dijagnostika senzora: `/arena/diag.html`

---

## 0. Prvo uradi ovo

**Odigraj jednu celu test partiju sam, na telefonu, i gledaj tok** — ne samo pojedine ekrane.
Većina primedbi nije „ovaj piksel", nego „ne razumem šta se dešava i kako se ovo igra".
Konkretno: da li je iz borbe jasno šta radi koje dugme, da li se vidi gde je protivnik, i da li
posle GONG-a znaš šta ti je sledeći potez.

Postavka za rad na pravom telefonu (Samsung SM-A576B, Android 16, Samsung Internet):

```bash
adb reverse tcp:3000 tcp:3000
```

```bash
npm run dev
```

Na telefonu otvori `http://localhost:3000/?test=1` — `adb reverse` daje **siguran kontekst**, pa
GPS, kamera i kompas rade nad lokalnim serverom. Snimak ekrana:

```bash
adb exec-out screencap -p > shot.png
```

Tap i prevlačenje: `adb shell input tap X Y`, `adb shell input swipe X1 Y1 X2 Y2 300`.
Ekran je 1080×2340 fizički, **384×686 CSS px** — sve mora da stane u to.

---

## 1. Urađeno u ovoj rundi

Sve provereno na telefonu (SM-A576B, Samsung Internet, preko `adb reverse`), osim gde piše drugačije.

### 1.1 Borba: primicanje i odmicanje su bili obrnuti  ✔
`screens.js` — sada `34 − 28·t`: razdaljina **0** stavlja oba lika na 34% od svoje ivice (u
sredini, jedan drugom u lice), razdaljina **5** na 6% (svako na svom kraju). Provereno kroz
DOM za svih šest razdaljina.

Uz to je borba objašnjena, jer se iz naziva poteza nije videlo šta rade:
- svako dugme ima ishod ispod naslova — *Napad −30 HP*, *Blok −60% štete*, *Priđi 5 → 4*
- nemoguć potez je ugašen sa razlogom (*Van dometa*, *Već ste u klinču*, *Dalje ne može*)
- nove ikonice `stepIn`/`stepOut` — strelice ka sredini i od sredine
- traka dometa piše *Sad si na 3 · Luk 3–5 · Napad*, sa „?" koje otvara pravila borbe

### 1.2 Lobi se prepisivao na svaku promenu u bazi  ✔
Podeljeno na `buildLobby()` (skelet, mapa, klizači — jednom) i `updateLobby()` (brojke, spisak
igrača, dugme *Pokreni*). Klizači imaju zastavicu `dragging` pa se ne diraju dok je prst na
njima. **Mapa arene sada radi** — u lobiju se vide ulice i krug arene.

### 1.3 „Mapa" i „Centriraj" razdvojeni  ✔
Gornje dugme centrira pogled na tebe. Donje otvara **punu mapu arene**: granica, zona,
kornukopija, vidljivi igrači i predmeti, legenda. Osvežava se dok je otvorena.

### 1.4 Kompas  ✔
Pojas od dva puna kruga se crta jednom, a na svaki događaj kompasa se pomera preko
`translateX` — klizi umesto da skače. **Slova strana sveta se sada vide**: uzrok je bio to što
je oznaka nosila klasu `card`, pa je iz `components.css` dobijala tamnu ploču sa 16 px razmaka
i ispadala ispod ivice trake visine 38 px. Klasa uklonjena, traka podignuta na 46 px.

### 1.5 Ostalo iz spiska  ✔
- kartica igrača: zelene oznake dozvola uklonjene; tvoja kartica je prva, sa zlatnom ivicom
- **mentor je na tvojoj kartici**; kad neko prihvati link, ispod tebe stoji uža kartica sa
  njegovim imenom (mentor nema lika)
- **promena lika radi u lobiju** — tap na svoj avatar, upisuje se odmah u bazu
- „centar arene" → **arena**
- **kretanje tapom u testu**: tap po mapi (i po punoj mapi arene) te vodi tamo peške, 1,4 m/s;
  u PREP fazi postoji i *Test: odšetaj do startne tačke* — bez toga se u testu do startne
  tačke uopšte nije stizalo, pa partija nije ni kretala
- animacije: prekidači (tema, jezik, raspored) imaju **klizeću pločicu**; prelazi između ekrana
- **nova QR ikonica**, prepravljene ikone za život, glad i sva oružja
- **slika lica**: isečak sada prati oval sa ekrana (lice popunjava kadar), 320×320 umesto 240,
  i okreće se po širini jer je prednja kamera daje u ogledalu

---

## 2. Ostaje za sledeću rundu

- **eventovi i skupljanje zone da se bolje vide** — zona se crta, ali najava faze i zid vatre
  su i dalje slabo primetni
- **sponzorski link šalje mentor**, ne igrač
- duhu inventar pokazuje samo broj iskri
- naziv „Tvorac igara" promeniti
- potvrditi da pun ekran stvarno radi u instaliranoj aplikaciji (WebAPK pamti `display` od
  trenutka instalacije — treba obrisati ikonu i instalirati ponovo)
- `npm run test:fb` i `npm run test:live` su pisani za stari protokol i ne rade
- **ekran borbe nije viđen u živoj partiji** — u dva pokušaja sa botovima do borbe nije došlo
  (zona me ubila pre toga). Ispravka je proverena kroz DOM, ali vredi je videti na terenu.
- botovi retko napadaju: čekaju da im priđeš, a sami idu ka centru zone; razmisliti o tome da
  u testu budu agresivniji

---

## 3. Šta NE dirati

- arhitektura bez servera: raspored se generiše jednom u `schedule` sa apsolutnim vremenima,
  svaki igrač piše samo svoj `players/{pid}`, sat ide preko `.info/serverTimeOffset`
- `/arena/test` je ista aplikacija sa flagom, ne kopija koda
- `manifest.json`: `start_url` i `scope` su `/arena/`
- zastavica `leftRadius` u `chase/{fid}` (§9) — bez nje borba puca odmah po bekstvu
- `npm test` (100+ provera pravila) mora da ostane zeleno

---

## 4. Gde je šta

```
docs/js/core/    util (RNG, geo) · rules (SVA pravila) · i18n · icons · haptics
docs/js/net/     clock (serverTimeOffset) · store (Firebase)
docs/js/ui/      kit · avatar (likovi) · nav (dugme nazad) · sensors · map · screens
docs/js/game/    engine · items · combat (+ potera) · encounter · mentor · bots
docs/css/        tokens · base · components · screens · game
```
