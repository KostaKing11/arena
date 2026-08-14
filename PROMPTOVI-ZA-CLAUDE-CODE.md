# ARENA — promptovi za Claude Code

Pet celina, poređanih po tome koliko vrede za uloženo vreme. **Šalji jedan po jedan** i
pusti `npm test` posle svakog. Svaki prompt je samostalan — ima imena fajlova i funkcija,
pa Claude Code ne mora da traži po kodu.

Stanje na kom se ovo nastavlja: predmeti su na **v5** (`PREDMETI.md`), borba je **v4**
(`BORBA-V4.md`), `npm test` prolazi 165 provera.

---

## PROMPT 1 — Mentor u lobi (uradi ovo prvo)

```
Mentorski sistem u ARENI radi, ali ga niko nikad nije video jer nema ulaz.

Trenutno je jedini put do mentorskog linka: budi u igri → otvori podešavanja nasred
partije → red "Mentor link" → pošalji nekome → taj ga otvori dok ti trčiš. To je pet
koraka od kojih se tri dešavaju dok si napolju i trčiš. Niko to nikad neće uraditi.

Premesti poziv mentora u LOBI — jedini trenutak kad svi stoje u mestu, zajedno, sa
vremenom.

ŠTA URADITI:

1. docs/js/ui/screens.js, funkcija buildLobby/updateLobby (oko linije 131-300):
   Dodaj karticu "Tvoj mentor" u lobi, ispod postojećih. Sadrži:
   - dugme "Pozovi mentora" koje otvara modal sa QR kodom i linkom
   - link je Mentor.mentorLinkFor(Store.code, Store.myId) — funkcija već postoji u
     docs/js/game/mentor.js
   - QR pravi isto kao postojeći showQr() u screens.js (oko linije 307) — iskoristi
     istu qrcode() biblioteku i istu strukturu modala, ne piši novu
   - ako igrač VEĆ ima mentora, kartica umesto dugmeta pokazuje ime mentora i
     "Promeni" dugme

2. docs/js/game/mentor.js, funkcija claim():
   Kad neko preuzme mentorstvo, upiši i ime mentora na igračev čvor:
   players/{pid}/mentorName. Igrač trenutno nema pojma da li mentora uopšte ima.

3. docs/js/ui/screens.js, renderGame() (oko linije 574):
   Kad me.mentorName postoji, prikaži malu ikonicu 'users' u traci efekata
   (#fxBar, funkcija renderEffects oko linije 681) — ne kao odbrojavač nego kao
   stalni čip sa imenom mentora. Tap na njega otvara kratak modal "Tvoj mentor: X".

4. docs/js/app.js, oko linije 486-540 (blok sa incomingHit/incomingAim/decoyHit):
   Dodaj toast kad ti neko postane mentor — isti obrazac kao decoyHit, sa novom
   promenljivom mentorShown. Tekst: novi i18n ključ 'mentorClaimed'.

5. docs/js/game/mentor.js:
   Mentorska sesija se gubi ako mentor zatvori tab. Zapamti {room, pid} u
   localStorage pod ključem 'arena.mentor' pri claim(), i pri učitavanju aplikacije
   (docs/js/app.js, funkcija boot/route) vrati mentora na svoj ekran ako taj zapis
   postoji i soba je još živa.

6. docs/js/core/i18n.js: dodaj sve nove ključeve i na SR i na EN.
   Novi ključevi: inviteMentor, yourMentor (postoji, proveri), mentorClaimed,
   changeMentor, mentorQrBody.

NE DIRAJ: mentorske izazove, cene paketa, PACKAGE_TIERS, renderMentor. Sistem radi —
menja se samo kako se do njega dolazi.

Na kraju pusti `npm test`.
```

---

## PROMPT 2 — Duhovi žive van zone

Ovo je najveća promena u paketu i rešava pravi problem uživo: duhovi koji šetaju kroz
arenu zbunjuju žive igrače. Umesto da im aplikacija govori da se lepo ponašaju, igra ih
sama razvodi.

