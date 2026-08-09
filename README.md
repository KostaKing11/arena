# ARENA — Igre gladi IRL

Telefon je mapa, inventar i oružje. Igra se **napolju, uživo**. Aplikacija povezuje telefone,
govori ti gde da ideš, javlja kad je neko blizu i drži borbe, predmete i događaje.

Statični sajt (GitHub Pages) + Firebase Realtime Database. **Nema servera koji treba držati
upaljen.** Radi na iPhone-u i Androidu kroz browser — dodaš na Home Screen i ponaša se kao app.

---

## 1. Podešavanje Firebase-a (uradi jednom, ~5 minuta)

1. Idi na [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
   Ime npr. `arena`. Google Analytics možeš da isključiš.
2. Levo **Build → Realtime Database → Create Database**.
   Region: `europe-west1`. Izaberi **Start in locked mode**.
3. U toj bazi otvori tab **Rules**, obriši šta piše i nalepi ceo sadržaj fajla
   [`firebase-rules.json`](firebase-rules.json) → **Publish**.
4. Levo **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**.
   (Ovo samo znači da svaki telefon dobije anoniman identitet — niko se ne registruje.)
5. Gore levo zupčanik → **Project settings** → skroluj do **Your apps** → klikni ikonicu `</>`
   → nadimak `arena` → **Register app**. Pojaviće ti se objekat `firebaseConfig`.
6. Otvori [`docs/js/firebase-config.js`](docs/js/firebase-config.js) i zameni onaj sa `PASTE_ME`
   svojim. Proveri da `databaseURL` postoji — ako ga nema u kopiranom objektu, uzmi ga sa
   vrha Realtime Database stranice (izgleda kao `https://arena-xxxx-default-rtdb.europe-west1.firebasedatabase.app`).

> Ovi ključevi **nisu tajna** — Firebase ih po dizajnu šalje browseru. Bazu štite pravila iz koraka 3.

## 2. Sajt

Objavljeno je na **https://kostaking11.github.io/arena/** — to je link koji šalješ društvu.
Repo: `KostaKing11/arena`, Pages servira granu `main`, folder `/docs`.

GitHub Pages je automatski HTTPS, što je **obavezno** da bi iPhone uopšte dao lokaciju.

Svaka izmena ide živo za minut-dva:

```bash
git add -A && git commit -m "sta si menjao" && git push
```

### Opciono, ali preporučeno: ograniči API ključ

Repo je javan (Pages na besplatnom nalogu to traži), pa je i Firebase config vidljiv. Ključ
sam po sebi nije tajna, ali pošto je anonimna prijava uključena, ko god ga nađe može da se
prijavi i dira bazu. Da to suziš:

[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
→ izaberi projekat `igre-gladi-irl` → klikni na „Browser key" → **Application restrictions →
Websites** → dodaj `kostaking11.github.io/*` i `localhost:3000/*` → Save.

Posle toga ključ radi samo sa tvog sajta.

---

## 3. Instalacija na telefon

Nije App Store, ali izgleda i ponaša se isto — ikona na početnom ekranu, bez adresne trake.

- **Android / Chrome:** otvori link, pa tapni **⬇ Instaliraj kao aplikaciju** na početnom ekranu.
  Chrome ume i sam da ponudi „Instaliraj aplikaciju" u meniju ⋮.
- **iPhone / Safari:** tapni **Podeli** (kvadratić sa strelicom, dole) → **Dodaj na početni ekran**.
  App ti to sam napiše kad te vidi na iPhone-u. *Mora Safari* — Chrome na iPhone-u to ne ume.

Instalirana verzija radi i kad signal zabaguje: `docs/sw.js` drži kod i biblioteke u kešu,
a uvek prvo pokušava mrežu da ne bi igrao sa starim kodom. Mape i baza se namerno **ne** keširaju.

Ikone se prave iz koda, bez ijedne biblioteke — ako hoćeš druge boje, promeni `BG`/`GOLD`
u `tools/make-icons.js` i pokreni:

```bash
npm run icons
```

> Ako menjaš kod, podigni `VERSION` u `docs/sw.js` da se stari keš obriše kod svih.

## 4. Kako se igra

1. **Domaćin** otvori link → *Napravi arenu* → dobije kod od 5 slova.
2. Ostali otvore isti link → upišu kod → *Uđi*.
3. Domaćin na mapi **tapne centar arene** (tu je kornukopija), podesi prečnik, broj predmeta
   i koliko vremena imate da se rasporedite. Pa *Pokreni igre*.
4. Svako dobije **svoju startnu poziciju** na obodu arene, sa strelicom i metrima do nje.
5. **GONG** → igra počinje.

**U igri:**
- **Mapa** je zamagljena osim oko tebe. Vidiš predmete u krugu od ~150 m. Baklja proširuje vid, noć ga prepolovljuje.
- Na **≤15 m od predmeta** dugme dole postaje aktivno. Da ga uzmeš moraš da položiš mini-izazov
  (tapkanje, precizno zaustavljanje, šifra, mirna ruka). Retkiji predmet = teži izazov.
- Predmeti daju **⚔ napad**, **🛡 odbranu**, **❤ život**, **👁 vid**, ili su potrošni
  (zavoji, adrenalin, zamka, kamuflaža, otrov).
- Na **≤100 m** od igrača vidiš samo blip: smer i grubu udaljenost, bez imena.
- Na **≤15 m** vidiš ko je, i imaš **Napadni** ili **Savez**. Savez traži pristanak, napad ne.
- **Borba** je u telefonu, ali se nađete uživo — app ti kaže koliko je metara do sredine između vas.
  Napad > Varka > Blok > Napad. Predmeti odlučuju koliko boli. Poraženi ispada, pobednik uzima
  **pola njegovog plena** i **nosi rane dalje** (život se ne resetuje).
- **Događaji**: arena se skuplja, obeleži se sektor iz kog moraš da izađeš za 5 minuta, gozba u
  kornukopiji, sponzorski paket, noć.
- Kad **ostanu dvojica** → svi (i eliminisani) idu u centar arene. Kad oba finalista stignu,
  kreće **finale**: 7 rundi, dupla šteta, produžava se dok nema pobednika.

---

## 5. Testiranje bez izlaska napolje

U čekaonici imaš **⚡ Test arena** — mala arena oko tvoje lokacije, 5 botova i **simulacija GPS-a**.
Tapneš po mapi i teleportuješ se (ili hodaš tamo brzinom 1,5 m/s ako u ⋯ → Podešavanja uključiš
*Automatsko hodanje*). Botovi stvarno hodaju, kupe predmete, sklapaju saveze i biju se — možeš
odigrati celu partiju sam.

### Testovi

Za sajt ti `npm install` **ne treba** — GitHub Pages servira gotove fajlove. Treba samo ako
hoćeš da pokrećeš testove ispod.

**Pravila igre** — 30 provera (determinizam sveta, borba, skupljanje arene) plus cela partija
sa 10 botova na virtuelnom satu. Bez browsera, bez Firebase-a, traje sekundu:

```bash
npm test
```

**Firebase sloj** — dva nezavisna klijenta protiv pravog lokalnog Realtime Database emulatora:
ulazak u sobu, trka za isti sanduk, vidljivost na 15 m i 55 m, cela borba runda po runda,
eliminacija i gledanje iz Kapitola. U jednom prozoru:

```bash
npm run emu
```

u drugom:

```bash
npm run test:fb
```

**Lokalni sajt** (pre nego što gurneš na GitHub) — `npm run dev`, pa `http://localhost:3000`.
Ako uz to pustiš i emulator, otvori `http://localhost:3000/?emu=1` da ne diraš pravu bazu.

> Emulatoru treba Java 21+. Ako imaš stariju, pokreni ga sa `npx firebase-tools@13 emulators:start
> --only database,auth --project demo-arena`.

---

## 6. Šta je gde

```
docs/                     ← ovo GitHub Pages servira
  index.html              svi ekrani
  manifest.json           ime, boje i ikone instalirane aplikacije
  sw.js                   service worker: omogucava "Instaliraj" i rad bez signala
  icons/                  PNG ikone (pravi ih tools/make-icons.js)
  css/style.css
  js/engine/rules.js      SVA PRAVILA (borba, plen, događaji) — čista logika, bez mreže
  js/net-firebase.js      Firebase sloj: sve što ne može da se predvidi
  js/bots.js              simulirani igrači (vodi ih domaćinov telefon)
  js/app.js               ekrani i HUD
  js/mapview.js           Leaflet mapa, magla rata, markeri
  js/challenges.js        mini-izazovi za predmete
  js/i18n.js              srpski / engleski
  js/firebase-config.js   ← tvoj config ide ovde
firebase-rules.json       pravila baze (nalepi u Firebase konzolu)
tools/make-icons.js       generator PNG ikona, bez biblioteka
test/simulate.js          30 provera pravila + cela partija sa 10 botova
test/integration.js       40 provera Firebase sloja protiv emulatora
test/verify-live.js       provera da je pravi Firebase projekat ispravno podesen
serve.js                  lokalni statični server
server/                   prva verzija sa Node serverom. Više se ne koristi i ne može da se
                          pokrene (servirala je folder public/ koji je zamenjen sa docs/).
                          Stoji samo za referencu — slobodno obriši ceo folder.
```

### Kako radi bez servera

Sve što je „slučajno" u partiji — raspored plena, startne pozicije, redosled i sadržaj događaja —
izvodi se iz jednog broja, `seed`-a, koji se upiše u bazu na startu. Svi telefoni iz istog seed-a
izračunaju **identičan svet**, pa niko ne mora da im ga šalje. U bazi stoji samo ono što se ne može
predvideti: gde je ko, ko je šta uzeo, i šta se dešava u borbama.

Borbu presuđuje čista funkcija (`resolveRound`) koju oba telefona izvrše nezavisno i dobiju isti
rezultat, a upis je zaštićen transakcijom da runda ne bi bila odigrana dvaput.

## 7. Ograničenja — pročitaj ovo

- **Nema zaštite od varanja.** Bez servera, svaki telefon vidi celu bazu, pa neko ko otvori
  browser konzolu može da vidi gde su svi. Za tebe i društvo je to u redu; ako ikad budeš
  objavljivao igru široj publici, tu ti treba pravi server.
- **Telefon mora da bude budan.** Bez servera, svaki telefon sam računa svoj deo igre. Browseri
  gase tajmere u pozadini (Chrome nakon par minuta na jedan otkucaj u minut), pa ako neko zaključa
  ekran ili izađe iz app-a, njegova pozicija se zamrzne i prestane da mu curi život van arene.
  Zato app traži *wake lock* i drži ekran upaljen dok je partija otvorena — reci društvu da ne
  gase ekran. Borbu to ne kvari: rundu presuđuje bilo koji od dvojice u borbi, pa je dovoljno da
  jedan bude budan.
- GPS u gradu ume da promaši 10–20 m. Zato je domet za borbu 15 m, a ne 5 m.
- Botove vodi domaćinov telefon. Ako domaćin zatvori app, botovi stanu — pravi igrači nastavljaju normalno.
- Besplatni Firebase plan (Spark) je bez kartice: 100 istovremenih veza i 10 GB prenosa mesečno.
  Partija od sat vremena sa 12 ljudi troši oko 20 MB. Nećeš ni prići limitu.
- Sobe starije od 24h se brišu same kad neko napravi novu.

## 8. Bezbednost, ozbiljno

Igrači trče napolju gledajući u telefon. Dogovorite se unapred gde su granice arene (ne preko
prometnih ulica), da se ne ulazi na privatne posede, i da niko ne trči po mraku tamo gde može da
se povredi. Borba je **u telefonu** — ništa se fizički ne dodiruje.
