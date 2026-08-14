# ARENA — PREDMETI (v5)

Pisano za **borbu v4**: nema stanja borbe, nema rundi, nema bekstva — napadaš tako što
fotografišeš metu, a daljina snimka određuje štetu.

**41 predmet**, ali nijedan nije „isti predmet, veći broj". Ovo je stanje u kodu
(`docs/js/core/rules.js`, `docs/js/game/items.js`, `engine.js`, `combat.js`), ne želja.

**Šta se promenilo u odnosu na v4:**

1. Način uzimanja zavisi od **tipa** predmeta, ne od retkosti
2. Glad i žeđ imaju **različite posledice** — prestale su da budu zamenljive
3. Izbačeno 10 predmeta koji su bili viši nivo nekog drugog
4. Dodata kategorija **kamera i borba** — 5 predmeta koji rade sa novom borbom
5. Sva tri pokvarena predmeta iz v4 rade
6. Baklja i ranac dobili cenu; do sada su bili čista dobit

---

## 1. Kako se predmet uzima

**Radijus 12 m** (bilo 10 — u gradu je to unutar same greške GPS-a, 5–20 m između zgrada).
Prvih **10 s posle starta** niko ne kupi ništa.

| Klasa | Kako | Šta spada |
|---|---|---|
| **Tap** | jedan dodir | hrana, piće, strele, lečenje, sitni alat |
| **Drži 3 s** | prekida se na pomeraj preko 6 m | oružje, zamke, ranac, tobolac, štit, mamac, trajni bonusi |
| **Sanduk 8 s** | pomeraj prekida, **svima ide objava** | Gozba, Luk, Nož, Trozubac |

Izvorska voda je „retko" a ide u sekundi; Trozubac te košta osam sekundi i javne objave da
si tu. Cenu plaćaš u **izloženosti**, srazmerno težini predmeta.

**Adrenalin polovi svako držanje** — sanduk sa 8 s pada na 4 s.

Izbačen je epski izazov (5 tapova u ritmu / tresenje telefona): jedina mehanika u igri koja
je tražila veštinu prstiju, usred igre gde treba da gledaš oko sebe.

## 2. Inventar

- **4 slota**, Trkač **+1**, Ranac **+3** → maksimum 8
- Oružje ima svoj slot van inventara; zamena = staro pada na zemlju
- **Stack po tipu:** hrana, piće i strele **3 po slotu**, sve ostalo **1**
- Gozba, Ranac i Štit zauzimaju ceo slot sami (`bigItem`)
- Ispuštaš ceo stack

## 3. Glad i žeđ — više nisu ista traka

| | Brzina | Ispod 30% | Na nuli |
|---|---|---|---|
| **Žeđ** | prazna za **10 min** | **slepiš** — minimapa 15 m → 10 m | −2 HP / 30 s |
| **Glad** | prazna za **15 min** | **slabiš** — tvoja šteta −25% | −2 HP / 30 s |

Oba na nuli: **−5 HP / 30 s** (jače od zbira).

> **Vid za PIĆE ne pada od žeđi.** Bez ovog izuzetka žeđ bi bila spirala iz koje se ne
> izlazi — što si žedniji, teže nađeš vodu, pa si još žedniji. Ovako kazna i dalje boli
> (ne vidiš oružje, zamke ni hranu), a igra ti ne oduzima način da je skineš.

Obe kazne se vide u traci efekata, pa igrač zna zašto promašuje.

## 4. Kako se predmet koristi

Hrana, piće i lečenje: **3 s stajanja**, prekida se na pomeraj preko 5 m.
Zamke i Mamac se **postavljaju** na tvoju lokaciju.

Svi efekti sa trajanjem imaju **odbrojavač na ekranu** (`#fxBar`, iznad vitalnih).
Izvor istine je `R.TIMED_EFFECTS` — nov predmet sa trajanjem se doda tamo i traka ga
sama pokupi.

---

## 5. Hrana (5)

| Predmet | Retkost | Uzimanje | Efekat | Gde |
|---|---|---|---|---|
| Bobice | obično | tap | +20 gladi | rasuto |
| Pečurke | neobično | tap | **+40 gladi, uvek te otruju** (3 HP / 10 s, 60 s) | rasuto |
| Obrok | neobično | tap | +45 gladi | oba |
| Gozba | legendarno | sanduk | **+100 gladi, +50 žeđi**, ceo slot | kornukopija |
| Pojas sa zalihama | epsko | drži 3 s | +30 max gladi trajno (max 50) | kornukopija |

