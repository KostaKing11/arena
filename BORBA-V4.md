# ARENA — borba v4 (uživo, bez ekrana za borbu)

**Ovo zamenjuje sekcije 7, 8 i 9 iz `SPEC.md`.** Sve ostalo iz specifikacije ostaje isto.

---

## 1. Osnovna promena

**Nema stanja borbe.** Nema rundi, nema trake razdaljine 0–5, nema potere, nema zastavice, nema `fights/` čvora.

Borba je fizička. Kad se pomeriš uživo, pomerio si se i u igri. Napad je **jedna akcija: nišaniš kamerom i uslikaš protivnika.** Razdaljina u igri = prava razdaljina u metrima.

Brišu se: `fights/`, `chase/`, cooldown od 3 min između dva igrača, zabrana lečenja u borbi, dugmad Priđi / Odmakni se / Napad / Blok.

---

## 2. Oružja

| Oružje | Klasa | Opseg | Šteta | Nišanjenje | Cooldown | Upozorenje žrtvi |
|---|---|---|---|---|---|---|
| Pesnice | — | 0–3 m | 10 | 1 s | 15 s | ne |
| Nož | Senka | 0–5 m | 45 | 1 s | 20 s | **ne** |
| Toljaga | Sakupljač | 0–5 m | 22 | 1,5 s | 20 s | ne |
| Sekira | Snagator | 0–8 m | 35 | 2 s | 25 s | ne |
| Mreža | Zamkar | 0–8 m | 10 + uplitanje | 2 s | 40 s | ne |
| Koplje | Lovac | 3–12 m | 28 | 2 s | 25 s | da |
| Trozubac | Ribar | 0–15 m | 30 | 2 s | 25 s | da (preko 8 m) |
| Duvaljka | Lekar | 5–20 m | 12 + otrov | 3 s | 40 s | da |
| Praćka | Trkač | 8–25 m | 15 | 3 s | 20 s | da |
| Luk | Strelac | 15–40 m | 30 | 5 s | 60 s | da |

Sa svojom klasom: **+8 štete.**

**Van opsega:**
- **Preblizu** (bliže od minimuma) → **pola štete i 40% šanse da promašiš**. Strelac na 3 m je skoro bespomoćan
- **Predaleko** → dugme za napad je zatamnjeno, ne može ni da uslika

**Uplitanje (mreža):** žrtva 20 s ne može da napada, ali može da se kreće i beži.

**Otrov (duvaljka):** 3 HP na 10 s tokom 60 s, kumulativno se ne slaže — novi pogodak samo resetuje trajanje.

---

## 3. Kako napad teče, korak po korak

1. Tapneš ikonicu kamere → otvara se ekran nišanjenja
2. Preko slike: **nišan u sredini, brojka razdaljine do izabranog cilja, i traka opsega tvog oružja** — zelena kad je cilj u opsegu, žuta kad je preblizu, crvena kad je predaleko
3. Aplikacija primenjuje tri filtera (isto kao u v3): **konus ±30° po kompasu**, **detekcija osobe u kadru** (MediaPipe, klasa `person`), **rangiranje po azimutu + poklapanju procenjene i GPS razdaljine**
4. Najbolji pogodak na vrhu sa slikom lica i imenom; skroluje se ako je pogrešio. Bez osobe u kadru → "Nema nikoga na slici"
5. Pritisneš i **držiš dugme za nišanjenje** onoliko koliko traži oružje. Ako se pomeriš više od 5 m tokom nišanjenja → promašaj
6. Otpuštaš → udarac se razrešava
7. **Animacija 1,5 s:** tvoj avatar udara njegov, iskoči broj štete, vibracija
8. Kreće cooldown oružja, prikazan kao krug oko ikonice kamere

## 4. Šta doživljava žrtva

- **Oružje sa upozorenjem** (koplje, trozubac, duvaljka, praćka, luk): u trenutku kad neko počne da nišani, dobija **"Neko te gađa sa severoistoka — MRDAJ!"**, jaku vibraciju i strelicu na kompasu. Ako se za to vreme pomeri **preko 8 m**, promašaj
- **Oružje bez upozorenja** (nož, sekira, toljaga, mreža, pesnice): nema nikakve najave. Zato je Senka strašna
- Pogodak: crveni bljesak preko ekrana, vibracija, i tekst **"Pogodio te je nož sa 4 m — Marko"** plus pravac odakle
- **Odbrana je fizička.** Ako si za zidom, za autom, u žbunu, iza ćoška — protivnik ne može da te detektuje u kadru i napad ne postoji. Nema dugmeta za blok

## 5. Smrt

- HP 0 → top svima, vibracija, ekran smrti
- **Sav inventar i oružje padaju na mesto smrti** kao obični predmeti, uzima ih ko stigne
- Ubica dobija +1 kill i objavu u feed

