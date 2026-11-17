// Szyb – serwer gry. Zero zależności: `node server.js`, potem http://localhost:3000
// Serwuje grę, logowanie przez Google (opcjonalne, zmienna GOOGLE_CLIENT_ID) i ranking szychty dnia.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SZYB = require('./shared/judge.js');

const PORT = process.env.PORT || 3000;

// ---------- konta (logowanie Google) ----------
// Client ID z Google Cloud (publiczny, nie jest tajny). Można nadpisać zmienną GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '796184596073-ub1ljm1g0s5ng74jnuumpal8cmjvnhli.apps.googleusercontent.com';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data'); // na hostingu: katalog na trwałym dysku (volume)
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = { users: {}, sessions: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
for (const u of Object.values(db.users || {})) delete u.email;   // adresu e-mail nie przechowujemy (RODO: minimalizacja danych)
if (db.categories) SZYB.addCategories(Object.values(db.categories));
if (db.added) SZYB.addAnswers(db.added);
// Odrzucone odpowiedzi graczy (do panelu autora: „Brakujące odpowiedzi”). who = adres/urządzenie, liczone raz na dobę.
function recordMiss(cat, text, who) {
  const t = clean(text, 40), k = SZYB.normalize(t);
  if (k.length < 2 || !SZYB.category(cat) || SZYB.judge(cat, t).ok) return;
  if (((db.missIgnored || {})[cat] || {})[k]) return;
  if (!limit('miss1', who + '|' + cat + '|' + k, 1, 24 * 3600e3, 1)) return;
  db.misses = db.misses || {};
  const m = db.misses[cat] || (db.misses[cat] = {});
  const e = m[k] || (m[k] = { t, n: 0 });
  e.n++; e.last = Date.now();
  const keys = Object.keys(m);
  if (keys.length > 400) keys.sort((a, b) => m[a].n - m[b].n || m[a].last - m[b].last).slice(0, keys.length - 400).forEach((x) => delete m[x]);
  saveDb();
}
let saveT = null;
function saveDb() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
    fs.renameSync(DB_FILE + '.tmp', DB_FILE);
  }, 300);
}
// Klucz do panelu autora (/admin.html): zmienna ADMIN_KEY albo wygenerowany przy pierwszym starcie (data/admin-key.txt)
const KEY_FILE = path.join(DATA_DIR, 'admin-key.txt');
let ADMIN_KEY = process.env.ADMIN_KEY || '';
if (!ADMIN_KEY) {
  try { ADMIN_KEY = fs.readFileSync(KEY_FILE, 'utf8').trim(); } catch {}
  if (!ADMIN_KEY) {
    ADMIN_KEY = crypto.randomBytes(12).toString('hex');
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    fs.writeFileSync(KEY_FILE, ADMIN_KEY + '\n');
  }
}
const sha = (x) => crypto.createHash('sha256').update(String(x)).digest();
const ADMIN_HASH = sha(ADMIN_KEY);
// Tajny adres panelu autora: zmienna ADMIN_PATH (np. kopalnia-x7k2) albo wygenerowany i zapisany w DATA_DIR/admin-path.txt.
// Pod /admin.html jest zwykłe „Nie znaleziono”.
const PATH_FILE = path.join(DATA_DIR, 'admin-path.txt');
let ADMIN_PATH = String(process.env.ADMIN_PATH || '').replace(/[^a-zA-Z0-9_-]/g, '');
if (!ADMIN_PATH) {
  try { ADMIN_PATH = fs.readFileSync(PATH_FILE, 'utf8').trim(); } catch {}
  if (!ADMIN_PATH) { ADMIN_PATH = 'panel-' + crypto.randomBytes(6).toString('hex'); fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(PATH_FILE, ADMIN_PATH + '\n'); }
}
function serveAdmin(res, file) {
  fs.readFile(path.join(__dirname, 'public', file), 'utf8', (err, txt) => {
    if (err) { res.writeHead(404); return res.end('Nie znaleziono'); }
    if (file === 'admin.html') txt = stampHtml(txt).replace(/src="shared\//g, 'src="/shared/').replace(/src="admin\.js\?v=/, `src="/${ADMIN_PATH}/admin.js?v=`);
    res.writeHead(200, { ...SEC, 'Content-Type': MIME[path.extname(file)], 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    res.end(txt);
  });
}
const isAdmin = (req) => {
  const ip = clientIp(req);
  if (!limit('adminfail', ip, 0, 15 * 60e3, 10)) return false;          // po 10 złych próbach blokada na 15 min
  const ok = crypto.timingSafeEqual(sha(req.headers['x-admin-key'] || ''), ADMIN_HASH);
  if (!ok) limit('adminfail', ip, 1, 15 * 60e3, 10);
  return ok;
};

// ---------- ograniczenia liczby żądań (na adres IP, w pamięci) ----------
const buckets = new Map();
function clientIp(req) {
  const cf = String(req.headers['cf-connecting-ip'] || '').trim();   // za Cloudflare prawdziwy adres gracza jest tutaj
  if (cf) return cf;
  const xf = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim();   // Railway dopisuje prawdziwy adres na końcu (początek może podrobić gracz)
  return xf || req.socket.remoteAddress || '?';
}
// zwraca false, gdy limit przekroczony; add = ile doliczyć
function limit(name, ip, add, windowMs, max) {
  const k = name + '|' + ip, now = Date.now();
  let b = buckets.get(k);
  if (!b || now - b.t > windowMs) { b = { t: now, n: 0 }; buckets.set(k, b); }
  if (b.n + Math.max(add, 1) > max) return false;
  b.n += add; return true;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.t > 24 * 3600e3) buckets.delete(k); }, 3600e3).unref();

// Wynik liczy serwer z kluczy odpowiedzi (klient nie może podać sobie dowolnych punktów)
function scoreFromKeys(date, keys) {
  const cats = SZYB.dailyCategories(date, 7);
  const tiles = [], clean = [];
  let score = 0;
  cats.forEach((id, i) => {
    const k = typeof keys[i] === 'string' ? keys[i].slice(0, 60) : null;
    const r = k ? SZYB.judge(id, k) : { ok: false };
    if (r.ok && r.key === k) { score += r.pts; tiles.push(r.tier); clean.push(k); } else { tiles.push(null); clean.push(null); }
  });
  return { score, tiles, keys: clean };
}
// dzisiejsza data (z zapasem 1 dnia na strefy czasowe graczy)
function dateOk(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(), y = new Date(d - 864e5), t = new Date(+d + 864e5);
  return [dayStr(y), dayStr(d), dayStr(t)].includes(date);
}
const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return dayStr(d); };
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);

