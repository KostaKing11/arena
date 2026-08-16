/* Podizanje verzije na jednom mestu.

   Bez ovoga je objava bila lutrija: GitHub Pages šalje `max-age=600`, pa je
   telefon posle objave umeo da ostane na starom kodu i po deset minuta — a
   videli smo i da dva ponovna pokretanja zaredom ne pomognu. U igri gde svi
   telefoni izvode isti svet iz istih pravila to nije kozmetika.

   Rešenje je da se ADRESE fajlova menjaju sa verzijom: `js/app.js?v=0.13.3`
   je za keš nov fajl, pa nema šta da se posluži staro. Ovaj alat upisuje novu
   verziju u kit.js, sw.js i version.json, i prepisuje sve lokalne adrese u
   index.html.

   Upotreba:  node tools/bump.js 0.13.3          */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || '')) {
  console.error('upotreba: node tools/bump.js X.Y.Z');
  process.exit(1);
}

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

/* — kit.js: APP_VERSION — */
const kitP = 'docs/js/ui/kit.js';
let kit = read(kitP);
const old = (kit.match(/const APP_VERSION = '([^']+)'/) || [])[1];
kit = kit.replace(/const APP_VERSION = '[^']+'/, `const APP_VERSION = '${v}'`);
write(kitP, kit);

/* — sw.js: keš se imenuje po verziji, pa se stari sam briše na aktivaciji — */
const swP = 'docs/sw.js';
let sw = read(swP);
sw = sw.replace(/const VERSION = 'arena-[^']+'/, `const VERSION = 'arena-${v}'`);
write(swP, sw);

/* — version.json: aplikacija ovo pita da bi znala da se osveži — */
write('docs/version.json', JSON.stringify({ v }) + '\n');

/* — index.html: sve lokalne adrese dobijaju ?v=VERZIJA — */
const idxP = 'docs/index.html';
let idx = read(idxP);
let n = 0;
idx = idx.replace(/(src|href)="((?:js|css)\/[^"?]+)(\?v=[^"]*)?"/g, (_, attr, file) => {
  n++;
  return `${attr}="${file}?v=${v}"`;
});
write(idxP, idx);

console.log(`${old || '?'} -> ${v}  (${n} adresa u index.html)`);