```
U ARENI duhovi (mrtvi igrači) skupljaju iskre uživo i troše ih na eventove. Problem: iskre
su rasute po celoj areni, pa duhovi šetaju kroz igru i zbunjuju žive igrače koji ne znaju
ko je još u partiji.

Rešenje: DUHOVI ŽIVE VAN ZONE. Živi igrači MORAJU biti u zoni (van nje gube život), pa je
prostor van zone prirodno prazan. Kako se zona skuplja, duhovska teritorija RASTE — a to
je i tematski lepo: teren koji je igra napustila pripada mrtvima.

ŠTA URADITI:

1. docs/js/core/rules.js — zameni generateSparks:

   Trenutno se sve iskre naprave jednom, po celoj areni, iz seed-a. Umesto toga
   napravi generateSparks(seed, cfg, playerCount, zonePhase, zone) koja ih rasipa u
   PRSTENU oko centra TRENUTNE zone:

     inner = (zone ? zone.radiusM : cfg.diameterM/2) + SPARK_ZONE_MARGIN_M
     outer = Math.max(inner + 40, cfg.diameterM/2 + GHOST_OUTER_M)

   Nove konstante, izvezi ih: SPARK_ZONE_MARGIN_M = 20, GHOST_OUTER_M = 60.

   Centar prstena je centar ZONE, ne arene — zona se pomera kroz partiju.
   Determinizam: U.rngFor(seed, 'sparks', zonePhase). Id iskre mora da nosi fazu
   (npr. 's' + zonePhase + '_' + i) da se skupljene iskre iz različitih faza ne
   sudaraju u sparks/collected.

   Na fazi 0 zona je cela arena, pa prsten pada IZVAN granice arene — to je u redu i
   namerno: na startu skoro niko nije mrtav. Sistem se sam balansira, kasno u partiji
   je zona mala a duhovski prsten ogroman.

2. docs/js/game/items.js, funkcija sparks(d) (oko linije 33):
   Prosledi trenutnu fazu i zonu iz d.zone. Iskra se i dalje kupi na SPARK_REACH_M.

3. docs/js/game/engine.js, funkcija derive():
   Dodaj u izvedeno stanje: out.ghostOutside = (duh je van zone). Duh NE gubi život
   u zoni — mrtav je — ali treba da zna gde mu je mesto.

4. docs/js/ui/screens.js, renderGhost(d) i renderGame(d):
   Kad je duh UNUTAR zone, prikaži jasan crveni baner: "U zoni si — vrati se napolje,
   ovde zbunjuješ žive igrače" (novi i18n ključ ghostInZone). Dok je unutra:
   - iskre se ne prikazuju na mapi (ionako ih tamo nema)
   - dugmad za kupovinu eventova su onemogućena
   Kompas duha (renderCompass) dobija strelicu ka najbližoj iskri, da ima kuda.

5. docs/js/ui/map.js, drawZone:
   Za duha zonu crtaj obrnuto — njegov teren je VAN kruga. Dodaj opciju
   drawZone(z, cfg, {ghost:true}) koja senči unutrašnjost umesto spoljašnjosti, da
   duhu odmah bude jasno gde ne sme.

6. test/simulate.js — dodaj sekciju "12. Duhovi van zone":
   - iskre su determinističke po fazi
   - nijedna iskra nije bliža od 20 m ivici zone
   - kad se zona skupi, prsten iskri je veći nego u prethodnoj fazi
   - id-jevi iskri iz različitih faza se ne poklapaju

Na kraju pusti `npm test`.
```

---

## PROMPT 3 — Duhovi: prava traka i zatvorena petlja

