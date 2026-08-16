# ARENA — radni spisak

Verzija **1.1.0**. Za sliku stanja, arhitekturu i način objavljivanja idi na
[`STANJE.md`](STANJE.md) — ovo je samo spisak posla.

Ideje za dalje: [`IDEJE.md`](IDEJE.md).

---

## 1. Prvo — odigrati napolju

Sve u ovoj rundi je testirano na telefonu, ali **u zatvorenom, sa botovima**. Prva prava partija
sa ljudima je jedini način da se sledeće stavke uopšte odluče. Konkretno pogledati:

- **Držanje kartice za uzimanje predmeta.** Prag za prekid sada prati grešku GPS-a (ranije
  fiksnih 6 m, što je manje od same greške signala). U zatvorenom je pucalo. Prvo što treba
  probati: priđi predmetu i zadrži karticu dok se ne napuni.
- **Da li se protivnik uopšte nalazi.** Vidi se samo ono što klasa dozvoljava. Ako se ljudi
  pola sata ne sretnu, arena je prevelika ili vid preuzak.
- **Da li je iz kamere jasno šta se dešava.** Domet, držanje, hlađenje.

---

## 2. Nikad viđeno uživo

Ovo nije pokvareno — samo nikad nije potvrđeno na terenu:

- specijali klasa (ubod u leđa, precizan hitac, nasrtaj, salva, velika mreža, drugi vetar…)
- mreža (zapetljavanje) i duvaljka (otrov)
- izdaja saveza
- upozorenje žrtvi da je neko nišani
- arena koja se sama umeša posle polovine partije

---

## 3. Poznato, a namerno ostavljeno

- **Baza je otvorena.** Za igru sa poznatima je u redu. Pre šireg deljenja linka treba
  postaviti Firebase pravila.
- **Bez signala partija staje.** Servisni radnik služi aplikaciju, ali stanje sveta ne stiže.
  Fali bar poruka umesto zamrznute slike.
- **`screens.js` je ~2500 linija.** Radi, ali svaka izmena traje duže nego što bi trebalo.
- **Testovi ne dodiruju UI.** 296 provera pokriva pravila; nijedna ne crta ekran.

---

## 4. Pravila koja se ne diraju

Utvrđeno kroz više rundi — ako nešto od ovoga izgleda kao greška, prvo pročitaj zašto:

- **Arhitektura bez servera.** Sve nasumično ide u `schedule` iz seed-a, sa apsolutnim
  vremenima. Nijedno pravilo ne sme da zavisi od `Date.now()` — samo `Clock.now()`.
- **Zastavica `leftRadius`**, **`/arena/test` kao flag**, **manifest scope `/arena/`.**
- **`npm test` mora da ostane zeleno.**
- **Objava ide isključivo preko `node tools/bump.js X.Y.Z`.** Ručno menjanje verzije na jednom
  mestu znači da telefon ostaje na starom kodu.
- **Geometrija iskri je čista funkcija FAZE, ne trenutka.** Bilo je mereno: iskra se selila
  634 m tokom jednog skupljanja jer se prsten računao iz žive zone.
- **Ekran se gradi jednom, otkucaj menja samo brojeve.** Prepisivanje `innerHTML` na svaki
  otkucaj ruši mapu, izbacuje tastaturu iz četa i pravi treperenje.
