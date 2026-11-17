// Szyb – tryb wieloosobowy „Dynamit”.
// Gracze siedzą przy stole, wszyscy dostają tę samą kategorię. Kto trzyma dynamit, musi podać poprawną odpowiedź,
// której jeszcze nie było – wtedy dynamit wędruje do następnej osoby. Lont ma ukrytą długość. Komu wybuchnie
// w rękach, traci życie (są 2). Bez żyć odpadasz. Wygrywa ostatni górnik przy stole.
// Stan pokoi trzymamy w pamięci, do przeglądarek idzie przez SSE (/api/m/events), akcje przez POST /api/m/*.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LIVES = 2;
const FUSE_MIN = +process.env.DYN_FUSE_MIN || 13000, FUSE_MAX = +process.env.DYN_FUSE_MAX || 22000;   // ukryta długość lontu na jedną turę – zapala się od nowa po każdej dobrej odpowiedzi (zmienne tylko do testów)
const BOOM_MS = 3000;                        // przerwa po wybuchu
const END_MS = 12000;                        // ekran zwycięzcy, potem pokój wraca do poczekalni
const START_MS = 10000, START_FULL_MS = 4000, LONELY_MS = 45000;
const HOST_MAX = 10, MAX_ROOMS = 400, LOG_MAX = 60;
const SIZES = {
  '1v1': { min: 2, max: 2 },
  '3': { min: 3, max: 3 },
  '4-6': { min: 4, max: 6 },
  '8-10': { min: 7, max: 10 },   // w menu „7–10” (klucz zostaje, bo gracze mają go zapamiętany)
};
const AVATARS = ['gornik', 'sztygar', 'kret', 'strzalowy', 'skarbnik'];
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

