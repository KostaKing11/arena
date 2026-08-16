> ⚠️ **Ova specifikacija je delimično prevaziđena.** Sekcije 7, 8 i 9 (borba) zamenjuje
> [`BORBA-V4.md`](BORBA-V4.md). Dan i noć, događaji, nebo, mentor, duhovi i savezi rade
> drugačije nego što ovde piše — tačan spisak razlika je u [`STANJE.md`](STANJE.md).
> Sve ostalo iz ovog fajla i dalje važi.

# ARENA — kompletna specifikacija v3

IRL Igre gladi. Web aplikacija (PWA), Firebase Realtime Database, bez servera.
UI dvojezičan (SR/EN). Imena polja u bazi engleska.

---

## 0. Arhitektura

Nema servera koji vrti igru. Zato:

1. **Sve vremenske stvari se generišu JEDNOM na startu** i upišu u `schedule` sa apsolutnim timestampovima (zona, eventovi). Klijenti samo gledaju sat.
2. **Svaki igrač piše samo svoj čvor** `players/{myId}`. Sam sebi primenjuje štetu od zone, glad i žeđ.
3. Host je autoritet za: start, generisanje predmeta i rasporeda, pauzu, kraj.
4. Obavezno `.info/serverTimeOffset` — telefoni imaju različite satove.
5. Glad, žeđ i HP se računaju **iz proteklog vremena**, ne iz tajmera: čuvaj `lastTickMs` i primeni `(now - lastTickMs)`. Tako je tačno i posle povratka iz pozadine.

---

## 1. Rute i instalacija

Sve je na **jednom linku**: `/arena/`. Test verzija sa botovima: `/arena/test` — **ista aplikacija sa uključenim flagom, ne kopija koda.**

Pri prvom ulasku modal: **"Instaliraj aplikaciju"** ili **"Nastavi u browseru"**. Izbor se pamti u `localStorage`, modal se više ne prikazuje.

Ako izabere instalaciju → pita **iPhone ili Android** → tekstualni tutorijal (slike se dodaju kasnije):
- Android: Chrome ima `beforeinstallprompt`, pa ponudi pravo dugme "Instaliraj"
- iPhone: ručno, **Podeli → Dodaj na početni ekran, isključivo u Safariju**

`manifest.json`: `start_url` i `scope` moraju biti **`/arena/`**. Service worker se registruje sa te putanje (GitHub Pages podputanja).

---

## 2. Lobi

Gore: kod sobe (**5 znakova, slova + brojevi**), QR dugme, dugme za deljenje linka, broj igrača.

Spisak igrača — avatar, ime i **4 ikonice statusa**: lokacija, kamera, kompas, slika. Sive dok nisu spremne, zelene kad jesu.

Host podešava: centar arene (tap na mapi ili moja lokacija), prečnik, trajanje, kornukopija/rasuto, gustinu predmeta, dužinu priprema, eventove, botove, jezik.

**Preporučene vrednosti** (prikazuju se kao oznaka na klizaču, žuto upozorenje ako host ode duplo iznad/ispod):

| Igrača | Prečnik | Trajanje |
|---|---|---|
| 3–6 | 350 m | 30 min |
| 7–12 | 500 m | 45 min |
| 13–20 | 700 m | 60 min |
| 21–32 | 900 m | 60 min |
| 33–48 | 1200 m | 90 min |

**Min 3, max 48 igrača.** Dugme "Pokreni" zaključano dok nema 3+ igrača, svi zeleni, i postavljen centar.

---

## 3. Priprema igrača (5 koraka)

1. **Dozvole** — lokacija i kamera obavezne, kompas (iOS traži `DeviceOrientationEvent.requestPermission()`), obaveštenja opciono, wake lock automatski
2. **Kalibracija kompasa** — "okreni telefon u osmicu", prihvati kad tačnost < 20°, posle 20 s ponudi preskakanje uz upozorenje
3. **Provera GPS-a** — čekaj tačnost < 20 m, prikaži je brojem. Ako ne ide ispod 30 m → "izađi napolje"
4. **Slika lica** — prednja kamera, oval kao vodilja, provera da lice postoji u kadru. Čuvaj kao JPEG ~240×240
5. **Spreman**

