// Szyb – logowanie przez Google (Google Identity Services). Działa, gdy serwer ma ustawione GOOGLE_CLIENT_ID.
(() => {
  const box = document.getElementById('authBox');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tokenGet = () => { try { return localStorage.getItem('szyb-token'); } catch { return null; } };
  const tokenSet = (t) => { try { t ? localStorage.setItem('szyb-token', t) : localStorage.removeItem('szyb-token'); } catch {} };

  const AUTH = { user: null, enabled: false, report, onChange: [] };
  window.SZYB_AUTH = AUTH;

  async function call(path, body) {
    const t = tokenGet();
    const res = await fetch('/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Błąd serwera');
    return data;
  }

  function setUser(u) {
    AUTH.user = u;
    render();
    AUTH.onChange.forEach((f) => f(u));
    const name = document.getElementById('nameInput');
    if (u && name && !name.value) name.value = u.name.slice(0, 16);
  }

  function render() {
    if (!AUTH.enabled) { box.innerHTML = ''; return; }
    if (AUTH.user) {
      const u = AUTH.user;
      box.innerHTML = `<div class="me-chip">
        ${u.picture ? `<img src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer">` : ''}
        <span>${esc(u.name)}<small>rekord ${(u.best * 10).toLocaleString('pl-PL')} m</small></span>
        <button class="icon-btn" id="btnLogout">Wyloguj</button><button class="icon-btn danger-btn" id="btnDelAcc" title="Usuń konto i wszystkie zapisane wyniki">Usuń konto</button></div>`;
      document.getElementById('btnDelAcc').onclick = async () => {
        if (!confirm('Usunąć konto? Skasujemy Twoje imię, zdjęcie, rekord, wyniki i ranking. Tego nie da się cofnąć.')) return;
        try { await call('auth/delete', {}); } catch (e) { alert('Nie udało się usunąć konta. Spróbuj ponownie albo napisz na kontakt@szyb.app.'); return; }
        tokenSet(null);
        if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
        setUser(null);
      };
      document.getElementById('btnLogout').onclick = async () => {
        try { await call('auth/logout', {}); } catch {}
        tokenSet(null);
        if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
        setUser(null);
      };
    } else {
      box.innerHTML = '<div id="gBtn"></div>';
      if (window.google && google.accounts) {
        google.accounts.id.renderButton(document.getElementById('gBtn'), {
          theme: 'filled_black', size: 'medium', shape: 'rectangular', text: 'signin_with', locale: 'pl',
        });
      }
    }
  }

  async function onCredential(resp) {
    try {
      const r = await call('auth/google', { credential: resp.credential });
      tokenSet(r.token);
      setUser(r.user);
    } catch (e) {
      const t = document.getElementById('toast');
      if (t) { t.textContent = 'Logowanie nie powiodło się: ' + e.message; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
    }
  }

  // Zapis wyniku na koncie (tylko zalogowani)
  async function report(mode, score, date, keys) {
    if (!AUTH.user) return;
    try { const r = await call('score', { mode, score, date, keys }); if (r.user) setUser(r.user); } catch {}
  }

  async function init() {
    if (!location.protocol.startsWith('http')) return;
    let cfg;
    try { cfg = await call('config'); } catch { return; }   // brak serwera (wersja demo)
    if (!cfg.googleClientId) return;
    AUTH.enabled = true;
    if (tokenGet()) { try { setUser((await call('me')).user); } catch { tokenSet(null); } }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: onCredential, auto_select: false, ux_mode: 'popup' });
      render();
    };
    document.head.appendChild(s);
    render();
  }
  init();
})();
