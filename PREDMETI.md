# ARENA — predmeti, kako sada rade

Izvučeno iz koda (`docs/js/core/rules.js`, `docs/js/game/items.js`, `docs/js/game/engine.js`),
ne iz specifikacije — ovo je **stvarno stanje**, da imaš od čega da pišeš novo.

Ukupno **40 predmeta**, od toga 9 oružja + strele.

Na dnu je spisak **stvari koje su se pokvarile posle borbe v4** — tri efekta više ništa ne rade.

---

## 1. Kako se predmet uzima

**Radijus 10 m.** Prvih **10 s posle starta** niko ne može ništa da pokupi.
Način uzimanja zavisi SAMO od retkosti, ne od toga šta je predmet:

| Retkost | Boja | Kako se uzima | Stack |
|---|---|---|---|
| Obično | siva | **tap** | 3 |
| Neobično | zelena | **drži 3 s** | 2 |
| Retko | plava | **drži 6 s**, prekida se ako se pomeriš preko 6 m | 1 |
| Epsko | ljubičasta | **izazov**: 5 tapova u ritmu ILI protresi telefon 3× (biraš) | 1 |
| Legendarno | zlatna | **drži 10 s**, prekida se na pomeraj, **svima ide objava** „neko otvara sanduk" | 1 |

## 2. Inventar

- **4 slota** osnovno, Trkač ima **+1**. Rančevi dižu kapacitet (5 / 7 / 9).
- Oružje ima **svoj slot van inventara**. Zamena = staro pada na zemlju.
- Ako pokupiš nešto što već imaš a stack nije pun → **ne pita ništa**, samo doda.
- Ekran za zamenu iskače **samo kad su svi slotovi puni**: tapneš šta izbacuješ, ili Otkaži.
- **Ispuštaš ceo stack**, ne komad po komad.

## 3. Kako se predmet koristi

Posle borbe v4: **jelo, piće i lečenje traju 3 s stajanja u mestu** i prekidaju se ako se
pomeriš preko 5 m. Nema više zabrane lečenja „u borbi" jer borbe kao stanja nema.

Zamke se ne „koriste" nego **postavljaju na tvoju trenutnu lokaciju**.

---

## 4. Spisak — hrana (6)

Puni glad, do maksimuma (100 + bonus od pojasa).

| Predmet | Retkost | Efekat | Gde se nalazi |
|---|---|---|---|
| Bobice | obično | +20 gladi, **5% šanse za otrov −10 HP** | oba |
| Pečurke | neobično | +30 gladi, **15% šanse za otrov −20 HP** | rasuto |
| Hleb | neobično | +35 gladi | oba |
| Sušeno meso | retko | +55 gladi | oba |
| Gozba | legendarno | +100 gladi | kornukopija |
| Pojas sa zalihama | epsko | **+30 max gladi trajno** (ukupan bonus ograničen na 50) | kornukopija |

## 5. Piće (5)

| Predmet | Retkost | Efekat | Gde |
|---|---|---|---|
| Prljava voda | obično | +25 žeđi, **−8 HP** (Sakupljaču ne škodi) | oba |
| Flaša vode | neobično | +40 žeđi | oba |
| Sok | neobično | +30 žeđi, +15 gladi | oba |
| Izvorska voda | retko | +70 žeđi | oba |
| Termos | epsko | **+30 max žeđi trajno** (ukupno max 50) | kornukopija |

## 6. Lečenje (5)

| Predmet | Retkost | Efekat | Gde |
|---|---|---|---|
| Lekovito bilje | obično | +15 HP, **Lekaru duplo (30)** | oba |
| Zavoj | neobično | +25 HP (Lekaru ×1.5) | oba |
| Protivotrov | retko | skida otrov | oba |
| Medkit | epsko | +60 HP (Lekaru ×1.5) | kornukopija |
| Sponzorska mast | legendarno | **pun HP** | oba |

> Lekarev `healMul` 1.5 množi svako lečenje; bilje ima poseban pravilo pa mu je tačno duplo.

## 7. Rančevi (3)

Dižu kapacitet inventara. Uzima se **najveći** koji imaš, ne sabiraju se.

| Predmet | Retkost | Efekat | Gde |
|---|---|---|---|
| Mala torba | retko | 4 → **5** slotova | oba |
| Ranac | epsko | 4 → **7** | kornukopija |
| Veliki ranac | legendarno | 4 → **9** | kornukopija |

## 8. Zamke (4)

Postavljaju se na tvoju lokaciju, **okidaju na 10 m** na svakog osim vlasnika.
Zamkar nosi duplo zamki i njegove su **+50% jače**.