---

## 4. PREP faza

- Svima se saopšti **njihova klasa** (svoju znaš, tuđe ne) i dodeli startna tačka.
- Kornukopija mod: tačke ravnomerno po krugu ~40 m oko centra. Rasuto: nasumično, min 30 m između dve tačke.
- Ekran: velika strelica, razdaljina, kompas traka, odbrojavanje.
- **Dugme "Stigao sam" aktivno tek na 10 m** od svoje tačke.
- Svi potvrde → 10 s odbrojavanje i start.
- Istekne vreme → kazna **srazmerna udaljenosti**: −1 HP i −2 gladi/žeđi na svakih 10 m koje nije prešao, max −15 HP.
- Tokom PREP: glad i žeđ ne padaju, predmeti se ne vide, borbe ne postoje.
- **Prvih 10 s posle starta ne može ništa da se pokupi** — svi vide gde je šta i krenu istovremeno.

---

## 5. Klase

Dodela je **špil karata**: promešaj svih 9, deli redom, promešaj ponovo tek kad se isprazni. Tako 4 igrača dobiju 4 različite, 48 dobije po ~5 od svake.

Svako zna **samo svoju** klasu. U feed na startu ide sastav arene ("2 strelca, 3 senke, 1 lekar…"), bez imena.

| Klasa | Oružje | Plus | Minus |
|---|---|---|---|
| **Strelac** | luk | Minimapa za igrače **40 m** (predmeti i dalje 15). Sa lukom +8 i napad na daljinu (§7) | −8 štete na dometu 0–1 |
| **Senka** | nož | **Nevidljiv** na svim mapama i trakerima. Sa nožem +8, prva runda besplatna | Ne vidi nikoga na mapi. Vidljiv samo svom timu, i sakriva se čim krene borba |
| **Snagator** | sekira | 130 max HP, upola manja šteta od zone | Vidljiv SVIMA na punoj mapi |
| **Sakupljač** | toljaga | Glad i žeđ **−40% brže**, prljava voda ne škodi, predmete vidi na 25 m | −5 štete svim oružjima |
| **Lekar** | duvaljka | Lečenje +50%, može da leči saveznika | 80 max HP |
| **Zamkar** | mreža | Nosi duplo zamki, zamke +50%, vidi tuđe zamke na 10 m | Ne može da beži iz borbe |
| **Trkač** | praćka | Beži za 10 s umesto 15 i bez besplatnog udarca protivniku, +1 slot | 85 max HP |
| **Lovac** | koplje | Drži razdaljinu, +6 na dometu 1–3 | −6 na dometu 0 |
| **Ribar** | trozubac | Najširi domet, +6 na svakoj razdaljini u svom dometu | 90 max HP |

Klase se ne menjaju tokom igre. **Niko ne kreće sa predmetima** — klasa je samo potencijal dok ne nađeš svoje oružje.

---

## 6. Oružja

Nosiš **samo jedno**, u posebnom slotu (ne troši inventar). Zamena = staro pada na zemlju.

| Oružje | Klasa | Šteta | Domet |
|---|---|---|---|
| Pesnice | — | 8 | 0–1 |
| Toljaga | Sakupljač | 12 | 0–1 |
| Praćka | Trkač | 12 | 2–4 |
| Mreža | Zamkar | 10 | 0–2 |
| Koplje | Lovac | 18 | 1–3 |
| Sekira | Snagator | 20 | 0–2 |
| Luk | Strelac | 22 | 3–5 |
| Nož | Senka | 24 | 0–1 |
| Trozubac | Ribar | 26 | 0–3 |
| Duvaljka | Lekar | 10 + otrov | 2–4 |

Sa svojom klasom: **+8 štete i otključan specijal.**

