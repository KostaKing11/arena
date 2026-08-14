# ARENA — plan za sledeću rundu

Ovaj fajl je **radni nalog za sledeću sesiju**. Merodavna pravila igre su u
[`SPEC.md`](SPEC.md); stanje kvarova je u [`TODO.md`](TODO.md); ovde stoji **šta se radi,
kojim redom, i sa kojim promptom**.

Redosled je namerno ovakav i ne treba ga preskakati:

| Faza | Šta | Zašto baš tim redom |
|---|---|---|
| **0** | Dev alatke za testiranje | Bez njih se duhovi, mentori i kamera ne mogu ni isprobati, pa bi se faze 2 i 3 pisale naslepo |
| **1** | Popravke i objašnjenje igre | Postojeće stvari da rade i da se razumeju |
| **2** | Duhovi (Tvorci igara) — nova zamisao | Najveći deo igre koji trenutno ne valja |
| **3** | Mentori i sponzori — nova zamisao | Zavisi od izazova koje faza 2 uvodi |

Dve stvari (**borba** i **eventovi**) su **odluke o dizajnu, ne o kodu**. Za njih su dole
ponuđene opcije — treba ih izabrati pre nego što se išta piše. Ne počinjati kodiranje borbe
dok izbor nije napravljen.

---

## 0. Kako se radi

Telefon: Samsung SM-A576B, Android 16, Samsung Internet. Ekran **1080×2340 fizički,
384×686 CSS px** — sve mora da stane u to.

```bash
adb reverse tcp:3000 tcp:3000
```

```bash
npm run dev
```

Na telefonu `http://localhost:3000/?test=1`. `adb reverse` daje **siguran kontekst**, pa GPS,
kamera i kompas rade nad lokalnim serverom.

```bash
adb exec-out screencap -p > shot.png
```

Tap i prevlačenje: `adb shell input tap X Y`, `adb shell input swipe X1 Y1 X2 Y2 300`.

**Pravila rada:**
- `npm test` (100+ provera pravila) mora da ostane zeleno posle svake izmene.
- Ne dirati: arhitekturu bez servera, zastavicu `leftRadius` u `chase/{fid}`, `/arena/test`
  kao flag (ne kopiju koda), `scope` i `start_url` `/arena/` u manifestu.
- Kad se menja kod u `docs/`, podići `VERSION` u `docs/sw.js` i `APP_VERSION` u
  `docs/js/ui/kit.js` — inače telefoni koji su već otvarali igru ostaju na keširanim fajlovima.
- **Svaka izmena se proverava na telefonu, u toku igre, ne samo na jednom ekranu.**

---

## FAZA 0 — dev alatke (prvo ovo)

Cilj: iz uključenog dev režima može da se **isproba svaka pojedinačna stvar u igri**, bez
čekanja da se desi sama. Ovo je preduslov za sve ostalo — duhovi, mentori i kamera do sada
nisu testirani nijednom, upravo zato što nije bilo načina da se do njih dođe.

Dev režim se već otključava sa **sedam tapova na verziju** u podešavanjima
(`arena.dev` u `localStorage`). Treba mu dodati pun panel.

### Šta sve mora da postoji u panelu

**Stanje partije**
- prebaci u LOBBY / PREP / LIVE / FINAL_TWO / END
- pomeri zonu za jednu fazu napred
- pokreni „nebo" (§16) odmah
- pauziraj / nastavi

**Ja**
- ubij me → vodi na ekran duha
- oživi me
- postavi HP / glad / žeđ na tačnu vrednost
- promeni mi klasu (svih 9)
- daj mi bilo koje oružje, bilo koji predmet, napuni/isprazni inventar
- teleportuj me na tapnutu tačku, ili prošetaj do nje (već postoji `TestWalk`)
- postavi smer kompasa ručno

**Borba**
- pokreni borbu sa izabranim botom **na izabranoj razdaljini 0–5**
- odigraj svaki specijal (svih 9) da se vidi šta radi
- pokreni poteru, i sa zastavicom `leftRadius` i bez nje
- pokreni napad na daljinu (Strelac)
- sklopi savez sa botom, pa izdaj

**Eventovi**
- pokreni svaki event pojedinačno: zid vatre, traker ose, feast, suša, noć, sanduk
- okini zamku na sebi (sve četiri vrste)