| Predmet | Retkost | Efekat kad neko upadne | Gde |
|---|---|---|---|
| Zamka | neobično | **−18 HP** (Zamkaru −27) | rasuto |
| Alarm | retko | žrtva je **vidljiva svima 8 s** + objava u feed | oba |
| Traker | epsko | **vlasnik vidi žrtvu 5 min** | oba |
| Mreža-zamka | epsko | ⚠️ **više ništa ne radi** — vidi §11 | oba |

## 9. Ostalo (7)

| Predmet | Retkost | Efekat | Gde |
|---|---|---|---|
| Baklja | obično | svetlo **8 min** | oba |
| Velika baklja | retko | svetlo **15 min**, +6 m radijusa | oba |
| Durbin | retko | vid predmeta **15 → 20 m** | oba |
| Dimna bomba | retko | **3 min nevidljiv trakerima** | oba |
| Tobolac | retko | strele **ne troše slot** i nema granice | oba |
| Napitak besa | epsko | ⚠️ **više ništa ne radi** — vidi §11 | oba |
| Kamuflažni ogrtač | epsko | **5 min nevidljiv svima**, i Strelcu | kornukopija |

## 10. Oružja i municija (10)

Oružja se nalaze kao predmeti i idu u **poseban slot**. Detalji dometa i štete su u
[`BORBA-V4.md`](BORBA-V4.md).

| Predmet | Retkost | Gde |
|---|---|---|
| Toljaga, Praćka | obično | rasuto |
| Mreža | neobično | oba |
| Koplje, Sekira, Duvaljka | retko | kornukopija |
| Luk, Nož | epsko | kornukopija |
| Trozubac | legendarno | kornukopija |
| **Strele** | neobično | rasuto, +3 po nalazištu |

Bez tobolca **max 3 strele** i troše slot. Nalazišta strela: **8 po strelcu u igri**.

---

## 11. ⚠️ Šta se pokvarilo posle borbe v4

Tri stvari i dalje postoje kao predmeti, ali im efekat više niko ne čita:

1. **Napitak besa** upisuje `effects.rage`, a to je čitao samo stari `openFight` („prva runda
   duplo"). Rundi više nema → **napitak ne radi ništa.**
2. **Mreža-zamka** upisuje `cannotFleeUntilMs`, a to je čitao samo stari `Combat.flee`.
   Bekstva više nema → **ne radi ništa.**
3. **Protivotrov** upisuje `poisonedUntilMs`, a nova borba čita `poisonUntilMs` — **različito
   polje**, pa protivotrov **ne skida otrov od duvaljke.** Ovo je obična greška u imenu, ne
   pitanje dizajna, i mogu je popraviti odmah ako hoćeš.

Uz to, **durbin** diže samo vid za **predmete**; vid za igrače ima jedino Strelac.

---

## 12. Kako se predmeti pojavljuju i nestaju

**Na startu:** ukupno = `broj igrača × 12`, host menja gustinu ±50%.
**30% kornukopija** (krug 40 m oko centra), **70% rasuto**.
Min rastojanje: **4 m** u kornukopiji, **12 m** rasuto. Nikad u poslednjih **20 m** uz ivicu.

Retkost se izvlači po bazenu:

| Retkost | Rasuto | Kornukopija |
|---|---|---|
| Obično | 55% | 20% |
| Neobično | 27% | 30% |
| Retko | 13% | 30% |
| Epsko | 4% | 15% |
| Legendarno | 1% | 5% |

**Tokom igre** (host proverava na 20 s, najviše 4 promene po prolazu):
- **hrana i piće se obnavljaju** — 90 s pošto se pokupe, isti tip se stvori drugde.
  Oružja, rančevi, zamke i alati se **NE** obnavljaju.
- predmet koji niko ne uzme **10 min** se **seli** na drugo mesto
- kad se zona skupi, predmeti van nje se **prebacuju unutra**
- predmeti koje je neko ispustio (`dropped`) se **ne sele** i **ne obnavljaju**

**Kad neko pogine:** sav inventar i oružje padaju na mesto smrti kao obični predmeti.

---

## 13. Šta bih ti predložio da razmisliš kad budeš pisao novo

Ne moraš ovo da prihvatiš, samo su tri stvari koje mi bodu oči dok čitam kod:

- **Način uzimanja zavisi samo od retkosti, ne od predmeta.** Zato se voda uzima isto kao
  ranac, a legendarna mast isto kao veliki ranac. Verovatnije je da želiš da vreme uzimanja
  prati *šta je stvar*, a ne koliko je retka.
- **Epski izazov (tapkanje u ritmu / tresenje) je jedini koji traži veštinu**, i to usred
  igre gde stojiš na ulici. Vredi proveriti da li to uopšte želiš.
- **Sedam predmeta su „efekat na X minuta"** (baklje, dimna bomba, ogrtač, traker), a nigde
  na ekranu ne piše koliko ti je još ostalo. Šta god da odlučiš za nove predmete, taj
  brojač verovatno treba negde da se vidi.
