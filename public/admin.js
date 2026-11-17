// Szyb – panel autora: przegląd propozycji pytań, przyjmowanie (z odpowiedziami w 6 pokładach) i odrzucanie.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TIERS = window.SZYB_DATA.TIERS;
  let key = ''; try { key = sessionStorage.getItem('szyb-admin') || ''; } catch {}
  let data = { suggestions: [], categories: [] }, reports = [], misses = [], missTotal = 0, filter = 'new';
  const imgUrls = new Map();   // id zgłoszenia -> adres obrazka (pobranego z kluczem w nagłówku)

  async function api(path, body) {
    const r = await fetch('/api/admin/' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Błąd serwera');
    return d;
  }
  const say = (t) => { $('msg').textContent = t; };

  async function load() {
    try {
      data = await api('suggestions');
      reports = (await api('reports')).reports || [];
      const ms = await api('misses'); misses = ms.misses || []; missTotal = ms.total || 0;
      try { sessionStorage.setItem('szyb-admin', key); } catch {}
      $('login').hidden = true; $('main').hidden = false;
      render();
    } catch (e) {
      $('login').hidden = false; $('main').hidden = true;
      if (key) alert(e.message === 'Zły klucz' ? 'Zły klucz panelu.' : e.message);
    }
  }

  function form(sg) {
    const ex = sg && sg.answers ? `<p class="note">Przykłady od gracza: ${esc(sg.answers)}</p>` : '';
    return `<div class="acc">
      <input class="fq" value="${esc(sg ? sg.text : '')}" placeholder="Treść pytania, np. Podaj coś, co można znaleźć w lodówce">
      ${ex}
      <p class="note">Wpisz odpowiedzi w pokładach: jedna odpowiedź na linię, warianty tej samej odpowiedzi rozdziel znakiem | (np. <b>ziemniak|kartofel</b>). Od najpopularniejszych (Piasek) do najrzadszych (Diament). W Diamencie wpisz tylko 1–3 najmniej oczywiste odpowiedzi. Potrzeba co najmniej 6 odpowiedzi.</p>
      <div class="tiers">${TIERS.map((t) => `<div><label style="color:${t.color}">${t.name} · ${t.pts} pkt</label><textarea class="ft" data-t="${t.id}" placeholder="${t.id === 0 ? 'najbardziej oczywiste' : t.id === 5 ? 'najrzadsze' : ''}"></textarea></div>`).join('')}</div>
      <div class="row"><button class="ok fsave">ZAPISZ I WPUŚĆ DO GRY OD JUTRA</button><button class="fcancel">ANULUJ</button></div>
    </div>`;
  }
  function openForm(host, sg) {
    host.insertAdjacentHTML('beforeend', form(sg));
    const box = host.querySelector('.acc');
    box.querySelector('.fcancel').onclick = () => box.remove();
    box.querySelector('.fsave').onclick = async () => {
      const tiers = [...box.querySelectorAll('.ft')].map((t) => t.value);
      try {
        await api('accept', { id: sg ? sg.id : '', q: box.querySelector('.fq').value, tiers });
        say('Zapisane. Pytanie wejdzie do losowania od jutra.');
        load();
      } catch (e) { alert(e.message); }
    };
    box.querySelector('.fq').focus();
  }

  function render() {
    document.querySelectorAll('.tabs [data-f]').forEach((b) => {
      const n = b.dataset.f === 'reports' ? reports.filter((r) => r.status === 'new').length : b.dataset.f === 'misses' ? missTotal : data.suggestions.filter((s) => s.status === b.dataset.f).length;
      b.classList.toggle('on', b.dataset.f === filter);
      b.innerHTML = { new: 'NOWE', accepted: 'PRZYJĘTE', rejected: 'ODRZUCONE', reports: 'ZGŁOSZENIA BŁĘDÓW', misses: 'BRAKUJĄCE ODPOWIEDZI' }[b.dataset.f] + `<span class="badge">${n}</span>`;
    });
    if (filter === 'reports') { renderReports(); renderCats(); return; }
    if (filter === 'misses') { renderMisses(); renderCats(); return; }
    const rows = data.suggestions.filter((s) => s.status === filter);
    $('list').innerHTML = rows.length ? rows.map((s) => `<div class="card" data-id="${esc(s.id)}">
        <div class="q">${esc(s.text)}</div>
        <div class="meta">${new Date(s.created).toLocaleString('pl-PL')}${s.by ? ' · ' + esc(s.by) : ' · gość'}${s.answers ? ' · przykłady: ' + esc(s.answers) : ''}</div>
        ${s.status === 'new' ? '<div class="row"><button class="ok bacc">PRZYJMIJ…</button><button class="no brej">ODRZUĆ</button></div>' : ''}
      </div>`).join('') : '<p class="muted">Pusto.</p>';
    $('list').querySelectorAll('.card').forEach((c) => {
      const sg = data.suggestions.find((s) => s.id === c.dataset.id);
      const a = c.querySelector('.bacc'), r = c.querySelector('.brej');
      if (a) a.onclick = () => { if (!c.querySelector('.acc')) openForm(c, sg); };
      if (r) r.onclick = async () => { try { await api('reject', { id: sg.id }); say('Odrzucone.'); load(); } catch (e) { alert(e.message); } };
    });
    renderCats();
  }
  // odpowiedzi, których gra nie znała – najczęstsze na górze; DODAJ dopisuje do bazy od razu
  function renderMisses() {
    const opt = (sel) => TIERS.slice(0, 5).map((t) => `<option value="${t.id}"${t.id === sel ? ' selected' : ''}>${t.name} · ${t.pts} pkt</option>`).join('');
    $('list').innerHTML = (misses.length ? '<p class="note">Odpowiedzi wpisane przez graczy, których gra nie uznała. Popraw pisownię, jeśli trzeba, wybierz pokład i kliknij DODAJ: odpowiedź działa od razu. POMIŃ chowa ją na zawsze.</p>' : '') +
      (misses.length ? misses.map((m, i) => `<div class="card miss" data-i="${i}">
        <div><input class="mt" value="${esc(m.t)}"><div class="meta">${esc(m.q)} · wpisało ${m.n} ${m.n === 1 ? 'osoba' : m.n < 5 ? 'osoby' : 'osób'}</div></div>
        <div class="row"><select class="mtier">${opt(m.n >= 5 ? 3 : 4)}</select><button class="ok badd">DODAJ</button><button class="no bign">POMIŃ</button></div>
      </div>`).join('') : '<p class="muted">Na razie gracze nie wpisali niczego, czego gra by nie znała.</p>');
    $('list').querySelectorAll('.miss').forEach((c) => {
      const m = misses[+c.dataset.i];
      const done = () => { misses.splice(misses.indexOf(m), 1); missTotal--; c.remove(); render(); };
      c.querySelector('.badd').onclick = async () => { try { await api('miss-add', { cat: m.cat, key: m.key, text: c.querySelector('.mt').value, tier: +c.querySelector('.mtier').value }); say(`Dodane: ${c.querySelector('.mt').value}`); done(); } catch (e) { alert(e.message); } };
      c.querySelector('.bign').onclick = async () => { try { await api('miss-ignore', { cat: m.cat, key: m.key }); done(); } catch (e) { alert(e.message); } };
    });
  }
  function renderReports() {
    $('list').innerHTML = reports.length ? reports.map((r) => `<div class="card${r.status === 'done' ? ' done' : ''}" data-id="${esc(r.id)}">
        <div class="rep-text">${esc(r.text) || '<span class="muted">(bez opisu)</span>'}</div>
        ${r.img ? '<img class="rep-img" alt="Zrzut ekranu">' : ''}
        <div class="meta">${new Date(r.created).toLocaleString('pl-PL')} · ${r.by ? esc(r.by) : 'gość'} · strona ${esc(r.page || '?')}<br>${esc(r.ua)}</div>
        <div class="row"><button class="ok bdone">${r.status === 'done' ? 'PRZYWRÓĆ' : 'ZAŁATWIONE'}</button><button class="no bdel">USUŃ</button></div>
      </div>`).join('') : '<p class="muted">Brak zgłoszeń.</p>';
    $('list').querySelectorAll('.card').forEach(async (c) => {
      const id = c.dataset.id;
      c.querySelector('.bdone').onclick = async () => { try { await api('report-done', { id }); load(); } catch (e) { alert(e.message); } };
      c.querySelector('.bdel').onclick = async () => { if (!confirm('Usunąć zgłoszenie razem ze zrzutem? Tego nie da się cofnąć.')) return; try { await api('report-delete', { id }); load(); } catch (e) { alert(e.message); } };
      const im = c.querySelector('.rep-img'); if (!im) return;
      try {
        if (!imgUrls.has(id)) {
          const r = await fetch('/api/admin/report-img?id=' + encodeURIComponent(id), { headers: { 'X-Admin-Key': key } });
          if (!r.ok) throw new Error();
          imgUrls.set(id, URL.createObjectURL(await r.blob()));
        }
        im.src = imgUrls.get(id); im.onclick = () => window.open(im.src, '_blank');
      } catch { im.replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'Nie udało się wczytać zrzutu.' })); }
    });
  }
  function renderCats() {
    const today = new Date(); const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    $('cats').innerHTML = data.categories.length ? data.categories.map((c) => {
      const n = c.tiers.reduce((a, t) => a + t.length, 0);
      const state = c.until ? `wycofane od ${c.until}` : c.since > ds ? `wchodzi do gry ${c.since}` : `w grze od ${c.since}`;
      return `<div class="card" data-id="${esc(c.id)}"><div class="q">${esc(c.q)}</div><div class="meta">${n} odpowiedzi · ${state}${c.by ? ' · zaproponował(a) ' + esc(c.by) : ''}</div>
        ${c.until ? '' : '<div class="row"><button class="no bret">WYCOFAJ OD JUTRA</button></div>'}</div>`;
    }).join('') : '<p class="muted">Jeszcze żadne pytanie z propozycji nie jest w grze.</p>';
    $('cats').querySelectorAll('.bret').forEach((b) => (b.onclick = async () => {
      const id = b.closest('.card').dataset.id;
      try { await api('retire', { id }); say('Pytanie zniknie z losowania od jutra.'); load(); } catch (e) { alert(e.message); }
    }));
  }

  document.querySelectorAll('.tabs [data-f]').forEach((b) => (b.onclick = () => { filter = b.dataset.f; render(); }));
  $('btnNew').onclick = () => { filter = 'new'; render(); const host = document.createElement('div'); host.className = 'card'; $('list').prepend(host); openForm(host, null); };
  $('btnLogin').onclick = () => { key = $('key').value.trim(); load(); };
  $('key').onkeydown = (e) => { if (e.key === 'Enter') $('btnLogin').click(); };
  $('btnLogout').onclick = () => { key = ''; try { sessionStorage.removeItem('szyb-admin'); } catch {} $('login').hidden = false; $('main').hidden = true; };
  if (key) load();
})();