```
Ekran duha u ARENI (docs/js/ui/screens.js, renderGhost oko linije 1512) je meni, a ne
doživljaj. Dve konkretne stvari fale.

PRVA: duh i dalje gleda svoje HP, glad i žeđ u #vitals. Mrtav je, to mu ne znači ništa.

U renderGame(d), kad je me.alive === false, zameni sadržaj #vitals duhovskom trakom:
  - iskre koje je on lično skupio (me.sparksCollected — dodaj brojač u
    docs/js/game/items.js, collectSpark)
  - zajednički bazen (Store.sparks().pool)
  - koliko fali do najjeftinijeg eventa koji još nije kupljen
  - koliko je igrača još živo
Traka efekata (#fxBar) se duhu ne prikazuje uopšte.

DRUGA, važnija: petlja se nikad ne zatvara. Skupljaš iskre uživo → kupiš zid vatre → i
onda NIŠTA. Ne vidiš šta si napravio, pa skupljanje nema poentu.

U docs/js/game/engine.js, funkcija maintainDrops / tickHost — kad se kupljeni event
stvarno pokrene (Store.room.liveEvents), emituj novi događaj 'myEvent' preko Engine.emit
onom duhu čiji je glas kupio event (upiši buyerId pri kupovini u docs/js/app.js,
funkcija buyEvent oko linije 424).

U docs/js/app.js, na Engine.on('myEvent'): otvori punu mapu arene, centriraj na mesto
eventa, i prikaži poruku "Ovo si ti pustio" (novi i18n ključ yourEvent) sa imenom eventa.
Vibracija Haptics.fire('cannon'), zvuk Sfx.warn().

Ovo je jedini trenutak isplate za sav trud oko iskri — neka bude glasan.

Dodaj i18n ključeve na SR i EN. Na kraju pusti `npm test`.
```

---

## PROMPT 4 — Pravo gledanje igrača (uključujući kadrove iz borbe)

Ovo je najbolji deo toga što si mrtav i trenutno ga nema. **I skoro sve što treba već
postoji u bazi** — slike iz napada se već upisuju u `hits/`.

```
U ARENI duh može da "prati" živog igrača, ali to je čekboks: upiše se players/{me}/
following i ne desi se ništa (docs/js/ui/screens.js, renderGhost oko linije 1553).

Napravi pravo gledanje. Novi ekran #s-watch (docs/index.html, po uzoru na #s-ghost),
render funkcija renderWatch(d) u screens.js:

1. Mapa centrirana na praćenog igrača, prati ga uživo (makeMap iz docs/js/ui/map.js,
   setFollow na njegovu poziciju umesto na moju).

2. Njegova kartica: avatar, ime, klasa, oružje, HP / glad / žeđ, aktivni efekti preko
   R.activeEffects(p, d.now), koliko predmeta nosi.

3. ŽIVI FEED NJEGOVIH UDARACA iz Store.hits() — filtriraj po attackerId === pid ili
   victimId === pid, sortiraj po atMs opadajuće. Svaki red: oružje, razdaljina, šteta
   ili promašaj, ko koga.

4. KADROVI IZ BORBE. Ovo je poenta i podatak već postoji: docs/js/game/combat.js,
   funkcija land() upisuje photoRef u hits/ — to je puna data URL slika koju je
   napadač snimio. Kad praćeni igrač napadne, duhu se preko celog ekrana prikaže ta
   slika sa brojem štete preko nje, 2 s, pa se skloni. To je pravi trenutak "video sam
   kad ga je sredio".

   VAŽNO — usput popravi problem koji već postoji: te slike se pišu u Realtime
   Database u punoj veličini (canvas.toDataURL('image/jpeg', 0.5) je 50–150 KB po
   udarcu). U docs/js/game/encounter.js, confirmPerson() — napravi drugu, malu
   verziju snimka (max 480 px šira strana, kvalitet 0.4) i SAMO nju šalji kao
   photoRef. Puna slika ostaje lokalno za prikaz napadaču.

5. Kad praćeni igrač NIŠANI (players/{pid}/incomingAim postoji), prikaži duhu
   upozorenje "nišani" — napetost pred udarac.

6. Dugme "prestani da pratiš" vraća na #s-ghost. Dugme u renderGhost menja se sa
   čekboksa na "Gledaj" i vodi na #s-watch.

7. docs/js/app.js: registruj ekran u route() i u petlji renderovanja (oko linije 463,
   gde stoji `else if (s === 'ghost')`). Dodaj 'watch' u listu iz linije 302 koja
   sprečava preusmeravanje.

Dodaj i18n ključeve na SR i EN. Na kraju pusti `npm test`.
```

