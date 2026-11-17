const S = require('../../shared/judge.js');
const ENDINGS = ['owie', 'ami', 'ach', 'ów', 'om', 'em', 'ie', 'ej', 'ow', 'a', 'e', 'i', 'o', 'u', 'y'];
const sw = (w) => { if (w.length <= 3) return w; for (const e of ENDINGS) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length); return w; };
const st = (n) => n.split(' ').map(sw).join(' ');
let n = 0;
for (const c of S.DATA.CATEGORIES) {
  const m = new Map();
  c.tiers.forEach((t, ti) => t.forEach((raw) => { for (const v of raw.split('|')) { const k = st(S.normalize(v)); const prev = m.get(k); if (prev && prev.raw !== raw) { n++; console.log(`${c.id}: "${v}" i "${prev.v}" mają ten sam rdzeń`); } else if (!prev) m.set(k, { raw, v }); } }));
}
console.log('kolizji rdzeni', n);
