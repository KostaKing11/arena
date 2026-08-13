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

## 1. Kvarovi sa utvrđenim uzrokom

### 1.1 Borba: primicanje i odmicanje su obrnuti  ⚠️ najgore
`docs/js/ui/screens.js`, oko linije 817:

```js
const near = 6, far = 34;
$('#figMe').style.left  = (near + (far - near) * t) + '%';   // t = distance/5
$('#figFoe').style.right = (near + (far - near) * t) + '%';
```

Na razdaljini **0** oba lika idu na **6%** od svoje ivice — dakle na suprotne krajeve ekrana.
Na razdaljini **5** idu na 34%, tj. jedan do drugog u sredini. Tačno obrnuto od stvarnosti.
Treba: `34 − 28·t` (blizu centra kad je razdaljina mala, ka ivicama kad raste).

Proveri i da traka razdaljine ispod (`.dtrack .pip`) prati isto, i da je pojas dometa oružja
(`.rngband`) na istoj skali.

### 1.2 Lobi se ponovo iscrtava na svaku promenu u bazi → klizači i mapa ne rade
`docs/js/app.js:32` — `Store.on('room', () => route())`, a `route()` na liniji 299 zove
`UI.renderLobby()`, koja prepiše ceo `#lobbyBody`. Pošto igrači upisuju poziciju svakih par
sekundi, lobi se prepisuje stalno. Posledice:

- **klizači** (prečnik, trajanje, gustina, priprema) pucaju usred prevlačenja — to je onih „90%
  vremena zabagovani"
- **mapa arene ne radi uopšte**: `makeMap('setupMap')` (`screens.js:197`) zakači Leaflet za čvor
  koji sledeće iscrtavanje obriše, pa mapa ostaje da visi nad odvojenim elementom

Rešenje: razdvoji „iscrtaj jednom" od „osveži podatke". Spisak igrača i dugme *Pokreni* smeju da
se osvežavaju stalno; mapa i klizači se prave **jednom** i posle se samo ažuriraju vrednosti.

### 1.3 „Mapa" i „Centriraj" rade istu stvar
`app.js:124` i `app.js:126` — oba zovu `UI.gmap.recenter()` kad si živ. Odluči šta je šta:
predlog je da gornje dugme centrira, a donje otvara **punu mapu arene** (pregled cele arene,
zona, tvoja pozicija) — to sada nigde ne postoji.

### 1.4 Kompas je isečkan
`renderCompass` se poziva iz otkucaja motora (1×/s) i svaki put prepisuje `innerHTML`. Zato
skače umesto da klizi. Treba: iscrtaj crtice **jednom**, a na svaki događaj kompasa (desetine
puta u sekundi) pomeraj traku sa `transform: translateX(...)`. Uz to proveri zašto se slova
strana sveta (S, SI, I…) ne vide — verovatno ih zaklanja/odseca visina trake.

---

## 2. Traženo, a nije urađeno

**Lobi i kartica igrača**
- ukloni zelenu oznaku „ima sve dozvole" sa kartice igrača — više nije potrebna otkako se
  dozvole traže unapred
- **mentor ide na tvoju karticu**: dugme na svojoj kartici šalje link; kad ga neko prihvati,
  ispod tebe se prikaže manja kartica sa imenom mentora (mentor nema lika)
- **sponzorski link šalje mentor**, ne igrač
- **promena lika mora da radi i u lobiju**
- „centar arene" preimenovati u **arena**, uz dugme da postaviš svoju lokaciju

**Izgled i osećaj**
- **animacije**: prekidači (jezik, tema) da klize, ne da se teleportuju; prelazi između ekrana
- **QR ikonica je loša** — nacrtaj bolju
- ikone za život, glad, žeđ i oružja da budu bolje
- eventovi i skupljanje zone da se bolje vide

**Test režim**
- **kretanje tapom po mapi** u testu — sada sa botovima stojiš u mestu i ništa se ne dešava

**Ranije prijavljeno, i dalje otvoreno**
- slika lica je **ogledalo** (`transform: scaleX(-1)` na video) i **premala**
- duhu inventar pokazuje samo broj iskri
- naziv „Tvorac igara" promeniti
- potvrditi da pun ekran stvarno radi u instaliranoj aplikaciji (WebAPK pamti `display` od
  trenutka instalacije — treba obrisati ikonu i instalirati ponovo)
- `npm run test:fb` i `npm run test:live` su pisani za stari protokol i ne rade

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