---

## PROMPT 5 — Podešavanja u igri

Najmanji posao u paketu, ostavljen za kraj namerno.

```
U ARENI dugme #btnMenu tokom igre otvara CEO ekran podešavanja (docs/js/app.js,
openSettings oko linije 155 → Screens.go('settings')). Nasred partije, dok stojiš na
ulici, to je pogrešno: nudi ti temu, jezik, avatar i dozvole.

Jedno dugme radi dva posla. U lobiju je to prava podešavanja, u igri je izlaz u nuždi.
Razdvoji ih.

U docs/js/app.js, openSettings(): ako je Store.state() različito od 'LOBBY' i 'END',
umesto Screens.go('settings') otvori mali sheet (koristi postojeći sheet() helper iz
docs/js/ui/kit.js, isti kao inventorySheet) sa TAČNO tri stavke:

  - Pauza / Nastavi — samo ako Store.isHost()
  - Pozovi mentora — otvara isti QR modal kao iz lobija (PROMPT 1)
  - Napusti igru — crveno, sa potvrdom, postojeća logika iz renderSettings (#setQuit)

Dole sitan red "Ostala podešavanja" koji otvara pun ekran, za slučaj da neko stvarno
menja jezik nasred partije. Ništa se ne gubi.

U lobiju i na kraju partije dugme radi kao i do sad — pun ekran.

renderSettings() ostaje kakav jeste, samo se blok `inGame` u njemu više ne prikazuje
(sad je u sheet-u). Dodaj i18n ključ otherSettings na SR i EN.
```

---

## Redosled i zašto

| # | Šta | Zašto tim redom |
|---|---|---|
| 1 | Mentor u lobi | Najveći efekat po vremenu — otključava ceo sistem koji već radi |
| 2 | Duhovi van zone | Rešava pravi problem uživo; menja `generateSparks`, pa ide pre svega ostalog što dira duhove |
| 3 | Traka duha + isplata za event | Zavisi od 2 (zna gde je duh) |
| 4 | Gledanje igrača | Najveći posao; podaci već postoje u `hits/` |
| 5 | Podešavanja | Najmanje, i deli QR modal sa 1 |

**Posle svakog prompta pusti `npm test`.** Ako nešto pukne, to je skoro sigurno
`test/simulate.js` sekcija 11 (iskre) — ona proverava staru `generateSparks` sa
potpisom `(seed, cfg, playerCount)` i očekuje 6 iskri po igraču po celoj areni.
PROMPT 2 tu sekciju mora da prepiše, ne da je obriše.

## Dve stvari koje sam usput primetio, a nisu u promptovima

**Slike iz borbe idu u bazu u punoj veličini.** `docs/js/game/combat.js` upisuje
`photoRef` kao `toDataURL('image/jpeg', 0.5)` — 50–150 KB po svakom udarcu, u Realtime
Database. Partija od 12 igrača lako napravi 200+ udaraca. To je desetine megabajta po
partiji i moguć razlog usporenja pred kraj. PROMPT 4 to popravlja usput, ali vredi da
znaš i ako ne odradiš taj prompt.

**`firebase-rules.json` ne ograničava veličinu `photoRef`.** Slike lica imaju limit
(`< 200000`), udarci nemaju nikakav. Vredi dodati isti limit na `hits/$hid/photoRef`.
