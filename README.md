# ARENA — Igre gladi IRL

GPS igra u stvarnom svetu. Telefon je mapa, inventar i oružje. Implementacija prati
[`SPEC.md`](SPEC.md) — ta specifikacija je merodavna, ovaj fajl je uputstvo za pokretanje.

Statični sajt (GitHub Pages) + Firebase Realtime Database. **Nema servera.**

- **Igra:** https://kostaking11.github.io/arena/
- **Test sa botovima:** https://kostaking11.github.io/arena/test

---

## Kako radi bez servera

Tri pravila iz §0 drže sve na okupu:

1. **Sve vremenske stvari se izračunaju jednom, na startu.** Zona, eventovi i nebo idu u
   `schedule` sa **apsolutnim** vremenima. Telefoni samo gledaju sat i izvode stanje sveta —
   niko ništa ne mora nikome da javlja.
2. **Svaki igrač piše samo svoj čvor** `players/{pid}`. Glad, žeđ i šteta od zone se računaju
   **iz proteklog vremena** preko `lastTickMs`, ne tajmerom. Zato je tačno i kad se telefon
   vrati iz pozadine posle deset minuta.
3. **Sat je zajednički** — `.info/serverTimeOffset`. Telefoni znaju da se razlikuju i po
   nekoliko minuta, pa se lokalni `Date.now()` nikad ne koristi za pravila igre.

Borbu presuđuje `resolveRound` — čista funkcija koju oba telefona izvrše nezavisno i dobiju
isti rezultat. Transakcija na `fights/{fid}` sprečava da se runda odigra dvaput.

---

## Podešavanje (jednom)

1. [console.firebase.google.com](https://console.firebase.google.com) → projekat `igre-gladi-irl`
2. **Realtime Database → Rules** → nalepi [`firebase-rules.json`](firebase-rules.json) → Publish
3. **Authentication → Sign-in method → Anonymous → Enable**
4. Config je već u [`docs/js/firebase-config.js`](docs/js/firebase-config.js)

Provera da je sve na mestu:

```bash
npm run test:live
```

## Objavljivanje

```bash
git add -A && git commit -m "opis" && git push
```

Pages servira granu `main`, folder `/docs`. Za minut-dva je živo.

---

## Testiranje

**Pravila igre** — 80+ provera: determinizam sveta, špil klasa, 5 faza zone, spawn predmeta,
borba sa dometima i specijalima, glad i žeđ iz proteklog vremena, bekstvo, konzumiranje.
Bez mreže i browsera:

```bash
npm test
```

**Firebase sloj** protiv lokalnog emulatora:

```bash
npm run emu
```

```bash
npm run test:fb
```

**Lokalni sajt:** `npm run dev` → `http://localhost:3000`. Uz emulator dodaj `?emu=1`.

> Emulatoru treba Java 21+. Sa starijom: `npx firebase-tools@13 emulators:start --only database,auth --project demo-arena`

**Botovi:** `/arena/test` je ista aplikacija sa upaljenim flagom (`?test=1`), ne kopija koda.
Botovi hodaju 1,4 m/s, skreću ka predmetima, napadaju na 20 m i beže ispod 30 HP. Vodi ih
domaćinov telefon.

---

## Struktura

```
docs/                        ← ovo GitHub Pages servira
  index.html                 kostur svih ekrana
  test/index.html            /arena/test → ista app sa flagom
  manifest.json  sw.js  icons/
  css/    tokens · base · components · screens · game
  js/core/    util (RNG, geo) · rules (SVA pravila) · i18n · icons · haptics
  js/net/     clock (serverTimeOffset) · store (Firebase)
  js/ui/      kit · sensors (GPS, kompas, wake lock) · map · screens
  js/game/    engine (otkucaj) · items · combat (+ potera) · encounter · bots
  js/app.js   pokretanje i rutiranje
tools/make-icons.js          generator PNG ikona
test/simulate.js             pravila, bez mreže
test/integration.js          Firebase sloj protiv emulatora
test/verify-live.js          provera pravog projekta
```

## Dizajn

Igra se napolju, po suncu, u hodu, jednom rukom — to diktira ceo UI:

- krupna tipografija, dugmad **min 56 px** (glavna 64), ništa kritično u gornjoj trećini ekrana
- **noćna tema** podrazumevano + **dnevni režim visokog kontrasta** za jako sunce (meni → ⋯)
- jedna paleta: ugljenisano crna, žar-narandžasta i zlatna. **Crvena samo za opasnost.**
  Retkosti predmeta zadržavaju svoje boje (siva/zelena/plava/ljubičasta/zlatna)
- mapa je pun ekran; inventar i kamera su donja traka nadohvat palca
- animira se samo ono što nosi napetost: skupljanje zone, odbrojavanje bekstva, nišanjenje, nebo
- vibracija je deo dizajna: predmet u blizini, zona, top, pogodak, dolazeći hitac
- ikonice su pravi SVG set, bez ijednog emodžija

## Ograničenja

- **Telefon mora da bude budan.** Browseri guše tajmere u pozadini (Chrome na ~1/min), pa se
  zaključan ekran vidi kao zamrznut igrač. App drži wake lock dok igra traje.
- Bez servera nema zaštite od varanja — ko otvori konzolu vidi bazu. Za društvo je to u redu.
- GPS u gradu greši 10–20 m. Zato je domet borbe 15 m, a kupljenje 10 m.
- Detekcija osobe na slici (MediaPipe) se povlači sa CDN-a. Ako ne uspe da se učita, slikanje
  i dalje radi — samo bez filtera „ima li koga u kadru".

## Bezbednost

Igrači trče napolju gledajući u telefon. Dogovorite granice arene (ne preko prometnih ulica),
bez privatnih poseda, bez trčanja po mraku tamo gde može da se povredi. Borba je **u telefonu**.