**Duhovi i mentori — ovo je ono što nedostaje najviše**
- otvori ekran duha (bez umiranja)
- daj sebi N iskri
- otvori ekran mentora za izabranog bota, kao da si mu mentor
- otvori ekran gledaoca
- pošalji sebi paket od mentora
- pokreni svaki mentorski izazov pojedinačno (`reaction`, `simon`, `targets`, `quiz`, `rhythm`)

**Kamera**
- otvori slikanje protivnika sa **lažnom detekcijom** — da se lista kandidata i ceo tok
  susreta mogu proći bez druge osobe u kadru
- ponovo uslikaj lice, i prikaži poslednju sačuvanu sliku u punoj veličini (da se vidi da
  li je okrenuta i koliko je krupna)
- prikaži šta senzori javljaju uživo (već postoji `/arena/diag.html` — povezati ga na panel)

**Prečice**
- ugasi sve cooldown-ove (borba 3 min, slikanje 15 s, paket 5 min, događaj 4 min)
- „igraj ponovo" bez izlaska iz sobe

### Prompt za fazu 0

```
Pročitaj PLAN.md, SPEC.md i TODO.md.

Napravi dev panel: novi ekran koji se otvara iz podešavanja kad je uključen dev režim
(sedam tapova na verziju, `arena.dev` u localStorage). Spisak svega što panel mora da
ume je u PLAN.md, faza 0.

Zahtevi:
- Panel je JEDAN ekran sa grupama dugmadi, ne raštrkan po aplikaciji.
- Svaka radnja radi i u pravoj sobi i u test sobi sa botovima.
- Ništa od ovoga se ne sme videti niti izvršiti kad dev režim nije uključen.
- Lažna detekcija osobe za kameru ide iza istog flag-a — nikad u pravoj partiji.
- `npm test` ostaje zeleno.

Kad završiš, na telefonu otvori panel i prođi kroz SVAKU grupu dugmadi, pa javi
šta radi a šta ne.
```

---

## FAZA 1 — popravke i objašnjenje igre

### 1.1 Prepisivanje ekrana na svaki otkucaj  ⚠️ sistemski problem

Motor kuca jednom u sekundi i pozива `render*`, a te funkcije prepisuju `innerHTML` celih
blokova. Zbog toga ekrani **vidno trepere**, a sve što ima svoje stanje (klizač usred
prevlačenja, otvoren padajući meni, izabran tekst, Leaflet mapa) puca.

Već je ovako popravljeno: **lobi** (`buildLobby` / `updateLobby`) i **priprema**
(`buildDeploy` / `renderDeploy`). Isti postupak treba primeniti i na ostalo:

| Funkcija | Prepisivanja `innerHTML` po otkucaju |
|---|---|
| `renderGame` | 9 |
| `renderMentor` | 3 |
| `renderGhost` | 2 |
| `renderChase` | 1 |
| `renderEnd` | 1 |

Obrazac je uvek isti: **skelet jednom** (čuvaj ključ od kog zavisi izgled — klasa, jezik,
uloga), **otkucaj menja samo tekst, brojeve i `disabled`**. Nikada ne prepisivati čvor u kome
živi mapa, klizač ili polje za unos.

U podešavanjima isto: promena jedne stavke ne sme da iscrtava ceo ekran. Tema je već
sređena; ostalo je dugme za pauzu (`renderSettings()` posle svakog klika).

### 1.2 Nigde ne piše kako se igra  ⚠️ najvažnije za prvog igrača

Ko prvi put uđe, potpuno je izgubljen. Treba:

- **Kratko uputstvo pre prve partije** — šta je cilj, kako se kreće, kako se nalazi plen,
  kako se napada, šta je zona. Pet-šest ekrana, može da se preskoči, pamti se da je viđeno.
- **Pomoć na svakom ekranu** — malo „?" koje otvara objašnjenje baš tog ekrana. U borbi
  takvo dugme već postoji, treba i na mapi, u pripremi, kod slikanja, kod duha i mentora.
- **Prvi put kad se nešto desi, objasni to** — prvi predmet u dometu, prva borba, prvo
  skupljanje zone, prvi paket. Jednom, pa nikad više.
- **Rečnik pojmova** u podešavanjima: klase, oružja, retkosti, zona, savez, potera.

### 1.3 Kretanje uživo