**Strele:** bez tobolca max 3 i troše slot. Sa tobolcem ne troše slot i nema granice. Tobolac na podu uvek ima 6 strela; ako već imaš svoj, ekran nudi **"Uzmi samo strele"**. Rasute strele po mapi: **8 nalazišta po strelcu u igri**. Praćka koristi kamenje — beskonačna.

**Posle borbe** sve ispaljene strele i bačeni trozubac padaju na mesto borbe kao obični predmeti; ko stigne, njegovo je. Kod napada na daljinu strela pada **kod žrtve**.

---

## 7. Susret — slikanje

Zamenjuje QR. Otvoriš kameru i uslikaš igrača. Tri filtera rade zajedno:

**1. Pravac.** Iz `DeviceOrientationEvent` znaš kuda kamera gleda, iz GPS pozicija računaš azimut do kandidata. Prolaze samo oni u **konusu ±30°** (kompas na telefonu greši 15–20°, uže ne radi).

**2. Detekcija osobe.** MediaPipe Object Detector (EfficientDet-Lite0), filtriraj samo klasu `person`. NE prepoznavanje lica — lice na 25 m je 20 piksela. Ako nema osobe u kadru → **"Nema nikoga na slici"**, bez ikakve liste.

**3. Rangiranje.** Visina okvira detektovane osobe u pikselima daje procenu razdaljine; uporedi je sa GPS razdaljinom kandidata. Rang = razlika azimuta (glavno) + poklapanje razdaljine. Najbolji pogodak na vrhu liste sa svojom slikom lica i imenom, ispod ostali iz konusa, skroluje se.

Zoom 1×–3× dozvoljen, ali **procenjenu visinu podeli faktorom zuma**. Razdaljina za borbu se uvek računa iz GPS-a, nikad iz zuma.

Kandidati preko **35 m** (Strelac 60 m) se ne prikazuju uopšte. Prazan konus → "Niko nije u tom pravcu", bez imena. **Cooldown 15 s na neuspelo slikanje**, da se kamera ne koristi kao radar.

Posle izbora: **Savez** (mora i on da prihvati) ili **Borba** (on bira Prihvati ili Beži).

**Startna razdaljina borbe** iz GPS-a u trenutku slikanja (uzmi prosek očitavanja oba telefona):

| Metara | Razdaljina |
|---|---|
| 0–8 | 0 |
| 8–15 | 1 |
| 15–25 | 2 |
| 25–35 | 3 |
| 35–50 | 4 (samo Strelac) |

### Napad na daljinu (samo Strelac)

- Vidi do 60 m, napada do 30 m
- **8 s nišanjenja u mestu** (pomeri se preko 5 m → promašaj)
- Žrtva dobija **"Neko te gađa sa severoistoka — MRDAJ!"** + jaka vibracija; ako se pomeri preko 12 m za tih 8 s, promašaj
- Pogodak 22 (30 sa bonusom), ne pokreće punu borbu. Cooldown 90 s
- **Anti-varanje:** blokirano ako je GPS tačnost bilo koga > 20 m; ako je strelac van arene; **ako se strelac nije pomerio bar 20 m u poslednjih 5 min**. Svaki hitac ide u feed vidljiv duhovima, sa slikom-dokazom

---

## 8. Borba

**Traka razdaljine 0–5** (apstraktna, u borbi). Svake runde (10 s) biraš:

| Akcija | Efekat |
|---|---|
| Priđi | razdaljina −1 |
| Odmakni se | razdaljina +1 |
| Napad | šteta oružja, samo ako je razdaljina u dometu |
| Blok | −60% štete; kontra 6 ako te napadnu izbliza |

- Napad van dometa = promašaj
- Ko ne odigra u 10 s → automatski Blok
- Max 10 rundi; ako niko ne padne, obojica −10 HP i razilaze se
- HP se NE resetuje i NE regeneriše. Leči se samo predmetima
- **Gubitnik ispušta SVE predmete** na svojoj GPS lokaciji, postaju obični predmeti koje svako može da pokupi
- Cooldown 3 min između ista dva igrača posle borbe

