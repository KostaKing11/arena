# ARENA — gde smo sada

**Verzija 1.1.0.** Igra je odigrana od početka do kraja na pravom telefonu, kao instalirana
aplikacija. Ovo je fajl koji se čita PRVI kad se počinje iz čista mira.

- Živo: <https://kostaking11.github.io/arena/>
- Test sa botovima: dugme „Testiraj sa botovima" na početnom ekranu (traži razvojne opcije)
- `npm test` — 296 provera u 25 sekcija, sve zelene

---

## Šta je igra

GPS igra Igara gladi u stvarnom svetu. Telefon je mapa, inventar i oružje. Napada se tako što
se protivnik **uslikaju kamerom** iz odgovarajuće razdaljine. Nema servera: statični sajt na
GitHub Pages + Firebase Realtime Database.

Tri pravila drže sve na okupu (§0 u [`SPEC.md`](SPEC.md)):

1. **Sve nasumično se izračuna JEDNOM, iz seed-a, u `schedule`, sa apsolutnim vremenima.**
   Telefoni samo gledaju sat i izvode stanje sveta. Niko nikome ništa ne javlja.
2. **Svaki igrač piše samo svoj čvor** `players/{pid}`. Glad, žeđ i šteta se računaju iz
   proteklog vremena, ne tajmerom — zato je tačno i kad se telefon vrati posle deset minuta.
3. **Sat je zajednički** (`.info/serverTimeOffset` → `Clock.now()`). Lokalni `Date.now()` se
   nikad ne koristi za pravila.

---

## Šta se promenilo u odnosu na SPEC.md

`SPEC.md` je i dalje merodavan za sve što ovde nije nabrojano, ali je na sledećim mestima
prevaziđen. Ovo je jedini pouzdan spisak:

| Oblast | Kako je sada |
|---|---|
| **Borba** | Sekcije 7, 8, 9 iz SPEC-a **ne važe** — zamenjuje ih [`BORBA-V4.md`](BORBA-V4.md). Nema rundi, nema chase-a, nema `fights/` ni `chase/`. Napad je nišanjenje kamerom, držanje dugmeta, jedan udarac. |
| **Dan i noć** | Nije više događaj koji se kupuje. Ide po satu: **pun dan 10 min — 5 svetlih, 5 mračnih**, počinje danom. Zato trajanje partije uvek ide u koracima od 10 min. |
| **Događaji** | Raspored ih **ne baca nasumično**. Puštaju ih duhovi za iskre, ili **arena sama** posle polovine partije ako je utihnula (vidi dole). Najviše jedan tip po partiji, ukupan budžet po trajanju. |
| **Nebo** | Ekran „Nebo" sa licima poginulih je **izbačen**. Smrt ide samo kroz objave, i to bez uzroka — „Ime — nema ga više". |
| **Mentor** | Minigejmovi izbačeni. Naklonost dolazi **isključivo od tributa** (vidi dole). Mentor ima mapu, zadatke i limite po trajanju. |
| **Duhovi** | Žive VAN zone, u prstenu oko nje. Imaju svoj ekran sa tri kartice: Dogovor (čet), Događaji, Igrači. |
| **Savezi** | Ne nude se više sa ekrana nišanjenja — kamera je samo napad. Savez se nudi iz trake „Saveznici". |
| **Predmeti** | [`PREDMETI.md`](PREDMETI.md) je i dalje tačan spisak od 41 predmeta, ali su **opisi sada u kodu**, u `i18n.js` pod `NAMES.itemDesc` — tamo se menjaju. |

---

## Sistemi koji su gotovi i testirani

**Duhovi.** Sakupljaju iskre u prstenu van zone (geometrija je čista funkcija FAZE, ne trenutka
— inače iskre beže). Ekran ima tri kartice. Događaji su podeljeni na *Pomoć živima* i *Nevolje*,
sa cenom i opisom, čitljivi i kad se ne mogu kupiti. Kad ih ima više od dvoje, kupovina ide
glasanjem, uz bravu nad `gmVotes/{type}/committed` da dvoje ne skinu istu kasu.

**Mentor v2.** Naklonost dolazi od onoga što uradi tribut:

| Razlog | Naklonost |
|---|---|
| ostao u zoni kad se skupila | 1 |
| oborio protivnika | 3 |
| uzeo legendarni predmet | 2 |
| ušao u poslednjih pet (jednom) | 3 |
| ispunio zadatak | 2 |

Svaki upis ide i u dnevnik, pa mentor vidi ZAŠTO ga je dobio i kada. Zadaje jedan od tri
ponuđena zadatka (nikad slobodan tekst — to bi bio kanal za dogovaranje). Limiti po trajanju:
pola sata 2 zadatka i 2 paketa, sat 4 i 4, sat i po 6 i 5. Mapa: tribut zeleno uživo, saveznici
plavo uživo, **ostali crvene tačke bez imena sa 30 s zakašnjenja** — namerno, da mentor ne
može da javi telefonom ko prilazi.