Hodanje po pravoj areni **mora da radi bez ijedne test pomoći** — to je cela igra. Proveriti
na terenu: `watchPosition`, prosek poslednja tri očitavanja, odbacivanje preko 30 m tačnosti,
upis najviše jednom na 3 s (§21). Test hodanje tapom sme da postoji **samo** u test režimu i
ne sme da menja ponašanje prave partije.

### 1.4 Sitnije, već poznato

- eventovi i skupljanje zone se slabo vide na mapi — najava faze i zid vatre su neupadljivi
- **sponzorski link šalje mentor, ne igrač**
- duhu inventar pokazuje samo broj iskri
- naziv „Tvorac igara" promeniti
- potvrditi da pun ekran radi u instaliranoj aplikaciji (WebAPK pamti `display` od trenutka
  instalacije — treba obrisati ikonu i instalirati ponovo)
- `npm run test:fb` i `npm run test:live` su pisani za stari protokol i ne rade
- u borbi su obe trake života crvene, i kad je HP pun

### Prompt za fazu 1

```
Pročitaj PLAN.md, SPEC.md i TODO.md.

Uradi fazu 1 iz PLAN.md, ovim redom:

1. Prestani da prepisuješ ekrane na svaki otkucaj motora. Primeni isti obrazac koji već
   postoji u `buildLobby`/`updateLobby` i `buildDeploy`/`renderDeploy` na renderGame,
   renderMentor, renderGhost, renderChase i renderEnd. Tabela sa brojem prepisivanja je
   u PLAN.md 1.1.
2. Napravi uputstvo i pomoć: uvodnih pet-šest ekrana pre prve partije, "?" na svakom
   ekranu, objašnjenje prvog puta kad se nešto desi, rečnik pojmova u podešavanjima.
   Tekst mora da postoji na SR i EN.
3. Proveri kretanje uživo na terenu i sitnice iz PLAN.md 1.4.

`npm test` ostaje zeleno. Sve proveri na telefonu, u toku igre.
```

---

## FAZA 2 — duhovi (Tvorci igara), nova zamisao

**Šta ne valja sada:** duh i dalje hoda po areni i kupi iskre sa mape. To znači da mrtav
igrač i dalje mora fizički da šeta, što je besmisleno — poginuo je, treba da sedne. Uz to
iskri ima previše, pa događaji lete.

**Kako treba:**

- Duh **ne hoda po mapi za iskre**. Iskre se zarađuju **izazovima na telefonu**, isto kao kod
  mentora (`reaction`, `simon`, `targets`, `quiz`, `rhythm` već postoje u `game/mentor.js` i
  mogu se deliti).
- **Iskri je malo.** Cilj: za celu partiju svi duhovi zajedno pokrenu **2–3 događaja**, ne
  više. Sa više igrača i dužom partijom sme malo više, ali to je gornja granica reda veličine.
- Duh i dalje: vidi sve žive na punoj mapi sa stanjem, bira jednog da prati, gleda borbe
  uživo rundu po rundu, i **ne šalje pakete nikome** (§16).
- Cena događaja i glasanje ostaju kao u §16, ali brojke treba prilagoditi novom prilivu iskri.

**Odluka koja fali:** koliko iskri nosi jedan izazov i koliko traje. Predlog za početak:
izazov ~30 s daje 1 iskru, cooldown 90 s po duhu. Uz cene 3–8, to je oko jedan događaj na
5–8 minuta po duhu — treba isprobati i doterati.

### Prompt za fazu 2

```
Pročitaj PLAN.md, SPEC.md (§16) i TODO.md.

Prepravi duhove po PLAN.md, faza 2:
- Iskre se više ne kupe hodanjem po mapi nego izazovima na telefonu. Iskoristi postojeće
  izazove iz game/mentor.js umesto da pišeš nove.
- Podesi priliv iskri tako da svi duhovi zajedno pokrenu 2-3 dogadjaja po partiji.
  Krenи od: izazov ~30 s = 1 iskra, cooldown 90 s po duhu. Isprobaj i doteraj.
- Zadrži iz §16: pun pregled zivih sa stanjem, pracenje jednog igraca, gledanje borbi
  rundu po rundu, i to da duh NE salje pakete.
- Popravi i to da duhu inventar pokazuje samo broj iskri.
- Promeni naziv "Tvorac igara".

Testiraj kroz dev panel iz faze 0 — otvori ekran duha bez umiranja i prodji sve.
`npm test` ostaje zeleno.
```