### Specijali — jednom po borbi, samo sa svojim oružjem

| Klasa | Specijal |
|---|---|
| Senka | **Ubod** — pritrči, 35 štete, vrati se; ako blokira, 12 |
| Ribar | **Bačeni trozubac** — svaka razdaljina, 45 štete, ali gubiš trozubac → pesnice. Promašaj = trozubac padne, obojica mogu da ga zgrabe |
| Snagator | **Razbijanje** — 28, probija blok |
| Strelac | **Precizan hitac** — 40, nišani 2 runde, protivnik to vidi i može da priđe i pokvari |
| Zamkar | **Uplitanje** — 3 runde ne može da menja razdaljinu ni da beži |
| Lovac | **Proboj** — 30 i odgurne protivnika +1 |
| Trkač | **Nestanak** — garantovano bekstvo bez potere |
| Sakupljač | **Omamljivanje** — protivnik gubi sledeći potez |
| Lekar | **Otrov** — 6 po rundi do kraja borbe, i 2 min posle nje |

---

## 9. Bekstvo i potera

Može i pre borbe i **usred borbe**.

- Klik **Pobegni** → protivnik dobija **jedan besplatan napad** (puna šteta oružja). Trkač je izuzet
- Stanje `chase`. Obojica se vide na minimapi dok traje
- **Van 20 m neprekidno 15 s → pobegao si** (Trkač 10 s)
- **VAŽNO — zastavica:** povratak u borbu je zaključan dok jednom ne izađeš van 20 m. Tek tad se otključa i prilazak na 8 m nastavlja borbu na razdaljini 0. Bez ovoga borba puca odmah po pokretanju
- 90 s bez ishoda → pobegao
- **Dok bežiš ne možeš da se lečiš ni da jedeš**
- Posle uspešnog bekstva **60 s** pre nego što te isti igrač može ponovo uslikati
- Na ekranu: odbrojavanje "9… 8… 7…" i strelica u pravcu progonioca

---

## 10. Savezi

- `allianceId`, imena **Tim 1, Tim 2, Tim 3**…
- Max u savezu: 3–8 igrača → 2, 9–16 → 3, 17–32 → 4, 33–48 → 5
- **Saveznika vidiš samo na minimapi.** Van 15 m ga ne vidiš dok se ne nađete
- Senka je vidljiva svom timu dok je u savezu
- **Izdaja:** bez slikanja, dugme aktivno kad je saveznik na < 12 m. Odmah kreće borba, objavljuje se svima
- **Izdaja nožem:** 25 štete odmah + prva runda besplatna

---

## 11. Glad, žeđ, HP

- `hunger` i `thirst` 0–100, max se može podići do 150
- **Žeđ −1 na 7 s** (prazna za ~12 min), **glad −1 na 11 s** (~18 min)
- Na 0: žeđ **−2 HP na 20 s**, glad **−2 HP na 30 s**, sabira se
- Ispod 25 → treperi ikonica + jedna vibracija + upozorenje samo tebi
- HP se nikad ne regeneriše sam

> Ako se na testu pokaže prebrzo, produži na 10 s / 15 s. Ovo su brojevi za prvu test igru.

---

## 12. Predmeti

**Inventar:** 4 slota (ranac diže), oružje ima svoj slot van toga.

**Stack po retkosti:** obično 3, neobično 2, retko i naviše 1.

- Kad pokupiš nešto što već imaš a stack nije pun → **ne pita ništa**, samo doda
- Ekran za zamenu iskače samo kad su svi slotovi puni i nema gde da stane; prikazuje tvoje predmete + novi, tapneš šta izbacuješ, plus dugme "Otkaži"
- **Ispuštaš ceo stack**, ne komad po komad

**Kupljenje po retkosti** (dok kupiš, ranjiv si):

