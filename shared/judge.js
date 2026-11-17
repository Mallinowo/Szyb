// Szyb – ocenianie odpowiedzi (wspólne dla klienta i serwera).
(function (root) {
  const DATA = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.SZYB_DATA;

  const PL = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (c) => PL[c])
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // dokładna pisownia (z polskimi znakami), tylko bez wielkości liter i zbędnych spacji
  function lowerExact(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim(); }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  // Uproszczony „stemmer” polskiej odmiany: ucina typowe końcówki (gęsi→gęś, ogórki→ogórek, jabłka→jabłko).
  const ENDINGS = ['owie', 'ami', 'ach', 'ów', 'om', 'em', 'ie', 'ej', 'ow', 'a', 'e', 'i', 'o', 'u', 'y'];
  function stemWord(w) {
    if (w.length <= 3) return w;
    for (const e of ENDINGS) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length);
    return w;
  }
  function stem(n) { return n.split(' ').map(stemWord).join(' '); }

  // słowa pomocnicze pomijane przy szukaniu słowa kluczowego („jazda na rowerze” → rower)
  const STOP = new Set(['na', 'w', 'we', 'z', 'ze', 'do', 'o', 'od', 'po', 'za', 'i', 'a', 'dla', 'pod', 'nad', 'przy', 'przez', 'bez', 'u', 'the', 'of', 'jazda', 'gra', 'granie']);
  // bezokolicznik → rdzeń (biegać → bieg, pływać → pływ, pasujące do „bieganie”, „pływanie”)
  // Każde słowo daje listę możliwych rdzeni.
  function contentTokens(n) {
    return n.split(' ').filter((w) => w && !STOP.has(w)).map((w) => {
      const f = [stemWord(w)];
      if (w.length >= 6 && /[aeiy]c$/.test(w)) { f.push(w.slice(0, -2)); if (/owac$/.test(w) && w.length >= 8) f.push(w.slice(0, -4)); }
      // narciarstwo → nart(y), łyżwiarstwo → łyżw(y), żeglarstwo → żegl(ować), ogrodnictwo → ogród
      const m = f[0].match(/^(.{3,}?)(iarstw|arstw|nictw)$/);
      if (m) { f.push(m[1]); if (m[1].endsWith('c')) f.push(m[1].slice(0, -1) + 't'); }
      return f;
    });
  }
  // pokrewne formy: ten sam rdzeń albo jedno jest początkiem drugiego z krótką końcówką
  // (bieg→bieganie, oszczep→oszczepnik, rower→rowerek)
  function related(a, b) {
    if (a === b) return a.length >= 3;
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    if (s.length < 4 || !l.startsWith(s)) return false;
    return SUFFIX.has(l.slice(s.length));
  }
  // końcówki słowotwórcze (już po ucięciu odmiany): bieg-an(ie), pomidor-ow(a), rower-ek, młyn-arz
  const SUFFIX = new Set(['an', 'en', 'owan', 'ywan', 'iwan', 'ow', 'ek', 'arz', 'sk', 'ck', 'n']);
  function uniqueEntry(pairs, toks) {
    let found = null;
    for (const [t, e] of pairs) {
      if (!toks.some((fs) => fs.some((x) => related(x, t)))) continue;
      if (found && found !== e) return null;   // pasuje do kilku różnych odpowiedzi – nie zgadujemy
      found = e;
    }
    // każde słowo z wpisu musi należeć do tej odpowiedzi („Kapela ze Wsi Warszawa” ≠ Warszawa)
    if (found && !toks.every((fs) => fs.some((x) => [...found.toks].some((t) => related(x, t))))) return null;
    return found;
  }

  const index = new Map(); // categoryId -> { exact: Map(norm -> entry), list: [ [norm, entry] ] }
  function indexCategory(cat) {
    const exact = new Map();
    const stems = new Map();
    const list = [];
    const singles = [];        // odpowiedzi jednowyrazowe: [rdzeń, wpis]
    const tokEntries = new Map();
    cat.tiers.forEach((answers, tier) => {
      for (const raw of answers) {
        const variants = raw.split('|');
        const entry = { key: normalize(variants[0]), display: variants[0], tier, spell: new Set(variants.map(lowerExact)), toks: new Set() };
        for (const v of variants) {
          const n = normalize(v);
          if (!n || exact.has(n)) continue;
          exact.set(n, entry);
          const st = stem(n);
          if (!stems.has(st)) stems.set(st, entry);
          list.push([n, entry, st]);
          const toks = contentTokens(n);
          if (toks.length === 1) for (const t of toks[0]) singles.push([t, entry]);
          for (const t of toks.flat()) { entry.toks.add(t); if (!tokEntries.has(t)) tokEntries.set(t, new Set()); tokEntries.get(t).add(entry); }
        }
      }
    });
    // słowa kluczowe: rdzenie, które w tej kategorii występują tylko w jednej odpowiedzi (np. „oszczep” → rzut oszczepem)
    const keys = [];
    for (const [t, set] of tokEntries) if (set.size === 1 && t.length >= 4) keys.push([t, [...set][0]]);
    index.set(cat.id, { exact, stems, list, singles, keys });
  }
  DATA.CATEGORIES.forEach(indexCategory);

  // Pytania przyjęte z propozycji graczy (z serwera). Aktywne od dnia `since` do dnia przed `until`.
  function addCategories(list) {
    for (const c of list || []) {
      if (!c || !c.id || !c.q || !Array.isArray(c.tiers) || index.has(c.id)) continue;
      const cat = { id: c.id, q: c.q, tiers: c.tiers.map((t) => (Array.isArray(t) ? t : [])), since: c.since, until: c.until, custom: true };
      DATA.CATEGORIES.push(cat);
      indexCategory(cat);
    }
  }

  // Odpowiedzi dopisane w panelu autora (z listy odrzuconych): { catId: [{ a: 'tekst', tier: 0–5 }] }
  function addAnswers(map) {
    for (const [id, list] of Object.entries(map || {})) {
      const cat = DATA.CATEGORIES.find((c) => c.id === id), idx = index.get(id);
      if (!cat || !idx || !Array.isArray(list)) continue;
      let changed = false;
      for (const x of list) {
        const a = x && String(x.a || '').trim(), t = x && x.tier;
        if (!a || !(t >= 0 && t <= 5) || idx.exact.has(normalize(a))) continue;
        cat.tiers[t].push(a); changed = true;
      }
      if (changed) indexCategory(cat);
    }
  }

  function tolerance(len) { return len >= 9 ? 2 : len >= 5 ? 1 : 0; }

  // Zwraca { ok, key, display, tier, pts } albo { ok:false }
  function judge(categoryId, text) {
    const idx = index.get(categoryId);
    const n = normalize(text);
    if (!idx || !n) return { ok: false };
    // 1) dokładnie (bez polskich znaków i wielkości liter), 2) ta sama forma podstawowa (odmiana),
    // 3) literówki: odległość edycyjna na pełnym słowie albo na rdzeniu
    let entry = idx.exact.get(n) || idx.stems.get(stem(n));
    let fuzzy = false;
    if (!entry) {
      fuzzy = true;
      let best = null, bestD = 99;
      const sn = stem(n);
      const tol = tolerance(n.length), tolS = tolerance(sn.length + 1);
      for (const [cand, e, st] of idx.list) {
        let d = tol > 0 ? lev(n, cand, tol) : 99;
        if (d > tol) d = 99;
        if (tolS > 0) { const ds = lev(sn, st, tolS); if (ds <= tolS && ds < d) d = ds; }
        if (d < bestD) { best = e; bestD = d; }
      }
      entry = best;
    }
    // 4) inna forma tego samego słowa albo samo słowo kluczowe: „bieganie” → bieg, „oszczep” → rzut oszczepem
    //    (tylko gdy jednoznacznie pasuje do jednej odpowiedzi; zawsze z pytaniem „Czy chodziło Ci o…?”)
    if (!entry) {
      const toks = contentTokens(n);
      if (toks.length && toks.length <= 3) entry = uniqueEntry(idx.singles, toks) || (toks.length <= 2 ? uniqueEntry(idx.keys, toks) : null);
    }
    // 5) dłuższa nazwa zaczynająca się od znanej odpowiedzi: „szynka konserwowa” → szynka, „kiełbasa myśliwska z dzika” → kiełbasa
    //    (pierwsze słowo musi być całą jednowyrazową odpowiedzią; liczy się jak ona, z pytaniem „Czy chodziło Ci o…?”)
    if (!entry) {
      const w = n.split(' ');
      if (w.length >= 2 && w.length <= 4 && w[0].length >= 3) {
        const e = idx.exact.get(w[0]);
        if (e && !e.key.includes(' ')) { entry = e; fuzzy = true; }
      }
    }
    if (!entry) return { ok: false };
    // pytamy „Czy chodziło Ci o…?” zawsze, gdy wpis różni się od poprawnej pisowni (brak ogonków, odmiana, literówka)
    if (!entry.spell.has(lowerExact(text))) fuzzy = true;
    const t = DATA.TIERS[entry.tier];
    // fuzzy = poprawiona literówka: klient pyta „Czy chodziło Ci o…?”
    return { ok: true, key: entry.key, display: entry.display, tier: entry.tier, pts: t.pts, fuzzy };
  }

  // Deterministyczny generator (do "Szychty dnia" – każdy dostaje ten sam zestaw)
  function seededRandom(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function pickCategories(n, rand, date) {
    rand = rand || Math.random;
    const ids = DATA.CATEGORIES.filter((c) => !date || ((!c.since || c.since <= date) && (!c.until || date < c.until))).map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ids.slice(0, n);
  }

  function category(id) { return DATA.CATEGORIES.find((c) => c.id === id); }

  // ---------- Szychta dnia: harmonogram bez powtórek (od NEW_START) ----------
  // Kategorie z bazy idą w cyklach: losowa kolejność wszystkich, i dopiero po zużyciu całej puli nowy cykl.
  // Pytania przyjęte z propozycji graczy (custom) grają w swoim dniu `since` i zajmują miejsce z cyklu.
  const NEW_START = '2026-11-08';
  const addDay = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const dayCache = new Map();
  let cacheSig = '';
  function shuffle(arr, seed) {
    const a = arr.slice(), rand = seededRandom(seed);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function customOn(d) {
    return DATA.CATEGORIES.filter((c) => c.custom && c.since === d && (!c.until || d < c.until)).sort((a, b) => (a.id < b.id ? -1 : 1)).map((c) => c.id);
  }
  function dailyCategories(date, n) {
    n = n || 7;
    if (!date || date < NEW_START) return pickCategories(n, seededRandom('szyb-' + date), date);
    const sig = DATA.CATEGORIES.length + '|' + DATA.CATEGORIES.filter((c) => c.custom).map((c) => c.id + c.since + (c.until || '')).join(',');
    if (sig !== cacheSig) { dayCache.clear(); cacheSig = sig; }
    if (dayCache.has(date)) return dayCache.get(date).slice();
    // lastDay: kiedy kategoria ostatnio grała. Nowy cykl bierze najpierw kategorie jeszcze niegrane,
    // a powtórki zaczynają się dopiero, gdy niegranych zabraknie (i wtedy od najdawniej granych).
    let cycle = -1, perm = [], k = 0, out = null;
    const lastDay = new Map();
    let dayNo = 0;
    for (let d = NEW_START; d <= date; d = addDay(d, 1), dayNo++) {
      const ids = customOn(d).slice(0, n);
      let guard = 0;
      while (ids.length < n && guard++ < 1000) {
        if (k >= perm.length) {
          cycle++; k = 0;
          const all = DATA.CATEGORIES.filter((c) => !c.custom && (!c.since || c.since <= d)).map((c) => c.id);
          // najpierw kategorie jeszcze nigdy nie grane; gdy takich brak, starsza połowa (najdawniej grane)
          let pool = all.filter((id) => !lastDay.has(id));
          if (!pool.length) pool = all.slice().sort((x, y) => lastDay.get(x) - lastDay.get(y)).slice(0, Math.max(n * 2, Math.floor(all.length / 2)));
          perm = shuffle(pool, 'szyb-cykl-' + cycle);
        }
        const id = perm[k++];
        if (!ids.includes(id)) { ids.push(id); lastDay.set(id, dayNo); }
      }
      for (const id of ids) lastDay.set(id, dayNo);   // też pytania od graczy
      dayCache.set(d, ids);
      if (d === date) out = ids;
    }
    return out.slice();
  }

  const api = { normalize, judge, seededRandom, pickCategories, dailyCategories, category, addCategories, addAnswers, DATA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SZYB = api;
})(typeof window !== 'undefined' ? window : globalThis);