---

## FAZA 3 — mentori i sponzori, nova zamisao

**Stanje:** napisano po §17 ali **nijednom isprobano**. Zna se da fali:

- **sponzorski link šalje mentor**, ne igrač (sada je obrnuto)
- kartica mentora na igračevoj kartici je urađena, ali ceo tok mentora nije viđen u radu

**Šta treba proveriti čim postoji dev panel:** da li mentor uopšte vidi igračevo stanje i
borbe uživo, da li izazovi rade, da li paket zaista pada 15 m od igrača, da li cena raste
1→3→6→10, da li gledalac dobija „Navijaj" i ništa više.

**Šta treba osmisliti:** kako mentorstvo izgleda za nekoga ko ne igra — sada je to ekran sa
izazovima i dugmetom za paket. Pitanje za odluku: da li mentor treba da ima i **glas u igri**
(poruka igraču, oznaka na mapi, savet), ili ostaje samo na paketima.

### Prompt za fazu 3

```
Pročitaj PLAN.md, SPEC.md (§17) i TODO.md.

Prvo ISPROBAJ postojeće mentore kroz dev panel iz faze 0 i javi tačno šta radi a šta ne:
stanje igrača, borbe uživo, svih pet izazova, cena paketa 1/3/6/10, paket pada 15 m,
gledalac ima samo "Navijaj". Ne popravljaj ništa dok ne napraviš taj spisak.

Onda popravi nađeno i prebaci slanje sponzorskog linka sa igrača na mentora.
`npm test` ostaje zeleno.
```

---

## Odluka 1 — borba (pre kodiranja!)

Sadašnja borba: runde po 10 s, četiri poteza, apstraktna razdaljina 0–5, najviše 10 rundi.
Popravljeno je to što su primicanje i odmicanje bili obrnuti i što se sada vidi šta koje
dugme radi — ali **sama zamisao i dalje ne valja**, i to je tačno.

**Zašto ne valja:**
- Stojiš na ulici i gledaš u meni. Ništa u borbi nije IRL — a IRL je cela poenta igre.
- Do 100 s po borbi je predugo za nešto što se igra napolju.
- Razdaljina 0–5 nema veze sa stvarnom razdaljinom između vas dvojice.
- Nema pravog izbora: ako si u dometu napadaš, ako nisi koračaš. To nije odluka.
- Ne vidiš protivnika na ekranu dok bira, pa nemaš šta da pročitaš.

**Tri pravca, treba izabrati jedan:**

**A — borba se vodi nogama.** Razdaljina u borbi je **stvarna GPS razdaljina**. Da napadneš,
moraš fizički da budeš u dometu svog oružja; da se odmakneš, stvarno se odmakneš. Telefon
samo presuđuje pogodak. *Za:* jedina opcija koja borbu vraća u stvarni svet, i odmah daje
smisao razlici između noža i luka. *Protiv:* opasno ako se trči, i teško uz GPS grešku od
5–10 m — dometi bi morali da budu grubi (do 10 m / 10–25 m / 25–40 m).

**B — kratko i sa pravim izborom.** Tri runde po 5 s, obojica biraju istovremeno i otkriva se
odjednom, sa pravim krugom: **Napad tuče Prilazak, Blok tuče Napad, Prilazak tuče Blok**.
*Za:* borba traje 20 s, ima blefa i čitanja protivnika, malo posla oko izmene. *Protiv:*
i dalje se igra u telefonu, samo brže.

**C — na refleks.** Traka koja se kreće, tapneš u pravom trenutku, preciznost određuje štetu.
*Za:* brzo, fizički, ne mora ništa da se čita, dobro za nekoga ko prvi put igra. *Protiv:*
klasa i oružje malo znače, pobeđuje brži palac.

**Predlog:** **A kao osnova, B kao runda.** Stvarna razdaljina određuje šta uopšte smeš da
uradiš, a kad ste u dometu, runda je kratak istovremeni izbor sa krugom iz B. To čuva IRL
osećaj, drži borbu ispod 30 s, i daje pravu odluku. Odluku doneti pre kodiranja.

---

## Odluka 2 — eventovi