| Retkost | Boja | Kako |
|---|---|---|
| Obično | siva | tap |
| Neobično | zelena | drži 3 s |
| Retko | plava | drži 6 s, prekida se ako se pomeriš |
| Epsko | ljubičasta | mini-izazov: 5 tapova u ritmu / protresi telefon 3× |
| Legendarno | zlatna | drži 10 s u mestu; svima ide objava "Neko otvara sanduk kod kornukopije" |

Radijus kupljenja **10 m** (ne 15 — GPS greška).

**Hrana:** bobice +20 (5% otrov −10 HP) · pečurke +30 (15% otrov −20 HP) · hleb +35 · sušeno meso +55 · gozba +100 · pojas sa zalihama +30 max glad trajno

**Piće:** prljava voda +25 žeđ i −8 HP · flaša vode +40 · sok +30 žeđ i +15 glad · izvorska voda +70 · termos +30 max žeđ trajno

**Lečenje:** lekovito bilje +15 (Lekar +100%) · zavoj +25 · protivotrov · medkit +60 · sponzorska mast pun HP

**Rančevi:** mala torba 4→5 · ranac 4→7 · veliki ranac 4→9 (legendarno, samo kornukopija)

**Zamke** (postavljaš na svoju lokaciju, okidaju na 10 m): obična −18 HP · alarm (lokacija žrtve svima 8 s) · traker (vidiš je 5 min) · mreža-zamka (ne može da beži iz sledeće borbe)

**Ostalo:** baklja 8 min · velika baklja 15 min + veći radijus · durbin (vid 15→20 m) · dimna bomba (3 min nevidljiv trakerima) · napitak besa (prva runda duplo) · tobolac · kamuflažni ogrtač (5 min nevidljiv i Strelcu)

---

## 13. Spawn predmeta

- Ukupno = **broj igrača × 12**, host menja ±50%
- **30% kornukopija** (krug 40 m oko centra), **70% rasuto**
- Min rastojanje: **12 m rasuto, 4 m kornukopija**
- Nikad u poslednjih 20 m uz ivicu arene

| Retkost | Rasuto | Kornukopija |
|---|---|---|
| Obično | 55% | 20% |
| Neobično | 27% | 30% |
| Retko | 13% | 30% |
| Epsko | 4% | 15% |
| Legendarno | 1% | 5% |

Rasuto sadrži: hranu, malo vode, bilje, toljagu, praćku, baklje. Kornukopija: sva jaka oružja, rančeve, medkitove, termos, pojas, ogrtač.

**Tri obavezna pravila:**
1. **Hrana i voda se obnavljaju** — 90 s pošto se pokupe, nova se spawnuje drugde. Oružja i rančevi se NE obnavljaju
2. **Predmet koji niko ne pokupi 10 min se seli** (verovatno je u zaključanom dvorištu ili na krovu)
3. **Kad se zona skupi, predmeti van nje se prebacuju unutra**

---

## 14. Zona

5 faza, tempo se skalira po izabranom trajanju igre. **Skuplja se postepeno, animirano, nikad instant skok.**

| Faza | Prečnik | Šteta / 10 s |
|---|---|---|
| 1 | 65% | 2 |
| 2 | 42% | 4 |
| 3 | 25% | 7 |
| 4 | 12% | 12 |
| 5 | **40 m, uvek na kornukopiji** | 20 |

Centri međufaza se blago pomeraju nasumično, ali svaki vodi ka centru (faktor 0.35, 0.5, 0.7, 1.0). Upozorenje 30 s pre svake faze + vibracija.

---

## 15. Eventovi

- **Zid vatre** — linija širine ~25 m **putuje pravo preko arene** sa jedne strane na drugu, pređe je za ~3 min. Najava 60 s ranije sa smerom i strelicom na kompasu. Ko je u liniji → instant smrt
- **Traker ose** — 3 HP na 10 s dok si unutra, **plus halucinacije**: 5 min ti se prikazuju lažni predmeti koji nestanu kad priđeš
- **Feast** — 6 jakih predmeta na kornukopiji, najava 2 min ranije
- **Suša** — žeđ duplo brže 5 min
- **Noć** — minimapa 15 → 8 m dok nemaš baklju, 6 min