function publicUser(u) { return { id: u.sub, name: u.name, picture: u.picture, best: u.best || 0, games: u.games || 0, daily: u.daily || {} }; }

// Weryfikacja tokenu ID przez Google (tokeninfo sprawdza podpis i ważność)
function verifyGoogleToken(idToken) {
  return new Promise((resolve, reject) => {
    https.get('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), (res) => {
      let b = ''; res.on('data', (c) => (b += c));
      res.on('end', () => {
        try {
          const t = JSON.parse(b);
          if (res.statusCode !== 200) return reject(new Error('Nieprawidłowy token'));
          if (t.aud !== GOOGLE_CLIENT_ID) return reject(new Error('Token dla innej aplikacji'));
          if (!['accounts.google.com', 'https://accounts.google.com'].includes(t.iss)) return reject(new Error('Zły wystawca'));
          if (Number(t.exp) * 1000 < Date.now()) return reject(new Error('Token wygasł'));
          resolve(t);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}
function userFromReq(req) {
  const m = /^Bearer (\w+)$/.exec(req.headers.authorization || '');
  const sess = m && db.sessions[m[1]];
  return sess ? db.users[sess.sub] : null;
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.woff2': 'font/woff2' };

// nagłówki bezpieczeństwa (bez osadzania w ramkach na obcych stronach, bez zgadywania typów plików)
const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};
function sendJson(res, code, obj) {
  res.writeHead(code, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req, max = 65536) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > max) { req.destroy(); resolve({}); } });
    req.on('error', () => resolve({}));
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

// wersja plików (skrót zawartości public/ i shared/): dopisywana jako ?v=… do css/js w HTML,
// żeby po deployu przeglądarki i Cloudflare od razu brały nowe pliki zamiast starych z pamięci podręcznej
const ASSET_V = (() => {
  const h = crypto.createHash('sha1');
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const fp = path.join(d, f.name); if (f.isDirectory()) walk(fp); else h.update(f.name).update(fs.readFileSync(fp)); } };
  try { walk(path.join(__dirname, 'public')); walk(path.join(__dirname, 'shared')); } catch {}
  return h.digest('hex').slice(0, 10);
})();
const stampHtml = (txt) => String(txt).replace(/((?:src|href)=")((?!https?:|data:|\/\/)[^"?#]+\.(?:css|js))"/g, `$1$2?v=${ASSET_V}"`);
const HTML_HEAD = { 'Cache-Control': 'no-cache' };
function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  let base = path.join(__dirname, 'public');
  if (rel.startsWith('/shared/')) { base = path.join(__dirname, 'shared'); rel = rel.slice(7); }
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Nie znaleziono'); }
    const ext = path.extname(file);
    if (ext === '.html') { res.writeHead(200, { ...SEC, ...HTML_HEAD, 'Content-Type': MIME[ext] }); return res.end(stampHtml(buf)); }
    const versioned = /[?&]v=/.test(req.url);
    res.writeHead(200, { ...SEC, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': versioned || ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'public, max-age=300' });
    res.end(buf);
  });
}

// tryb wieloosobowy „Dynamit” (/multi, /api/m/*)
const MULTI = require('./multi.js')({ recordMiss, stampHtml, SZYB, db, saveDb, sendJson, readBody, clientIp, limit, userFromReq, SEC, publicDir: path.join(__dirname, 'public') });

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error('Błąd:', e); try { sendJson(res, 500, { error: 'Błąd serwera' }); } catch {} });
});
async function handle(req, res) {
  // CANONICAL_HOST=szyb.app: stary adres (np. *.up.railway.app) przekierowuje na właściwą domenę
  const CH = process.env.CANONICAL_HOST;
  if (CH && req.headers.host && req.headers.host !== CH && !req.url.startsWith('/api/health')) {
    res.writeHead(301, { Location: 'https://' + CH + req.url }); return res.end();
  }
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/api/health') return sendJson(res, 200, { ok: true });
  if ((req.method === 'GET' || req.method === 'HEAD') && (p === '/prywatnosc' || p === '/regulamin')) return serveStatic(req, res, p + '.html');
  if (await MULTI.handle(req, res, url)) return;
  if (p === '/api/config') return sendJson(res, 200, { googleClientId: GOOGLE_CLIENT_ID || null });
  if (p === '/api/me') {
    const u = userFromReq(req);
    return u ? sendJson(res, 200, { user: publicUser(u) }) : sendJson(res, 401, { error: 'Niezalogowany' });
  }
  if (p === '/api/dist') {
    // Rozkład wyników wszystkich graczy (też gości) dla danej szychty: kubełki co 50 pkt
    const date = url.searchParams.get('date') || '';
    const scores = Object.values((db.plays || {})[date] || {}).map((x) => x.score);
    const buckets = new Array(15).fill(0);
    for (const sc of scores) buckets[Math.min(14, Math.floor(sc / 50))]++;
    const tiers = new Array(7).fill(0);   // 0-5 pokłady, 6 = brak odpowiedzi
    for (const x of Object.values((db.plays || {})[date] || {})) for (const t of x.tiles || []) tiers[t == null ? 6 : t]++;
    // ilu graczy wybrało daną odpowiedź w każdej kategorii (do „N innych graczy wybrało to samo”)
    const picks = Array.from({ length: 7 }, () => ({}));
    for (const x of Object.values((db.plays || {})[date] || {})) (x.keys || []).forEach((k, i) => { if (k && picks[i]) picks[i][k] = (picks[i][k] || 0) + 1; });
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return sendJson(res, 200, { count: scores.length, avg, buckets, tiers, picks, scores: scores.sort((a, b) => a - b) });
  }
  if (p === '/api/categories') {
    // pytania przyjęte z propozycji graczy – klient dokłada je do puli (aktywne od `since`)
    return sendJson(res, 200, { categories: Object.values(db.categories || {}).sort((a, b) => (a.since + a.id < b.since + b.id ? -1 : 1)), added: db.added || {} });
  }
  if (p === '/api/admin/misses') {
    if (!isAdmin(req)) return sendJson(res, 403, { error: 'Zły klucz' });
    const out = [];
    for (const [cat, m] of Object.entries(db.misses || {})) {
      const c = SZYB.category(cat); if (!c) continue;
      for (const [key, e] of Object.entries(m)) out.push({ cat, q: c.q, key, t: e.t, n: e.n, last: e.last });
    }
    out.sort((a, b) => b.n - a.n || b.last - a.last);
    return sendJson(res, 200, { misses: out.slice(0, 400), total: out.length });
  }
  if (p === '/api/admin/suggestions') {
    if (!isAdmin(req)) return sendJson(res, 403, { error: 'Zły klucz' });
    const list = Object.values(db.suggestions || {}).sort((a, b) => b.created - a.created);
    return sendJson(res, 200, { suggestions: list, categories: Object.values(db.categories || {}) });
  }
  if (p === '/api/leaderboard') {
    const date = url.searchParams.get('date');
    const rows = Object.values(db.users)
      .map((u) => ({ name: u.name, picture: u.picture, score: date ? (u.daily || {})[date] : u.best }))
      .filter((r) => r.score != null).sort((a, b) => b.score - a.score).slice(0, 20);
    return sendJson(res, 200, { rows });
  }

  // ---------- zgłoszenia błędów (opis + opcjonalny zrzut ekranu) → panel autora ----------
  if (req.method === 'POST' && p === '/api/report') {
    const ip = clientIp(req);
    if (!limit('report', ip, 1, 3600e3, 8)) return sendJson(res, 429, { error: 'Za dużo zgłoszeń. Spróbuj za godzinę.' });
    const body = await readBody(req, 4 * 1024 * 1024);
    const text = String(body.text || '').replace(/[\u0000-\u0008\u000b-\u001f<>]+/g, ' ').trim().slice(0, 1500);
    const dev = String(body.device || '');
    if (text.length < 3 && !body.image) return sendJson(res, 400, { error: 'Opisz, co się stało.' });
    db.reports = db.reports || {};
    if (Object.keys(db.reports).length >= 1000) return sendJson(res, 503, { error: 'Skrzynka zgłoszeń jest pełna, napisz na kontakt@szyb.app.' });
    let img = null, buf = null;
    if (body.image) {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image));
      if (!m) return sendJson(res, 400, { error: 'Zrzut ekranu musi być obrazkiem (JPG, PNG albo WebP).' });
      buf = Buffer.from(m[2], 'base64');
      // sprawdzamy prawdziwy format pliku, a nie tylko to, co deklaruje przeglądarka
      const magic = { jpeg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46] }[m[1]];
      if (buf.length > 2.5 * 1024 * 1024 || buf.length < 100 || !magic.every((b, i) => buf[i] === b) || (m[1] === 'webp' && buf.toString('ascii', 8, 12) !== 'WEBP')) return sendJson(res, 400, { error: 'Nie udało się odczytać zrzutu ekranu.' });
      img = m[1] === 'jpeg' ? 'jpg' : m[1];
    }
    const id = crypto.randomBytes(6).toString('hex');
    if (buf) { const dir = path.join(DATA_DIR, 'reports'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, id + '.' + img), buf); }
    const u = userFromReq(req);
    db.reports[id] = { id, text, page: String(body.page || '').slice(0, 200), ua: String(req.headers['user-agent'] || '').slice(0, 200),
      by: u ? u.name : null, sub: u ? u.sub : null, device: /^[a-z0-9]{8,40}$/.test(dev) ? dev : null, img, created: Date.now(), status: 'new' };
    saveDb();
    return sendJson(res, 200, { ok: true });
  }
  if (p === '/api/admin/report-img' && req.method === 'GET') {
    if (!isAdmin(req)) return sendJson(res, 403, { error: 'Zły klucz' });
    const r = (db.reports || {})[String(url.searchParams.get('id') || '')];
    if (!r || !r.img) return sendJson(res, 404, { error: 'Brak zrzutu' });
    fs.readFile(path.join(DATA_DIR, 'reports', r.id + '.' + r.img), (err, buf) => {
      if (err) return sendJson(res, 404, { error: 'Brak zrzutu' });
      res.writeHead(200, { ...SEC, 'Content-Type': { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[r.img], 'Cache-Control': 'private, no-store' });
      res.end(buf);
    });
    return;
  }
  if (p === '/api/admin/reports' && req.method === 'GET') {
    if (!isAdmin(req)) return sendJson(res, 403, { error: 'Zły klucz' });
    return sendJson(res, 200, { reports: Object.values(db.reports || {}).sort((a, b) => b.created - a.created).map(({ sub, device, ...r }) => r) });
  }

  if (req.method === 'POST' && p.startsWith('/api/')) {
    const body = await readBody(req);
    if (p === '/api/submit') {
      // Wynik szychty z dowolnego urządzenia (bez logowania) – do wykresu wszystkich graczy
      const date = String(body.date || ''), dev = String(body.device || '');
      if (!dateOk(date) || !/^[a-z0-9]{8,40}$/.test(dev)) return sendJson(res, 400, { error: 'Złe dane' });
      if (!limit('submit', clientIp(req), 1, 24 * 3600e3, 40)) return sendJson(res, 429, { error: 'Za dużo wyników z tego adresu.' });
      const { score, tiles, keys } = scoreFromKeys(date, Array.isArray(body.keys) ? body.keys : []);
      db.plays = db.plays || {};
      const day = db.plays[date] || (db.plays[date] = {});
      if (!day[dev]) { day[dev] = { score, tiles, keys }; saveDb(); }   // liczy się pierwsza próba z urządzenia
      return sendJson(res, 200, { ok: true });
    }
    if (p === '/api/miss') {
      // odpowiedź, której gra nie zna – trafia do panelu autora
      if (!limit('missreq', clientIp(req), 1, 3600e3, 300)) return sendJson(res, 429, { error: 'Za dużo' });
      recordMiss(String(body.cat || '').slice(0, 80), body.text, clientIp(req));
      return sendJson(res, 200, { ok: true });
    }
    if (p === '/api/suggest') {
      // propozycja pytania od gracza – trafia do panelu autora
      const text = clean(body.text, 140), answers = clean(body.answers, 300), dev = String(body.device || '');
      if (text.length < 5) return sendJson(res, 400, { error: 'Pytanie jest za krótkie.' });
      if (!/^[a-z0-9]{8,40}$/.test(dev)) return sendJson(res, 400, { error: 'Złe dane' });
      db.suggestions = db.suggestions || {};
      const today = dayStr(new Date());
      const mine = Object.values(db.suggestions).filter((x) => x.device === dev && x.day === today).length;
      if (mine >= 5 || !limit('suggest', clientIp(req), 1, 24 * 3600e3, 10)) return sendJson(res, 429, { error: 'Dziś wysłałeś już 5 propozycji. Wróć jutro.' });
      if (Object.keys(db.suggestions).length >= 5000) return sendJson(res, 503, { error: 'Skrzynka propozycji jest pełna, spróbuj później.' });
      const u = userFromReq(req);
      const id = crypto.randomBytes(5).toString('hex');
      db.suggestions[id] = { id, text, answers, by: u ? u.name : null, device: dev, day: today, created: Date.now(), status: 'new' };
      saveDb();
      return sendJson(res, 200, { ok: true });
    }
    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(req)) return sendJson(res, 403, { error: 'Zły klucz' });
      db.suggestions = db.suggestions || {}; db.categories = db.categories || {};
      const sg = db.suggestions[String(body.id || '')];
      if (p === '/api/admin/miss-add' || p === '/api/admin/miss-ignore') {
        const cat = String(body.cat || ''), key = String(body.key || ''), m = (db.misses || {})[cat];
        if (!SZYB.category(cat)) return sendJson(res, 400, { error: 'Nie ma takiej kategorii' });
        if (p === '/api/admin/miss-add') {
          const a = clean(body.text, 60), tier = Number(body.tier);
          if (!SZYB.normalize(a) || !(tier >= 0 && tier <= 4)) return sendJson(res, 400, { error: 'Złe dane' });
          db.added = db.added || {};
          (db.added[cat] = db.added[cat] || []).push({ a, tier });
          SZYB.addAnswers({ [cat]: [{ a, tier }] });
        } else {
          db.missIgnored = db.missIgnored || {};
          (db.missIgnored[cat] = db.missIgnored[cat] || {})[key] = 1;
        }
        if (m) delete m[key];
        saveDb(); return sendJson(res, 200, { ok: true });
      }
      if (p === '/api/admin/reject') {
        if (!sg) return sendJson(res, 404, { error: 'Nie ma takiej propozycji' });
        sg.status = 'rejected'; saveDb(); return sendJson(res, 200, { ok: true });
      }
      if (p === '/api/admin/accept') {
        // autor podaje treść i odpowiedzi w 6 pokładach (jedna na linię, warianty po |); pytanie wchodzi do gry od jutra
        const q = clean(body.q, 140);
        const tiers = Array.isArray(body.tiers) ? body.tiers.slice(0, 6).map((t) => String(t || '').split('\n').map((x) => clean(x, 80)).filter(Boolean).slice(0, 80)) : [];
        while (tiers.length < 6) tiers.push([]);
        const total = tiers.reduce((a, t) => a + t.length, 0);
        if (q.length < 5) return sendJson(res, 400, { error: 'Wpisz treść pytania.' });
        if (total < 6) return sendJson(res, 400, { error: 'Dodaj przynajmniej 6 odpowiedzi.' });
        if (tiers[5].length > 3) return sendJson(res, 400, { error: 'Diament to tylko 1–3 najmniej oczywiste odpowiedzi. Resztę przenieś do Złota.' });
        const id = 'u-' + (sg ? sg.id : crypto.randomBytes(5).toString('hex'));
        // max 2 pytania od graczy dziennie: szukamy pierwszego wolnego dnia od jutra
        let since = tomorrow();
        const busy = (d) => Object.values(db.categories).filter((c) => c.since === d && !(c.until && c.until <= d)).length;
        for (let i = 0; i < 400 && busy(since) >= 2; i++) { const t = new Date(since + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); since = t.toISOString().slice(0, 10); }
        db.categories[id] = { id, q, tiers, since, by: sg ? sg.by : null };
        SZYB.addCategories([db.categories[id]]);
        if (sg) sg.status = 'accepted';
        saveDb(); return sendJson(res, 200, { ok: true, category: db.categories[id] });
      }
      if (p === '/api/admin/report-done' || p === '/api/admin/report-delete') {
        const r = (db.reports || {})[String(body.id || '')];
        if (!r) return sendJson(res, 404, { error: 'Nie ma takiego zgłoszenia' });
        if (p === '/api/admin/report-done') r.status = r.status === 'done' ? 'new' : 'done';
        else { if (r.img) fs.rm(path.join(DATA_DIR, 'reports', r.id + '.' + r.img), { force: true }, () => {}); delete db.reports[r.id]; }
        saveDb(); return sendJson(res, 200, { ok: true });
      }
      if (p === '/api/admin/retire') {
        // wycofanie: pytanie znika z losowania od jutra (dzisiejszy zestaw zostaje bez zmian)
        const c = db.categories[String(body.id || '')];
        if (!c) return sendJson(res, 404, { error: 'Nie ma takiego pytania' });
        c.until = tomorrow(); const live = SZYB.category(c.id); if (live) live.until = c.until; saveDb(); return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 404, { error: 'Nieznana akcja.' });
    }
    if (p === '/api/auth/google') {
      if (!GOOGLE_CLIENT_ID) return sendJson(res, 400, { error: 'Logowanie Google nie jest skonfigurowane' });
      if (!limit('auth', clientIp(req), 1, 3600e3, 30)) return sendJson(res, 429, { error: 'Za dużo prób logowania. Spróbuj za godzinę.' });
      try {
        const t = await verifyGoogleToken(String(body.credential || ''));
        const u = db.users[t.sub] || (db.users[t.sub] = { sub: t.sub, best: 0, games: 0, daily: {}, created: Date.now() });
        u.name = (t.given_name || t.name || 'Górnik').slice(0, 24);
        u.picture = t.picture || '';
        const token = crypto.randomBytes(24).toString('hex');
        db.sessions[token] = { sub: t.sub, created: Date.now() };
        saveDb();
        return sendJson(res, 200, { token, user: publicUser(u) });
      } catch (e) { return sendJson(res, 401, { error: e.message }); }
    }
    if (p === '/api/auth/delete') {
      // usunięcie konta na życzenie gracza (RODO: prawo do usunięcia danych)
      const u = userFromReq(req);
      if (!u) return sendJson(res, 401, { error: 'Niezalogowany' });
      for (const [k, v] of Object.entries(db.sessions)) if (v.sub === u.sub) delete db.sessions[k];
      if (db.ratings) delete db.ratings['g:' + u.sub];
      for (const x of Object.values(db.suggestions || {})) if (x.by === u.name && x.status !== 'accepted') x.by = null;
      for (const x of Object.values(db.reports || {})) if (x.sub === u.sub) { x.by = null; x.sub = null; }
      delete db.users[u.sub];
      saveDb();
      return sendJson(res, 200, { ok: true });
    }
    if (p === '/api/auth/logout') {
      const m = /^Bearer (\w+)$/.exec(req.headers.authorization || '');
      if (m) { delete db.sessions[m[1]]; saveDb(); }
      return sendJson(res, 200, { ok: true });
    }
    if (p === '/api/score') {
      const u = userFromReq(req);
      if (!u) return sendJson(res, 401, { error: 'Niezalogowany' });
      if (!dateOk(String(body.date || ''))) return sendJson(res, 400, { error: 'Zła data szychty' });
      const { score } = scoreFromKeys(body.date, Array.isArray(body.keys) ? body.keys : []);
      if (u.daily[body.date] == null) {          // liczy się tylko pierwsza próba danego dnia
        u.daily[body.date] = score;
        u.games = (u.games || 0) + 1;
        if (score > (u.best || 0)) u.best = score;
        saveDb();
      }
      return sendJson(res, 200, { user: publicUser(u) });
    }
    return sendJson(res, 404, { error: 'Nieznana akcja.' });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (p === '/' + ADMIN_PATH || p === '/' + ADMIN_PATH + '/') return serveAdmin(res, 'admin.html');
    if (p === '/' + ADMIN_PATH + '/admin.js') return serveAdmin(res, 'admin.js');
    if (p === '/admin.html' || p === '/admin.js') { res.writeHead(404, SEC); return res.end('Nie znaleziono'); }
    return serveStatic(req, res, p);
  }
  res.writeHead(405); res.end();
}
process.on('uncaughtException', (e) => console.error('Nieobsłużony błąd:', e));

server.listen(PORT, () => {
  console.log(`Szyb działa: http://localhost:${PORT}`);
  console.log(`Panel autora (propozycje pytań): http://localhost:${PORT}/${ADMIN_PATH}  klucz: ${process.env.ADMIN_KEY ? '(z ADMIN_KEY)' : ADMIN_KEY}`);
});