Hleb i Sušeno meso spojeni u **Obrok**. Bobicama skinuta 5% šansa za trovanje.

**Pečurke koriste pravi sistem otrova** (isti kao duvaljka), pa ih Protivotrov skida i
60 s imuniteta ih sprečava. Uvek te otruju, ali te najbolje hrane od svega rasutog: to
jeste odluka, za razliku od 15% da te zezne.

## 6. Piće (4)

| Predmet | Retkost | Uzimanje | Efekat | Gde |
|---|---|---|---|---|
| Prljava voda | obično | tap | +25 žeđi, **−8 HP** (Sakupljaču bez štete) | oba |
| Flaša vode | neobično | tap | +45 žeđi | oba |
| Izvorska voda | retko | tap | +70 žeđi | oba |
| Termos | epsko | drži 3 s | +30 max žeđi trajno (max 50) | kornukopija |

Sok izbačen — bio je mešavina hleba i vode.

## 7. Lečenje (4)

| Predmet | Retkost | Uzimanje | Efekat | Gde |
|---|---|---|---|---|
| Lekovito bilje | obično | tap | +15 HP (Lekaru tačno 30) | oba |
| Zavoj | neobično | tap | **+35 HP** (Lekaru ×1.5) | oba |
| Protivotrov | retko | tap | skida otrov **+ 60 s imuniteta** | oba |
| Sponzorska mast | legendarno | tap | pun HP + skida otrov | oba |

Medkit izbačen (stepenik između zavoja i masti), zavoj podignut 25 → 35.

## 8. Ranac (1)

| Predmet | Retkost | Uzimanje | Efekat | Gde |
|---|---|---|---|---|
| Ranac | epsko | drži 3 s | **+3 slota**, ali te **svi vide na 50 m** | kornukopija |