---

## 16. Smrt, duhovi = Tvorci igara

Smrt: HP 0 u borbi, glad, žeđ, zona, zid vatre.

**Top** — na svaku smrt svima zvuk topa + vibracija.

**Nebo** — na svakih 15 min sve stane na 20 s, pusti se himna i prikažu se **lica poginulih** od prošlog puta (koriste se slike iz pripreme).

Mrtvi:
- vide **sve žive** na punoj mapi + stats (HP, glad, žeđ, oružje)
- biraju jednog igrača da prate
- obaveštenje kad počne borba, gledaju je **uživo, rundu po rundu**
- **NE šalju pakete nikome**

**Tvorci igara:** duhovi i dalje hodaju po areni i kupe **iskre** (vidljive samo njima) u **zajedničku kasu**. Iz nje kupuju događaje:

| Događaj | Cena |
|---|---|
| Noć | 3 |
| Suša | 3 |
| Sanduk sa zalihama na neutralnom mestu | 4 |
| Traker ose | 5 |
| Feast | 6 |
| Zid vatre | 8 |

Cooldown **4 min** između događaja. Ako ima više od dva duha, treba **većina glasova**.

---

## 17. Mentor, sponzor, gledaoci

- Link je ličan: `?room=KOD&mentor=ID`. **Jedan mentor po igraču.**
- Mentor vidi: tvoj HP, glad, žeđ, oružje, tvoju poziciju, tvoje borbe uživo. **Ne vidi tuđe stvari.**
- Zarađuje **naklonost publike** izazovima na telefonu, 20–40 s po komadu: reakcija (tapni čim pozeleni ×5), Simon niz od 6, gađanje mete koja beži, kviz o Igrama gladi, tapkanje u ritmu
- **Cena raste: 1. paket 1 poen, 2. paket 3, 3. paket 6, 4. paket 10.** Voda i hrana od 1, medkit i ranac od 3, oružje od 6
- **Max 1 paket na 5 min po igraču.** Paket pada **15 m** od igrača; svima ide "Neko je dobio paket" bez imena, tebi piše ko je poslao
- Ko otvori zauzet link → **gledalac tog igrača**, bez moći. Dugme **"Navijaj"** jednom na 10 min = +0.5 poena mentoru

---

## 18. FINAL_TWO

Automatski kad ostanu 2 živa. Obojica vide poziciju onog drugog **na punoj mapi**, stalno. Zona se skuplja duplo brže do poslednjih 40 m. Feed: "Ostala su dvojica."

---

## 19. Kraj

Pobednik sa likom, klasom i oružjem. Vremenska linija ko je kad poginuo i od koga. Tabela za svakog: preživeo, pređeno metara, borbe, šteta, pokupljeno predmeta.

Nagrade: najviše pređenih metara · najviše borbi · najmanje borbi (kukavica) · najgladniji · najviše popijene prljave vode · najbrže poginuo.

Dugme **"Igraj ponovo"** — vraća sve u lobi sa istim podešavanjima.

---

## 20. Feed

- **Svima:** smrti, faze zone, eventovi, feast, "neko otvara legendarni sanduk", izdaje, "neko je dobio paket" (bez imena)
- **Samo tebi:** tvoja šteta, upozorenja za glad i žeđ, predmet u blizini, paket sa imenom mentora
- **Samo duhovima:** svaki ispaljeni hitac sa slikom-dokazom, ko je gde, ko koga prati

---

## 21. Tehnički zahtevi

