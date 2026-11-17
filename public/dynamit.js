// Szyb · Dynamit – klient trybu wieloosobowego (/multi i /multi/KOD).
(() => {
  const FX = window.SZYB_FX;
  const Sound = FX.Sound;
  const TIERS = window.SZYB_DATA ? window.SZYB_DATA.TIERS : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const sget = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
  const sset = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} };
  const token = () => { try { return localStorage.getItem('szyb-token'); } catch { return null; } };
  function deviceId() {
    let id = store.get('szyb-device');
    if (!id || !/^[a-z0-9]{8,40}$/.test(id)) { id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join(''); store.set('szyb-device', id); }
    return id;
  }
  async function api(path, body) {
    const t = token();
    const res = await fetch('/api/m/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Błąd serwera');
    return data;
  }
  let toastT = null;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }
  const tierInfo = (t) => {
    const T = (window.SZYB && window.SZYB.DATA && window.SZYB.DATA.TIERS) || TIERS;
    return T && T[t] ? T[t] : { name: '', color: '#f6f1d8' };
  };

  // ---------- grafika pixel-art ----------
  function spriteFromRows(rows, pal) {
    const h = rows.length, w = rows[0].length;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
    return c.toDataURL();
  }
  // górnicy 16×20 px
  const AV = {
    gornik: { name: 'GÓRNIK', days: 0, pal: {"K": "#1a1430", "Y": "#f2c230", "y": "#b8860f", "h": "#fff3a0", "L": "#fff6c0", "l": "#9fd8ff", "S": "#f2c09a", "s": "#d08e66", "E": "#1a1430", "R": "#ff8f8f", "M": "#6a4426", "G": "#5f6380", "g": "#454964", "B": "#3d72d6", "b": "#2a4f9a", "O": "#ff9f1a", "N": "#4a3424", "n": "#2e2016", "P": "#b9bdcc", "H": "#8a5a32"}, rows: [
      '.....KKKKKK.....', '...KKYYLLYYKK...', '..KYhYKllKYYyK..', '..KYhYYKKYYYyK..', '.KYYYYYYYYYYYyK.', 'KKyyyyyyyyyyyyKK', '.KKSSSSSSSSSSKK.', '..KSSESSSSESSK..', '..KSSESSSSESSK..', '..KSRSSMMSSRSK..', '..KsSSMSSMSSsK..', '...KKsSSSSsKK...', '..KGGKBBBBKGGK..', '.KGgGBBOOBBGgGK.', '.KGgKBBBBBBKgGK.', '.KSSKBBBBBBKSSK.', '..KKKBBbbBBKKK..', '....KBBKKBBK....', '...KNNnKKnNNK...', '...KKKKKKKKKK...'] },
    sztygar: { name: 'SZTYGAR', days: 5, pal: {"K": "#1a1430", "C": "#2b2838", "c": "#46405e", "X": "#14111e", "P": "#ffffff", "p": "#d23a3a", "G": "#f2c230", "S": "#f2c09a", "s": "#d08e66", "E": "#1a1430", "R": "#ff8f8f", "M": "#e8e2d0", "N": "#20202a"}, rows: [
      '......KPPK......', '.....KPppPK.....', '.....KPPPPK.....', '....KXXXXXXK....', '...KXcXGGXXXK...', '...KXXXXXXXXK...', '..KKKKKKKKKKKK..', '..KSSSSSSSSSSK..', '..KSSESSSSESSK..', '..KSRSSSSSSRSK..', '..KSMMMMMMMMSK..', '...KsSSMMSSsK...', '..KCCKKCCKKCCK..', '.KCcCCGCCGCCcCK.', '.KCcCCCCCCCCcCK.', '.KSSKCGCCGCKSSK.', '..KKKCCCCCCKKK..', '....KCCKKCCK....', '...KNNNKKNNNK...', '...KKKKKKKKKK...'] },
    kret: { name: 'KRET', days: 14, pal: {"K": "#1a1430", "Y": "#f2c230", "y": "#b8860f", "L": "#fff6c0", "D": "#4a3830", "d": "#6b5448", "e": "#2e221c", "P": "#ff8aa6", "p": "#c95a78", "W": "#f0e0d0", "E": "#0a0608"}, rows: [
      '.....KKKKKK.....', '...KKYYLLYYKK...', '..KYYYKLLKYYyK..', '.KyyyyyyyyyyyyK.', 'KKKKKKKKKKKKKKKK', '.KDDDDDDDDDDDDK.', '.KDDEEDDDDEEDDK.', '.KDDDDDDDDDDDDK.', '.KDdDDDPPDDDdDK.', '..KDdDDppDDdDK..', '..KDDDWWWWDDDK..', '...KKDDDDDDKK...', '..KDDKddddKDDK..', '.KDdDdddddddDdK.', 'KWWDKddddddKDWWK', 'KWKWKddddddKWKWK', '.KK.KddddddK.KK.', '....KDDKKDDK....', '...KPPPKKPPPK...', '...KKKKKKKKKK...'] },
    strzalowy: { name: 'STRZAŁOWY', days: 30, pal: {"K": "#1a1430", "R": "#e0402f", "r": "#9a2525", "h": "#ff8a70", "G": "#34d8c2", "g": "#1f8f80", "S": "#f2c09a", "s": "#d08e66", "E": "#1a1430", "V": "#ff7a1a", "v": "#c45510", "T": "#f6f1d8", "N": "#3a3a44", "D": "#d8352a", "F": "#f6e7b0"}, rows: [
      '.....KKKKKK.....', '...KKRRRRRRKK...', '..KRhRRRRRRRrK..', '.KRhRRRRRRRRRrK.', 'KKrrrrrrrrrrrrKK', '.KKGGGGKKGGGGKK.', '..KGgGGKKGgGGK..', '..KKKKSSSSKKKK..', '..KSSSSSSSSSSK..', '..KSSSSKKSSSSK..', '..KsSSSSSSSSsK..', '...KKsSSSSsKK...', '..KVVKVTTVKVVK..', '.KVvVVVTTVVVvVK.', '.KVTTTTTTTTTTVK.', '.KSSKVVTTVVKSSK.', '..KKKVVVVVVKKK..', '....KNNKKNNK....', '...KNNNKKNNNK...', '...KKKKKKKKKK...'] },
    skarbnik: { name: 'SKARBNIK', days: 45, pal: {"K": "#1a1430", "H": "#2e5a4a", "h": "#4a8a70", "C": "#23463a", "c": "#336b56", "F": "#cfe8d8", "E": "#7dff6b", "B": "#eef4f0", "b": "#b8c8c8", "L": "#ffd52e", "l": "#ff9f1a", "M": "#6a5a3a"}, rows: [
      '......KKKK......', '....KKHHHHKK....', '...KHHhhhHHHK...', '..KHHhHHHHHHHK..', '..KHHFFFFFFHHK..', '..KHFFFFFFFFHK..', '..KHFEFFFFEFHK..', '..KHFFFFFFFFHK..', '..KHBBFFFFBBHK..', '..KCBBBBBBBBCK..', '..KCCBBBBBBCCK..', '.KCCCbBBBBbCCK..', '.KCcCCBBBBCCcCK.', 'KCcCCCCbbCCCCcCK', 'KCcCCCCCCCCCKMK.', 'KFFKCCCCCCCKLLLK', '.KK.KCCCCCCKlLlK', '....KCCCCCCKLLLK', '...KCCCKKCCCKK..', '...KKKKKKKKKK...'] },
  };
  const AV_IDS = Object.keys(AV);
  for (const id of AV_IDS) AV[id].src = spriteFromRows(AV[id].rows, AV[id].pal);

  // dynamit z buzią: stan 'sleep' | 'lit' | 'hot', klatka 0/1 (iskra)
  function dynSprite(state, frame) {
    const c = document.createElement('canvas'); c.width = 24; c.height = 26;
    const g = c.getContext('2d');
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    for (let i = 0; i < 3; i++) {
      const x0 = 4 + i * 5;
      px(x0, 7, 5, 17, state === 'hot' ? '#d8352a' : '#c8322a');
      px(x0, 8, 1, 15, '#ef6a4e'); px(x0 + 4, 8, 1, 15, '#8e1d1c');
      px(x0, 7, 5, 1, '#f0d2a8'); px(x0, 23, 5, 1, '#6e1515');
    }
    px(4, 11, 15, 2, '#5b3b22'); px(4, 11, 15, 1, '#7d5532');
    px(4, 20, 15, 2, '#5b3b22'); px(4, 20, 15, 1, '#7d5532');
    // fuse
    [[11, 6], [11, 5], [12, 4], [12, 3], [13, 2]].forEach(([x, y]) => px(x, y, 1, 1, '#3a3530'));
    if (state === 'lit' || state === 'hot') {
      const pts = frame ? [[13, 0, '#fff'], [14, 1, '#ffd52e'], [12, 1, '#ff9f1a'], [15, 0, '#ff9f1a'], [13, 1, '#ffd52e']] : [[13, 1, '#fff'], [12, 0, '#ffd52e'], [14, 0, '#ff9f1a'], [14, 2, '#ffd52e'], [13, 0, '#ffd52e']];
      for (const [x, y, col] of pts) px(x, y, 1, 1, col);
    }
    // buzia
    if (state === 'sleep') { px(7, 16, 2, 1, '#2a0c0c'); px(14, 16, 2, 1, '#2a0c0c'); px(10, 18, 3, 1, '#2a0c0c'); }
    else if (state === 'wake') {
      // obudzony: wielkie oczy patrzą w bok, buzia „o”
      px(6, 13, 3, 4, '#fff'); px(14, 13, 3, 4, '#fff');
      const dx = frame ? 1 : 0; px(7 + dx, 14, 1, 2, '#120808'); px(15 + dx, 14, 1, 2, '#120808');
      px(11, 18, 2, 2, '#2a0c0c');
      px(6, 12, 3, 1, '#7a1a16'); px(14, 12, 3, 1, '#7a1a16');   // uniesione brwi
    } else if (state === 'blink') { px(6, 15, 3, 1, '#2a0c0c'); px(14, 15, 3, 1, '#2a0c0c'); px(10, 18, 1, 1, '#2a0c0c'); px(11, 19, 1, 1, '#2a0c0c'); px(12, 18, 1, 1, '#2a0c0c'); }
    else if (state === 'hot') { px(7, 14, 2, 3, '#fff'); px(14, 14, 2, 3, '#fff'); px(8, 15, 1, 1, '#120808'); px(14, 15, 1, 1, '#120808'); px(11, 17, 2, 2, '#2a0c0c'); }
    else { px(7, 15, 2, 2, '#fff'); px(14, 15, 2, 2, '#fff'); px(8, 16, 1, 1, '#120808'); px(15, 16, 1, 1, '#120808'); px(10, 18, 1, 1, '#2a0c0c'); px(11, 19, 1, 1, '#2a0c0c'); px(12, 18, 1, 1, '#2a0c0c'); }
    px(6, 18, 1, 1, '#ff8a8a'); px(17, 18, 1, 1, '#ff8a8a');
    return c.toDataURL();
  }
  const DYN = { sleep: dynSprite('sleep', 0), lit: [dynSprite('lit', 0), dynSprite('lit', 1)], hot: [dynSprite('hot', 0), dynSprite('hot', 1)] };
  DYN.wake = [dynSprite('wake', 0), dynSprite('wake', 1)]; DYN.blink = dynSprite('blink', 0);
  // dynamit w menu: śpi, a po kliknięciu budzi się i rozgląda; po kilku szybkich kliknięciach zapala mu się lont
  (function idleDynamite() {
    const el = $('idleDyn'), set = (src) => { el.style.backgroundImage = `url(${src})`; };
    set(DYN.sleep);
    let timers = [], spin = 0, clicks = 0, clickT = 0, angry = false;
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    el.addEventListener('click', () => {
      timers.forEach(clearTimeout); timers = []; clearInterval(spin);
      const now = performance.now();
      clicks = now - clickT < 700 ? clicks + 1 : 1; clickT = now;
      el.classList.remove('poke'); void el.offsetWidth; el.classList.add('poke');
      el.classList.add('awake');
      if (clicks >= 5 || angry) {
        // „nie budź mnie!” – lont się pali, dynamit się trzęsie
        angry = true; el.classList.add('fuming'); Sound.tick();
        let f = 0; spin = setInterval(() => set(DYN.hot[f++ % 2]), 140);
        later(2200, () => { clearInterval(spin); angry = false; clicks = 0; el.classList.remove('fuming'); set(DYN.blink); });
        later(2600, () => set(DYN.wake[0]));
        later(4200, () => { set(DYN.sleep); el.classList.remove('awake'); });
        return;
      }
      Sound.click();
      set(DYN.wake[0]);
      later(500, () => set(DYN.wake[1]));
      later(1000, () => set(DYN.wake[0]));
      later(1500, () => set(DYN.blink));
      later(1650, () => set(DYN.wake[0]));
      later(2600, () => set(DYN.blink));
      later(3000, () => { set(DYN.sleep); el.classList.remove('awake'); });
    });
  })();

  // ---------- tło: komora pod ziemią ----------
  const cave = $('cave'), cg = cave.getContext('2d');
  let caveS = 4, caveW = 0, caveH = 0, caveBase = null;
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  let caveRoom = false, gems = [];
  function drawCave() {
    caveRoom = !$('room').hidden;
    caveS = Math.max(3, Math.round(innerHeight / 200));
    caveW = Math.ceil(innerWidth / caveS); caveH = Math.ceil(innerHeight / caveS);
    cave.width = caveW; cave.height = caveH;
    const img = cg.createImageData(caveW, caveH), d = img.data;
    const C = 11;                                    // wielkość kamienia (w pikselach płótna)
    const pt = (gx, gy) => [gx * C + 2 + hash(gx, gy * 3 + 1) * (C - 4), gy * C + 2 + hash(gx * 5 + 2, gy) * (C - 4)];
    const floorY = caveRoom ? caveH : Math.round(caveH * 0.84);
    const cx = caveW / 2, cy = caveH * 0.6, rx = caveW * 0.44, ry = caveH * 0.33;
    cartRail = caveRoom ? 0 : floorY + Math.round((caveH - floorY) * 0.45);
    gems = [];
    for (let y = 0; y < caveH; y++) for (let x = 0; x < caveW; x++) {
      let r, g, b;
      const k = 9;   // podłoga pokoju to osobny element w arenie (zawsze pod graczami)
      if (caveRoom && k < 1.06) {
        // klepisko komory: gładkie, oświetlone od środka, z obwódką z kamieni
        if (k >= 1) {
          const a = Math.atan2((y - cy) / ry, (x - cx) / rx), seg = Math.floor((a + Math.PI) * 18);
          const n = hash(seg, 3), gap = Math.abs(((a + Math.PI) * 18) % 1 - 0.5) > 0.44;
          r = 70 + n * 26; g = 62 + n * 20; b = 76 + n * 22;
          if (k < 1.015 || gap) { r = 18; g = 14; b = 24; }
          else if (k < 1.03) { r += 22; g += 20; b += 20; }
        } else {
          const n = hash(x, y), m = hash(x >> 2, y >> 2);
          const light = 1 - k * 0.55;
          r = (46 + n * 6 + m * 8) * light + 14; g = (38 + n * 5 + m * 6) * light + 10; b = (46 + n * 6 + m * 7) * light + 14;
          if (n > 0.992) { r += 18; g += 15; b += 12; }
        }
      } else if (!caveRoom && y >= floorY) {
        // spąg: żwir, podkłady i tory
        const n = hash(x, y);
        r = 40 + n * 14; g = 33 + n * 11; b = 40 + n * 12;
        const ry0 = floorY + Math.round((caveH - floorY) * 0.45);
        if (y >= ry0 - 1 && y <= ry0 + 4 && (x % 14) < 8) { r = 74; g = 50; b = 34; if (y === ry0 - 1) { r = 96; g = 66; b = 44; } }
        if (y === ry0 || y === ry0 + 3) { r = 150; g = 150; b = 165; }
        if (y === ry0 + 1 || y === ry0 + 4) { r = 70; g = 70; b = 84; }
      } else {
        // ściana z nieregularnych kamieni
        const gx = Math.floor(x / C), gy = Math.floor(y / C);
        let d1 = 1e9, d2 = 1e9, best = null;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const [px, py] = pt(gx + i, gy + j), dd = (x - px) ** 2 + (y - py) ** 2;
          if (dd < d1) { d2 = d1; d1 = dd; best = [gx + i, gy + j, px, py]; } else if (dd < d2) d2 = dd;
        }
        const edge = Math.sqrt(d2) - Math.sqrt(d1);
        const n = hash(best[0] * 13 + 7, best[1] * 17 + 3);
        const warm = hash(best[0] + 99, best[1] * 2);
        r = 44 + n * 22 + warm * 8; g = 36 + n * 16; b = 54 + n * 20 - warm * 6;
        // światło z lewej góry na każdym kamieniu
        const lx = (best[2] - x) + (best[3] - y);
        r += lx * 1.6; g += lx * 1.4; b += lx * 1.6;
        if (edge < 1.1) { r = 16; g = 12; b = 22; }
        else if (edge < 2) { r *= .7; g *= .7; b *= .75; }
        else if (hash(x * 7 + 11, y * 13 + 5) > 0.9985 && n > 0.6) { gems.push([x, y, warm > .5 ? 0 : 1]); }
        // głębia: ciemniej przy górze i bokach
        const vx = Math.abs(x - caveW / 2) / (caveW / 2), vy = 1 - y / caveH;
        const dk = Math.min(.7, vx * vx * .45 + vy * vy * .35); r *= 1 - dk; g *= 1 - dk; b *= 1 - dk;
      }
      const i = (y * caveW + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    // obudowa chodnika: stojaki, stropnice i zastrzały
    const top = Math.round(caveH * (caveRoom ? 0.1 : 0.08)), bot = caveRoom ? Math.round(caveH * 0.72) : floorY;
    const post = (x) => {
      cg.fillStyle = '#3e2818'; cg.fillRect(x, top, 5, bot - top);
      cg.fillStyle = '#6b4630'; cg.fillRect(x + 1, top, 1, bot - top);
      cg.fillStyle = '#24160d'; cg.fillRect(x + 4, top, 1, bot - top);
      for (let yy = top + 6; yy < bot; yy += 9) { cg.fillStyle = '#2e1d12'; cg.fillRect(x + 2, yy, 1, 3); }
    };
    const xs = caveRoom ? [Math.round(caveW * 0.04), Math.round(caveW * 0.17), Math.round(caveW * 0.8), Math.round(caveW * 0.93)]
                        : [Math.round(caveW * 0.05), Math.round(caveW * 0.22), Math.round(caveW * 0.75), Math.round(caveW * 0.92)];
    lamps = [];
    if (caveRoom) { caveBase = cg.getImageData(0, 0, caveW, caveH); return; }   // w pokoju bez stelaży i lamp – nic nie wchodzi na stół
    xs.forEach(post);
    for (const [a, b] of [[xs[0], xs[1]], [xs[2], xs[3]]]) {
      cg.fillStyle = '#4e3220'; cg.fillRect(a - 3, top - 1, b - a + 11, 6);
      cg.fillStyle = '#80583a'; cg.fillRect(a - 3, top - 1, b - a + 11, 1);
      cg.fillStyle = '#24160d'; cg.fillRect(a - 3, top + 4, b - a + 11, 1);
      // zastrzały pod stropnicą
      for (let t = 0; t < 7; t++) { cg.fillStyle = '#4a3020'; cg.fillRect(a + 5 + t, top + 5 + t, 2, 1); cg.fillRect(b - 2 - t, top + 5 + t, 2, 1); }
      lamps.push([(a + b) / 2 + 2, top + 5]);
    }
    caveBase = cg.getImageData(0, 0, caveW, caveH);
  }
  let lamps = [];
  // wagonik z urobkiem jeździ po torach w menu (od lewej do prawej, za ekranem wraca na początek)
  let cartRail = 0;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function drawCart(t) {
    const ry0 = cartRail, span = caveW + 60;
    const run = calm ? 0 : t / 1000 * 16;                      // ok. 16 pikseli płótna na sekundę
    const wx = calm ? Math.round(caveW * 0.62) : Math.round((caveW * 0.62 + run) % span) - 30;
    const bob = !calm && (wx % 14 + 14) % 14 < 2 ? 1 : 0;           // podskok na łączeniu szyn
    const y = ry0 - bob;
    cg.fillStyle = '#1c1626'; cg.fillRect(wx - 1, y - 15, 28, 13);
    cg.fillStyle = '#5a5470'; cg.fillRect(wx, y - 14, 26, 11);
    cg.fillStyle = '#77708f'; cg.fillRect(wx, y - 14, 26, 2);
    cg.fillStyle = '#3d3852'; for (let k = 4; k < 26; k += 7) cg.fillRect(wx + k, y - 11, 1, 8);
    cg.fillStyle = '#2b2a2e'; cg.fillRect(wx + 1, y - 18, 24, 4);
    cg.fillStyle = '#c9a25c'; for (let k = 0; k < 7; k++) cg.fillRect(wx + 3 + k * 3, y - 19 + (k % 2), 2, 2);
    // koła z obracającą się szprychą
    cg.fillStyle = '#121016'; cg.fillRect(wx + 3, ry0 - 3, 5, 4); cg.fillRect(wx + 18, ry0 - 3, 5, 4);
    const sp = [[1, 0], [2, 1], [1, 2], [0, 1]][Math.floor(run / 1.6) % 4];
    cg.fillStyle = '#8a86a0'; cg.fillRect(wx + 4 + sp[0], ry0 - 2 + sp[1], 1, 1); cg.fillRect(wx + 19 + sp[0], ry0 - 2 + sp[1], 1, 1);
    // iskry spod kół
    if (!calm && hash(Math.floor(t / 90), 7) > 0.8) { cg.fillStyle = '#ffd98a'; cg.fillRect(wx + 1, ry0 - 1, 1, 1); cg.fillRect(wx - 1, ry0 - 2, 1, 1); }
  }
  function caveFrame(t) {
    if (!caveBase) return;
    cg.putImageData(caveBase, 0, 0);
    for (const [x, y] of lamps) {
      const fl = 0.85 + Math.sin(t / 180 + x) * 0.08 + (hash(Math.floor(t / 120), x) - 0.5) * 0.1;
      const grd = cg.createRadialGradient(x, y + 6, 1, x, y + 6, 70 * fl);
      grd.addColorStop(0, 'rgba(255,190,90,.34)'); grd.addColorStop(.5, 'rgba(255,150,60,.10)'); grd.addColorStop(1, 'rgba(255,150,60,0)');
      cg.fillStyle = grd; cg.fillRect(x - 75, y - 70, 150, 150);
      cg.fillStyle = '#2a2238'; cg.fillRect(Math.round(x), Math.round(y), 1, 3);
      cg.fillStyle = '#ffd98a'; cg.fillRect(Math.round(x) - 1, Math.round(y) + 3, 3, 4);
      cg.fillStyle = '#fff6c0'; cg.fillRect(Math.round(x), Math.round(y) + 4, 1, 2);
    }
    // migoczące żyłki rudy
    for (const [x, y, c] of gems) {
      const tw = hash(x + Math.floor(t / 400), y) > 0.75;
      cg.fillStyle = c ? (tw ? '#bff6ff' : '#5fc8dc') : (tw ? '#fff1a8' : '#d9b04a');
      cg.fillRect(x, y, 1, 1);
      if (tw) { cg.globalAlpha = .45; cg.fillRect(x - 1, y, 3, 1); cg.fillRect(x, y - 1, 1, 3); cg.globalAlpha = 1; }
    }
    if (cartRail) drawCart(t);
  }
  drawCave();
  addEventListener('resize', () => { drawCave(); if (S) layoutSeats(); });
  let lastCave = 0;
  function loop(t) {
    // w menu częściej (płynna jazda wagonika), w pokoju wystarczy migotanie lamp i rudy
    if (t - lastCave > (cartRail && !calm ? 33 : 140)) { caveFrame(t); lastCave = t; }
    animDyn(t);
    requestAnimationFrame(loop);
  }

  // ---------- dźwięki dodatkowe ----------
  let ac = null;
  function boomSound() {
    if (Sound.muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const len = ac.sampleRate * 0.9, buf = ac.createBuffer(1, len, ac.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, ac.currentTime); f.frequency.exponentialRampToValueAtTime(120, ac.currentTime + 0.8);
      const gn = ac.createGain(); gn.gain.value = 0.5;
      src.connect(f).connect(gn).connect(ac.destination); src.start();
    } catch {}
  }

  // ---------- strona główna ----------
  const st = {
    name: store.get('szyb-name') || '',
    avatar: store.get('szyb-avatar') || 'gornik',
    size: store.get('szyb-msize') || '3',
    hostPublic: store.get('szyb-mpublic') !== false,
  };
  function bestStreak() {
    const days = new Set();
    try { for (const k of Object.keys(localStorage)) if (/^szyb-daily-\d{4}-\d{2}-\d{2}$/.test(k)) days.add(k.slice(11)); } catch {}
    let best = 0, run = 0, prev = null;
    for (const day of [...days].sort()) {
      const t = new Date(day + 'T12:00:00');
      run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
      best = Math.max(best, run); prev = t;
    }
    return best;
  }
  const streak = bestStreak();
  const unlocked = (id) => streak >= AV[id].days;
  if (!AV[st.avatar] || !unlocked(st.avatar)) st.avatar = 'gornik';

  function renderAvatars() {
    $('avatars').innerHTML = AV_IDS.map((id) => {
      const a = AV[id], lock = !unlocked(id);
      return `<button class="av${id === st.avatar ? ' on' : ''}${lock ? ' locked' : ''}" data-av="${id}" title="${lock ? `Odblokujesz serią ${a.days} dni w szychcie dnia` : a.name}"><img src="${a.src}" alt=""><b>${a.name}</b>${a.days ? `<small>${lock ? '🔒 ' : ''}${a.days} dni</small>` : '<small>&nbsp;</small>'}</button>`;
    }).join('');
  }
  $('avatars').addEventListener('click', (e) => {
    const b = e.target.closest('.av'); if (!b) return;
    const id = b.dataset.av;
    if (!unlocked(id)) { toast(`${AV[id].name}: odblokujesz serią ${AV[id].days} dni w szychcie dnia (masz ${streak}).`); return; }
    st.avatar = id; store.set('szyb-avatar', id); renderAvatars(); Sound.click();
  });
  const CAPS = { '1v1': 'jeden na jednego', '3': 'trzech przy stole', '4-6': 'od 4 do 6 przy stole', '8-10': 'od 7 do 10 przy stole' };
  function renderSizes() {
    for (const b of $('sizes').children) b.classList.toggle('on', b.dataset.size === st.size);
    $('sizeCap').textContent = CAPS[st.size];
  }
  $('sizes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.size = b.dataset.size; store.set('szyb-msize', st.size); renderSizes(); Sound.click(); });
  function renderVis() {
    $('btnVis').textContent = st.hostPublic ? 'PUBLICZNY · NA LIŚCIE' : 'PRYWATNY · TYLKO KOD';
    $('btnVis').classList.toggle('on', st.hostPublic);
    $('visCap').textContent = st.hostPublic ? 'każdy może dołączyć z listy' : 'tylko z kodem albo linkiem';
  }
  $('btnVis').onclick = () => { st.hostPublic = !st.hostPublic; store.set('szyb-mpublic', st.hostPublic); renderVis(); Sound.click(); };
  $('nameIn').value = st.name;
  $('nameIn').addEventListener('input', () => { st.name = $('nameIn').value.trim(); store.set('szyb-name', st.name); });
  (async () => {
    if (st.name || !token()) return;
    try {
      const r = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token() } });
      const j = await r.json();
      if (j.user && !st.name) { st.name = j.user.name.slice(0, 16); $('nameIn').value = st.name; store.set('szyb-name', st.name); }
    } catch {}
  })();
  async function loadRating() {
    try {
      const r = await api('me', { device: deviceId() });
      $('myRating').innerHTML = `RANKING <b>${r.rating}</b> · ${r.games} ${r.games === 1 ? 'gra' : r.games % 10 >= 2 && r.games % 10 <= 4 && (r.games % 100 < 10 || r.games % 100 >= 20) ? 'gry' : 'gier'} rankingowych`;
    } catch {}
  }
  const me = () => ({ name: st.name || $('nameIn').placeholder, avatar: st.avatar, device: deviceId() });
  function needName() {
    if (st.name) return false;
    $('nameIn').focus(); toast('Wpisz swoje imię.'); return true;
  }
  async function go(path, body, btn) {
    if (needName()) return;
    if (btn) btn.disabled = true;
    try {
      const r = await api(path, { ...me(), ...body });
      sset('szyb-m-pid-' + r.code, r.pid);
      history.pushState({}, '', '/multi/' + r.code);
      enterRoom(r.code, r.pid);
    } catch (e) { toast(e.message); } finally { if (btn) btn.disabled = false; }
  }
  $('btnQuick').onclick = () => go('quick', { size: st.size, rated: false }, $('btnQuick'));
  $('btnRated').onclick = () => go('quick', { size: st.size, rated: true }, $('btnRated'));
  $('btnHost').onclick = () => go('create', { isPublic: st.hostPublic }, $('btnHost'));
  $('codeIn').addEventListener('input', () => { $('codeIn').value = $('codeIn').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('joinForm').onsubmit = (e) => {
    e.preventDefault();
    const code = $('codeIn').value;
    if (code.length !== 4) { toast('Kod ma 4 litery.'); return; }
    go('join', { code });
  };
  $('btnHow').onclick = () => { $('howModal').hidden = false; };
  $('howClose').onclick = () => { $('howModal').hidden = true; };
  $('howModal').onclick = (e) => { if (e.target === $('howModal')) $('howModal').hidden = true; };

  let roomsT = null;
  async function loadRooms() {
    clearTimeout(roomsT);
    if ($('home').hidden) return;
    try {
      const r = await api('rooms');
      $('roomsCount').textContent = r.rooms.length ? `POKAZUJE ${r.rooms.length}` : '';
      $('roomList').innerHTML = r.rooms.length ? r.rooms.map((x) => {
        const full = x.n >= x.max;
        const label = x.kind === 'rated' ? '<span class="rk">RANKING · </span>' : '';
        return `<li class="${full ? 'full' : ''}"><span class="rc">${esc(x.code)}</span><span class="rh"><b>${esc(x.host)}</b><small class="${x.playing ? 'play' : ''}">${label}${x.n}/${x.max} · ${x.playing ? 'GRAJĄ' : 'W POCZEKALNI'}</small></span>${full ? '<button disabled>PEŁNY</button>' : `<button data-code="${esc(x.code)}">DOŁĄCZ ▸</button>`}</li>`;
      }).join('') : '<li class="empty">Nikt teraz nie gra w publicznym pokoju. Załóż własny albo kliknij Szybką grę i poczekaj na innych.</li>';
    } catch {}
    roomsT = setTimeout(loadRooms, 4000);
  }
  $('roomList').addEventListener('click', (e) => { const b = e.target.closest('button[data-code]'); if (b) go('join', { code: b.dataset.code }); });

  $('btnSound').classList.toggle('off', Sound.muted);
  $('btnSound').onclick = () => { $('btnSound').classList.toggle('off', Sound.toggle()); };

  function showHome() {
    leaveRoomLocal();
    document.title = 'Szyb – Dynamit, gra słowna ze znajomymi';
    $('room').hidden = true; $('home').hidden = false; $('btnLeave').hidden = true; drawCave();
    renderAvatars(); renderSizes(); renderVis(); loadRooms(); loadRating();
  }

  // ---------- pokój ----------
  let arenaC = { x: 0, y: 0 };
  let unloading = false;
  let S = null, ES = null, CODE = null, PID = null, recvAt = 0, prev = null, typeT = 0, typeTimer = null, chatTab = 'log', seatPos = {}, lastLogId = 0, firstState = true;
  function leaveRoomLocal() {
    if (ES) { ES.close(); ES = null; }
    S = null; prev = null; CODE = null; PID = null; firstState = true; lastLogId = 0;
  }
  async function enterRoom(code, pid) {
    leaveRoomLocal();
    clearTimeout(roomsT);
    CODE = code; PID = pid;
    document.title = `Szyb · Dynamit · ${code}`;
    $('home').hidden = true; $('room').hidden = false; $('btnLeave').hidden = false; drawCave();
    $('rCode').textContent = code;
    $('seats').innerHTML = ''; $('chatLog').innerHTML = ''; $('cCard').hidden = true; $('qCard').hidden = true;
    let fails = 0;
    ES = new EventSource(`/api/m/events?code=${encodeURIComponent(code)}&pid=${encodeURIComponent(pid)}`);
    ES.onmessage = (e) => { fails = 0; try { onState(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    ES.addEventListener('type', (e) => { try { const d = JSON.parse(e.data); onTyping(d.pid, d.text); } catch {} });
    ES.onerror = () => {
      if (!ES || unloading) return;
      if (ES.readyState === 2 || ++fails > 6) {
        ES.close(); ES = null;
        sset('szyb-m-pid-' + code, null);
        if (!S) rejoin(code); else { api('leave', { code, pid }).catch(() => {}); toast('Połączenie z pokojem zostało zerwane.'); history.replaceState({}, '', '/multi'); showHome(); }
      }
    };
  }
  async function rejoin(code) {
    try {
      const r = await api('join', { ...me(), code });
      sset('szyb-m-pid-' + r.code, r.pid);
      enterRoom(r.code, r.pid);
    } catch (e) { toast(e.message); history.replaceState({}, '', '/multi'); showHome(); }
  }
  $('btnLeave').onclick = async () => {
    const code = CODE, pid = PID;
    sset('szyb-m-pid-' + code, null);
    history.pushState({}, '', '/multi');
    showHome();
    try { await api('leave', { code, pid }); } catch {}
  };

  const meP = () => S && S.players.find((p) => p.pid === S.you);
  const playing = () => S && (S.phase === 'play' || S.phase === 'boom');
  function seatList() {
    if (!S) return [];
    if (S.phase === 'lobby') return S.players;
    const ids = S.order.filter((id) => S.players.some((p) => p.pid === id));
    return ids.map((id) => S.players.find((p) => p.pid === id));
  }
  function layoutSeats() {
    const list = seatList();
    const ar = $('arena').getBoundingClientRect();
    const W = ar.width, H = ar.height;
    const q = $('qCard'), cc = $('cCard');
    // stół zaczyna się pod kartą z kategorią (na telefonie zajmuje sporo miejsca)
    // +95: górny gracz razem ze swoją chmurką mieści się pod kartą pytania
    const top = (!q.hidden ? q.offsetTop + q.offsetHeight : 0) + (W < 600 ? 80 : 95), bottom = H - 50;
    const cx = W / 2, cy = (top + bottom) / 2;
    const rx = Math.min(W * (W < 600 ? 0.34 : 0.38), 420), ry = Math.max(60, Math.min((bottom - top) / 2, 230));
    arenaC = { x: cx, y: cy };
    // klepisko dokładnie pod miejscami graczy
    const fl = $('floor');
    if (fl) { const fx = rx + (W < 600 ? 52 : 80), fy = ry + (W < 600 ? 62 : 80); fl.style.left = (cx - fx) + 'px'; fl.style.top = (cy - fy + 10) + 'px'; fl.style.width = fx * 2 + 'px'; fl.style.height = fy * 2 + 'px'; drawFloor(fl, fx * 2, fy * 2); }
    // ja na dole, reszta zgodnie z ruchem wskazówek zegara
    let start = list.findIndex((p) => p.pid === S.you);
    if (start < 0) start = 0;
    seatPos = {};
    const n = list.length;
    list.forEach((p, i) => {
      const k = (i - start + n) % n;
      const ang = Math.PI / 2 + (k * 2 * Math.PI) / Math.max(n, 1);
      seatPos[p.pid] = { x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry };
    });
    for (const el of $('seats').children) {
      const pos = seatPos[el.dataset.pid];
      if (pos) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; }
    }
    placeDyn();
  }
  // dynamit stoi na środku stołu, a lont/strzałka wskazuje, kto teraz odpowiada (jak rybka w krillionie)
  function placeDyn() {
    const cx = arenaC.x, cy = arenaC.y - (innerWidth < 600 ? 22 : 30);
    $('dyn').style.left = cx + 'px'; $('dyn').style.top = cy + 'px';
    // dymek z tym, co pisze gracz z dynamitem: nad jego głową, a u graczy z górnej połowy stołu – pod imieniem
    const h = S && playing() && seatPos[S.holder], lv = $('live');
    if (h) {
      const up = h.y > cy - 10, sm = innerWidth < 600;
      lv.classList.toggle('below', !up);
      lv.style.left = h.x + 'px';
      lv.style.top = (up ? h.y - (sm ? 46 : 60) - (lv.offsetHeight || 50) : h.y + (sm ? 66 : 82)) + 'px';
    }
  }
  // klepisko w stylu pixel-art: owalny spąg z kamiennym obramowaniem, rysowany w niskiej rozdzielczości
  let floorKey = '';
  function drawFloor(cv, w, h) {
    const S4 = innerWidth < 600 ? 3 : 4;
    const W = Math.max(20, Math.round(w / S4)), H = Math.max(20, Math.round(h / S4));
    if (floorKey === W + 'x' + H) return; floorKey = W + 'x' + H;
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const cx = W / 2, cy = H / 2, rx = W / 2 - 1, ry = H / 2 - 1;
    const RIM = Math.max(3, Math.round(Math.min(W, H) * 0.045));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry, k = Math.sqrt(nx * nx + ny * ny);
      if (k > 1) continue;
      let r, gg, b;
      const edgePx = (1 - k) * Math.min(rx, ry);           // odległość od brzegu w pikselach
      if (edgePx < RIM) {
        // obramowanie z kamieni: segmenty wokół owalu
        const a = Math.atan2(ny, nx), seg = Math.floor((a + Math.PI) / (Math.PI * 2) * Math.round((rx + ry) * 0.42));
        const n = hash(seg, 11), segPos = ((a + Math.PI) / (Math.PI * 2) * Math.round((rx + ry) * 0.42)) % 1;
        r = 74 + n * 30; gg = 64 + n * 22; b = 86 + n * 26;
        if (edgePx < 1 || edgePx > RIM - 1 || segPos < 0.08) { r = 20; gg = 15; b = 28; }
        else if (edgePx < 2) { r += 26; gg += 22; b += 24; }
      } else {
        // ubite klepisko: plamy, żwirek i jaśniejszy środek od lampy
        const n = hash(x, y), m = hash(x >> 2, y >> 2), m2 = hash((x >> 3) + 50, (y >> 3) + 9);
        const light = Math.max(0, 1 - Math.hypot(nx, ny * 1.1)) * 24;
        r = 50 + m * 10 + m2 * 8 + light; gg = 41 + m * 8 + m2 * 6 + light * .8; b = 52 + m * 9 + m2 * 7 + light * .6;
        if (n > 0.985) { r += 22; gg += 18; b += 16; } else if (n < 0.012) { r -= 14; gg -= 12; b -= 12; }
        // cień tuż przy obramowaniu
        if (edgePx < RIM + 3) { const f = .72 + (edgePx - RIM) * .09; r *= f; gg *= f; b *= f; }
      }
      const i = (y * W + x) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  function hearts(p) {
    if (!p.inGame) return '';
    let s = '';
    for (let i = 0; i < (S.lives || 2); i++) s += i < p.lives ? '♥' : '<s>♥</s>';
    return s;
  }
  function bubbleFor(p) {
    if (playing() && p.last && p.pid !== S.holder) return `<span class="bubble ${p.last.st}">${esc(p.last.text)}</span>`;
    return '';
  }
  function renderSeats() {
    const list = seatList();
    const host = $('seats');
    const have = new Map([...host.children].map((el) => [el.dataset.pid, el]));
    for (const [pid, el] of have) if (!list.some((p) => p.pid === pid)) el.remove();
    for (const p of list) {
      let el = have.get(p.pid);
      if (!el) { el = document.createElement('div'); el.className = 'seat'; el.dataset.pid = p.pid; el.innerHTML = '<div class="ped"><img alt=""><span class="bw"></span></div><div class="nm"></div><div class="hp"></div>'; host.appendChild(el); }
      const av = AV[p.avatar] || AV.gornik;
      const img = el.querySelector('img'); if (img.getAttribute('src') !== av.src) img.src = av.src;
      el.querySelector('.nm').textContent = p.name + (S.kind === 'rated' && p.rating ? ` · ${p.rating}` : '') + (S.phase === 'lobby' && p.pid === S.host && S.kind === 'host' ? ' ★' : '');
      el.querySelector('.hp').innerHTML = hearts(p);
      const bw = el.querySelector('.bw'), html = bubbleFor(p);
      if (bw.innerHTML !== html) bw.innerHTML = html;
      el.classList.toggle('up', playing() && p.pid === S.holder && S.phase === 'play');
      el.classList.toggle('out', p.inGame && p.lives <= 0 && S.phase !== 'lobby');
      el.classList.toggle('gone', !p.connected);
      el.classList.toggle('me', p.pid === S.you);
    }
    layoutSeats();
  }
  function onTyping(pid, text) {
    if (!S || !playing()) return;
    const p = S.players.find((x) => x.pid === pid); if (!p) return;
    p.typing = text;
    const el = [...$('seats').children].find((x) => x.dataset.pid === pid);
    if (el) el.querySelector('.bw').innerHTML = bubbleFor(p);
    renderLive();
  }
  // środek stołu: na żywo to, co wpisuje gracz z dynamitem (albo ostatnia dobra odpowiedź)
  function renderLive() {
    const lv = $('live');
    if (!S || S.phase !== 'play') { lv.hidden = true; return; }
    const h = S.players.find((p) => p.pid === S.holder);
    if (!h) { lv.hidden = true; return; }
    let text, cls;
    if (h.typing) { text = esc(h.typing) + '<i class="caret">▌</i>'; cls = 'typing'; }
    else if (h.last && h.last.st !== 'ok') { text = esc(h.last.text); cls = h.last.st; }
    else { text = '<i class="dots"><i>.</i><i>.</i><i>.</i></i>'; cls = 'think'; }
    const lt = $('liveText');
    if (lt.innerHTML !== text) lt.innerHTML = text;
    const below = lv.classList.contains('below');
    lv.className = 'live ' + cls + (below ? ' below' : ''); lv.hidden = false;
    placeDyn();
  }

  function centerCard(html, cls) {
    const c = $('cCard');
    if (!html) { c.hidden = true; return; }
    c.className = 'center-card' + (cls ? ' ' + cls : '');
    if (c.innerHTML !== html) c.innerHTML = html;
    c.hidden = false;
  }
  function inviteLink() { return location.origin + '/multi/' + CODE; }

  function onState(s) {
    const was = S;
    S = s; recvAt = performance.now();
    const mine = meP();
    // nagłówek
    $('rVis').textContent = (s.isPublic ? 'PUBLICZNY' : 'PRYWATNY') + (s.kind === 'rated' ? ' · RANKING' : '');
    const inGame = s.players.filter((p) => p.inGame);
    $('rAliveL').textContent = s.phase === 'lobby' ? 'GRACZE' : 'W GRZE';
    $('rAlive').textContent = s.phase === 'lobby' ? `${s.players.length}/${s.max}` : `${inGame.filter((p) => p.lives > 0).length}/${inGame.length}`;
    $('rCat').textContent = s.phase === 'lobby' ? 'POCZEKALNIA' : s.phase === 'end' ? 'KONIEC GRY' : `KATEGORIA ${s.catNo}`;
    // kategoria
    if (playing() && s.question) {
      const q = $('qCard');
      if (!was || was.catNo !== s.catNo || q.hidden) { q.hidden = false; FX.retrigger(q, 'pop'); }
      $('qK').textContent = 'KATEGORIA ' + s.catNo; $('qText').textContent = s.question;
    } else $('qCard').hidden = true;

    renderSeats();
    renderLive();
    renderCard();
    renderDock();
    renderChat();
    effects(was, s);
    firstState = false;
  }
  function renderCard() {
    const s = S;
    if (s.phase === 'lobby') {
      const n = s.players.length;
      const startIn = s.startIn ? Math.ceil((s.startIn - (performance.now() - recvAt)) / 1000) : 0;
      if (s.kind === 'host') {
        const isHost = s.host === s.you;
        const ready = s.players.filter((p) => p.connected).length;
        centerCard(`<h3>Poczekalnia</h3><p>Wyślij znajomym kod <b>${esc(s.code)}</b> albo link do pokoju.</p>
          <div class="row"><button class="chip" data-act="copy">KOPIUJ LINK</button>${isHost ? `<button class="chip${s.isPublic ? ' on' : ''}" data-act="vis">${s.isPublic ? 'PUBLICZNY · NA LIŚCIE' : 'PRYWATNY · TYLKO KOD'}</button>` : ''}</div>
          ${isHost ? `<div class="row lives-pick"><span>SERCA</span>${[1, 2, 3, 4, 5].map((n) => `<button class="chip${s.lives === n ? ' on' : ''}" data-act="lives" data-n="${n}">${'♥'.repeat(n)}</button>`).join('')}</div>` : `<p>Każdy ma <b>${s.lives}</b> ${s.lives === 1 ? 'serce' : s.lives < 5 ? 'serca' : 'serc'}.</p>`}
          ${isHost ? `<button class="bigbtn gold" data-act="start" ${ready < 2 ? 'disabled' : ''}>ZACZNIJ GRĘ</button><p>${ready < 2 ? 'Potrzeba co najmniej 2 graczy.' : `Przy stole: ${ready}.`}</p>` : `<p>Gospodarz zacznie grę, gdy wszyscy będą gotowi.</p>`}`);
      } else {
        centerCard(`<h3>${startIn > 0 ? `Start za ${startIn} s` : 'Szukamy graczy'}</h3><p>Przy stole: <b>${n}/${s.max}</b>${s.kind === 'rated' ? ' · gra rankingowa' : ''}</p>
          <p>${startIn > 0 ? 'Jeszcze ktoś może dołączyć.' : n < 2 ? 'Czekamy na drugiego gracza. Możesz wysłać znajomemu link.' : `Gra ruszy, gdy przy stole będzie ${s.min} graczy albo po chwili czekania.`}</p>
          <div class="row"><button class="chip" data-act="copy">KOPIUJ LINK</button></div>`);
      }
    } else if (s.phase === 'boom' && s.boom) {
      const ex = s.boom.examples && s.boom.examples.length ? `<p>Można było: <b>${s.boom.examples.map(esc).join(', ')}</b></p>` : '';
      centerCard(`<h3>BUM!</h3><p><b>${esc(s.boom.name)}</b> ${s.boom.dead ? 'odpada z gry' : 'traci życie'}.</p>${ex}<p>Za chwilę nowa kategoria.</p>`, 'boom');
    } else if (s.phase === 'end') {
      const w = s.winner;
      let deltas = '';
      if (s.ratingDelta) {
        deltas = '<ul class="deltas">' + Object.entries(s.ratingDelta).sort((a, b) => b[1] - a[1]).map(([pid, d]) => {
          const p = s.players.find((x) => x.pid === pid);
          return p ? `<li><span>${esc(p.name)}</span><span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d} (${p.rating})</span></li>` : '';
        }).join('') + '</ul>';
      }
      centerCard(`<h3>${w ? (w.pid === s.you ? 'WYGRYWASZ!' : 'WYGRYWA ' + esc(w.name)) : 'KONIEC GRY'}</h3><p>${w && w.pid === s.you ? 'Ostatni górnik przy stole.' : 'Ostatni górnik przy stole.'}</p>${deltas}<p>Za chwilę wracamy do poczekalni.</p>`);
    } else centerCard(null);
  }
  $('cCard').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !S) return;
    if (b.dataset.act === 'copy') {
      try { await navigator.clipboard.writeText(inviteLink()); toast('Skopiowano link do pokoju.'); } catch { toast(inviteLink()); }
    } else if (b.dataset.act === 'start') {
      try { await api('start', { code: CODE, pid: PID }); } catch (err) { toast(err.message); }
    } else if (b.dataset.act === 'lives') {
      try { await api('lives', { code: CODE, pid: PID, lives: +b.dataset.n }); Sound.click(); } catch (err) { toast(err.message); }
    } else if (b.dataset.act === 'vis') {
      try { await api('visibility', { code: CODE, pid: PID, isPublic: !S.isPublic }); } catch (err) { toast(err.message); }
    }
  });
  function renderDock() {
    setTimeout(dupCheck, 0);
    const s = S, mine = meP();
    const myTurn = s.phase === 'play' && s.holder === s.you;
    const inp = $('ansIn');
    $('myLives').querySelector('b').textContent = mine && mine.inGame ? mine.lives : 0;
    $('ansForm').classList.toggle('myturn', myTurn);
    let ph;
    if (s.phase === 'lobby') ph = 'czekamy na start…';
    else if (s.phase === 'end') ph = 'koniec gry';
    else if (!mine || !mine.inGame) ph = 'jesteś w następnej grze · oglądasz…';
    else if (mine.lives <= 0) ph = 'odpadłeś · oglądasz do końca…';
    else if (myTurn) ph = 'twoja kolej! pisz…';
    else ph = 'przygotuj odpowiedź…';
    inp.placeholder = ph;
    // pisać można zawsze, gdy jesteś w grze; wysłać tylko w swojej kolejce
    const canType = (s.phase === 'play' || s.phase === 'boom') && mine && mine.inGame && mine.lives > 0;
    if (!canType && !inp.disabled) { inp.value = ''; hideConfirm(); }
    inp.disabled = !canType; $('ansBtn').disabled = !canType; $('ansBtn').classList.toggle('wait', !myTurn);
    if (myTurn && !wasMyTurn) {
      // na telefonie nie przejmujemy fokusu (iOS potrafi wtedy zablokować klawiaturę) – wystarczy dotknąć pola
      if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => inp.focus(), 30);
      if (inp.value) api('type', { code: CODE, pid: PID, text: inp.value }).catch(() => {});
    }
    if (!myTurn) hideConfirm();
    wasMyTurn = myTurn;
    const h = $('heatBar');
    if (!playing()) { h.style.width = '0'; h.className = 'hbar'; }
    const holder = s.players.find((p) => p.pid === s.holder);
    const ul = $('upLine');
    ul.classList.toggle('mine', myTurn);
    const qh = $('qCard').offsetHeight;
    ul.innerHTML = s.phase === 'play' && holder ? (myTurn ? '▶ <b>TWOJA KOLEJ!</b> ◀' : `teraz pisze: <b>${esc(holder.name)}</b>`) : '';
    if ($('qCard').offsetHeight !== qh) layoutSeats();
  }
  const SYS = {
    join: (e) => `${esc(e.name)} dołącza`, leave: (e) => `${esc(e.name)} wychodzi`, start: (e) => `Start! Przy stole: ${e.n}`,
    boom: (e) => `${esc(e.name)} traci życie`, dead: (e) => `${esc(e.name)} odpada`, out: (e) => `${esc(e.name)} odpada (rozłączony)`, win: (e) => `${esc(e.name)} wygrywa`,
  };
  function renderChat() {
    const log = $('chatLog');
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const fresh = S.log.filter((e) => e.id > lastLogId);
    if (fresh.length) {
      if (fresh.length === S.log.length) log.innerHTML = '';
      for (const e of fresh) {
        const li = document.createElement('li');
        if (e.sys) { li.className = 'sys' + (e.sys === 'win' ? ' win' : e.sys === 'boom' || e.sys === 'dead' ? ' bad' : ''); li.innerHTML = (SYS[e.sys] || (() => ''))(e); }
        else li.innerHTML = `<b>${esc(e.name)}:</b> ${esc(e.text)}`;
        log.appendChild(li);
      }
      while (log.children.length > 80) log.firstChild.remove();
      lastLogId = S.log[S.log.length - 1].id;
      if (near || firstState) log.scrollTop = log.scrollHeight;
    }
    $('chatPlayers').innerHTML = S.players.map((p) => `<li><span>${esc(p.name)}${p.pid === S.you ? ' (ty)' : ''}${p.pid === S.host && S.kind === 'host' ? ' ★' : ''}${p.connected ? '' : ' · rozłączony'}</span><span>${p.inGame ? '♥'.repeat(Math.max(0, p.lives)) || '✕' : S.phase === 'lobby' ? '' : 'ogląda'}${S.kind === 'rated' ? ' ' + p.rating : ''}</span></li>`).join('');
  }
  document.querySelector('.chat-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    chatTab = b.dataset.tab;
    for (const x of document.querySelectorAll('.chat-tabs .chip')) x.classList.toggle('on', x === b);
    $('chatLog').hidden = chatTab !== 'log'; $('chatPlayers').hidden = chatTab !== 'players';
  });
  $('chatForm').onsubmit = async (e) => {
    e.preventDefault();
    const text = $('chatIn').value.trim(); if (!text || !CODE) return;
    $('chatIn').value = '';
    try { await api('chat', { code: CODE, pid: PID, text }); } catch (err) { toast(err.message); }
  };

  // wpisywanie na żywo i odpowiedzi
  let wasMyTurn = false, pending = null;
  function showConfirm(display) {
    const b = $('confirmBox');
    b.innerHTML = `Czy chodziło Ci o <b>„${esc(display)}”</b>? <span>Enter = tak · Esc = popraw</span>`;
    b.hidden = false;
  }
  function hideConfirm() { pending = null; const b = $('confirmBox'); if (b) b.hidden = true; }
  $('ansIn').addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pending) { e.preventDefault(); hideConfirm(); }
    // Enter wysyła zawsze sami (niektóre klawiatury na Androidzie nie wysyłają formularza same)
    if ((e.key === 'Enter' || e.keyCode === 13) && !e.isComposing) { e.preventDefault(); sendAnswer(); }
  });
  $('confirmBox').addEventListener('click', () => { if (pending) $('ansForm').requestSubmit(); });
  // od razu przy pisaniu: „to już było” (jak w szychcie, zanim wyślesz)
  function dupCheck() {
    const el = $('dupHint'); if (!el) return;
    const v = $('ansIn').value.trim();
    let msg = '';
    if (v && S && S.phase === 'play' && S.catId && window.SZYB && SZYB.judge && SZYB.category && SZYB.category(S.catId)) {
      const r = SZYB.judge(S.catId, v);
      if (r.ok && (S.usedKeys || []).includes(r.key)) msg = 'już było';
    }
    el.textContent = msg; el.hidden = !msg || !$('confirmBox').hidden;
    $('ansForm').classList.toggle('isdup', !!msg && !el.hidden);
  }
  $('ansIn').addEventListener('input', () => {
    if (pending && $('ansIn').value.trim() !== pending.text) hideConfirm();
    dupCheck();
    if (!S || S.holder !== S.you) return;
    clearTimeout(typeTimer);
    const send = () => { typeT = performance.now(); api('type', { code: CODE, pid: PID, text: $('ansIn').value }).catch(() => {}); };
    if (performance.now() - typeT > 120) send(); else typeTimer = setTimeout(send, 120);
  });
  $('ansForm').onsubmit = (e) => { e.preventDefault(); sendAnswer(); };
  let sending = false;
  async function sendAnswer() {
    if (sending) return;
    const text = $('ansIn').value.trim();
    if (!text || !S) return;
    if (S.holder !== S.you || S.phase !== 'play') { if (S.phase === 'play') { toast('Jeszcze nie twoja kolej. Odpowiedź czeka w polu.'); FX.retrigger($('ansForm'), 'shake'); } return; }
    const confirm = !!(pending && pending.text === text);
    hideConfirm();
    $('ansIn').value = '';
    clearTimeout(typeTimer);
    sending = true;
    try {
      const r = await api('answer', { code: CODE, pid: PID, text, confirm });
      if (r.confirm) { pending = { text }; if (!$('ansIn').value) $('ansIn').value = text; showConfirm(r.confirm); Sound.tick(); }
      else if (r.ok) { Sound.hit(r.tier); }
      else if (r.dup) { Sound.miss(); FX.retrigger($('ansForm'), 'shake'); dupCheck(); }
      else if (r.error) toast(r.error);
      else { Sound.miss(); FX.retrigger($('ansForm'), 'shake'); }
    } catch (err) { toast(err.message); } finally { sending = false; }
  }
  // dotknięcie „Wyślij” nie zabiera fokusu z pola (klawiatura na telefonie zostaje otwarta)
  $('ansBtn').addEventListener('pointerdown', (e) => { if (!$('ansIn').disabled) e.preventDefault(); });

  // efekty przy zmianach stanu
  function tierPop(pid, tier) {
    const pos = seatPos[pid]; if (!pos) return;
    const t = tierInfo(tier);
    const el = document.createElement('div');
    el.className = 'tierpop'; el.textContent = '+ ' + String(t.name).toUpperCase(); el.style.color = t.color;
    el.style.left = pos.x + 'px'; el.style.top = (pos.y - 70) + 'px';
    $('arena').appendChild(el); setTimeout(() => el.remove(), 1400);
  }
  function explodeFx() {
    const d = $('dyn'), ar = $('arena');
    const x = parseFloat(d.style.left) || 0, y = parseFloat(d.style.top) || 0;
    const cols = ['#ffd52e', '#ff9f1a', '#ff5f3a', '#fff6c0', '#8a7f9a'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div'); p.className = 'spark';
      p.style.background = cols[i % cols.length];
      p.style.left = x + 'px'; p.style.top = y + 'px';
      const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 160;
      p.style.setProperty('--dx', Math.round(Math.cos(a) * r) + 'px'); p.style.setProperty('--dy', Math.round(Math.sin(a) * r) + 'px');
      ar.appendChild(p); setTimeout(() => p.remove(), 950);
    }
    const f = document.createElement('div'); f.className = 'flash'; document.body.appendChild(f); setTimeout(() => f.remove(), 500);
    FX.retrigger(ar, 'shake');
    boomSound();
  }
  function effects(was, s) {
    if (!was) return;
    if (was.phase === 'play' && s.phase === 'boom') explodeFx();
    if (was.phase !== 'play' && s.phase === 'play' && s.catNo === 1) Sound.start();
    if (was.phase !== 'end' && s.phase === 'end') Sound.end();
    const newOk = s.phase === 'play' && s.lastOk && (!was.lastOk || was.catNo !== s.catNo || was.lastOk.n !== s.lastOk.n);
    if (newOk) {
      tierPop(s.lastOk.pid, s.lastOk.tier);
      if (s.lastOk.pid !== s.you) Sound.click();
    }
    if (s.phase === 'play' && s.holder === s.you && was.holder !== s.you) [880, 1175].forEach((f, i) => setTimeout(() => Sound.tick(), i * 90));
    if (s.phase === 'lobby' && s.startIn && s.kind !== 'host') scheduleCountdown();
  }
  let cdT = null;
  function scheduleCountdown() {
    clearTimeout(cdT);
    cdT = setTimeout(() => { if (S && S.phase === 'lobby') { renderCard(); if (S.startIn) scheduleCountdown(); } }, 500);
  }

  // animacja dynamitu
  let lastFrameT = 0, frame = 0, lastTick = 0;
  function animDyn(t) {
    const dyn = $('dyn'), body = $('dynBody');
    if (!S || $('room').hidden) return;
    if (S.phase === 'end') { dyn.style.visibility = 'hidden'; return; }
    dyn.style.visibility = S.phase === 'boom' ? 'hidden' : 'visible';
    if (S.phase === 'lobby') {
      dyn.className = 'dyn sleep'; body.style.setProperty('--sc', 1);
      if (body.dataset.k !== 'sleep') { body.style.backgroundImage = `url(${DYN.sleep})`; body.dataset.k = 'sleep'; }
      return;
    }
    const heat = Math.min(1, S.heat + (t - recvAt) * S.heatRate);
    const hot = heat > 0.5;
    dyn.className = 'dyn' + (hot ? ' hot' : '');
    body.style.setProperty('--sc', (1 + heat * 0.7).toFixed(2));
    const speed = 160 - heat * 110;
    if (t - lastFrameT > speed) { frame ^= 1; lastFrameT = t; }
    const k = (hot ? 'hot' : 'lit') + frame;
    if (body.dataset.k !== k) { body.style.backgroundImage = `url(${DYN[hot ? 'hot' : 'lit'][frame]})`; body.dataset.k = k; }
    const hb = $('heatBar');
    if (S.phase === 'play') { hb.style.width = (heat * 100).toFixed(1) + '%'; hb.className = 'hbar' + (heat > 0.6 ? ' hot' : heat > 0.35 ? ' warm' : ''); }
    // tykanie, gdy dynamit jest u mnie
    if (S.phase === 'play' && S.holder === S.you && t - lastTick > 700 - heat * 520) { lastTick = t; Sound.tick(); }
  }

  // ---------- start ----------
  function route() {
    const m = /^\/multi\/([A-Za-z]{4})\/?$/.exec(location.pathname);
    if (m) {
      const code = m[1].toUpperCase();
      if (code === CODE && S) return;
      renderAvatars(); renderSizes(); renderVis();
      const pid = sget('szyb-m-pid-' + code);
      if (pid) enterRoom(code, pid);
      else if (!st.name) {
        // ktoś wszedł z linku i nie ma jeszcze imienia: pokaż stronę główną z wpisanym kodem
        showHome(); $('codeIn').value = code; $('nameIn').focus(); toast('Wpisz imię i kliknij DOŁĄCZ.');
      } else rejoin(code);
    } else if (CODE || $('home').hidden || !roomsT) showHome();
  }
  // Wyjście ze strony (☰, cofnięcie do menu, zamknięcie karty): od razu zwalniamy miejsce przy stole.
  // (beforeunload przychodzi, zanim przeglądarka zerwie połączenie z pokojem – inaczej onerror
  //  wziąłby to za awarię sieci i „wyszedł” tylko lokalnie, a miejsce przy stole by zostało)
  function bailOut() {
    unloading = true;
    if (!CODE || !PID) return;
    sset('szyb-m-pid-' + CODE, null);
    const body = JSON.stringify({ code: CODE, pid: PID });
    let sent = false;
    try { sent = navigator.sendBeacon('/api/m/leave', new Blob([body], { type: 'text/plain' })); } catch {}
    if (!sent) { try { fetch('/api/m/leave', { method: 'POST', keepalive: true, body }); } catch {} }
    leaveRoomLocal();
  }
  addEventListener('beforeunload', bailOut);
  addEventListener('pagehide', bailOut);
  // powrót przyciskiem „dalej” ze stanu zamrożonego przez przeglądarkę: zaczynamy od nowa
  addEventListener('pageshow', (e) => { unloading = false; if (e.persisted) { leaveRoomLocal(); $('home').hidden = false; $('room').hidden = true; route(); } });
  addEventListener('popstate', () => {
    if (CODE && !/^\/multi\/[A-Za-z]{4}/.test(location.pathname)) {
      const code = CODE, pid = PID; sset('szyb-m-pid-' + code, null);
      api('leave', { code, pid }).catch(() => {});
    }
    route();
  });
  $('home').hidden = false;
  route();
  requestAnimationFrame(loop);
})();