Sada ih ima šest (§15) i **slabi su**: uglavnom se svedu na poruku i malo štete, a na mapi se
jedva vide. Treba odlučiti da li se:

- **doteruju** — isti eventovi, ali jasno vidljivi na mapi i sa jačim posledicama, ili
- **menjaju** — manje eventova, ali svaki menja kako se igra sledećih par minuta.

Zid vatre je jedini koji stvarno tera ljude da se pomere. Vredi krenuti od njega kao merila:
**event je dobar ako te natera da promeniš plan.** Suša i noć to sada ne rade.

---

## Spisak svih predmeta (40)

Traženo za pregled. Izvučeno iz `docs/js/core/rules.js`.
`pool`: `scatter` = samo rasuto, `corn` = samo kornukopija, `both` = i jedno i drugo.

### Obično — 6
| Predmet | Šta radi | Gde se nalazi |
|---|---|---|
| Bobice | +20 glad, 5% otrov (−10 HP) | oba |
| Prljava voda | +25 žeđ, −8 HP | oba |
| Lekovito bilje | +15 lečenje (Lekar duplo) | oba |
| Baklja | svetlo 8 min | oba |
| Toljaga | oružje | rasuto |
| Praćka | oružje | rasuto |

### Neobično — 8
| Predmet | Šta radi | Gde se nalazi |
|---|---|---|
| Pečurke | +30 glad, 15% otrov (−20 HP) | rasuto |
| Hleb | +35 glad | oba |
| Flaša vode | +40 žeđ | oba |
| Sok | +30 žeđ, +15 glad | oba |
| Zavoj | +25 lečenje | oba |
| Obična zamka | −18 HP | rasuto |
| Strele | +3 strele | rasuto |
| Mreža | oružje | oba |

### Retko — 12
| Predmet | Šta radi | Gde se nalazi |
|---|---|---|
| Sušeno meso | +55 glad | oba |
| Izvorska voda | +70 žeđ | oba |
| Protivotrov | skida otrov | oba |
| Mala torba | 4 → 5 slotova | oba |
| Zamka alarm | otkriva žrtvu svima 8 s | oba |
| Velika baklja | svetlo 15 min, +6 m radijus | oba |
| Durbin | vid 15 → 20 m | oba |
| Dimna bomba | 3 min nevidljiv trakerima | oba |
| Tobolac | strele ne troše slot, bez granice | oba |
| Koplje | oružje | kornukopija |
| Sekira | oružje | kornukopija |
| Duvaljka | oružje | kornukopija |

### Epsko — 10
| Predmet | Šta radi | Gde se nalazi |
|---|---|---|
| Pojas sa zalihama | +30 max glad trajno | kornukopija |
| Termos | +30 max žeđ trajno | kornukopija |
| Medkit | +60 lečenje | kornukopija |
| Ranac | 4 → 7 slotova | kornukopija |
| Zamka traker | vidiš žrtvu 5 min | oba |
| Mreža-zamka | žrtva ne može da beži iz sledeće borbe | oba |
| Napitak besa | prva runda duplo | oba |
| Kamuflažni ogrtač | 5 min nevidljiv svima, i Strelcu | kornukopija |
| Luk | oružje | kornukopija |
| Nož | oružje | kornukopija |

### Legendarno — 4
| Predmet | Šta radi | Gde se nalazi |
|---|---|---|
| Gozba | +100 glad | kornukopija |
| Sponzorska mast | pun HP | oba |
| Veliki ranac | 4 → 9 slotova | kornukopija |
| Trozubac | oružje | kornukopija |

**Ne postoji, a pominje se u SPEC-u §12:** ništa — svih 40 je implementirano. Rančevi,
zamke, hrana, piće, lečenje i sva oružja se poklapaju sa specifikacijom.

---

## Gde je šta

```
docs/js/core/    util (RNG, geo) · rules (SVA pravila) · i18n · icons · haptics
docs/js/net/     clock (serverTimeOffset) · store (Firebase)
docs/js/ui/      kit · avatar (likovi) · nav (dugme nazad) · sensors (+ TestWalk) · map · screens
docs/js/game/    engine · items · combat (+ potera) · encounter · mentor · bots
docs/css/        tokens · base · components · screens · game
```

`docs/css/style.css` **nije povezan** ni sa jednim HTML-om — to je ostatak starog izgleda i
može da se obriše.