Tri ranca („važi najveći, ne sabiraju se") su bili jedan predmet napisan tri puta.

> Vidljivost je **trajna od trenutka upotrebe**, ne „dok ga nosiš" — ranac se koristi
> jednom i kapacitet ostaje. Uzeo si veću torbu, do kraja partije si veća meta.
> Ako se u testu pokaže prestrogo, prvo smanji **50 m**, ne broj slotova.

## 9. Zamke (4)

Postavljaju se na tvoju lokaciju. Okidaju na **15 m**, ali tek posle **5 s neprekidnog
zadržavanja**. Vlasnik ne okida svoje. Zamkar nosi duplo i njegove su +50% jače.

| Predmet | Retkost | Efekat | Gde |
|---|---|---|---|
| Zamka | neobično | −20 HP (Zamkaru −30) | rasuto |
| Alarm | retko | žrtva vidljiva svima 8 s + objava | oba |
| Traker | epsko | vlasnik vidi žrtvu 5 min | oba |
| **Mreža-zamka** | epsko | žrtva **30 s ne može da fotografiše ni da uzima predmete** | oba |

**Zašto 15 m i 5 s.** Stari radijus od 10 m je unutar greške GPS-a — zamke su okidale na
ljude koji nisu ni prišli. Uslov zadržavanja filtrira i drift i prolaznike, i tematski je
bolji: zamka hvata onog ko se zadržava, ne onog ko projuri.

**Mreža je popravljena.** Stara je pisala `cannotFleeUntilMs`, a to je čitao samo
`Combat.flee` kog više nema. Pošto se napada kamerom, „uhvaćen u mrežu" prirodno znači da
ti kamera ne radi.

## 10. Kamera i borba (5) — nova kategorija

| Predmet | Retkost | Uzimanje | Efekat | Gde |
|---|---|---|---|---|
| Blic-folija | retko | tap | **60 s** — fotografije sa preko **15 m** te promaše | oba |
| Stativ | retko | tap | sledeći kadar radi **duplu štetu** i **probija blic** (1×) | kornukopija |
| Dimna bomba | retko | tap | krug **20 m, 60 s** — kamera ne radi **nikome**, ni tebi | oba |
| Adrenalin | epsko | tap | **90 s** — nema kazne za preblizu + **duplo brže uzimanje** | oba |
| Štit | epsko | drži 3 s | **upija jedan napad u celosti**, pa puca | kornukopija |

**Blic-folija i Stativ su jedini par u igri koji se direktno kontrira.** Ako te neko gađa
iz daljine, folija mu ubija snimak; stativ je probija jednim udarcem. Prva prava
„makaze-papir" dinamika, i to prostorna — ne statistička.

**Adrenalin** je popravljen Napitak besa (`effects.rage` je čitao samo stari `openFight`).
Skida kaznu za preblizu, što je u borbi v4 ekvivalent onoga što je „prva runda duplo"
značilo ranije. **Domet oružja i dalje važi** — „predaleko" ostaje predaleko, inače bi
pesnice tukle na 40 m.

**Dimna bomba** je bila „3 min nevidljiv trakerima" — preusko. Sada pravi zonu u kojoj
niko ne može da bude detektovan u kadru, uključujući tebe. Vidi se na mapi kao siv
isprekidan krug, inače igrač ne zna zašto mu se meta ne pojavljuje.

**Štit** upija napad pre svega ostalog — ni otrov ni mreža ne prolaze kroz njega.

## 11. Izviđanje i alat (8)

| Predmet | Retkost | Uzimanje | Efekat | Gde |
|---|---|---|---|---|
| Baklja | obično | tap | svetlo **8 min**, +6 m vida — **ali te svi vide na 100 m** | oba |
| Kompas tributa | neobično | tap | **5 min** — strelica ka najbližem, bez razdaljine, osvežava se na 30 s | oba |
| Signalna raketa | neobično | tap | otkriva te svima **30 s**; mentor odmah šalje **jedan besplatan paket** | oba |
| Durbin | retko | tap | **15 s** — igrači u konusu **±25°, do 60 m** u pravcu telefona | oba |
| Karta zone | retko | tap | **5 min** — najavni prsten sledeće zone se pali ranije | oba |
| Mamac | retko | drži 3 s | lažni **legendarni sanduk** koji svima izgleda pravi | oba |
| Tobolac | retko | drži 3 s | strele ne troše slot, bez granice | rasuto |
| Kamuflažni ogrtač | epsko | tap | **5 min** — ne pojavljuješ se ni u kadru ni na jednoj mapi | kornukopija |

**Baklja sada ima cenu, i to je najvažnija pojedinačna promena u listi.** Svetlo znači da
ti vidiš, ali i da tebe vide — jedini tradeoff koji je istinit i uživo, i jedini razlog da
je iko ikad ugasi. Velika baklja izbačena.

**Durbin** je bio najslabiji „retko" u igri (vid za PREDMETE 15 → 20 m). Sada daje vid na
**igrače**, ali traži da staneš, da pogodiš pravac i troši se za 15 s. Koristi kompas koji
igrači i onako kalibrišu pre starta.

**Mamac** se prirodno spaja sa halucinacijama od trkačkih osa. Nikad se ne seli, ne
obnavlja i **nestaje kad njegov vlasnik pogine**. Vlasnik dobija obaveštenje kad neko
nagazi na njega.

**Signalna raketa** je jedina veza predmeta sa mentorskim sistemom: paket ne košta
naklonost i ne čeka hlađenje od 5 min.

## 12. Oružja i municija (10)

Bez promena u brojkama — detalji su u [`BORBA-V4.md`](BORBA-V4.md). Menja se samo uzimanje:
epska (Luk, Nož) i legendarno (Trozubac) sada idu kroz **sanduk od 8 s sa javnom objavom**.

| Predmet | Retkost | Uzimanje | Gde |
|---|---|---|---|
| Toljaga, Praćka | obično | drži 3 s | rasuto |
| Mreža | neobično | drži 3 s | oba |
| Koplje, Sekira, Duvaljka | retko | drži 3 s | kornukopija |
| Luk, Nož | epsko | **sanduk** | kornukopija |
| Trozubac | legendarno | **sanduk** | kornukopija |
| Strele | neobično | tap | rasuto, +3 po nalazištu |

Bez Tobolca max 3 strele. Nalazišta: 8 po strelcu u igri.

## 13. Pojava i nestajanje

Na startu: `broj igrača × 12`, host menja gustinu ±50%. **30% kornukopija** (krug 40 m),
**70% rasuto**. Min rastojanje 4 m / 12 m. Nikad u poslednjih 20 m uz ivicu.

| Retkost | Rasuto | Kornukopija |
|---|---|---|
| Obično | 55% | 20% |
| Neobično | 27% | 30% |
| Retko | 13% | 30% |
| Epsko | 4% | 15% |
| Legendarno | 1% | 5% |

Stvarna raspodela po kategorijama (200 arena, 12 igrača): alat 23%, oružje 20%,
lečenje 15%, piće 13,5%, hrana 13%, zamke 6,5%, kamera 6%, strele 2%, rančevi 1,4%.
Po načinu uzimanja: **tap 69%, drži 30%, sanduk 2%**.

**Tokom igre** (host na 20 s, max 4 promene po prolazu):

- **hrana i piće se obnavljaju** 90 s posle uzimanja, drugde
- oružja, ranac, zamke, alat i **cela kategorija kamera** se **NE** obnavljaju
- predmet koji niko ne uzme **10 min** se seli
- kad se zona skupi, predmeti van nje ulaze unutra
- ispušteni (`dropped`) se ne sele i ne obnavljaju
- **Mamac** se ne seli, ne obnavlja i ne uvlači u zonu

**Kad neko pogine:** sav inventar i oružje padaju na mesto smrti. Aktivni Štit i
nepotrošeni Stativ se **ne** ispuštaju — troše se sa smrću.

---

## 14. Popravke iz borbe v4

| Predmet | Šta je bilo | Sada |
|---|---|---|
| **Protivotrov** | pisao `poisonedUntilMs`, borba čita `poisonUntilMs` | isto polje + 60 s imuniteta |
| **Mreža-zamka** | `cannotFleeUntilMs`, čitao samo `Combat.flee` | blokira kameru 30 s |
| **Napitak besa** | `effects.rage`, čitao samo `openFight` | **Adrenalin** — 90 s bez kazne za preblizu |

Otrov ima **jednog vlasnika**: `Attack.tick`. `survivalTick` ga podržava zbog testova, ali
mu engine namerno ne prosleđuje ključ — inače bi se šteta brojala dvaput.

## 15. Gde je šta u kodu

| Fajl | Šta nosi |
|---|---|
| `core/rules.js` | `PICKUP`/`pickupOf`, `ITEMS`, `STACKABLE`, `SURVIVAL`, `survivalPenalty`, `consume`, `TIMED_EFFECTS`/`activeEffects`, `smokeZones`/`inSmoke`, `selfRevealM`, `TRAP_RADIUS_M`/`TRAP_DWELL_MS` |
| `game/items.js` | uzimanje po klasi, `setDecoy`, zadržavanje u zamci (`dwell`), vid za piće |
| `game/engine.js` | odvojen tick gladi/žeđi, zone dima u `derive`, čišćenje mamca |
| `game/combat.js` | štit, stativ, blic, dim u `ctxFor` |
| `game/encounter.js` | dim briše kandidate iz kadra |
| `ui/screens.js` | `renderEffects` (traka), durbin i samootkrivanje u `visiblePlayers`, kompas |
| `ui/map.js` | `drawSmoke`, `z.peek` za Kartu zone |
| `test/simulate.js` | 165 provera, sekcije 4/4b/4c/10/10b |

## 16. Šta bih prvo gledao u testu

- **Ranac, 50 m vidljivosti** — najverovatnije prestrogo
- **Baklja, 100 m** — ako je niko ne pali, spusti na 60 m
- **Zadržavanje 5 s u zamci** — ako zamke nikad ne okidaju, spusti na 3 s
- **Žeđ za 10 min** — traži ~4,5 punjenja po partiji od 45 min, uz ~1,6 pića po igraču na
  startu. Obnavljanje na 90 s to pokriva u proseku, ali je najtešnji broj u celom sistemu
- **Blic-folija na 15 m** — ako Strelac postane neupotrebljiv, digni prag

## 17. Šta namerno nije dirano

Bazeni retkosti, podela 30/70, brojke oružja, klase i njihovi perkovi, mentorski i
Gamemaker sistem. Signalna raketa se kači na postojeći mentorski tok, ne menja ga.
