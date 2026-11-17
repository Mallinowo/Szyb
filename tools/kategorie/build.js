// Składa scratchpad/cats/b*.txt w shared/cats.js i sprawdza dane
const fs = require('fs'), path = require('path');
const ROOT = require('path').join(__dirname, '..', '..');
const dir = __dirname;  // pliki b*.txt obok tego skryptu
const files = fs.readdirSync(dir).filter((f) => /^b\d+\.txt$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
const cats = [];
const problems = [];
for (const f of files) {
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, ln) => {
    const parts = line.split(' # ');
    if (parts.length !== 3) { problems.push(`${f}:${ln + 1} zły format`); return; }
    const [id, q, body] = parts.map((s) => s.trim());
    const tiers = body.split(' / ').map((t) => t.split(',').map((x) => x.trim()).filter(Boolean));
    if (tiers.length !== 6) problems.push(`${id}: ${tiers.length} pokładów`);
    if (/[^\u0000-ɏ’– ]/.test(body + q)) problems.push(`${id}: dziwne znaki ${[...(body + q)].filter((c) => /[^\u0000-ɏ’– ]/.test(c)).join('')}`);
    // b1–b7 grają od startu harmonogramu; nowsze paczki od 2026-11-09, żeby nie zmienić bieżącego cyklu (dzisiejszych zestawów)
    cats.push({ id, q, tiers, since: Number(f.match(/\d+/)[0]) <= 7 ? '2026-11-08' : '2026-11-09' });
  });
}
// rozszerzenia: pliki x*.txt, linia „id # srebro, … / złoto, …” dopisuje odpowiedzi do istniejącej kategorii
// (powtórki i formy, które sędzia już rozpozna, są pomijane po cichu)
const PLx = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };
const normx = (s) => String(s).toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => PLx[c]).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const ENDx = ['owie', 'ami', 'ach', 'ów', 'om', 'em', 'ie', 'ej', 'ow', 'a', 'e', 'i', 'o', 'u', 'y'];
const stemx = (n) => n.split(' ').map((w) => { if (w.length <= 3) return w; for (const e of ENDx) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length); return w; }).join(' ');
// data.js sam dokleja shared/cats.js (wynik poprzedniego builda) – podmieniamy go na pusty,
// żeby rozszerzenia kategorii bazowych nie znikały co drugi build
{ const cp = require.resolve(ROOT + '/shared/cats.js'); require.cache[cp] = { id: cp, filename: cp, loaded: true, exports: [] }; }
const baseData = require(ROOT + '/shared/data.js');
const baseIds = new Set(baseData.CATEGORIES.filter((c) => !c.since).map((c) => c.id));
const extend = [];   // dla kategorii z data.js
let added = 0, skipped = 0;
const xfiles = fs.readdirSync(dir).filter((f) => /^x\d+\.txt$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
for (const f of xfiles) {
  fs.readFileSync(path.join(dir, f), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, ln) => {
    const parts = line.split(' # ');
    if (parts.length !== 2) { problems.push(`${f}:${ln + 1} zły format`); return; }
    const id = parts[0].trim();
    const add = parts[1].split(' / ').map((t) => t.split(',').map((x) => x.trim()).filter(Boolean));
    if (add.length !== 2) { problems.push(`${f}:${ln + 1} (${id}) ma być „srebro / złoto”`); return; }
    if (/[^\u0000-ɏ’– ]/.test(parts[1])) problems.push(`${id}: dziwne znaki ${[...parts[1]].filter((c) => /[^\u0000-ɏ’– ]/.test(c)).join('')}`);
    let tiers = (cats.find((c) => c.id === id) || {}).tiers;
    let ext = null;
    if (!tiers && baseIds.has(id)) { ext = extend.find((e) => e.extend === id) || (extend.push({ extend: id, add: [[], [], [], [], [], []] }), extend[extend.length - 1]); tiers = baseData.CATEGORIES.find((c) => c.id === id).tiers.map((t, i) => t.concat(ext.add[i])); }
    if (!tiers) { problems.push(`${f}: nie ma kategorii ${id}`); return; }
    const have = new Set(), haveSt = new Set();
    for (const t of tiers) for (const raw of t) for (const v of raw.split('|')) { have.add(normx(v)); haveSt.add(stemx(normx(v))); }
    add.forEach((list, k) => {
      const ok = [];
      for (const raw of list) {
        const vs = raw.split('|');
        if (vs.some((v) => have.has(normx(v)) || haveSt.has(stemx(normx(v))))) { skipped++; continue; }
        vs.forEach((v) => { have.add(normx(v)); haveSt.add(stemx(normx(v))); });
        ok.push(raw); added++;
      }
      // część „popularna” (wypisana od najbardziej oczywistych) rozkłada się na węgiel / miedź / srebro,
      // żeby znane odpowiedzi nie dawały punktów jak rzadkie; część „rzadka” idzie do złota
      const dst = ext ? ext.add : tiers;
      ok.forEach((raw, i) => {
        const r = i / ok.length;
        dst[3 + k].push(raw); // ostateczny podział na pokłady robi shared/data.js (rebalance)
      });
    });
  });
}

// walidacja przez prawdziwy judge
const base = baseData;
const ids = new Set(base.CATEGORIES.filter((c) => !c.since).map((c) => c.id));
const PL = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };
const norm = (s) => String(s).toLowerCase().replace(/[ąćęłńóśźż]/g, (c) => PL[c]).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
let total = 0;
for (const c of cats) {
  if (ids.has(c.id)) problems.push(`${c.id}: powtórzone id`); ids.add(c.id);
  const seen = new Map();
  let n = 0;
  c.tiers.forEach((t, ti) => t.forEach((raw) => {
    n++;
    for (const v of raw.split('|')) {
      const k = norm(v);
      if (!k) problems.push(`${c.id}: pusta odpowiedź`);
      if (seen.has(k) && seen.get(k) !== raw) problems.push(`${c.id}: duplikat "${v}" (pokład ${ti})`);
      seen.set(k, raw);
    }
  }));
  if (n < 30) problems.push(`${c.id}: tylko ${n} odpowiedzi`);
  if (c.tiers.slice(0, 5).some((t) => t.length < 3)) problems.push(`${c.id}: pokład z <3 odpowiedziami`);
  // Diament to tylko 1–3 najmniej oczywiste odpowiedzi
  if (c.tiers[5].length < 1 || c.tiers[5].length > 3) problems.push(`${c.id}: ${c.tiers[5].length} diamentów (ma być 1–3)`);
  total += n;
}
const out = `// Szyb – dodatkowa baza kategorii (${cats.length}). Generowane ze scratchpadu; format jak w data.js.
(function (root) {
  const CATS = ${JSON.stringify(cats.map(({ id, q, tiers, since }) => ({ id, q, since, tiers })).concat(extend))};
  if (typeof module !== 'undefined' && module.exports) module.exports = CATS;
  else root.SZYB_CATS = CATS;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(ROOT + '/shared/cats.js', out);
console.log('kategorii', cats.length, 'odpowiedzi', total, 'bajtów', out.length, '| dopisane', added, 'pominięte powtórki', skipped);
console.log(problems.length ? 'PROBLEMY:\n' + problems.join('\n') : 'bez problemów');
