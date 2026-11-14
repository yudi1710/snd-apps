/**
 * Inti SND Apps (PWA di GitHub Pages, backend Apps Script).
 *  - Auth: Google Identity Services -> ID token (1 jam). Dikirim ke Apps Script di setiap panggilan,
 *    server memverifikasi token & domain. Token disimpan di sessionStorage saja.
 *  - Halaman mendaftar lewat App.daftar({ id, label, ikon, render(el, ui) }).
 */
window.App = (function () {
  const CFG = window.SND_CONFIG || {};
  const halaman = [];
  const state = { aktif: null, email: '', konteks: null, token: '', tokenExp: 0 };
  const $ = id => document.getElementById(id);

  // ---------- helper teks & angka ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const angka = n => Number(n || 0).toLocaleString('id-ID');
  const rp = n => 'Rp ' + angka(Math.round(n || 0));
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const tanggal = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : (iso || '-'); };
  const hariAntara = (isoA, isoB) => Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86400000);
  const inisial = email => (email || '?').split('@')[0].split(/[._-]/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase() || '?';
  const namaDariEmail = email => (email || '').split('@')[0].split(/[._-]/).map(s => s ? s[0].toUpperCase() + s.slice(1) : '').join(' ');

  const ikon = {
    monitor: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 13l3-3 2 2 4-5"/></svg>',
    sync: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M20 4v4h-4M4 20v-4h4"/></svg>',
    cari: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    luar: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
    kosong: '<svg viewBox="0 0 24 24"><path d="M4 7h16l-1.5 12h-13zM9 7V5a3 3 0 0 1 6 0v2"/></svg>',
    grafik: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    beranda: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/></svg>',
    kartu: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    keluar: '<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>',
  };

  // ---------- auth (Google Identity Services) ----------
  function tokenValid() { return !!state.token && Date.now() < state.tokenExp - 60_000; }

  function simpanToken(cred) {
    try {
      const payload = JSON.parse(atob(cred.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const email = String(payload.email || '').toLowerCase();
      if (!email.endsWith('@' + CFG.domain)) { toast(`Hanya akun @${CFG.domain} yang boleh masuk (kamu: ${email || 'tidak dikenal'}).`, true); keluar(false); return false; }
      state.token = cred;
      state.tokenExp = (payload.exp || 0) * 1000;
      state.email = email;
      sessionStorage.setItem('snd_token', cred);
      return true;
    } catch (e) { return false; }
  }

  function muatTokenTersimpan() {
    const t = sessionStorage.getItem('snd_token');
    if (t && simpanToken(t) && tokenValid()) return true;
    sessionStorage.removeItem('snd_token');
    state.token = ''; state.tokenExp = 0;
    return false;
  }

  let gisSiap = false;
  function siapkanGIS(callback) {
    if (!window.google || !google.accounts) { setTimeout(() => siapkanGIS(callback), 200); return; }
    if (!gisSiap) {
      google.accounts.id.initialize({
        client_id: CFG.clientId,
        hd: CFG.domain,
        auto_select: true,
        itp_support: true,
        use_fedcm_for_prompt: true,
        callback: r => { if (simpanToken(r.credential)) callback(); },
      });
      gisSiap = true;
    }
    const wadah = $('tombolGoogle');
    if (wadah) {
      wadah.innerHTML = '';
      google.accounts.id.renderButton(wadah, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', width: 280, locale: 'id' });
    }
    google.accounts.id.prompt();
  }

  function tampilLogin(pesan) {
    $('login').classList.add('tampil');
    $('loginPesan').textContent = pesan || '';
    siapkanGIS(() => { $('login').classList.remove('tampil'); setelahMasuk(); });
  }

  function keluar(tampilkanLogin) {
    sessionStorage.removeItem('snd_token');
    state.token = ''; state.tokenExp = 0; state.email = '';
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    if (tampilkanLogin !== false) tampilLogin('Kamu sudah keluar.');
  }

  /** Pastikan ada token valid; kalau tidak, minta login ulang (silent dulu lewat auto_select). */
  function pastikanToken() {
    if (tokenValid()) return Promise.resolve(state.token);
    return new Promise(resolve => {
      tampilLogin('Sesi habis, masuk lagi ya.');
      const cek = setInterval(() => { if (tokenValid()) { clearInterval(cek); resolve(state.token); } }, 300);
    });
  }

  // ---------- panggilan server ----------
  /** api('getDataApp', ...args) -> POST text/plain ke Apps Script (tanpa preflight CORS). */
  async function api(aksi, ...args) {
    const token = await pastikanToken();
    const res = await fetch(CFG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token, aksi, args }), redirect: 'follow' });
    const teks = await res.text();
    let j;
    try { j = JSON.parse(teks); } catch (e) { throw new Error('Jawaban server tidak dikenal (cek URL API).'); }
    if (j.error) {
      if (j.kode === 401) { keluar(true); }
      throw new Error(j.error);
    }
    return j.data;
  }

  // ---------- toast ----------
  let toastTimer = null;
  function toast(teks, gagal) {
    const el = $('toast');
    el.textContent = teks;
    el.className = 'toast tampil' + (gagal ? ' gagal' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, gagal ? 6000 : 2600);
  }

  // ---------- bottom sheet ----------
  const sheet = {
    buka(judul, html) {
      $('sheetJudul').innerHTML = judul;
      $('sheetBadan').innerHTML = html;
      $('sheet').classList.add('terbuka');
      $('sheet').setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('sheetBadan').scrollTop = 0;
    },
    tutup() {
      $('sheet').classList.remove('terbuka');
      $('sheet').setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    },
    badan: () => $('sheetBadan'),
  };

  // ---------- navigasi ----------
  function daftar(h) { halaman.push(h); }

  function gambarNav() {
    const tombol = (h, pendek) => `<button type="button" class="${h.id === state.aktif ? 'aktif' : ''}" data-hal="${esc(h.id)}">${ikon[h.ikon] || ikon.monitor}<span>${esc(pendek ? (h.pendek || h.label) : h.label)}</span></button>`;
    $('navSamping').innerHTML = halaman.map(h => tombol(h, false)).join('');
    $('bottomnav').innerHTML = halaman.map(h => tombol(h, true)).join('');
    document.querySelectorAll('[data-hal]').forEach(b => b.addEventListener('click', () => { buka(b.dataset.hal); tutupLaci(); }));
  }

  function buka(id) {
    const h = halaman.find(x => x.id === id) || halaman[0];
    if (!h) return;
    state.aktif = h.id;
    try { if (location.hash !== '#' + h.id) history.replaceState(null, '', '#' + h.id); } catch (e) {}
    $('judulHal').textContent = h.label;
    $('subHal').textContent = '';
    $('aksiHal').innerHTML = '';
    gambarNav();
    const view = $('view');
    view.innerHTML = '';
    h.render(view, { setSub: t => { $('subHal').textContent = t; }, setAksi: html => { $('aksiHal').innerHTML = html; } });
  }

  function bukaLaci() { $('sidebar').classList.add('terbuka'); $('tirai').classList.add('terbuka'); }
  function tutupLaci() { $('sidebar').classList.remove('terbuka'); $('tirai').classList.remove('terbuka'); }

  function gambarPengguna() {
    $('avatarSamping').textContent = inisial(state.email);
    $('namaSamping').textContent = state.email ? namaDariEmail(state.email) : 'Tim SND';
    $('emailSamping').textContent = state.email || CFG.domain;
  }

  function setelahMasuk() {
    gambarPengguna();
    const awal = location.hash.slice(1);
    buka(halaman.some(h => h.id === awal) ? awal : (halaman[0] && halaman[0].id));
    api('getKonteks').then(k => { state.konteks = k; }).catch(() => {});
  }

  // ---------- mulai ----------
  function mulai() {
    $('btnMenu').addEventListener('click', bukaLaci);
    $('tirai').addEventListener('click', tutupLaci);
    $('btnKeluar').addEventListener('click', () => keluar(true));
    document.querySelectorAll('[data-tutup]').forEach(el => el.addEventListener('click', sheet.tutup));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') sheet.tutup(); });
    window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== state.aktif) buka(id); });
    $('versiApp').textContent = 'v' + (CFG.versi || '');
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

    if (!CFG.clientId || CFG.clientId.startsWith('GANTI') || !CFG.apiUrl || CFG.apiUrl.startsWith('GANTI')) {
      $('login').classList.add('tampil');
      $('loginPesan').textContent = 'Konfigurasi belum lengkap: isi apiUrl dan clientId di js/config.js.';
      return;
    }
    if (muatTokenTersimpan()) setelahMasuk(); else tampilLogin('');
  }

  return { daftar, halaman: () => halaman, buka, mulai, api, toast, sheet, keluar, esc, angka, rp, tanggal, hariAntara, ikon, state, $ };
})();