- `navigator.wakeLock` čim igra krene i ponovo na `visibilitychange`
- `watchPosition` sa `enableHighAccuracy: true`. Upis pozicije max 1× na 3 s, ređe kad igrač stoji. Odbaci očitavanja preko 30 m tačnosti, proseči poslednja 3
- **Prekid veze ne izbacuje iz sobe.** Posle **3 min bez veze** igrač postaje **"onesvešćen"**: statična oznaka na mapi koju svi vide, ko dođe do njega pobeđuje bez borbe. Povratak u aplikaciju ga odmah budi
- `beforeunload` upozorenje dok je stanje LIVE
- **Host izađe usred igre** → prosto umire i njegove stvari mogu da se pokupe. Novi host je **igrač koji je ušao prvi posle njega**
- Host ima **PAUZU** (zamrzava zonu, glad, žeđ, eventove) i svako ima **"Izlazim"**
- Firebase pravila: igrač piše samo `players/{svoj pid}`, host piše sve u sobi
- Slike lica se brišu kad se igra završi
- Pre starta upozorenje: gledaj u okolinu, ne trči po ulici, ne ulazi na privatan posed
- **Botovi (`/arena/test`)**: hodaj ka nasumičnoj tački 1,4 m/s, skreni ka predmetu u blizini, napadni igrača na 20 m, beži ispod 30 HP

---

## 22. Struktura baze

```
rooms/{CODE}/
  meta: hostId, state, lang, createdAt, startedAt, endedAt, winnerId
  config: center{lat,lng}, diameterM, durationMin, itemCount,
          prepMinutes, startMode, eventsEnabled, botsEnabled
  schedule:
    zone: [ {atMs, radiusM, centerLat, centerLng, dps} ]
    events: [ {id, type, atMs, warnMs, endMs, lat, lng, radiusM, headingDeg} ]
    sky: [ {atMs} ]
  players/{pid}:
    name, avatar{body,hair,hairColor,skin,shirt}, facePhoto
    classId, hp, maxHp, alive, deathAtMs, killedBy, kills
    hunger, thirst, lastTickMs
    pos{lat,lng,accM,atMs}, startPos{lat,lng}, arrived
    allianceId, capacity, weapon, arrows
    inv: [ {slot, itemType, qty} ]
    effects{}, hiddenUntilMs, lastSeenMs, unconscious
    mentorId, distanceWalkedM
  items/{iid}: type, rarity, lat, lng, takenBy, spawnedAtMs
  traps/{tid}: ownerId, type, lat, lng, triggeredBy
  fights/{fid}: a, b, state, round, distance, hpA, hpB,
                moves{}, specialUsedA, specialUsedB, log[], winner
  chase/{fid}: leftRadius (zastavica), startedAtMs
  sparks: pool, collected{}
  gmVotes/{eventType}: {pid: true}
  mentors/{pid}: favor, packagesSent, lastPackageMs
  feed/{id}: type, text, atMs, subjectId, scope
```

---

## 23. Redosled implementacije

1. Modal za instalaciju, PWA manifest, rute `/arena/` i `/arena/test`
2. Lik, soba, ulazak (kod/QR/link), lobi sa statusima i preporukama
3. Priprema (5 koraka) i PREP faza
4. Špil klasa i dodela
5. Zona sa postepenim skupljanjem + `schedule` generator
6. Minimapa (samo predmeti) + puna mapa + kompas traka
7. Spawn predmeta, retkosti, kupljenje, inventar sa stackovima
8. Slikanje: kompas konus + detekcija osobe + lista kandidata
9. Borba sa razdaljinom, oružjima i specijalima
10. Bekstvo i potera sa zastavicom
11. Savezi i izdaja
12. Glad, žeđ, HP automatika
13. Zamke, trakeri, ostali predmeti
14. Eventovi
15. Smrt, top, nebo, duhovi kao Tvorci igara
16. Mentori, izazovi, gledaoci
17. FINAL_TWO, kraj, recap, igraj ponovo
18. Botovi

---

## 24. Ostaje za kasnije

- Slike u tutorijalu za instalaciju
- Dodatne klase i oružja
- AR
- Fino štelovanje brojeva za glad i žeđ posle prve test igre
