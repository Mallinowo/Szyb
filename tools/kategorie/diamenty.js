// Jednorazowo przestawia pokład Diament: zostają tylko odpowiedzi z diamenty.txt, reszta idzie na koniec Złota.
// Zmienia pliki b*.txt i kategorie wpisane w shared/data.js. Uruchom: node tools/kategorie/diamenty.js
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const picks = {};
for (const line of fs.readFileSync(path.join(DIR, 'diamenty.txt'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [id, rest] = line.split(/:\s(.+)/);
  picks[id.trim()] = rest.split('|').map((x) => x.trim());
}
const first = (a) => a.split('|')[0].trim();
const done = new Set(), problems = [];
function split(id, t4, t5) {
  const want = picks[id];
  if (!want) { problems.push(`${id}: brak w diamenty.txt`); return null; }
  for (const w of want) if (!t5.some((a) => first(a) === w)) problems.push(`${id}: „${w}” nie ma w pokładzie Diament`);
  done.add(id);
  return { t4: [...t4, ...t5.filter((a) => !want.includes(first(a)))], t5: want.map((w) => t5.find((a) => first(a) === w)).filter(Boolean) };
}

// pliki b*.txt
for (const f of fs.readdirSync(DIR).filter((x) => /^b\d+\.txt$/.test(x)).sort()) {
  const out = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').map((line) => {
    if (!line.trim()) return line;
    const [id, q, body] = line.split(' # ');
    const tiers = body.split(' / ').map((t) => t.split(',').map((x) => x.trim()).filter(Boolean));
    if (tiers[5].length <= 3 && !picks[id.trim()]) return line;
    const r = split(id.trim(), tiers[4], tiers[5]);
    if (!r) return line;
    tiers[4] = r.t4; tiers[5] = r.t5;
    return `${id} # ${q} # ${tiers.map((t) => t.join(', ')).join(' / ')}`;
  });
  fs.writeFileSync(path.join(DIR, f), out.join('\n'));
}

// shared/data.js: kategorie zapisane jako 6 linii z tablicami
const dataFile = path.join(DIR, '..', '..', 'shared', 'data.js');
let src = fs.readFileSync(dataFile, 'utf8');
src = src.replace(/\{ id: '([^']+)', q: '((?:[^'\\]|\\.)*)', tiers: \[\n((?:\s*\[.*\],\n){6})(\s*)\]\}/g, (m, id, q, body, ind) => {
  const lines = body.split('\n').filter((l) => l.trim());
  const arr = lines.map((l) => JSON.parse(l.trim().replace(/,$/, '').replace(/'/g, '"')));
  const r = split(id, arr[4], arr[5]);
  if (!r) return m;
  arr[4] = r.t4; arr[5] = r.t5;
  const pad = lines[0].match(/^\s*/)[0];
  const fmt = (a) => pad + '[' + a.map((x) => `'${x.replace(/'/g, "\\'")}'`).join(', ') + '],';
  return `{ id: '${id}', q: '${q}', tiers: [\n${arr.map(fmt).join('\n')}\n${ind}]}`;
});
fs.writeFileSync(dataFile, src);

for (const id of Object.keys(picks)) if (!done.has(id)) problems.push(`${id}: nie znaleziono kategorii`);
console.log(problems.length ? problems.join('\n') : `gotowe, kategorii: ${done.size}`);
