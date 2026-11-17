// Szyb – tło pixel-art (wieża wyciągowa, szyb, winda), efekty i dźwięki 8-bit
(() => {
  const B = 4;                 // blok skały w pikselach logicznych
  const PX_PER_M = 1 / 3;      // 3 m = 1 piksel świata (7000 m ≈ 2333 px)
  const CAGE_W = 26, CAGE_H = 24, SHAFT_W = 34;
  const ORE = ['#d8c48a', '#2b2e35', '#e0803e', '#dfe8f2', '#ffd52e', '#7fe7ff'];

  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // Warstwy skały – granice w metrach (te same nazwy pokazuje gra przy zjeździe)
  // [od metrów, nazwa, 3 odcienie kamieni, kolor szczelin, wielkość kamienia [szer, wys]]
  const LAYERS_M = [
    [0, 'Ziemia', ['#5c3b22', '#6b462a', '#7a5333'], '#2e1c10', [6, 4]],
    [300, 'Glina', ['#6d5843', '#7c6650', '#8b765d'], '#3d3023', [9, 6]],
    [750, 'Lita skała', ['#4c4b56', '#5a5965', '#696874'], '#25242c', [13, 8]],
    [1750, 'Głęboka skała', ['#372f4d', '#433a5b', '#50466a'], '#1a1529', [15, 9]],
    [2750, 'Gorące głębiny', ['#47191e', '#572126', '#682b30'], '#22080c', [12, 8]],
  ];
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const LAY = LAYERS_M.map(([m, , pal, crack, cell]) => ({ y: m * PX_PER_M, pal: pal.map(hex), crack: hex(crack), cw: cell[0], ch: cell[1] }));
  const OREC = ORE.map(hex);
  function layerAt(x, y) {
    // granice warstw są faliste, żeby nie wyglądały jak linijka
    const wy = y + Math.sin(x / 19) * 3 + Math.sin(x / 7 + 2) * 1.5;
    let L = LAY[0];
    for (const l of LAY) if (wy >= l.y) L = l;
    return L;
  }
  // Kolor jednego piksela skały (świat: x w px, y w px od powierzchni). Kamienie = komórki z przesuniętymi środkami.
  function rockPx(x, y) {
    const L = layerAt(x, y);
    const cw = L.cw, ch = L.ch;
    const cy = Math.floor(y / ch);
    const off = (cy & 1) * (cw >> 1);                 // przesunięcie rzędów jak w murze
    const cx = Math.floor((x + off) / cw);
    let d1 = 1e9, d2 = 1e9, best = 0, fx = 0, fy = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j;
      const px = (gx + .2 + .6 * hash(gx, gy * 3 + 1)) * cw - ((gy & 1) * (cw >> 1));
      const py = (gy + .25 + .5 * hash(gx * 7 + 3, gy)) * ch;
      const dx = x - px, dy = (y - py) * (cw / ch);
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; best = gx * 92821 + gy; fx = px; fy = py; } else if (d < d2) d2 = d;
    }
    if (Math.sqrt(d2) - Math.sqrt(d1) < 1.15) return L.crack;
    const h = hash(best, 11);
    let c = L.pal[h < .35 ? 0 : h < .75 ? 1 : 2];
    // ruda w niektórych kamieniach (głębiej rzadsze kruszce)
    const m = y / PX_PER_M;
    if (h > .93 && d1 < 5.5) {
      const f = Math.min(1, m / 7000);
      const t = Math.min(5, Math.floor(hash(best, 5) * (2 + f * 4.6)));
      if (hash(x, y) < .7) return d1 < 1.2 ? [255, 255, 255] : OREC[t];
    }
    // światło z góry-lewej, cień z dołu-prawej
    const ry = y - fy, rx = x - fx;
    const k = ry < -ch * .22 || rx < -cw * .3 ? 1.12 : ry > ch * .2 ? .82 : 1;
    const n = .94 + hash(x * 3, y * 5) * .1;
    return [c[0] * k * n, c[1] * k * n, c[2] * k * n];
  }

  class Background {
    constructor(canvas) {
      this.c = canvas; this.ctx = canvas.getContext('2d');
      this.depth = 0; this.target = 0; this.parts = []; this.wheel = 0; this.moving = false; this.centered = false; this.sxf = null;
      this.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.onDepth = null;
      this.resize(); addEventListener('resize', () => this.resize());
      this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
    }
    resize() {
      const s = Math.max(3, Math.round(innerHeight / 170));
      this.s = s;
      this.W = Math.ceil(innerWidth / s); this.H = Math.ceil(innerHeight / s);
      this.c.width = this.W; this.c.height = this.H;
      this.sxf = null;   // pozycja szybu przeliczy się w następnej klatce
      this.tiles = new Map();
    }
    // skała liczona piksel po pikselu raz na kafelek 64 px wysokości i trzymana w pamięci
    tile(i) {
      let t = this.tiles.get(i);
      if (t) return t;
      t = document.createElement('canvas'); t.width = this.W; t.height = 64;
      const c = t.getContext('2d'), img = c.createImageData(this.W, 64), d = img.data;
      for (let yy = 0; yy < 64; yy++) {
        const y = i * 64 + yy;
        for (let x = 0; x < this.W; x++) {
          const col = rockPx(x, y), o = (yy * this.W + x) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      }
      c.putImageData(img, 0, 0);
      this.tiles.set(i, t);
      if (this.tiles.size > 24) this.tiles.delete(this.tiles.keys().next().value);
      return t;
    }
    // na szerokim ekranie szyb stoi z lewej; w trakcie gry (center=true) przesuwa się na środek
    sxTarget() { return this.centered || innerWidth <= 900 ? this.W / 2 : Math.max(24, this.W * 0.13); }
    center(on) { this.centered = !!on; }
    // przelicza metry na piksele CSS (do warstwy z liniami pokładów)
    get mpx() { return PX_PER_M * ((this.c.clientWidth || innerWidth) / this.W); }
    get arrived() { return this.depth === this.target; }
    set(meters, instant) {
      this.target = meters;
      if (instant || this.reduced) this.depth = meters;
    }
    loop(now) {
      requestAnimationFrame(this.loop);
      this.t = now;
      const tx = this.sxTarget();
      if (this.sxf == null || this.reduced) this.sxf = tx;
      else this.sxf += Math.abs(tx - this.sxf) < 0.5 ? tx - this.sxf : (tx - this.sxf) * 0.08;
      this.sx = Math.round(this.sxf);
      const diff = this.target - this.depth;
      if (Math.abs(diff) < 0.5) { this.depth = this.target; this.moving = false; }
      else {
        // płynny zjazd: szybko na starcie, łagodne hamowanie; w górę szybciej
        const step = diff > 0 ? Math.max(1.6, diff * 0.013) : Math.min(-12, diff * 0.08);
        this.depth += Math.abs(step) > Math.abs(diff) ? diff : step;
        this.moving = true;
        this.wheel += step * 0.05;
        if (Math.random() < 0.5) this.parts.push({ x: this.sx + (Math.random() - .5) * SHAFT_W, y: this.depth * PX_PER_M - 30 - Math.random() * 60, vy: -1 - Math.random() * 1.5, life: 40 });
      }
      if (this.onDepth) this.onDepth(this.depth);
      this.draw();
    }
    draw() {
      const { ctx, W, H, sx } = this, t = this.t;
      const cageBottom = this.depth * PX_PER_M;           // świat: 0 = poziom gruntu
      const cam = Math.round(cageBottom - CAGE_H / 2 - H * 0.5);
      const shake = this.moving && !this.reduced ? Math.round(Math.sin(t / 30)) : 0;
      const half = SHAFT_W / 2;
      ctx.fillStyle = '#0a0712'; ctx.fillRect(0, 0, W, H);

      // --- niebo ---
      if (cam < 0) this.drawSurface(-cam, shake);

      // --- skała (z pamięci) ---
      const ty0 = Math.max(0, Math.floor(cam / 64)), ty1 = Math.floor((cam + H) / 64);
      for (let i = ty0; i <= ty1; i++) ctx.drawImage(this.tile(i), 0, i * 64 - cam);
      // trawa i darń
      if (cam < 4 && cam > -H) {
        for (let x = 0; x < W; x++) {
          const g = hash(x, 1);
          ctx.fillStyle = g < .5 ? '#3c9a48' : '#2f8a3e'; ctx.fillRect(x, -cam - (g < .15 ? 2 : g < .4 ? 1 : 0), 1, 3 + (g < .15 ? 2 : g < .4 ? 1 : 0));
          ctx.fillStyle = '#245c2c'; ctx.fillRect(x, -cam + 3, 1, 1);
        }
      }
      // boczne chodniki z lampami i wózkami
      this.drawGalleries(cam, half);
      // światło: im dalej od szybu, tym ciemniej
      const lg = ctx.createLinearGradient(0, 0, W, 0);
      const a = Math.max(0, (sx - 70) / W), b = Math.min(1, (sx + 70) / W);
      lg.addColorStop(0, 'rgba(6,4,14,.62)'); lg.addColorStop(a, 'rgba(6,4,14,.05)'); lg.addColorStop(sx / W, 'rgba(6,4,14,0)');
      lg.addColorStop(b, 'rgba(6,4,14,.05)'); lg.addColorStop(1, 'rgba(6,4,14,.62)');
      const rockTop = Math.max(0, -cam + 4);
      ctx.fillStyle = lg; ctx.fillRect(0, rockTop, W, H - rockTop);

      // --- wnętrze szybu ---
      const top = Math.max(0, -cam);
      ctx.fillStyle = '#0a0712'; ctx.fillRect(sx - half, top, SHAFT_W, H - top);
      // deski obudowy co 12 px
      for (let wy = Math.ceil(Math.max(cam, 0) / 12) * 12; wy < cam + H; wy += 12) {
        const y = wy - cam;
        ctx.fillStyle = '#3a2614'; ctx.fillRect(sx - half, y, SHAFT_W, 2);
        ctx.fillStyle = '#5a3a1e'; ctx.fillRect(sx - half, y, SHAFT_W, 1);
      }
      // lampy na ścianie co 60 px
      for (let wy = Math.ceil(Math.max(cam, 10) / 60) * 60 + 30; wy < cam + H; wy += 60) {
        const y = wy - cam;
        const g = ctx.createRadialGradient(sx - half + 2, y, 0, sx - half + 2, y, 14);
        g.addColorStop(0, 'rgba(255,214,120,.35)'); g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g; ctx.fillRect(sx - half, y - 14, 18, 28);
        ctx.fillStyle = '#ffd56b'; ctx.fillRect(sx - half, y - 1, 2, 3);
      }
      // prowadnice
      ctx.fillStyle = '#6d7684'; ctx.fillRect(sx - half + 3, top, 1, H - top); ctx.fillRect(sx + half - 4, top, 1, H - top);
      // znaczniki głębokości co 100 m (kreski na prowadnicy)
      for (let m = Math.ceil(Math.max(0, cam) / (100 * PX_PER_M)) * 100; m * PX_PER_M < cam + H; m += 100) {
        const y = Math.round(m * PX_PER_M) - cam;
        ctx.fillStyle = m % 1000 === 0 ? '#ffcc1a' : '#9aa3b2';
        ctx.fillRect(sx + half - 7, y, m % 1000 === 0 ? 6 : 3, 1);
      }

      // --- liny i klatka ---
      const cageTop = Math.round(cageBottom - CAGE_H) - cam + shake;
      const ropeTop = Math.max(0, -cam - 70);
      ctx.fillStyle = '#b8bec8';
      ctx.fillRect(sx - 4, ropeTop, 1, cageTop - ropeTop); ctx.fillRect(sx + 3, ropeTop, 1, cageTop - ropeTop);
      this.drawCage(sx - CAGE_W / 2, cageTop);
      // pozycja klatki na ekranie (px CSS) – do przyczepienia napisu z odpowiedzią
      const k = (this.c.clientWidth || innerWidth) / W;
      this.cage = { x: (sx - CAGE_W / 2) * k, y: (cageTop - 5) * k, w: CAGE_W * k, h: (CAGE_H + 5) * k, camCss: cam * k, k };
      if (this.onFrame) this.onFrame(this.cage);

      // pył
      this.parts = this.parts.filter((p) => p.life-- > 0);
      for (const p of this.parts) { p.y += p.vy; ctx.fillStyle = 'rgba(200,180,150,.7)'; ctx.fillRect(Math.round(p.x), Math.round(p.y - cam), 1, 1); }
    }
    drawSurface(groundY, shake) {
      const { ctx, W, t } = this;
      // niebo: gradient z ditheringiem (szachownica między pasami)
      const stops = [[0, [9, 7, 26]], [.45, [22, 16, 52]], [.75, [52, 30, 78]], [.92, [104, 52, 86]], [1, [170, 84, 76]]];
      const skyH = Math.min(groundY, 260);
      const top = groundY - skyH;
      ctx.fillStyle = '#09071a'; ctx.fillRect(0, 0, W, Math.max(0, top));
      const col = (k) => { let i = 0; while (i < stops.length - 2 && k > stops[i + 1][0]) i++; const [k0, c0] = stops[i], [k1, c1] = stops[i + 1]; const f = (k - k0) / (k1 - k0); return c0.map((v, j) => Math.round((v + (c1[j] - v) * f) / 6) * 6); };
      for (let y = Math.max(0, top); y < groundY; y++) {
        const k = (y - top) / skyH;
        const c1 = col(k), c2 = col(Math.min(1, k + .03));
        ctx.fillStyle = `rgb(${c1})`; ctx.fillRect(0, y, W, 1);
        if (c1.join() !== c2.join()) { ctx.fillStyle = `rgb(${c2})`; for (let x = y & 1; x < W; x += 2) ctx.fillRect(x, y, 1, 1); }
      }
      // gwiazdy
      for (let i = 0; i < 90; i++) {
        const x = Math.floor(hash(i, 3) * W), y = groundY - 60 - Math.floor(hash(i, 4) * 200);
        if (y < 0) continue;
        if (((t / 300 + i * 7) | 0) % 11 === 0) continue;
        ctx.fillStyle = i % 9 ? 'rgba(255,246,196,.85)' : '#9fd8ff'; ctx.fillRect(x, y, 1, 1);
        if (i % 17 === 0) { ctx.fillStyle = 'rgba(255,246,196,.35)'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
      }
      // księżyc z poświatą
      const mx = Math.floor(W * 0.8), my = groundY - 170;
      const g = ctx.createRadialGradient(mx + 5, my + 5, 2, mx + 5, my + 5, 40); g.addColorStop(0, 'rgba(255,240,190,.18)'); g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g; ctx.fillRect(mx - 40, my - 40, 90, 90);
      ctx.fillStyle = '#fff3c0'; ctx.fillRect(mx, my, 10, 10); ctx.fillRect(mx - 1, my + 2, 12, 6); ctx.fillRect(mx + 2, my - 1, 6, 12);
      ctx.fillStyle = '#e6d79a'; ctx.fillRect(mx + 2, my + 2, 2, 2); ctx.fillRect(mx + 6, my + 6, 2, 1); ctx.fillRect(mx + 6, my + 3, 1, 1);
      // daleki grzbiet z miasteczkiem i kominami
      for (let x = 0; x < W; x++) {
        const h = 20 + Math.floor(7 * Math.sin(x / 41) + 4 * Math.sin(x / 13 + 1));
        ctx.fillStyle = '#2a1c48'; ctx.fillRect(x, groundY - h, 1, h);
      }
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(hash(i, 21) * W), h = 4 + Math.floor(hash(i, 22) * 6), w = 4 + Math.floor(hash(i, 23) * 5);
        const base = groundY - 20 - Math.floor(7 * Math.sin(x / 41) + 4 * Math.sin(x / 13 + 1));
        ctx.fillStyle = '#231840'; ctx.fillRect(x, base - h, w, h + 2);
        if (hash(i, 24) < .7) { ctx.fillStyle = ((t / 1500 + i) | 0) % 5 ? '#ffcf6b' : '#7a5a30'; ctx.fillRect(x + 1, base - h + 2, 1, 1); }
        if (i % 4 === 0) { ctx.fillStyle = '#231840'; ctx.fillRect(x + w - 2, base - h - 9, 2, 9); ctx.fillStyle = '#ff4d63'; if (((t / 700 + i) | 0) % 2) ctx.fillRect(x + w - 2, base - h - 10, 2, 1); }
      }
      // bliższe hałdy i lasek świerków
      for (let x = 0; x < W; x++) {
        const h = 9 + Math.floor(6 * Math.sin(x / 23) + 4 * Math.sin(x / 9 + 1));
        ctx.fillStyle = '#1a1230'; ctx.fillRect(x, groundY - h, 1, h);
      }
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(hash(i, 31) * W), h = 7 + Math.floor(hash(i, 32) * 8);
        if (Math.abs(x - this.sx) < 46) continue;
        ctx.fillStyle = '#120d24';
        for (let k = 0; k < h; k++) { const w = Math.max(1, Math.floor((k + 1) / 2)); ctx.fillRect(x - w + 1, groundY - h - 2 + k, w * 2 - 1, 1); }
        ctx.fillRect(x, groundY - 2, 1, 2);
      }
      // płot przy drodze
      for (let x = 0; x < W; x += 6) { if (Math.abs(x - this.sx) < 40) continue; ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x, groundY - 5, 1, 5); }
      for (let x = 0; x < W; x++) { if (Math.abs(x - this.sx) < 40) continue; ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x, groundY - 4, 1, 1); }
      this.drawHeadframe(groundY, shake);
    }
    drawGalleries(cam, half) {
      const { ctx, W, H, sx, t } = this;
      const SP = 260 * PX_PER_M, GH = 16;
      const i0 = Math.max(0, Math.floor((cam - GH) / SP)), i1 = Math.floor((cam + H) / SP);
      for (let i = i0; i <= i1; i++) {
        const y = Math.round(120 * PX_PER_M + i * SP) - cam;
        if (y + GH < 0 || y > H) continue;
        const right = hash(i, 41) < .5, len = 60 + Math.floor(hash(i, 42) * 70);
        const x0 = right ? sx + half : sx - half - len;
        // wnętrze chodnika z wygasającą ciemnością
        ctx.fillStyle = '#0d0a16'; ctx.fillRect(x0, y, len, GH);
        const gr = ctx.createLinearGradient(right ? x0 : x0 + len, 0, right ? x0 + len : x0, 0);
        gr.addColorStop(0, 'rgba(255,200,110,.10)'); gr.addColorStop(1, 'rgba(0,0,0,.5)');
        ctx.fillStyle = gr; ctx.fillRect(x0, y, len, GH);
        // obudowa drewniana: odrzwia co 14 px
        for (let k = 4; k < len; k += 14) {
          const x = right ? x0 + k : x0 + len - k - 2;
          ctx.fillStyle = '#6b4423'; ctx.fillRect(x, y, 2, GH); ctx.fillRect(x - 3, y, 8, 2);
          ctx.fillStyle = '#8a5a30'; ctx.fillRect(x, y, 1, GH);
        }
        ctx.fillStyle = '#4a2f18'; ctx.fillRect(x0, y, len, 1);
        // tory
        ctx.fillStyle = '#3a2a1c'; for (let k = 0; k < len; k += 4) ctx.fillRect(x0 + k, GH - 2 + y, 2, 2);
        ctx.fillStyle = '#8b919c'; ctx.fillRect(x0, y + GH - 3, len, 1);
        // lampa przy wylocie
        const lx = right ? x0 + 9 : x0 + len - 10, ly = y + 4;
        const on = ((t / 90 + i * 13) | 0) % 37 !== 0;
        if (on) { const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22); g.addColorStop(0, 'rgba(255,214,120,.45)'); g.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 22, ly - 22, 44, 44); }
        ctx.fillStyle = '#555'; ctx.fillRect(lx, y + 2, 1, 2); ctx.fillStyle = on ? '#ffd56b' : '#6a5520'; ctx.fillRect(lx - 1, ly, 3, 2);
        // wózek z urobkiem
        if (hash(i, 43) < .65) {
          const wx = right ? x0 + 22 + Math.floor(hash(i, 44) * (len - 40)) : x0 + 8 + Math.floor(hash(i, 44) * (len - 40)), wy = y + GH - 10;
          ctx.fillStyle = '#5b5f6b'; ctx.fillRect(wx, wy + 1, 12, 6); ctx.fillStyle = '#7d8492'; ctx.fillRect(wx, wy + 1, 12, 1);
          ctx.fillStyle = '#2b2e35'; ctx.fillRect(wx + 2, wy + 7, 2, 2); ctx.fillRect(wx + 8, wy + 7, 2, 2);
          const oc = ORE[Math.min(5, Math.floor(hash(i, 45) * (2 + i * .4)))];
          ctx.fillStyle = oc; ctx.fillRect(wx + 1, wy - 1, 10, 2); ctx.fillRect(wx + 3, wy - 2, 6, 1);
        }
        // łuk stropu w skale
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x0, y - 1, len, 1); ctx.fillRect(x0, y + GH, len, 1);
      }
    }
    drawCage(x, y) {
      const ctx = this.ctx, t = this.t;
      // światło spod klatki
      const g = this.ctx.createRadialGradient(x + CAGE_W / 2, y + CAGE_H / 2, 2, x + CAGE_W / 2, y + CAGE_H / 2, 34);
      g.addColorStop(0, 'rgba(255,220,130,.28)'); g.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 30, y - 30, CAGE_W + 60, CAGE_H + 60);
      // zawieszenie
      ctx.fillStyle = '#8a929e'; ctx.fillRect(x + 8, y - 3, 10, 2); ctx.fillRect(x + 12, y - 5, 2, 2);
      // dach
      ctx.fillStyle = '#c23b22'; ctx.fillRect(x - 1, y, CAGE_W + 2, 3);
      ctx.fillStyle = '#e2552f'; ctx.fillRect(x - 1, y, CAGE_W + 2, 1);
      // wnętrze
      ctx.fillStyle = '#ffd98a'; ctx.fillRect(x + 2, y + 3, CAGE_W - 4, CAGE_H - 6);
      ctx.fillStyle = '#f0b65a'; ctx.fillRect(x + 2, y + CAGE_H - 7, CAGE_W - 4, 4);
      // siatka
      ctx.fillStyle = '#2a2f3a';
      for (let i = 4; i < CAGE_W - 2; i += 4) ctx.fillRect(x + i, y + 3, 1, CAGE_H - 6);
      for (let j = 7; j < CAGE_H - 3; j += 5) ctx.fillRect(x + 2, y + j, CAGE_W - 4, 1);
      // rama
      ctx.fillStyle = '#596170';
      ctx.fillRect(x, y + 3, 2, CAGE_H - 3); ctx.fillRect(x + CAGE_W - 2, y + 3, 2, CAGE_H - 3);
      ctx.fillRect(x, y + CAGE_H - 3, CAGE_W, 3);
      ctx.fillStyle = '#7d8696'; ctx.fillRect(x, y + 3, 1, CAGE_H - 3);
      // lampa sygnałowa
      const on = !this.moving || ((t / 220) | 0) % 2 === 0;
      ctx.fillStyle = this.moving ? (on ? '#ff4d63' : '#5a1820') : '#7dff6b';
      ctx.fillRect(x + CAGE_W - 6, y - 2, 3, 2);
    }
    drawHeadframe(groundY, shake) {
      const ctx = this.ctx, sx = this.sx, t = this.t;
      const topY = groundY - 64;
      // nadszybie (budynek)
      ctx.fillStyle = '#5b2e2a'; ctx.fillRect(sx + 20, groundY - 26, 46, 26);
      ctx.fillStyle = '#6e3a33';
      for (let y = groundY - 24; y < groundY; y += 4) for (let x = sx + 20 + ((y / 4) % 2) * 3; x < sx + 66; x += 6) ctx.fillRect(x, y, 5, 3);
      ctx.fillStyle = '#3b1f1c'; ctx.fillRect(sx + 18, groundY - 29, 50, 3);
      for (let i = 0; i < 4; i++) { const lit = hash(i, 9) < .7; ctx.fillStyle = lit ? '#ffd56b' : '#2a1a18'; ctx.fillRect(sx + 25 + i * 10, groundY - 20, 5, 6); }
      // komin
      ctx.fillStyle = '#6e3a33'; ctx.fillRect(sx + 56, groundY - 48, 6, 22);
      ctx.fillStyle = '#ffffff22'; for (let i = 0; i < 4; i++) { const k = ((t / 90) + i * 12) % 48; ctx.fillRect(sx + 57 + Math.round(Math.sin(k / 6) * 2) + k / 4, groundY - 50 - k, 3, 3); }
      // wieża (kratownica)
      ctx.fillStyle = '#2f6fdc';
      for (let y = topY; y < groundY; y++) {
        const k = (y - topY) / (groundY - topY);
        const off = Math.round(10 + k * 10);
        ctx.fillRect(sx - off, y, 2, 1); ctx.fillRect(sx + off - 1, y, 2, 1);
      }
      ctx.fillStyle = '#245bb8';
      for (let y = topY + 8; y < groundY; y += 10) {
        const k1 = (y - topY) / (groundY - topY), k2 = (y + 10 - topY) / (groundY - topY);
        const a = Math.round(10 + k1 * 10), b = Math.round(10 + k2 * 10);
        for (let i = 0; i <= 10; i++) { const xx = Math.round(-a + (a + b) * i / 10); ctx.fillRect(sx + xx, y + i, 1, 1); }
        ctx.fillRect(sx - a, y, a * 2, 1);
      }
      // pomost i koła linowe
      ctx.fillStyle = '#1d4a99'; ctx.fillRect(sx - 14, topY - 2, 28, 3);
      this.drawWheel(sx - 4, topY - 8);
      this.drawWheel(sx + 4, topY - 8);
      // światło ostrzegawcze
      ctx.fillStyle = ((t / 600) | 0) % 2 ? '#ff4d63' : '#661a24'; ctx.fillRect(sx - 1, topY - 17, 2, 2);
    }
    drawWheel(cx, cy) {
      const ctx = this.ctx, r = 6;
      ctx.fillStyle = '#c9ced6';
      for (let a = 0; a < 32; a++) { const an = a / 32 * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r), 1, 1); }
      ctx.fillStyle = '#8a929e';
      for (let k = 0; k < 3; k++) {
        const an = this.wheel + k * Math.PI / 3;
        for (let d = -r + 1; d < r; d++) ctx.fillRect(Math.round(cx + Math.cos(an) * d), Math.round(cy + Math.sin(an) * d), 1, 1);
      }
      ctx.fillStyle = '#ffcc1a'; ctx.fillRect(cx, cy, 1, 1);
    }
  }

  // ---------- dźwięk 8-bit ----------
  let ac = null;
  let muted = false;
  try { muted = localStorage.getItem('szyb-muted') === '1'; } catch {}
  function audio() {
    if (muted) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, start, dur, type = 'square', vol = 0.06) {
    const a = audio(); if (!a || !isFinite(freq)) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + start);
    g.gain.setValueAtTime(vol, a.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start); o.stop(a.currentTime + start + dur + 0.02);
  }
  const NOTES = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];
  const Sound = {
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('szyb-muted', muted ? '1' : '0'); } catch {} return muted; },
    hit(tier) { const n = 2 + tier; for (let i = 0; i < n; i++) tone(NOTES[Math.min(NOTES.length - 1, i + Math.max(0, tier - 3))], i * 0.07, 0.12); },
    miss() { tone(140, 0, 0.18, 'sawtooth', 0.05); tone(110, 0.12, 0.22, 'sawtooth', 0.05); },
    tick() { tone(1200, 0, 0.04, 'square', 0.03); },
    click() { tone(660, 0, 0.04, 'square', 0.03); },
    start() { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.12)); },
    end() { [784, 659, 784, 1047, 988, 1047].forEach((f, i) => tone(f, i * 0.12, 0.16, 'triangle', 0.08)); },
    timeout() { [440, 392, 349, 262].forEach((f, i) => tone(f, i * 0.12, 0.16, 'square', 0.05)); },
  };

  // ---------- efekty DOM ----------
  function floater(host, text, color) {
    const el = document.createElement('div');
    el.className = 'floater'; el.textContent = text; el.style.color = color;
    host.appendChild(el); setTimeout(() => el.remove(), 1500);
  }
  function burst(host, color, n = 18) {
    const r = host.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'burst';
      p.style.background = color;
      p.style.left = (r.width / 2) + 'px'; p.style.top = (r.height * 0.45) + 'px';
      const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 110;
      p.style.setProperty('--dx', Math.round(Math.cos(ang) * dist / 4) * 4 + 'px');
      p.style.setProperty('--dy', Math.round(Math.sin(ang) * dist / 4) * 4 + 'px');
      host.appendChild(p); setTimeout(() => p.remove(), 900);
    }
  }
  function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function typewriter(el, text) {
    clearInterval(el._tw);
    el.textContent = ''; el.classList.add('typing');
    let i = 0;
    el._tw = setInterval(() => {
      i += 2; el.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(el._tw); el.classList.remove('typing'); }
    }, 28);
  }
  function countUp(el, to, fmt, ms = 1200) {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  window.SZYB_FX = { LAYERS_M, Background, Sound, floater, burst, retrigger, typewriter, countUp };
})();