**Arena se umeša.** Posle polovine partije, ako je utihnula, arena sama ubaci događaj — ali
bira ga prema stanju: izgladnelima i prebijenima pomoć (gozba, sanduk), sitima i čitavima
nevolju koja ih tera u pokret (suša ako plivaju u vodi, inače zid vatre pa ose). Budžet je
**zajednički sa duhovima**, pa se dva izvora ne mogu sabrati.

**Povratak i ekran.** Wake Lock dok partija traje. Zapis o partiji u `arena.session`; ako
partija traje, povratak ne pita ništa nego vodi pravo u igru. Brojač nesvesti **miruje dok je
aplikacija skrivena** (`hiddenAtMs`) — inače bi svako gašenje ekrana obaralo igrača.

---

## Objavljivanje — obavezno preko `tools/bump.js`

Ovo je jedina stvar koju **ne smeš da radiš ručno**. GitHub Pages šalje `max-age=600`, a na
hladnom startu stranica se učita pre nego što je servisni radnik preuzme — pa je telefon umeo
da ostane na starom kodu i posle dva ponovna pokretanja.

```bash
node tools/bump.js 1.1.1
```

Upisuje verziju na **četiri mesta odjednom**: `kit.js` (`APP_VERSION`), `sw.js` (ime keša),
`version.json`, i **26 adresa u `index.html`** (`js/app.js?v=1.1.1`). Nove adrese = keš nema
šta staro da posluži. Uz to aplikacija na startu i pri svakom povratku iz pozadine pita
`version.json` i, ako se razlikuje, ode na `?v=NOVA` — obično `location.reload()` NIJE dovoljno
jer ponovo učita isti keširani `index.html`.

Posle toga: commit, push, pa sačekaj da se objavi:

```bash
until curl -s "https://kostaking11.github.io/arena/version.json?cb=$RANDOM" | grep -q "1.1.1"; do sleep 8; done
```

---

## Testiranje na telefonu

Instalirana aplikacija (Samsung Internet WebAPK), ne tab u browseru:

```bash
adb shell monkey -p com.sec.android.app.sbrowser.webapk.we0259eb91cc554db131b9ddc1335cd991 -c android.intent.category.LAUNCHER 1
```

Ponovno pokretanje posle objave: `adb shell am force-stop <PKG>` pa gornja komanda. Snimak:
`adb exec-out screencap -p > shot.png`. Ekran je 1080×2340 fizički, **384×782 CSS px** u
standalone režimu.

**Nikad ne koristi `adb shell input keyevent 4` (BACK).** Izbacuje aplikaciju iz prvog plana,
pa sledeći tapovi odu u tuđu aplikaciju. Koristi dugmad za nazad u samoj aplikaciji, i proveri
šta je u prvom planu pre svakog tapa:

```bash
adb shell dumpsys window | grep -m1 mCurrentFocus
```

Za brzo prolaženje partije: **razvojne opcije** (tapni verziju 7 puta u podešavanjima) →
**Test panel** → kartica *Svet*: +1/+5/+10 min, skok na sledeću zonu, ručno puštanje svakog
događaja, ubijanje bota, punjenje kase, bacanje predmeta. Pomeranje vremena pomera ceo raspored
(`R.shiftSchedule`), pravila ostaju nedirnuta.

---

## Raspored fajlova

```
docs/js/core/    rules.js (SVA pravila, deli se sa testovima preko UMD), i18n.js, icons.js, util.js, haptics.js
docs/js/net/     clock.js (zajednički sat), store.js (Firebase, sesija, čet duhova)
docs/js/game/    engine.js (otkucaj, host prelazi), items.js, combat.js, encounter.js, mentor.js, bots.js
docs/js/ui/      screens.js (~2500 linija, svi ekrani), kit.js (holdFill, sheet, modal), map.js, sensors.js
test/simulate.js provere pravila bez mreže i browsera
tools/bump.js    JEDINI ispravan način da se podigne verzija
```

---

## Šta još nije viđeno uživo

Ovo su jedine stvari koje nikad nisu potvrđene na terenu, sa dva prava telefona:

- **specijali klasa** (Senkin ubod u leđa, Strelčev precizan hitac, Snagatorov nasrtaj…)
- **mreža** (zapetljavanje) i **duvaljka** (otrov)
- **izdaja saveza** i **upozorenje žrtvi da je neko nišani**
- **prag za držanje koji prati grešku GPS-a** — popravljeno posle poslednjeg testa, ali
  provereno samo u zatvorenom. Prvo pri sledećoj igri: priđi predmetu i zadrži karticu.
- **arena koja se sama umeša** — pravilo je pokriveno testovima kroz vreme, ali traži pola
  partije da prođe, pa ga niko još nije video na terenu.

---

## Istorijski fajlovi (ne prati ih, samo za kontekst)

[`PLAN.md`](PLAN.md), [`POPRAVKE-1.md`](POPRAVKE-1.md),
[`PROMPTOVI-ZA-CLAUDE-CODE.md`](PROMPTOVI-ZA-CLAUDE-CODE.md) — spiskovi zadataka iz ranijih
rundi. **Sve iz njih je odrađeno.** Ostavljeni su jer objašnjavaju zašto neke stvari izgledaju
kako izgledaju.