Pošto nož radi 45 a luk 30, potrebno je **3 pogotka nožem ili 4 strele** za 100 HP. To je namerno — jedan napad iz zasede nikad ne ubija, uvek postoji trenutak da pobegneš ili odgovoriš.

---

## 6. Specijali — sada jednom po IGRI, ne po borbi

Pošto nema borbi, specijal je jedan potez po celoj igri. Zato su jači.

| Klasa | Specijal |
|---|---|
| Senka | **Ubod u leđa** — 90 štete, ali samo na manje od 3 m i samo ako žrtva u tom trenutku ne gleda u tvom pravcu (poredi njen kompas sa azimutom do tebe, tolerancija ±60°) |
| Ribar | **Bačeni trozubac** — 60 štete do 25 m, gubiš trozubac; pada kod žrtve, uzima ga ko stigne |
| Strelac | **Precizan hitac** — 55 štete do 60 m, nišanjenje 10 s, žrtva dobija upozorenje |
| Snagator | **Nasrtaj** — 50 štete do 8 m, ignoriše i preblizu i predaleko kaznu |
| Lovac | **Salva** — tri pogotka po 20 u roku od 15 s, bez cooldowna između njih |
| Zamkar | **Velika mreža** — svi u krugu od 12 m ne mogu da napadaju 40 s |
| Trkač | **Drugi vetar** — 60 s tvoji cooldowni su prepolovljeni |
| Sakupljač | **Zaliha** — glad i žeđ ti se pune do maksimuma |
| Lekar | **Napitak** — vraća 70 HP tebi ili savezniku koga uslikaš |

---

## 7. Klase — izmene zbog nove borbe

Sve ostalo iz `SPEC.md` sekcije 5 ostaje. Menja se samo ovo:

- **Trkač** — nema više bekstva pa mu treba nešto novo: **svi cooldowni −25%**, i imun je na uplitanje
- **Zamkar** — plus ostaje (duplo zamki, +50% jačina, vidi tuđe na 10 m), minus mu se menja na **−10 max HP**, jer "ne može da beži" više ne postoji
- **Lekar** — leči saveznika tako što ga **uslika** kao da ga napada; aplikacija prepoznaje da je saveznik i lečenje se primenjuje
- **Senka** — bez upozorenja nikad, +8 nožem, nevidljiva na svim mapama
- **Strelac** — minimapa 40 m za igrače, opseg 15–40 m

---

## 8. Savezi i izdaja

- Kad uslikaš saveznika, ekran kaže **"Ovo je tvoj saveznik"** i nudi dva dugmeta: **Izleči / Daj predmet** i **Napadni ipak**
- **Izdaja = prvi pogodak na saveznika radi +50% štete** i objavljuje se svima u feed. Posle toga je običan protivnik
- Senka koja izda odmah ponovo postaje nevidljiva svom bivšem timu

---

## 9. Lečenje i predmeti

- Pošto nema stanja borbe, lečenje i jelo su dostupni uvek — ali **traju 3 s stajanja u mestu** i prekidaju se ako se pomeriš preko 5 m
- Zamke rade isto kao pre

---

## 10. Anti-varanje — sada važi za SVAKI napad, ne samo za luk

Napad je blokiran ako:
- GPS tačnost napadača ili žrtve je **preko 20 m**
- napadač je **van arene**
- napadač se **nije pomerio bar 20 m u poslednjih 5 minuta** (ko sedi kod kuće ne može da napada)
- žrtva je **mrtva** → "Ovaj tribut je mrtav", bez cooldowna
- prošlo je **manje od 30 s od starta igre** (da kornukopija ne bude masakr u prve tri sekunde)

Neuspelo slikanje bez detektovane osobe: **cooldown 15 s**, da se kamera ne koristi kao radar.

Svaka uslikana slika se čuva kao dokaz i vidljiva je duhovima u feed-u.

---

## 11. Baza — izmene

Briše se `fights/` i `chase/`.

Dodaje se u `players/{pid}`:

```
weaponCooldownUntilMs
specialUsedThisGame
poisonUntilMs
entangledUntilMs
lastAttackAtMs
attacksLanded, attacksMissed
```

Novi čvor:

```
hits/{hid}: attackerId, victimId, weapon, distanceM,
            damage, missed, photoRef, atMs
```

`hits` služi za feed, za recap na kraju i kao dokaz duhovima.

---

## 12. Šta se briše iz koda

- ekran borbe sa rundama i dugmadima Priđi / Odmakni se / Napad / Blok
- traka razdaljine 0–5 i sva logika oko nje
- stanje `chase`, zastavica `leftRadius`, odbrojavanje bekstva
- cooldown od 3 min između ista dva igrača
- zabrana lečenja tokom borbe
- "gubitnik ispušta sve" → sada ispušta samo onaj ko umre

---

## 13. Upozorenje igračima pre starta

Dodaj u tekst pre igre: **ljudi će sada sprintati jedan ka drugom gledajući u telefon.** Ne trči po ulici, gledaj u okolinu, arena ne sme biti kraj saobraćajnice.
