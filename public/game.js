// Szyb – klient (Szychta dnia). Przebieg rundy: kategoria → odliczanie 3 s → 25 s na odpowiedź →
// odpowiedź zjeżdża windą przez linie pokładów → karta pokładu → „Zjeżdżaj” → następna kategoria.
(() => {
  const { judge, seededRandom, pickCategories, category, DATA } = window.SZYB;
  const { TIERS, METERS_PER_POINT } = DATA;
  const FX = window.SZYB_FX;
  const ROUNDS = 7, ROUND_MS = 25000, COUNTDOWN = 3, MAX_PTS = ROUNDS * TIERS[TIERS.length - 1].pts;
  const LAUNCH = '2026-11-07';   // szychta #1

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
    keys() { try { return Object.keys(localStorage); } catch { return []; } },
  };
  const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => dateStr(new Date());
  const num = (n) => Math.round(n).toLocaleString('pl-PL');
  const meters = (pts) => num(pts * METERS_PER_POINT) + ' m';
  const diveNo = (d) => Math.max(1, Math.round((new Date(d + 'T12:00:00') - new Date(LAUNCH + 'T12:00:00')) / 86400000) + 1);
  const FLAVOR = [
    'Odpowiedź, którą każdy rzuca pierwszą.',
    'Pewniak, ale już nie dla wszystkich.',
    'Solidnie. Kopiesz razem z brygadą.',
    'Rzadka żyła. Mało kto tu zagląda.',
    'Głęboki pokład. Prawie nikt tu nie dotarł.',
    'Jeden na milion. Absurdalnie głęboko.',
  ];
  const BEARING = [
    [0, 150, 0, 'Piasek pod butami. Sporo skały jeszcze przed Tobą.'],
    [151, 250, 2, 'Brygada. Kopiesz razem z resztą.'],
    [251, 350, 3, 'Pod stropem. Ładny, głęboki zjazd.'],
    [351, 449, 4, 'Głęboki chodnik. Naprawdę rzadkie odpowiedzi.'],
    [450, MAX_PTS, 5, 'Jeden na milion. Mieszkasz w diamentach.'],
  ];
  // ciekawostki przy szybie (metry)
  const FACTS = [
    [100, 'tyle ma 30-piętrowy wieżowiec'],
    [237, 'Pałac Kultury z iglicą zmieściłby się tu cały'],
    [327, 'dno Kopalni Soli Wieliczka'],
    [500, 'tu nie dochodzi już żaden dźwięk z powierzchni'],
    [828, 'Burj Khalifa – najwyższy budynek świata'],
    [1000, 'skała ma tu już około 40°C'],
    [1400, 'tak głęboko sięgają polskie kopalnie miedzi'],
    [2200, 'najgłębsza znana jaskinia świata'],
    [4000, 'Mponeng (RPA) – najgłębsza kopalnia świata'],
    [7000, 'dno szychty. Dalej tylko odwierty'],
  ];

  // ikonka pokładu: pikselowa bryłka w kolorze pokładu
  const NUGGET = ['..##..', '.####.', '##o###', '######', '.####.', '..##..'];
  function oreRects(x, y, size, color) {
    const p = size / 6; let s = '';
    NUGGET.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      s += `<rect x="${x + i * p}" y="${y + j * p}" width="${p + .2}" height="${p + .2}" fill="${ch === 'o' ? '#fff' : color}"/>`;
    }));
    return s;
  }
  const oreIcon = (tier, size = 18) => tier == null
    ? `<svg class="ore miss" width="${size}" height="${size}" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#6d6690" stroke-width="1.2" stroke-dasharray="2 1.6"/></svg>`
    : `<svg class="ore" width="${size}" height="${size}" viewBox="0 0 12 12">${oreRects(0, 0, 12, TIERS[tier].color)}</svg>`;

  // ---------- tło, warstwa głębokości, napis jadący windą ----------
  const bg = new FX.Background($('bg'));
  window.SZYB_BG = bg;   // podgląd/testy
  const layer = $('depthLayer');
  const youMark = document.createElement('div');
  youMark.className = 'you-mark'; youMark.textContent = 'TY ◂'; document.body.appendChild(youMark);
  (function buildLayer() {
    let h = '';
    for (let m = 0; m <= 7500; m += 50) h += `<i class="tk${m % 100 ? '' : ' big'}" style="--m:${m}">${m % 100 ? '' : (m ? '−' + num(m) + ' m' : '0 m')}</i>`;
    FX.LAYERS_M.slice(1).forEach(([m, name]) => { h += `<span class="zone" style="--m:${m}">${esc(name.toUpperCase())}</span>`; });
    FACTS.forEach(([m, t], i) => { h += `<span class="fact ${i % 2 ? 'r' : 'l'}" style="--m:${m}">${esc(t)} · ${num(m)} m</span>`; });
    h += '<div id="marks"></div>';
    layer.innerHTML = h;
  })();
  const marksEl = $('marks');
  let lastMpx = 0;
  bg.onDepth = (m) => { const el = $('hudDepth'); const t = num(m) + ' m'; if (el.textContent !== t) el.textContent = t; };

  const rider = $('rider');
  let riderOn = false, riderAnim = null;
  bg.onFrame = (cage) => {
    if (bg.mpx !== lastMpx) { lastMpx = bg.mpx; layer.style.setProperty('--mpx', lastMpx); }
    layer.style.transform = `translate3d(0, ${-cage.camCss}px, 0)`;
    youMark.style.top = Math.round(cage.y + cage.h / 2) + 'px';
    // linie pokładów, które winda już minęła, świecą
    if (layer.classList.contains('show-marks')) {
      let hot = null;
      for (const el of marksEl.children) {
        const passed = bg.depth >= +el.dataset.m - 0.5;
        el.classList.toggle('passed', passed);
        if (passed) hot = el;
      }
      for (const el of marksEl.children) el.classList.toggle('hot', el === hot && bg.moving);
    }
    if (!riderOn) return;
    const w = rider.offsetWidth, h = rider.offsetHeight;
    let x = cage.x + cage.w / 2, y = cage.y - 6;
    if (riderAnim) {
      const k = Math.min(1, (performance.now() - riderAnim.t0) / 1000), e = 1 - Math.pow(1 - k, 3);
      x = riderAnim.x + (x - riderAnim.x) * e; y = riderAnim.y + (y - riderAnim.y) * e;
      if (k >= 1) riderAnim = null;
    }
    const left = Math.max(10, Math.min(innerWidth - w - 10, x - w / 2));
    rider.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(64, y - h))}px)`;
  };
  function setMarks(base) {
    marksEl.innerHTML = TIERS.map((t) => {
      const m = base + t.pts * METERS_PER_POINT;
      return `<div class="mark" data-m="${m}" style="--m:${m};--c:${t.color}"><span>${oreIcon(t.id, 12)} ${t.name.toUpperCase()} · ${t.pts}</span></div>`;
    }).join('');
  }

  function show(name) {
    if (name === 'menu') bg.set(0);
    bg.center(name === 'play');
    document.body.dataset.screen = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + name));
    if (name !== 'play') { riderOn = false; rider.hidden = true; document.body.classList.remove('low'); }
    window.scrollTo(0, 0);
  }
  let toastT;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

  // ---------- zegar (tarcza + pasek pod polem) ----------
  const RING = 2 * Math.PI * 19;
  $('clockRing').style.strokeDasharray = RING;
  let timerEnd = 0, timerCb = null, timerIv = null, lastSec = 99;
  function startTimer(ms, onEnd) { timerEnd = Date.now() + ms; timerCb = onEnd; lastSec = 99; clearInterval(timerIv); tick(); timerIv = setInterval(tick, 50); }
  function stopTimer() { clearInterval(timerIv); timerCb = null; document.body.classList.remove('low'); }
  function tick() {
    const left = Math.max(0, timerEnd - Date.now()), frac = left / ROUND_MS;
    $('clockRing').style.strokeDashoffset = RING * (1 - frac);
    $('tbar').style.transform = `scaleX(${frac})`;
    const sec = Math.ceil(left / 1000);
    $('clockNum').textContent = sec;
    const low = left <= 5000 && left > 0;
    document.body.classList.toggle('low', low);
    if (low && sec !== lastSec && timerCb) FX.Sound.tick();
    lastSec = sec;
    if (left <= 0) { clearInterval(timerIv); const cb = timerCb; timerCb = null; document.body.classList.remove('low'); if (cb) cb(); }
  }

  // ---------- zapis ----------
  const KEY_DONE = (d) => 'szyb-daily-' + d;
  const KEY_PROG = (d) => 'szyb-progress-' + d;
  function allDailies() {
    return store.keys().filter((k) => /^szyb-daily-\d{4}-\d{2}-\d{2}$/.test(k))
      .map((k) => ({ date: k.slice(11), ...(store.get(k) || {}) }))
      .filter((x) => typeof x.score === 'number')
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  function streaks() {
    const days = new Set(allDailies().map((x) => x.date));
    const d = new Date();
    if (!days.has(dateStr(d))) d.setDate(d.getDate() - 1);
    let cur = 0;
    while (days.has(dateStr(d))) { cur++; d.setDate(d.getDate() - 1); }
    let best = 0, run = 0, prev = null;
    for (const day of [...days].sort()) {
      const t = new Date(day + 'T12:00:00');
      run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = t;
    }
    return { cur, best };
  }

  // ---------- menu ----------
  function refreshMenu() {
    const done = store.get(KEY_DONE(today()));
    const prog = store.get(KEY_PROG(today()));
    $('btnDaily').textContent = done ? '▼ TWÓJ ZJAZD ▼' : prog ? '▼ DOKOŃCZ ZJAZD ▼' : '▼ ZJAZD W DÓŁ ▼';
    $('diveNo').textContent = `SZYCHTA #${diveNo(today())}`;
  }
  $('legendList').innerHTML = `<table class="legend-table">${TIERS.map((t) => `<tr><td>${oreIcon(t.id, 16)}</td><td style="color:${t.color}">${t.name}</td><td>${t.pts} pkt</td><td>${meters(t.pts)}</td></tr>`).join('')}</table>`;

  // ---------- rozgrywka ----------
  const game = { date: null, cats: [], answers: [], score: 0, phase: 'idle', pending: null, base: 0 };
  let countIv = null;

  function paintHud() {
    const i = game.answers.length;
    $('progSq').innerHTML = Array.from({ length: ROUNDS }, (_, k) => {
      const a = game.answers[k];
      if (a) return a.tier == null ? '<i class="miss"></i>' : `<i class="done" style="--c:${TIERS[a.tier].color}"></i>`;
      return `<i class="${k === i ? 'cur' : ''}"></i>`;
    }).join('');
    $('roundLabel').textContent = `KATEGORIA ${Math.min(i + 1, ROUNDS)} Z ${ROUNDS}`;
  }

  async function startDaily() {
    await customReady;
    const d = today();
    const done = store.get(KEY_DONE(d));
    if (done) return showResult(d, done, false);
    game.date = d;
    game.cats = window.SZYB.dailyCategories(d, ROUNDS);
    const prog = store.get(KEY_PROG(d));
    game.answers = prog ? prog.answers : [];
    // przeładowanie strony w trakcie kategorii = ta kategoria przepada (żeby nie dało się podejrzeć pytania)
    if (prog && prog.inRound && game.answers.length < ROUNDS) game.answers.push({ cat: game.cats[game.answers.length], key: null, display: null, tier: null, pts: 0 });
    game.score = game.answers.reduce((s, a) => s + a.pts, 0);
    bg.set(game.score * METERS_PER_POINT, true);
    $('scoreLabel').textContent = game.score;
    show('play');
    if (game.answers.length >= ROUNDS) return finishDaily();
    FX.Sound.start();
    beginRound();
  }

  function saveProgress(inRound) { store.set(KEY_PROG(game.date), { answers: game.answers, inRound }); }

  function beginRound() {
    const i = game.answers.length;
    const cat = category(game.cats[i]);
    game.phase = 'count'; game.pending = null;
    game.base = game.score * METERS_PER_POINT;
    saveProgress(true);
    paintHud();
    riderOn = false; rider.hidden = true;
    layer.classList.remove('show-marks');
    $('btnNext').hidden = true; $('checking').hidden = true;
    $('promptK').textContent = `KATEGORIA ${i + 1} Z ${ROUNDS}`;
    const card = $('promptCard');
    card.className = 'prompt'; FX.retrigger(card, 'in');
    FX.typewriter($('question'), cat.q + '.');
    $('dock').hidden = true;
    $('msg').className = 'msg'; $('msg').textContent = '';
    $('confirm').hidden = true;
    const inp = $('answerInput'); inp.value = ''; inp.disabled = true;
    // „zjeżdżamy · zegar rusza za 3”
    let n = COUNTDOWN;
    $('countNum').textContent = n; $('countPill').hidden = false;
    clearInterval(countIv);
    countIv = setInterval(() => {
      n--;
      if (n > 0) { $('countNum').textContent = n; return; }
      clearInterval(countIv);
      startAnswer();
    }, 1000);
  }

  function startAnswer() {
    game.phase = 'answer';
    $('countPill').hidden = true;
    $('dock').hidden = false; FX.retrigger($('dock'), 'in');
    $('btnDive').textContent = 'ZJAZD'; $('btnDive').disabled = false;
    const inp = $('answerInput'); inp.disabled = false; inp.focus();
    setMarks(game.base);
    startTimer(ROUND_MS, () => finishRound(null));
  }

  // literówka poprawiona przez autokorektę: pytamy, czy o to chodziło
  function askConfirm(r) {
    game.pending = r;
    $('confirmWord').textContent = `„${r.display}”`;
    $('msg').className = 'msg';
    $('confirm').hidden = false;
  }
  function confirmYes() { const r = game.pending; if (!r || game.phase !== 'answer') return; game.pending = null; $('confirm').hidden = true; finishRound(r); }
  function confirmNo(keepFocus) {
    if (!game.pending) return;
    game.pending = null;
    $('confirm').hidden = true;
    if (keepFocus !== false) { const inp = $('answerInput'); inp.focus(); inp.select(); }
  }
  $('btnYes').onclick = confirmYes;
  $('btnNo').onclick = () => confirmNo();
  $('answerInput').addEventListener('input', () => { if (game.pending) confirmNo(false); });

  let badT = null;
  // nieznana odpowiedź → do panelu autora (autor może ją dopisać do bazy)
  function reportMiss(cat, text) {
    if (!location.protocol.startsWith('http')) return;
    try { fetch('/api/miss', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cat, text }) }).catch(() => {}); } catch {}
  }
  function badAnswer(text) {
    const b = $('btnDive'); b.textContent = '…'; b.disabled = true;
    setTimeout(() => {
      if (game.phase !== 'answer') return;
      b.textContent = 'ZJAZD'; b.disabled = false;
      const m = $('msg');
      m.innerHTML = `„${esc(text)}”: głucho. spróbuj jeszcze`;
      m.className = 'msg'; FX.retrigger(m, 'show');
      FX.Sound.miss();
      clearTimeout(badT); badT = setTimeout(() => m.classList.remove('show'), 2200);
    }, 260);
  }

  $('answerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (game.phase !== 'answer' || $('btnDive').disabled) return;
    if (game.pending) return confirmYes();
    const text = $('answerInput').value.trim();
    if (!text) return;
    const r = judge(game.cats[game.answers.length], text);
    if (!r.ok) { reportMiss(game.cats[game.answers.length], text); return badAnswer(text); }
    if (r.fuzzy) return askConfirm(r);
    finishRound(r);
  });

  function finishRound(r) {
    if (game.phase !== 'answer') return;
    game.phase = 'sink';
    game.pending = null;
    stopTimer();
    const catId = game.cats[game.answers.length];
    game.answers.push({ cat: catId, key: r ? r.key : null, display: r ? r.display : null, tier: r ? r.tier : null, pts: r ? r.pts : 0 });
    game.score += r ? r.pts : 0;
    saveProgress(false);
    $('answerInput').disabled = true;
    $('confirm').hidden = true;
    $('msg').className = 'msg';
    sink(r);
  }

  // Zjazd: odpowiedź spada z pola na dach windy, winda zjeżdża przez linie pokładów.
  function sink(r) {
    const inpRect = $('answerInput').getBoundingClientRect();
    $('dock').hidden = true;
    if (!r) { FX.Sound.timeout(); return land(null); }
    rider.className = 'rider falling';
    rider.innerHTML = `<b>„${esc(r.display)}”</b><span class="arr">▼</span>`;
    rider.hidden = false; riderOn = true;
    riderAnim = { t0: performance.now(), x: inpRect.left + inpRect.width / 2, y: inpRect.top + inpRect.height };
    $('promptCard').className = 'prompt gone';
    layer.classList.add('show-marks');
    FX.Sound.click();
    setTimeout(() => bg.set(game.score * METERS_PER_POINT), 450);
    const t0 = Date.now();
    const wait = setInterval(() => {
      if (Date.now() - t0 < 1600 || !bg.arrived) return;
      clearInterval(wait);
      land(r);
    }, 50);
  }

  function land(r) {
    game.phase = 'landed';
    paintHud();
    const sc = $('scoreLabel'), from = +sc.textContent || 0;
    FX.countUp(sc, game.score - from, (v) => String(from + v), 700);
    const last = game.answers.length >= ROUNDS;
    if (r) FX.Sound.hit(r.tier);
    $('promptCard').className = 'prompt gone';
    rider.className = 'rider card' + (r ? ` t${r.tier}` : ' miss');
    rider.innerHTML = r
      ? `<div class="lc-icon">${oreIcon(r.tier, 44)}</div><div class="lc-tier" style="color:${TIERS[r.tier].color}">${TIERS[r.tier].name}</div>
         <div class="lc-word">„${esc(r.display)}”</div><div class="lc-pts"><b>+${r.pts} PKT</b> · zjazd ${meters(r.pts)}</div><div class="lc-flav">${FLAVOR[r.tier]}</div>`
      : `<div class="lc-icon">${oreIcon(null, 44)}</div><div class="lc-tier miss">Nic nie wydobyto</div><div class="lc-word">—</div>
         <div class="lc-pts"><b>+0 PKT</b></div><div class="lc-flav">zegar był szybszy.</div>`;
    rider.hidden = false; riderOn = true; riderAnim = null;
    const nb = $('btnNext'); nb.textContent = last ? 'ZOBACZ WYNIK ▶' : 'ZJEŻDŻAJ ▼'; nb.hidden = false; FX.retrigger(nb, 'in');
    setTimeout(() => { if (game.phase === 'landed') nb.focus({ preventScroll: true }); }, 50);
  }
  function nextRound() {
    if (game.phase !== 'landed') return;
    FX.Sound.click();
    if (game.answers.length >= ROUNDS) {
      game.phase = 'checking';
      riderOn = false; rider.hidden = true; $('btnNext').hidden = true;
      $('checking').hidden = false;
      return setTimeout(finishDaily, 900);
    }
    beginRound();
  }
  $('btnNext').onclick = nextRound;
  document.addEventListener('keydown', (e) => {
    if (document.body.dataset.screen !== 'play') return;
    if (game.phase === 'landed' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextRound(); }
    else if (game.phase === 'answer' && game.pending && e.key === 'Escape') { e.preventDefault(); confirmNo(); }
  });

  function deviceId() {
    let id = store.get('szyb-device');
    if (!id || !/^[a-z0-9]{8,40}$/.test(id)) { id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join(''); store.set('szyb-device', id); }
    return id;
  }

  function finishDaily() {
    stopTimer();
    game.phase = 'done';
    const result = { score: game.score, tiles: game.answers.map((a) => a.tier), answers: game.answers };
    store.set(KEY_DONE(game.date), result);
    store.del(KEY_PROG(game.date));
    if (window.SZYB_AUTH) window.SZYB_AUTH.report('daily', game.score, game.date, game.answers.map((a) => a.key || null));
    showResult(game.date, result, true);
  }

  // ---------- serwer (wykres wszystkich graczy) ----------
  let hasServer = null;
  async function serverUp() {
    if (hasServer !== null) return hasServer;
    hasServer = false;
    if (location.protocol.startsWith('http')) {
      try { const r = await fetch('/api/health', { cache: 'no-store' }); hasServer = r.ok && !!(await r.json()).ok; } catch {}
    }
    return hasServer;
  }

  function drawCurve(scores, mine) {
    const svg = $('curve');
    const n = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 60;
    const h = Math.max(22, 1.06 * sd * Math.pow(n, -0.2));
    const xs = [], ys = [];
    for (let x = 0; x <= MAX_PTS; x += 5) {
      let y = 0; for (const s of scores) y += Math.exp(-0.5 * ((x - s) / h) ** 2);
      xs.push(x); ys.push(y);
    }
    const max = Math.max(...ys) || 1;
    const Y = (y) => 112 - y / max * 100;
    const line = xs.map((x, i) => `${i ? 'L' : 'M'}${x},${Y(ys[i]).toFixed(1)}`).join('');
    const mi = Math.round(Math.min(MAX_PTS, mine) / 5);
    svg.innerHTML = `<path d="${line}L${MAX_PTS},112L0,112Z" class="c-area"/><path d="${line}" class="c-line"/>
      <line x1="${mine}" x2="${mine}" y1="${Y(ys[mi])}" y2="112" class="c-me"/><circle cx="${mine}" cy="${Y(ys[mi])}" r="5" class="c-dot"/>`;
    const pct = (mine / MAX_PTS * 100).toFixed(2);
    $('curveAxis').innerHTML = [0, 100, 200, 300, 400, 500, 600, 700].map((v) => `<span style="left:${v / MAX_PTS * 100}%">${v}</span>`).join('') + `<b style="left:${pct}%">TY</b>`;
  }

  async function loadChart(date, res) {
    const box = $('chartBox');
    if (!(await serverUp())) {
      box.classList.add('empty');
      $('curve').innerHTML = ''; $('curveAxis').innerHTML = '';
      $('chartSum').textContent = 'Krzywa wszystkich graczy i liczby wyborów pojawiają się, gdy gra działa na serwerze (node server.js).';
      return null;
    }
    box.classList.remove('empty');
    try {
      await fetch('/api/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, score: res.score, tiles: res.tiles, keys: (res.answers || []).map((a) => a.key || null), device: deviceId() }) });
      const d = await (await fetch('/api/dist?date=' + date, { cache: 'no-store' })).json();
      drawCurve(d.scores.length ? d.scores : [res.score], res.score);
      const below = d.scores.filter((x) => x < res.score).length;
      const pct = d.count > 1 ? Math.round(below / (d.count - 1) * 100) : 100;
      $('chartSum').innerHTML = `LEPIEJ NIŻ <b>${Math.min(100, pct)}%</b> DZISIEJSZYCH GRACZY <small>· graczy: ${num(d.count)} · średnio ${d.avg} pkt</small>`;
      return d;
    } catch {
      $('chartSum').textContent = 'Nie udało się pobrać wyników innych graczy. Spróbuj odświeżyć stronę.';
      return null;
    }
  }

  // ---------- wynik ----------
  const tileEmoji = (t) => (t == null ? '⬛' : TIERS[t].emoji);
  let dayShown = today();
  function untilMidnight() {
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const ms = mid - now, h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
    return [h, m, sec].map((x) => String(x).padStart(2, '0')).join(':');
  }
  function paintCountdown() {
    const t = untilMidnight();
    const done = !!store.get(KEY_DONE(today()));
    $('menuCountdown').innerHTML = done ? `NASTĘPNA SZYCHTA ZA <b>${t}</b>` : `DZISIEJSZA SZYCHTA ZOSTAJE JESZCZE <b>${t}</b>`;
    $('nextDaily').innerHTML = `NASTĘPNA SZYCHTA ZA <b>${t}</b>`;
    if (today() !== dayShown) { dayShown = today(); if (document.body.dataset.screen === 'menu') refreshMenu(); }
  }
  setInterval(paintCountdown, 1000);

  function diveLog(answers) {
    const W = 420, H = 210, x0 = 44, y0 = 16, ch = 170, step = (W - x0 - 20) / (ROUNDS - 1);
    const Y = (p) => y0 + p / 100 * ch;
    let s = '';
    [0, 25, 50, 75, 100].forEach((p) => { s += `<line x1="${x0 - 8}" x2="${W - 6}" y1="${Y(p)}" y2="${Y(p)}" class="dl-grid"/><text x="${x0 - 14}" y="${Y(p) + 4}" class="dl-ax" text-anchor="end">${p ? '−' + p * 10 : 0}</text>`; });
    answers.forEach((a, i) => {
      const x = x0 + i * step;
      s += `<text x="${x}" y="${H - 2}" class="dl-ax" text-anchor="middle">${i + 1}</text>`;
      if (a.tier == null) { s += `<circle cx="${x}" cy="${Y(0) + 2}" r="7" class="dl-miss"/>`; return; }
      const y = Y(a.pts);
      s += `<line x1="${x}" x2="${x}" y1="${Y(0)}" y2="${y - 7}" class="dl-stem"/>${oreRects(x - 7, y - 7, 14, TIERS[a.tier].color)}`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Głębokość każdej odpowiedzi">${s}</svg>`;
  }

  function allAnswers(cat) {
    const out = [];
    cat.tiers.forEach((list, t) => list.forEach((e) => out.push({ name: e.split('|')[0], tier: t, pts: TIERS[t].pts })));
    return out.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, 'pl'));
  }
  function answersPanel(li, cat) {
    const all = allAnswers(cat);
    const counts = TIERS.map((t) => all.filter((a) => a.tier === t.id).length);
    const panel = document.createElement('div');
    panel.className = 'all-ans';
    panel.innerHTML = `<div class="fchips"><button class="fchip on" data-t="all">Wszystkie ${all.length}</button>${TIERS.slice().reverse().map((t) => counts[t.id] ? `<button class="fchip" data-t="${t.id}" style="--c:${t.color}">${t.name} ${counts[t.id]}</button>` : '').join('')}</div>
      <input class="fsearch" placeholder="Szukaj w odpowiedziach…" aria-label="Szukaj w odpowiedziach"><ul class="flist"></ul><p class="fcount"></p>`;
    let filt = 'all';
    const paint = () => {
      const q = window.SZYB.normalize(panel.querySelector('.fsearch').value || '');
      const rows = all.filter((a) => (filt === 'all' || a.tier === +filt) && (!q || window.SZYB.normalize(a.name).includes(q)));
      panel.querySelector('.flist').innerHTML = rows.map((a) => `<li>${oreIcon(a.tier, 12)}<span>${esc(a.name)}</span><b style="color:${TIERS[a.tier].color}">+${a.pts}</b></li>`).join('');
      panel.querySelector('.fcount').textContent = `${rows.length} z ${all.length} odpowiedzi`;
    };
    panel.querySelectorAll('.fchip').forEach((b) => (b.onclick = () => { filt = b.dataset.t; panel.querySelectorAll('.fchip').forEach((x) => x.classList.toggle('on', x === b)); paint(); }));
    panel.querySelector('.fsearch').oninput = paint;
    paint();
    li.appendChild(panel);
  }

  function paintCatch(res, dist) {
    $('resultAnswers').innerHTML = (res.answers || []).map((a, i) => {
      const c = category(a.cat);
      const n = dist && dist.picks && dist.picks[i] && a.key ? Math.max(0, (dist.picks[i][a.key] || 1) - 1) : null;
      return `<li data-i="${i}"><button class="crow" type="button" aria-expanded="false">
        <span class="cn">${i + 1}</span>${oreIcon(a.tier, 18)}
        <span class="cmain"><small>${esc(c ? c.q.toUpperCase() : '')}</small><b>${a.tier == null ? '—' : esc(a.display)}</b>${n != null ? `<em>${n === 0 ? 'nikt inny tego nie wybrał' : `${num(n)} ${n === 1 ? 'inny gracz wybrał' : 'innych graczy wybrało'} to samo`}</em>` : ''}</span>
        <span class="cpts" style="color:${a.tier == null ? 'var(--muted)' : TIERS[a.tier].color}">${a.pts}</span><span class="cplus">+</span></button></li>`;
    }).join('');
    $('resultAnswers').querySelectorAll('li').forEach((li) => {
      const btn = li.querySelector('.crow');
      btn.onclick = () => {
        const open = li.classList.toggle('open');
        btn.setAttribute('aria-expanded', open);
        if (open && !li.querySelector('.all-ans')) answersPanel(li, category(res.answers[+li.dataset.i].cat));
      };
    });
  }

  function showResult(date, res, fresh) {
    stopTimer();
    game.phase = 'idle';
    bg.set(res.score * METERS_PER_POINT, !fresh);
    $('resultKicker').textContent = `SZYCHTA #${diveNo(date)} ZALICZONA`;
    FX.countUp($('resultPts'), res.score, (v) => String(v), fresh ? 1200 : 400);
    $('resultDepth').textContent = `−${meters(res.score)}`;
    const answers = res.answers || [];
    $('diveLog').innerHTML = diveLog(answers);
    $('bearing').innerHTML = BEARING.map(([a, b, t, txt]) => {
      const me = res.score >= a && res.score <= b;
      return `<div class="brow${me ? ' me' : ''}">${oreIcon(t, 16)}<span class="br" style="color:${TIERS[t].color}">${a}–${b}</span><span>${txt}</span></div>`;
    }).join('');
    const s = streaks(), all = allDailies();
    const best = Math.max(0, ...all.map((x) => x.score));
    const avg = all.length ? Math.round(all.reduce((a, x) => a + x.score, 0) / all.length) : 0;
    $('resultStats').innerHTML = `SERIA <b>${s.cur}</b> · ROZEGRANE <b>${all.length}</b> · ŚREDNIA <b>${avg}</b> · REKORD <b>${best}</b>`;
    const shareText = `Szyb #${diveNo(date)} · ${res.score} pkt (−${meters(res.score)})\n${res.tiles.map(tileEmoji).join('')}\nszyb.app`;
    $('btnShare').onclick = () => copy(shareText);
    $('btnShare2').onclick = () => {
      if (navigator.share) navigator.share({ text: shareText }).catch(() => {});
      else copy(shareText);
    };
    $('btnStats2').onclick = showStats;
    $('btnMenu').onclick = goMenu;
    if (fresh) FX.Sound.end();
    paintCatch(res, null);
    $('curve').innerHTML = ''; $('curveAxis').innerHTML = ''; $('chartSum').textContent = 'Wczytuję wyniki innych graczy…';
    loadChart(date, res).then((d) => { if (d) paintCatch(res, d); });
    paintCountdown();
    show('result');
  }
  const days = (n) => n + (n === 1 ? ' dzień' : ' dni');
  const statTile = (label, val) => `<div class="stat"><b>${val}</b><span>${label}</span></div>`;

  // ---------- statystyki ----------
  function showStats() {
    const all = allDailies(), s = streaks();
    const avg = all.length ? Math.round(all.reduce((a, x) => a + x.score, 0) / all.length) : 0;
    const best = Math.max(0, ...all.map((x) => x.score));
    $('statTiles').innerHTML = statTile('Rozegrane', all.length) + statTile('Seria', days(s.cur)) + statTile('Najdłuższa seria', days(s.best)) +
      statTile('Średnio', `${avg} pkt`) + statTile('Rekord', `${best} pkt`);
    const counts = new Array(TIERS.length).fill(0); let miss = 0;
    for (const x of all) for (const t of x.tiles || []) { if (t == null) miss++; else counts[t]++; }
    const max = Math.max(1, miss, ...counts);
    const row = (label, n, color) => `<div class="dist-row"><span class="dist-label">${label}</span><span class="dist-bar"><i style="width:${Math.max(2, n / max * 100)}%;background:${color}"></i></span><span class="dist-n">${n}</span></div>`;
    $('statDist').innerHTML = TIERS.map((t, i) => row(t.name, counts[i], t.color)).reverse().join('') + row('Brak', miss, '#3a3358') +
      (all.length ? '' : '<p class="hint">Zagraj pierwszą szychtę, a tu pojawią się Twoje liczby.</p>');
    show('stats');
  }

  // ---------- ustawienia ----------
  const muteBtn = $('btnMute');
  const paintMute = () => { muteBtn.textContent = FX.Sound.muted ? 'Wyłączone' : 'Włączone'; $('btnSound').classList.toggle('off', FX.Sound.muted); };
  paintMute();
  muteBtn.onclick = () => { FX.Sound.toggle(); paintMute(); FX.Sound.click(); };
  $('btnSound').onclick = () => { FX.Sound.toggle(); paintMute(); FX.Sound.click(); toast(FX.Sound.muted ? 'Dźwięk wyłączony' : 'Dźwięk włączony'); };

  // ---------- nawigacja ----------
  function goMenu() { stopTimer(); clearInterval(countIv); game.phase = 'idle'; refreshMenu(); paintCountdown(); show('menu'); }
  $('logo').onclick = () => goMenu();
  $('logo').onkeydown = (e) => { if (e.key === 'Enter') goMenu(); };
  document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = goMenu));
  $('btnDaily').onclick = startDaily;
  $('btnStats').onclick = showStats;
  $('btnHow').onclick = () => show('how');
  $('btnSettings').onclick = () => show('settings');

  function copy(text) {
    const fallback = () => toast('Nie udało się skopiować. Zaznacz wynik ręcznie.');
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Skopiowano wynik do schowka'), fallback);
      else fallback();
    } catch { fallback(); }
  }

  // ---------- propozycje pytań ----------
  $('suggestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('sgMsg'), text = $('sgText').value.trim();
    if (text.length < 5) { msg.textContent = 'Wpisz pytanie (co najmniej 5 znaków).'; return; }
    if (!(await serverUp())) { msg.textContent = 'Wysyłanie propozycji działa w wersji z serwerem (node server.js).'; return; }
    $('sgSend').disabled = true; msg.textContent = 'Wysyłam…';
    try {
      let t = null; try { t = localStorage.getItem('szyb-token'); } catch {}
      const r = await fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
        body: JSON.stringify({ text, answers: $('sgAnswers').value.trim(), device: deviceId() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Nie udało się wysłać.');
      $('sgText').value = ''; $('sgAnswers').value = '';
      msg.textContent = 'Dzięki! Pytanie trafiło do autora gry.';
    } catch (err) { msg.textContent = err.message || 'Nie udało się wysłać. Spróbuj jeszcze raz.'; }
    $('sgSend').disabled = false;
  });

  // pytania przyjęte z propozycji (tylko z serwerem); dzienny zestaw losuje się dopiero po ich wczytaniu
  const customReady = (async () => {
    if (!location.protocol.startsWith('http')) return;
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch('/api/categories', { cache: 'no-store', signal: ctl.signal }); clearTimeout(tm);
      if (r.ok) { const d = await r.json(); window.SZYB.addCategories(d.categories); if (d.added && window.SZYB.addAnswers) window.SZYB.addAnswers(d.added); }
    } catch {}
  })();

  refreshMenu();
  paintCountdown();
  show('menu');
})();
