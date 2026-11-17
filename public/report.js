// Szyb – „Zgłoś błąd”: opis + opcjonalny zrzut ekranu (z pliku albo wklejony Ctrl+V). Trafia do panelu autora.
(() => {
  const ls = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  let shot = null;   // data URL zmniejszonego zrzutu

  const box = document.createElement('div');
  box.className = 'rep-back'; box.hidden = true;
  box.innerHTML = `<form class="rep" role="dialog" aria-modal="true" aria-labelledby="repT">
    <h3 id="repT">Zgłoś błąd</h3>
    <p class="rep-sub">Napisz, co się stało. Możesz dołączyć zrzut ekranu.</p>
    <textarea id="repText" maxlength="1500" rows="5" placeholder="np. w multi po wybuchu nie zmieniło się pytanie…"></textarea>
    <label class="rep-file"><input type="file" id="repFile" accept="image/png,image/jpeg,image/webp"><span>+ DODAJ ZRZUT EKRANU</span></label>
    <p class="rep-hint">albo wklej go tutaj skrótem Ctrl+V / ⌘V</p>
    <div class="rep-prev" id="repPrev" hidden><img id="repImg" alt="Podgląd zrzutu"><button type="button" id="repDel" aria-label="Usuń zrzut">✕</button></div>
    <p class="rep-err" id="repErr"></p>
    <div class="rep-row"><button type="button" class="rep-cancel" id="repCancel">ANULUJ</button><button type="submit" class="rep-send" id="repSend">WYŚLIJ ZGŁOSZENIE</button></div>
    <p class="rep-note">Zgłoszenie z adresem strony i rodzajem przeglądarki zobaczy tylko autor gry. Szczegóły w <a href="/prywatnosc">polityce prywatności</a>.</p>
  </form>`;
  document.body.appendChild(box);
  const $ = (id) => document.getElementById(id);

  function open() {
    $('repErr').textContent = ''; box.hidden = false;
    setTimeout(() => $('repText').focus(), 30);
  }
  function close() { box.hidden = true; }
  function reset() { $('repText').value = ''; setShot(null); $('repFile').value = ''; }
  function setShot(url) {
    shot = url;
    $('repPrev').hidden = !url;
    if (url) $('repImg').src = url; else $('repImg').removeAttribute('src');
  }

  // zmniejszamy obrazek w przeglądarce (max 1600 px, JPEG), żeby wysyłka była lekka
  function loadImage(file) {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) { $('repErr').textContent = 'To musi być obrazek (PNG, JPG albo WebP).'; return; }
    if (file.size > 25 * 1024 * 1024) { $('repErr').textContent = 'Ten plik jest za duży.'; return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.85, out = c.toDataURL('image/jpeg', q);
      while (out.length > 2.6e6 && q > 0.4) { q -= 0.15; out = c.toDataURL('image/jpeg', q); }
      URL.revokeObjectURL(url);
      $('repErr').textContent = '';
      setShot(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); $('repErr').textContent = 'Nie udało się wczytać obrazka.'; };
    img.src = url;
  }
  $('repFile').addEventListener('change', (e) => loadImage(e.target.files[0]));
  box.addEventListener('paste', (e) => {
    const it = [...(e.clipboardData ? e.clipboardData.items : [])].find((x) => x.kind === 'file' && /^image\//.test(x.type));
    if (it) { e.preventDefault(); loadImage(it.getAsFile()); }
  });
  $('repDel').onclick = () => { setShot(null); $('repFile').value = ''; };
  $('repCancel').onclick = close;
  box.addEventListener('mousedown', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });

  box.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const text = $('repText').value.trim();
    if (text.length < 3 && !shot) { $('repErr').textContent = 'Opisz, co się stało.'; return; }
    const btn = $('repSend'); btn.disabled = true; btn.textContent = 'WYSYŁAM…';
    try {
      let t = null; try { t = localStorage.getItem('szyb-token'); } catch {}
      const r = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
        body: JSON.stringify({ text, image: shot, page: location.pathname, device: ls('szyb-device') }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Nie udało się wysłać.');
      reset(); close();
      const ok = document.createElement('div'); ok.className = 'rep-ok'; ok.textContent = 'Dzięki! Zgłoszenie trafiło do autora gry.';
      document.body.appendChild(ok); setTimeout(() => ok.remove(), 3200);
    } catch (err) { $('repErr').textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = 'WYŚLIJ ZGŁOSZENIE'; }
  };

  // każdy element z data-report otwiera okno
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-report]');
    if (a) { e.preventDefault(); open(); }
  });
  window.SzybReport = { open };
})();
