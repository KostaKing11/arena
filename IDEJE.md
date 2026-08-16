# ARENA — ideje za dalje

Ništa odavde nije obećano ni započeto. Poređano po tome **koliko donosi u odnosu na to koliko
košta**, ne po tome koliko je zanimljivo da se piše.

Merilo za sve: *da li ovo tera ljude da se kreću, sreću i donose odluke na ulici* — ili je
samo još jedan ekran u telefonu.

---

## A. Prvo posle prve prave igre

Ovo su stvari koje se **ne mogu odlučiti za stolom** — treba odigrati dve-tri partije napolju
pa videti šta zaista smeta.

**1. Balans dometa i cooldowna.**
Brojevi u `WEAPONS` su pogađani, ne mereni. Posle igre se zna: da li luk od 40 m pravi
kampere, da li nož od 5 m iko ikad iskoristi, da li je 45 s hlađenja luka predugo da bi se
isplatio. Sve stoji na jednom mestu (`rules.js`), pa je izmena jedna linija i `npm test`.

**2. Veličina arene po broju igrača.**
`RECOMMENDED` je tabela iz glave. Kad se odigra sa 5 i sa 12 ljudi, videće se da li 350 m za
šestoro znači „stalno se sudarate" ili „nikad se ne nađete".

**3. Da li zona uopšte ubija prave ljude.**
Botovi ginu od zone jer ne beže pametno. Ljudi beže. Možda je šteta premala i zona je samo
tempo, a ne pretnja — to se vidi tek napolju.

---

## B. Sitno, a mnogo vredi

**4. Onboarding koji stvarno uči igru.**
Trenutno prvi put igraš tako što ti neko objasni uživo. Nedostaje 60 sekundi koje kažu: ovo je
zona, ovako se napada, ovo je tvoja klasa, ovo se dešava kad pogineš. Ne tutorijal sa
strelicama — jedan ekran po stvari, preskočiv.

**5. Zvuk kao informacija, ne ukras.**
Sada postoji top, gong, pokupljen predmet i rajsferšlus ranca. Fali ono što se **čuje dok je
telefon u džepu**: zona koja se skuplja, neko te nišani, paket je pao. To je jedina stvar koja
igraču dozvoljava da ne bulji u ekran dok hoda — a to je i cela poenta igre na ulici.

**6. Vibracija po značenju.**
Isto: kratko-kratko = predmet blizu, dugo = zona, tri puta = neko te gađa. Već postoji
`Haptics`, treba mu rečnik.

**7. Objave koje se pamte.**
Sada su tačne, ali suve. „Ime — nema ga više" može da bude „Top je odjeknuo dvaput" kad dvoje
padnu u minutu. Ovo je čist tekst, bez ijedne nove mehanike.

**8. Ekran kraja kao priča.**
Postoji vremenska linija i priznanja. Fali jedna rečenica koja sažme partiju: „Trajalo je 34
minuta, poginulo je petoro, zonu je preživeo samo pobednik." To je ono što se šalje u grupu.

---

## C. Mehanike koje bi promenile igru

**9. Distrikti (timovi) kao pravi režim.**
Savezi postoje, ali su ad-hoc. Pravi timski režim — 2–4 distrikta, zajednička kasa, zajednički
mentor — potpuno menja kako se ide kroz grad. Najveća stavka na spisku, i najskuplja.

**10. Kornukopija kao događaj, ne kao mesto.**
Sada je krug sa predmetima na startu. Mogla bi da bude trenutak: svi startuju na 40 m, prvih
60 s je otvorena, ko uđe rizikuje. To je scena iz filma koju igra trenutno nema.

**11. Zamke koje se vide tek kad zakasniš.**
Zamke rade, ali ih malo ko koristi jer se ne zna gde je iko. Uz distrikte i uz „traker" bi
postale oružje kontrole terena.

**12. Duhovi kao ekipa, ne kao pojedinci.**
Čet postoji, glasanje postoji. Sledeći korak: duhovi biraju **jednog tributa kome navijaju** i
dobijaju bonus ako on pobedi — pa imaju razlog da ne guraju haos nasumično.

**13. Sponzori odvojeni od mentora.**
Sada je mentor i sponzor u jednom. Moglo bi: mentor je jedan i stalan, sponzori su bilo ko sa
linka i mogu samo da doniraju u zajedničku kasu tributa. Publika bez moći da kvari igru.

---

## D. Tehnički dug — ne vidi se, ali usporava sve

**14. `screens.js` je ~2500 linija.**
Svi ekrani u jednom fajlu. Deljenje po ekranima (igra / duhovi / mentor / lobi) bi svaku
sledeću izmenu učinilo dvaput bržom. Nema rizika, samo posao.

**15. Testovi ne dodiruju UI.**
296 provera pokrivaju pravila, nijedna ne pokriva ekrane. Nekoliko provera koje samo pozovu
`renderGame` sa lažnim `d` i provere da ne puca bi uhvatile pola grešaka koje sam našao gledanjem
snimaka ekrana.

**16. Firebase pravila.**
Baza je otvorena. Za igru sa prijateljima je u redu; čim se link podeli šire, neko može da piše
tuđe čvorove. Nije hitno, ali je jednom potrebno.

**17. Ponašanje bez signala.**
Servisni radnik služi aplikaciju, ali partija bez mreže staje. Minimum: jasna poruka „nema
veze, ovo što vidiš je od pre X" umesto tihe zamrznute slike.

---

## E. Ideje koje zvuče dobro a verovatno nisu

Zapisano da se ne bi ponovo predlagale.

- **Glasovni čet u igri.** Ubija tenziju i pretvara igru u Discord poziv sa hodanjem.
- **Fotografije kao dokaz u feed-u svima.** Već postoje u gledanju duhova; svima bi bilo
  otkrivanje pozicija na mala vrata.
- **Više arena istovremeno / matchmaking.** Igra je za ekipu koja se dogovori, ne za javni
  lobi. Kod sobe je dovoljan.
- **XP, nivoi, otključavanja.** Svaka partija mora da počne ravnopravno, inače klase gube
  smisao.
- **Automatsko prepoznavanje lica kao meta.** Sadašnji detektor osobe je taman: dovoljan da
  spreči slikanje zida, a ne pravi bazu lica.
