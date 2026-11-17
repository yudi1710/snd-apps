/**
 * Inti SND Apps (PWA di GitHub Pages, backend Apps Script).
 *  - Auth: Google Identity Services -> ID token (1 jam). Dikirim ke Apps Script di setiap panggilan,
 *    server memverifikasi token & domain. Token disimpan di sessionStorage saja.
 *  - Halaman mendaftar lewat App.daftar({ id, label, ikon, render(el, ui) }).
 */
window.App = (function () {
  const CFG = window.SND_CONFIG || {};
  const halaman = [];
  const state = { aktif: null, email: '', konteks: null, token: '', tokenExp: 0, sesi: '', sesiExp: 0, bukaPO: '', awal: null, query: new URLSearchParams() };
  const memo = {};
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
    lonceng: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 21h4"/></svg>',
    kotak: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>',
    jam: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    centang: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4.5 4.5L19 7"/></svg>',
    panah: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    loncengMati: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 9.3-5M18 8c0 4 1 6 2 7H8M10 21h4M3 3l18 18"/></svg>',
    tambah: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    unduh: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>',
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
      state.nama = String(payload.name || '').trim();
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
      google.accounts.id.renderButton(wadah, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', width: Math.max(200, Math.min(360, Math.floor(wadah.clientWidth || 280))), locale: 'id', logo_alignment: 'left' });
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
    hapusSesi();
    Object.keys(memo).forEach(k => delete memo[k]);
    try { Object.keys(localStorage).filter(k => k.startsWith('snd_c_')).forEach(k => localStorage.removeItem(k)); } catch (e) {} // hapus cache offline milik akun ini
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
    // sesi SND Apps (7 hari) kalau ada, kalau tidak ID token Google
    return panggil(sesiValid() ? { sesi: state.sesi } : { token: await pastikanToken() }, aksi, args);
  }

  async function panggil(kredensial, aksi, args) {
    let teks;
    try {
      const res = await fetch(CFG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...kredensial, aksi, args }), redirect: 'follow' });
      teks = await res.text();
    } catch (e) {
      const err = new Error('Tidak ada koneksi ke server.');
      err.jaringan = true; // dipakai untuk jatuh ke data offline
      throw err;
    }
    let j;
    try { j = JSON.parse(teks); } catch (e) { throw new Error('Jawaban server tidak dikenal (cek URL API).'); }
    if (j.error) {
      if (j.kode === 401) { hapusSesi(); keluar(true); }
      throw new Error(j.error);
    }
    return j.data;
  }

  // ---------- sesi SND Apps (localStorage, dipakai bersama Chrome & APK) ----------
  const SESI_KEY = 'snd_sesi';
  const sesiValid = () => !!state.sesi && Date.now() < state.sesiExp - 60_000;
  function hapusSesi() { state.sesi = ''; state.sesiExp = 0; try { localStorage.removeItem(SESI_KEY); } catch (e) {} }

  /** Pakai sesi tersimpan (mis. login dilakukan di Chrome, lalu APK dibuka). */
  function muatSesi() {
    try {
      const j = JSON.parse(localStorage.getItem(SESI_KEY) || 'null');
      if (!j || !j.sesi || !j.email || Date.now() >= j.exp - 60_000) { localStorage.removeItem(SESI_KEY); return false; }
      state.sesi = j.sesi; state.sesiExp = j.exp; state.email = j.email; state.nama = j.nama || '';
      return true;
    } catch (e) { return false; }
  }

  /** Setelah login Google berhasil: minta server menerbitkan sesi 7 hari, simpan di perangkat. */
  function buatSesiBaru() {
    if (sesiValid() || !tokenValid()) return;
    panggil({ token: state.token }, 'buatSesi', []).then(simpanSesi)
      .catch(() => { /* sesi opsional: kalau gagal, tetap jalan dengan token Google */ });
  }

  function simpanSesi(s) {
    state.sesi = s.sesi; state.sesiExp = s.exp;
    try { localStorage.setItem(SESI_KEY, JSON.stringify({ sesi: s.sesi, exp: s.exp, email: s.email, nama: s.nama })); } catch (e) {}
  }

  // ---------- cache offline (localStorage, per akun) ----------
  const cacheKey = aksi => 'snd_c_' + aksi;
  function simpanCache(aksi, d) {
    try { localStorage.setItem(cacheKey(aksi), JSON.stringify({ t: Date.now(), u: state.email, d })); }
    catch (e) { try { localStorage.removeItem(cacheKey(aksi)); } catch (e2) {} } // kuota penuh: buang saja
  }
  function bacaCache(aksi) {
    try {
      const j = JSON.parse(localStorage.getItem(cacheKey(aksi)) || 'null');
      return j && j.d && j.u === state.email ? j : null;
    } catch (e) { return null; }
  }
  const jamCache = t => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // ---------- cache data bersama (dipakai halaman & notifikasi) ----------
  function kabari(aksi, data) { window.dispatchEvent(new CustomEvent('snd:data', { detail: { aksi, data } })); }
  /** Ambil data dengan cache ttl ms; panggilan serentak berbagi satu request. */
  function ambil(aksi, ttl, ...args) {
    const m = memo[aksi];
    if (m && ttl > 0 && Date.now() - m.t < ttl) return m.p;
    const p = api(aksi, ...args).then(d => { memo[aksi] = { t: Date.now(), p: Promise.resolve(d) }; simpanCache(aksi, d); kabari(aksi, d); return d; })
      .catch(e => {
        delete memo[aksi];
        const c = e.jaringan ? bacaCache(aksi) : null;
        if (!c) throw e;
        // offline: tampilkan data terakhir yang tersimpan di perangkat
        const d = Object.assign({}, c.d, { offlineSejak: c.t });
        toast('Offline — menampilkan data terakhir (' + jamCache(c.t) + ')', true);
        return d;
      });
    memo[aksi] = { t: Date.now(), p };
    return p;
  }
  /** Simpan hasil terbaru (mis. setelah sync/simpan) ke cache bersama. */
  function isi(aksi, data) { memo[aksi] = { t: Date.now(), p: Promise.resolve(data) }; simpanCache(aksi, data); kabari(aksi, data); }

  // ---------- toast ----------
  let toastTimer = null;
  function toast(teks, gagal) {
    const el = $('toast');
    el.textContent = teks;
    el.className = 'toast tampil' + (gagal ? ' gagal' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, gagal ? 6000 : 2600);
  }

  // ---------- lembar detail (dialog) ----------
  let fokusSebelum = null;
  const sheet = {
    buka(judul, html) {
      fokusSebelum = document.activeElement;
      $('sheetJudul').innerHTML = judul;
      $('sheetBadan').innerHTML = html;
      $('sheet').classList.add('terbuka');
      $('sheet').setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('sheetBadan').scrollTop = 0;
      const tutup = $('sheet').querySelector('.sheet-kepala [data-tutup]');
      if (tutup) tutup.focus({ preventScroll: true });
    },
    tutup() {
      if (!$('sheet').classList.contains('terbuka')) return;
      $('sheet').classList.remove('terbuka');
      $('sheet').setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (fokusSebelum && document.contains(fokusSebelum) && fokusSebelum.focus) fokusSebelum.focus({ preventScroll: true });
      fokusSebelum = null;
    },
    badan: () => $('sheetBadan'),
  };
  /** Tab berputar di dalam dialog yang terbuka. */
  function jebakFokus(e) {
    if (e.key !== 'Tab' || !$('sheet').classList.contains('terbuka')) return;
    const f = [...$('sheet').querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const awal = f[0], akhir = f[f.length - 1];
    if (e.shiftKey && document.activeElement === awal) { e.preventDefault(); akhir.focus(); }
    else if (!e.shiftKey && document.activeElement === akhir) { e.preventDefault(); awal.focus(); }
  }

  // ---------- navigasi ----------
  function daftar(h) { halaman.push(h); }

  // Nav dibangun sekali; hanya penanda menu aktif yang berganti.
  let navDibangun = false;

  function bangunNav() {
    const isi = (wadah, pendek) => {
      wadah.innerHTML = halaman.map(h =>
        '<button type="button" data-hal="' + esc(h.id) + '" title="' + esc(h.label) + '">' + (ikon[h.ikon] || ikon.monitor) +
        '<span>' + esc(pendek ? (h.pendek || h.label) : h.label) + '</span></button>').join('');
    };
    isi($('navSamping'), false);
    isi($('bottomnav'), true);
    document.querySelectorAll('[data-hal]').forEach(b => b.addEventListener('click', () => { buka(b.dataset.hal); tutupLaci(); }));
    navDibangun = true;
  }

  function gambarNav() {
    if (!navDibangun) bangunNav();
    [$('navSamping'), $('bottomnav')].forEach(wadah => wadah.querySelectorAll('button').forEach(b => {
      const on = b.dataset.hal === state.aktif;
      b.classList.toggle('aktif', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }));
  }

  // ---------- filter di URL: #halaman?k=v (bisa dibagikan, bertahan saat refresh) ----------
  function infoHash() {
    const h = location.hash.slice(1), i = h.indexOf('?');
    return { id: i < 0 ? h : h.slice(0, i), q: new URLSearchParams(i < 0 ? '' : h.slice(i + 1)) };
  }
  function simpanQuery(obj) {
    const p = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    try { history.replaceState(null, '', '#' + state.aktif + (s ? '?' + s : '')); } catch (e) {}
  }

  // ---------- sidebar ciut (desktop), pilihan diingat ----------
  function setCiut(ya) {
    $('shell').classList.toggle('ciut', ya);
    const b = $('btnCiut');
    if (b) { b.title = ya ? 'Lebarkan menu' : 'Ciutkan menu'; b.setAttribute('aria-label', b.title); }
    try { localStorage.setItem('snd_ciut', ya ? '1' : '0'); } catch (e) {}
  }

  function buka(id) {
    const h = halaman.find(x => x.id === id) || halaman[0];
    if (!h) return;
    state.aktif = h.id;
    try { if (infoHash().id !== h.id) history.replaceState(null, '', '#' + h.id); } catch (e) {}
    state.query = infoHash().q; // filter awal dari URL (dibaca halaman saat render)
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
    $('namaSamping').textContent = state.nama || (state.email ? namaDariEmail(state.email) : 'Tim SND');
    $('emailSamping').textContent = state.email || CFG.domain;
  }

  function setelahMasuk() {
    gambarPengguna();
    const awal = infoHash().id;
    buka(halaman.some(h => h.id === awal) ? awal : (halaman[0] && halaman[0].id));
    api('getKonteks').then(k => { state.konteks = k; }).catch(() => {});
    buatSesiBaru();
    window.dispatchEvent(new Event('snd:masuk'));
  }

  // ---------- mulai ----------
  function mulai() {
    $('btnMenu').addEventListener('click', bukaLaci);
    $('btnCiut').addEventListener('click', () => setCiut(!$('shell').classList.contains('ciut')));
    try { setCiut(localStorage.getItem('snd_ciut') === '1'); } catch (e) {}
    $('tirai').addEventListener('click', tutupLaci);
    $('btnKeluar').addEventListener('click', () => keluar(true));
    document.querySelectorAll('[data-tutup]').forEach(el => el.addEventListener('click', sheet.tutup));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') sheet.tutup(); });
    window.addEventListener('hashchange', () => { const id = infoHash().id; if (id && id !== state.aktif) buka(id); });
    $('sheet').addEventListener('keydown', jebakFokus);
    $('versiApp').textContent = 'v' + (CFG.versi || '');
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

    if (!CFG.clientId || CFG.clientId.startsWith('GANTI') || !CFG.apiUrl || CFG.apiUrl.startsWith('GANTI')) {
      $('login').classList.add('tampil');
      $('loginPesan').textContent = 'Konfigurasi belum lengkap: isi apiUrl dan clientId di js/config.js.';
      return;
    }
    if (muatSesi() || muatTokenTersimpan()) setelahMasuk(); else tampilLogin('');
  }

  return { daftar, halaman: () => halaman, buka, mulai, simpanQuery, api, ambil, isi, toast, sheet, keluar, esc, angka, rp, tanggal, hariAntara, ikon, state, $ };
})();