module.exports = function createMulti(ctx) {
  const { recordMiss, SZYB, db, saveDb, sendJson, readBody, clientIp, limit, userFromReq, SEC, publicDir } = ctx;
  const rooms = new Map();
  const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

  // ---------- ranking (Elo) ----------
  db.ratings = db.ratings || {};
  function ratingKey(req, body) {
    const u = userFromReq(req);
    if (u) return 'g:' + u.sub;
    const dev = String(body.device || '');
    return /^[a-z0-9]{8,40}$/.test(dev) ? 'd:' + dev : null;
  }
  const ratingOf = (key) => (key && db.ratings[key] ? db.ratings[key].r : 1000);

  // ---------- pokoje ----------
  function newCode() {
    let c;
    do { c = Array.from({ length: 4 }, () => ABC[crypto.randomInt(ABC.length)]).join(''); } while (rooms.has(c));
    return c;
  }
  function createRoom(kind, size, isPublic) {
    const sz = SIZES[size] || null;
    const room = {
      code: newCode(), kind, size: kind === 'host' ? null : size, isPublic,
      min: kind === 'host' ? 2 : sz.min, max: kind === 'host' ? HOST_MAX : sz.max,
      lives: LIVES, players: new Map(), bySecret: new Map(), hostPid: null, phase: 'lobby', startAt: 0, waitSince: 0,
      order: [], holder: null, cat: null, catNo: 0, used: new Set(), fuseStart: 0, fuseEnd: 0,
      out: [], boom: null, winner: null, ratingDelta: null, usedCats: [], log: [], timer: null, touched: Date.now(), seq: 0,
    };
    rooms.set(room.code, room);
    return room;
  }
  function pushLog(room, entry) {
    room.log.push({ id: ++room.seq, ...entry });
    if (room.log.length > LOG_MAX) room.log.shift();
  }
  function addPlayer(room, name, avatar, rKey) {
    // pid jest jawny (widzą go wszyscy przy stole), a secret zna tylko ten gracz – tylko nim podpisuje się akcje
    const pid = crypto.randomBytes(9).toString('hex'), secret = crypto.randomBytes(18).toString('hex');
    const nm = clean(name, 16) || 'Górnik' + crypto.randomInt(100, 999);
    room.players.set(pid, {
      pid, secret, name: nm, avatar: AVATARS.includes(avatar) ? avatar : 'gornik', lives: 0, inGame: false,
      connected: false, goneAt: Date.now(), streams: new Set(), last: null, typing: '', rKey, rating: ratingOf(rKey), typeN: 0, typeT: 0, chatT: 0,
    });
    room.bySecret.set(secret, pid);
    if (!room.hostPid) room.hostPid = pid;
    pushLog(room, { sys: 'join', name: nm });
    if (room.phase === 'lobby') lobbyCheck(room);
    broadcast(room);
    return secret;
  }
  function removePlayer(room, pid, why) {
    const p = room.players.get(pid);
    if (!p) return;
    if (p.inGame && p.lives > 0 && (room.phase === 'play' || room.phase === 'boom')) eliminate(room, pid, true);
    room.players.delete(pid);
    room.bySecret.delete(p.secret);
    for (const s of p.streams) { try { s.end(); } catch {} }
    pushLog(room, { sys: why || 'leave', name: p.name });
    if (room.hostPid === pid) room.hostPid = room.players.keys().next().value || null;
    if (room.players.size === 0) { clearTimeout(room.timer); rooms.delete(room.code); return; }
    if (room.phase === 'lobby') lobbyCheck(room);
    broadcast(room);
  }
  const connectedPlayers = (room) => [...room.players.values()].filter((p) => p.connected);

  // Poczekalnia: pokoje z kolejki ruszają same, gdy zbierze się minimum (albo gdy długo czeka para graczy).
  function lobbyCheck(room) {
    if (room.phase !== 'lobby' || room.kind === 'host') return;
    const n = room.players.size;
    if (n < 2) { room.startAt = 0; clearTimeout(room.timer); if (!room.waitSince || n === 0) room.waitSince = Date.now(); return; }
    if (!room.waitSince) room.waitSince = Date.now();
    let wait = null;
    if (n >= room.max) wait = START_FULL_MS;
    else if (n >= room.min) wait = START_MS;
    else if (Date.now() - room.waitSince >= LONELY_MS) wait = START_MS;
    if (wait == null) { room.startAt = 0; clearTimeout(room.timer); return; }
    const at = Date.now() + wait;
    if (room.startAt && room.startAt <= at) return;   // odliczanie już trwa i jest krótsze
    room.startAt = at;
    clearTimeout(room.timer);
    room.timer = setTimeout(() => startGame(room), wait);
  }

  function pickCat(room) {
    // bez dzisiejszych kategorii szychty dnia (żeby multi niczego nie zdradzało)
    const today = dayStr(new Date());
    const daily = new Set(SZYB.dailyCategories(today, 7));
    let pool = SZYB.DATA.CATEGORIES.filter((c) => (!c.since || c.since <= today) && !(c.until && c.until <= today) && !daily.has(c.id) && !room.usedCats.includes(c.id)).map((c) => c.id);
    if (!pool.length) { room.usedCats = []; pool = SZYB.DATA.CATEGORIES.filter((c) => !daily.has(c.id)).map((c) => c.id); }
    const id = pool[crypto.randomInt(pool.length)];
    room.usedCats.push(id);
    return id;
  }

  function startGame(room) {
    clearTimeout(room.timer);
    room.startAt = 0;
    const ps = [...room.players.values()].filter((p) => p.connected).slice(0, room.max);
    if (ps.length < 2) { room.phase = 'lobby'; room.waitSince = Date.now(); broadcast(room); return; }
    const order = ps.map((p) => p.pid);
    for (let i = order.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    for (const p of room.players.values()) { p.inGame = order.includes(p.pid); p.lives = p.inGame ? room.lives : 0; p.last = null; p.typing = ''; p.rating = ratingOf(p.rKey); }
    room.order = order; room.out = []; room.catNo = 0; room.winner = null; room.ratingDelta = null; room.boom = null;
    room.holder = order[0];
    pushLog(room, { sys: 'start', n: order.length });
    nextCategory(room);
  }
  const alive = (room) => room.order.filter((pid) => { const p = room.players.get(pid); return p && p.inGame && p.lives > 0; });
  function nextAlive(room, from) {
    const i = room.order.indexOf(from);
    for (let k = 1; k <= room.order.length; k++) {
      const pid = room.order[(i + k) % room.order.length];
      const p = room.players.get(pid);
      if (p && p.inGame && p.lives > 0) return pid;
    }
    return null;
  }
  function nextCategory(room) {
    clearTimeout(room.timer);
    if (alive(room).length <= 1) return endGame(room);
    room.cat = pickCat(room);
    room.catNo++;
    room.used = new Set(); room.lastOk = null;
    room.boom = null;
    for (const p of room.players.values()) { p.last = null; p.typing = ''; }
    const h = room.players.get(room.holder);
    if (!h || !h.inGame || h.lives <= 0) room.holder = nextAlive(room, room.holder);
    room.phase = 'play';
    lightFuse(room);
    broadcast(room);
  }
  // nowy lont na turę: losowa, ukryta długość
  function lightFuse(room) {
    clearTimeout(room.timer);
    const fuse = FUSE_MIN + crypto.randomInt(Math.max(1, FUSE_MAX - FUSE_MIN));
    room.fuseStart = Date.now(); room.fuseEnd = room.fuseStart + fuse;
    room.timer = setTimeout(() => explode(room), fuse);
  }
  function eliminate(room, pid, left) {
    const p = room.players.get(pid);
    if (!p) return;
    p.lives = 0;
    if (!room.out.includes(pid)) room.out.push(pid);
    if (left) pushLog(room, { sys: 'out', name: p.name });
    if (room.phase === 'play') {
      if (alive(room).length <= 1) return endGame(room);
      if (room.holder === pid) { room.holder = nextAlive(room, pid); broadcast(room); }
    }
  }
  function explode(room) {
    clearTimeout(room.timer);
    const victim = room.holder;
    const p = room.players.get(victim);
    const cat = SZYB.category(room.cat);
    // przykłady odpowiedzi, których nikt nie podał (z rzadszych pokładów)
    const examples = [];
    for (let t = 5; t >= 0 && examples.length < 3; t--) for (const a of cat.tiers[t]) {
      const d = a.split('|')[0];
      const r = SZYB.judge(room.cat, d);
      if (r.ok && !room.used.has(r.key) && examples.length < 3) examples.push(d);
    }
    if (p) {
      p.lives = Math.max(0, p.lives - 1);
      pushLog(room, { sys: p.lives > 0 ? 'boom' : 'dead', name: p.name });
      if (p.lives <= 0 && !room.out.includes(victim)) room.out.push(victim);
    }
    room.boom = { pid: victim, name: p ? p.name : '?', dead: p ? p.lives <= 0 : true, examples, at: Date.now() };
    room.holder = p && p.lives > 0 ? nextAlive(room, victim) || victim : nextAlive(room, victim);
    room.phase = 'boom';
    // po wybuchu nowa kategoria (Kuba: „kto nie znał odpowiedzi, kończy pytanie”)
    room.timer = setTimeout(() => (alive(room).length <= 1 ? endGame(room) : nextCategory(room)), BOOM_MS);
    broadcast(room);
  }
  function endGame(room) {
    clearTimeout(room.timer);
    const left = alive(room);
    const w = left[0] || null;
    const wp = w && room.players.get(w);
    room.winner = w ? { pid: w, name: wp ? wp.name : '?' } : null;
    if (wp) pushLog(room, { sys: 'win', name: wp.name });
    // kolejność: zwycięzca, potem od ostatniego, który odpadł
    const places = [...left, ...room.out.slice().reverse()].filter((x, i, a) => a.indexOf(x) === i);
    if (room.kind === 'rated' && places.length >= 2) room.ratingDelta = rate(room, places);
    room.phase = 'end';
    room.timer = setTimeout(() => backToLobby(room), END_MS);
    broadcast(room);
  }
  function rate(room, places) {
    const ps = places.map((pid) => room.players.get(pid)).filter(Boolean);
    const delta = {};
    const n = ps.length, K = 32;
    ps.forEach((a, i) => {
      let s = 0;
      ps.forEach((b, j) => {
        if (i === j) return;
        const e = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
        s += (i < j ? 1 : 0) - e;
      });
      delta[a.pid] = Math.round((K * s) / (n - 1));
    });
    for (const p of ps) {
      if (!p.rKey) continue;
      const r = db.ratings[p.rKey] || (db.ratings[p.rKey] = { r: 1000, games: 0, wins: 0 });
      r.r = Math.max(100, r.r + delta[p.pid]); r.games++; if (p.pid === places[0]) r.wins++;
      r.name = p.name; r.at = Date.now();
      p.rating = r.r;
    }
    saveDb();
    return delta;
  }
  function backToLobby(room) {
    clearTimeout(room.timer);
    for (const p of [...room.players.values()]) if (!p.connected) removePlayer(room, p.pid, 'leave');
    if (!rooms.has(room.code)) return;
    room.phase = 'lobby'; room.boom = null; room.cat = null; room.holder = null; room.waitSince = Date.now();
    for (const p of room.players.values()) { p.inGame = false; p.lives = 0; p.last = null; p.typing = ''; }
    lobbyCheck(room);
    broadcast(room);
  }

  function answer(room, pid, text, confirm) {
    if (room.phase !== 'play') return { error: 'Poczekaj na następną kategorię.' };
    if (room.holder !== pid) return { error: 'Teraz nie twoja kolej.' };
    const p = room.players.get(pid);
    const r = SZYB.judge(room.cat, text);
    p.typing = '';
    if (!r.ok) { p.last = { text: clean(text, 30), st: 'bad' }; broadcast(room); if (recordMiss) recordMiss(room.cat, text, 'p:' + pid); return { ok: false }; }
    if (room.used.has(r.key)) { p.last = { text: r.display, st: 'dup' }; broadcast(room); return { ok: false, dup: true, display: r.display }; }
    // jak w szychcie dnia: przy innej pisowni (bez ogonków, odmiana, literówka) najpierw „Czy chodziło Ci o…?”
    if (r.fuzzy && !confirm) return { ok: false, confirm: r.display };
    room.used.add(r.key);
    p.last = { text: r.display, st: 'ok', tier: r.tier };
    room.lastOk = { pid, text: r.display, tier: r.tier, n: room.used.size };
    room.holder = nextAlive(room, pid);
    lightFuse(room);
    broadcast(room);
    return { ok: true, display: r.display, tier: r.tier };
  }

  // ---------- widok dla klienta ----------
  function viewFor(room, pid) {
    const now = Date.now();
    return {
      code: room.code, kind: room.kind, lives: room.lives, size: room.size, isPublic: room.isPublic, max: room.max, min: room.min,
      phase: room.phase, you: pid, host: room.hostPid,
      startIn: room.startAt ? Math.max(0, room.startAt - now) : 0,
      question: room.cat && (room.phase === 'play' || room.phase === 'boom') ? SZYB.category(room.cat).q : null,
      catNo: room.catNo, catId: room.phase === 'play' ? room.cat : null, usedKeys: room.phase === 'play' ? [...room.used] : [], holder: room.holder, order: room.order, lastOk: room.phase === 'play' || room.phase === 'boom' ? room.lastOk : null,
      // tylko ile lontu już się spaliło względem najdłuższego możliwego (koniec pozostaje tajemnicą)
      heat: room.phase === 'play' ? Math.min(1, (now - room.fuseStart) / FUSE_MAX) : room.phase === 'boom' ? 1 : 0,
      heatRate: 1 / FUSE_MAX,
      boom: room.boom, winner: room.winner, ratingDelta: room.ratingDelta,
      players: [...room.players.values()].map((p) => ({
        pid: p.pid, name: p.name, avatar: p.avatar, lives: p.lives, inGame: p.inGame, connected: p.connected,
        last: p.last, typing: p.typing, rating: room.kind === 'rated' ? p.rating : undefined,
      })),
      log: room.log,
    };
  }
  function broadcast(room) {
    room.touched = Date.now();
    for (const p of room.players.values()) {
      if (!p.streams.size) continue;
      const data = 'data: ' + JSON.stringify(viewFor(room, p.pid)) + '\n\n';
      for (const res of p.streams) { try { res.write(data); } catch {} }
    }
  }
  function sendTyping(room, p) {
    const data = 'event: type\ndata: ' + JSON.stringify({ pid: p.pid, text: p.typing }) + '\n\n';
    for (const q of room.players.values()) for (const res of q.streams) { try { res.write(data); } catch {} }
  }
  function roomList() {
    const rank = (r) => (r.players.size >= r.max ? 2 : r.phase === 'lobby' ? 0 : 1);
    return [...rooms.values()].filter((r) => r.isPublic && r.players.size)
      .sort((a, b) => rank(a) - rank(b) || b.players.size - a.players.size)
      .slice(0, 50)
      .map((r) => {
        const h = r.players.get(r.hostPid);
        return { code: r.code, host: h ? h.name : '?', n: r.players.size, max: r.max, playing: r.phase !== 'lobby', kind: r.kind, size: r.size };
      });
  }

  // ---------- HTTP ----------
  function serveMultiPage(res) {
    fs.readFile(path.join(publicDir, 'multi.html'), (err, buf) => {
      if (err) { res.writeHead(404, SEC); return res.end('Nie znaleziono'); }
      res.writeHead(200, { ...SEC, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(ctx.stampHtml ? ctx.stampHtml(buf) : buf);
    });
  }
  const joinAllowed = (req) => limit('mjoin', clientIp(req), 1, 3600e3, 240);

  async function handle(req, res, url) {
    const p = url.pathname;
    if ((req.method === 'GET' || req.method === 'HEAD') && (p === '/multi' || p === '/multi/' || /^\/multi\/[A-Za-z]{4}\/?$/.test(p))) { serveMultiPage(res); return true; }
    if (!p.startsWith('/api/m/')) return false;

    if (p === '/api/m/rooms') { sendJson(res, 200, { rooms: roomList(), online: [...rooms.values()].reduce((a, r) => a + r.players.size, 0) }); return true; }
    if (p === '/api/m/events' && req.method === 'GET') {
      const room = rooms.get(String(url.searchParams.get('code') || '').toUpperCase());
      const pl = room && room.players.get(room.bySecret.get(String(url.searchParams.get('pid') || '')));
      if (!pl) { sendJson(res, 404, { error: 'Nie ma cię w tym pokoju.' }); return true; }
      res.writeHead(200, { ...SEC, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n');
      if (pl.streams.size >= 3) { const old = pl.streams.values().next().value; pl.streams.delete(old); try { old.end(); } catch {} }
      pl.streams.add(res);
      pl.connected = true; pl.goneAt = 0;
      if (room.phase === 'lobby') lobbyCheck(room);
      broadcast(room);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 15000);
      req.on('close', () => {
        clearInterval(ping);
        pl.streams.delete(res);
        if (pl.streams.size === 0 && room.players.get(pl.pid) === pl) { pl.connected = false; pl.goneAt = Date.now(); broadcast(room); }
      });
      return true;
    }
    if (req.method !== 'POST') { sendJson(res, 405, { error: 'Zła metoda' }); return true; }
    const body = await readBody(req);

    if (p === '/api/m/me') {
      const k = ratingKey(req, body);
      const r = k && db.ratings[k];
      sendJson(res, 200, { rating: r ? r.r : 1000, games: r ? r.games : 0, wins: r ? r.wins : 0 });
      return true;
    }
    if (p === '/api/m/create' || p === '/api/m/quick') {
      if (!joinAllowed(req)) { sendJson(res, 429, { error: 'Za dużo prób. Odczekaj chwilę.' }); return true; }
      const rKey = ratingKey(req, body);
      let room;
      if (p === '/api/m/create') {
        if (rooms.size >= MAX_ROOMS) { sendJson(res, 503, { error: 'Serwer jest pełny, spróbuj za chwilę.' }); return true; }
        room = createRoom('host', null, body.isPublic !== false);
      } else {
        const size = SIZES[body.size] ? body.size : '3';
        const kind = body.rated ? 'rated' : 'quick';
        if (kind === 'rated' && !rKey) { sendJson(res, 400, { error: 'Złe dane' }); return true; }
        const mine = ratingOf(rKey);
        const fits = (r) => {
          if (!r.isPublic || r.kind !== kind || r.size !== size || r.phase !== 'lobby' || r.players.size >= r.max) return false;
          if ([...r.players.values()].some((x) => !x.connected && Date.now() - x.goneAt > 3000)) return false;
          const ps = [...r.players.values()];
          if (rKey && ps.some((x) => x.rKey === rKey)) return false;
          if (kind !== 'rated') return true;
          const avg = ps.reduce((a, x) => a + x.rating, 0) / ps.length;
          const widen = 150 + Math.min(600, (Date.now() - r.waitSince) / 100);   // im dłużej pokój czeka, tym szerzej szuka
          return Math.abs(avg - mine) <= widen;
        };
        room = [...rooms.values()].filter(fits).sort((a, b) => b.players.size - a.players.size)[0];
        if (!room) {
          if (rooms.size >= MAX_ROOMS) { sendJson(res, 503, { error: 'Serwer jest pełny, spróbuj za chwilę.' }); return true; }
          room = createRoom(kind, size, true);
        }
      }
      sendJson(res, 200, { code: room.code, pid: addPlayer(room, body.name, body.avatar, rKey) });
      return true;
    }
    const room = rooms.get(String(body.code || '').toUpperCase());
    if (!room) { sendJson(res, 404, { error: 'Nie ma takiego pokoju. Sprawdź kod.' }); return true; }
    if (p === '/api/m/join') {
      if (!joinAllowed(req)) { sendJson(res, 429, { error: 'Za dużo prób. Odczekaj chwilę.' }); return true; }
      const rKey = ratingKey(req, body);
      // ten sam gracz (urządzenie albo konto) nie może siedzieć przy stole dwa razy;
      // jeśli jego stare miejsce jest rozłączone, po prostu wraca na nie
      const same = rKey && [...room.players.values()].find((x) => x.rKey === rKey);
      if (same && same.connected) { sendJson(res, 409, { error: 'Już jesteś w tym pokoju (w innej karcie albo na innym urządzeniu).' }); return true; }
      if (same) { sendJson(res, 200, { code: room.code, pid: same.secret }); return true; }
      if (room.players.size >= room.max) { sendJson(res, 409, { error: 'Pokój jest pełny.' }); return true; }
      sendJson(res, 200, { code: room.code, pid: addPlayer(room, body.name, body.avatar, rKey) });
      return true;
    }
    const pl = room.players.get(room.bySecret.get(String(body.pid || '')));
    if (!pl) { sendJson(res, 403, { error: 'Nie jesteś w tym pokoju.' }); return true; }
    if (p === '/api/m/start') {
      if (room.hostPid !== pl.pid) { sendJson(res, 403, { error: 'Grę zaczyna gospodarz pokoju.' }); return true; }
      if (room.phase !== 'lobby') { sendJson(res, 409, { error: 'Gra już trwa.' }); return true; }
      if (connectedPlayers(room).length < 2) { sendJson(res, 409, { error: 'Potrzeba co najmniej 2 graczy.' }); return true; }
      startGame(room);
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (p === '/api/m/visibility') {
      if (room.hostPid !== pl.pid || room.kind !== 'host') { sendJson(res, 403, { error: 'Tylko gospodarz.' }); return true; }
      room.isPublic = !!body.isPublic; broadcast(room);
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (p === '/api/m/lives') {
      // gospodarz własnego pokoju wybiera, ile serc ma każdy (1–5); w kolejce zawsze 2
      const n = Math.round(Number(body.lives));
      if (room.hostPid !== pl.pid || room.kind !== 'host') { sendJson(res, 403, { error: 'Tylko gospodarz.' }); return true; }
      if (room.phase !== 'lobby') { sendJson(res, 409, { error: 'Gra już trwa.' }); return true; }
      if (!(n >= 1 && n <= 5)) { sendJson(res, 400, { error: 'Od 1 do 5 serc.' }); return true; }
      room.lives = n; broadcast(room);
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (p === '/api/m/type') {
      const now = Date.now();
      if (now - pl.typeT > 1000) { pl.typeT = now; pl.typeN = 0; }
      if (++pl.typeN <= 20 && room.phase === 'play' && room.holder === pl.pid) { pl.typing = clean(body.text, 30); sendTyping(room, pl); }
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (p === '/api/m/answer') {
      const now = Date.now();
      if (now - pl.typeT > 1000) { pl.typeT = now; pl.typeN = 0; }
      if (++pl.typeN > 20) { sendJson(res, 429, { error: 'Wolniej.' }); return true; }
      sendJson(res, 200, answer(room, pl.pid, String(body.text || '').slice(0, 60), body.confirm === true));
      return true;
    }
    if (p === '/api/m/chat') {
      const text = clean(body.text, 120);
      const now = Date.now();
      if (!text) { sendJson(res, 400, { error: 'Pusta wiadomość' }); return true; }
      if (now - pl.chatT < 700) { sendJson(res, 429, { error: 'Wolniej.' }); return true; }
      pl.chatT = now;
      pushLog(room, { name: pl.name, text });
      broadcast(room);
      sendJson(res, 200, { ok: true });
      return true;
    }
    if (p === '/api/m/leave') { removePlayer(room, pl.pid, 'leave'); sendJson(res, 200, { ok: true }); return true; }
    sendJson(res, 404, { error: 'Nieznana akcja.' });
    return true;
  }

  // Sprzątanie: rozłączony w trakcie gry > 20 s odpada, rozłączony > 60 s znika z pokoju; poczekalnie sprawdzają odliczanie.
  setInterval(() => {
    const now = Date.now();
    for (const room of [...rooms.values()]) {
      for (const pl of [...room.players.values()]) {
        if (pl.connected || !pl.goneAt) continue;
        if (pl.inGame && pl.lives > 0 && room.phase === 'play' && now - pl.goneAt > 20000) eliminate(room, pl.pid, true);
        // w poczekalni rozłączeni znikają szybko (żeby kolejka nie łączyła z pustymi miejscami), w grze po minucie
        if (now - pl.goneAt > (room.phase === 'lobby' ? 8000 : 60000) && rooms.has(room.code)) removePlayer(room, pl.pid, 'leave');
      }
      if (rooms.has(room.code) && room.phase === 'lobby' && !room.startAt) lobbyCheck(room) || (room.startAt && broadcast(room));
    }
  }, 2000).unref();

  return { handle, rooms };
};
