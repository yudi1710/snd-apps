/**
 * Notifikasi di SND Apps (lonceng di appbar) + aktivasi Web Push ke HP.
 * Aturan sama dengan reminder bot WA ke grup Partman:
 *  - PO open yang umurnya >= batas (3 hari) dan belum full received -> "reminder", muncul lagi tiap kelipatan 3 hari.
 *  - PO yang ETA-nya sudah lewat -> "ETA lewat".
 * Daftar ini DIHITUNG dari data PO, jadi status per notifikasi disimpan di perangkat (localStorage): dibaca, dihapus (×  atau
 * "Hapus semua"), dan kapan pertama muncul. Notifikasi hilang sendiri setelah UMUR_MAKS hari; kelipatan 3 hari berikutnya dari PO
 * yang masih tertunda punya id baru, jadi muncul lagi sebagai notifikasi baru.
 * Push: Stock Bot mengirim ke HP (reminder tiap pagi 09:00, PO baru yang perlu diproses); langganan didaftarkan lewat Apps Script.
 */
(function () {
  const { esc, angka, sheet, tanggal, toast, ikon } = App;
  const CFG = window.SND_CONFIG || {};
  const KUNCI = 'snd_notif_state';      // { [id]: { t: waktu pertama muncul (ms), b: 1 = sudah dibaca, h: 1 = dihapus } }
  const KUNCI_LAMA = 'snd_notif_dibaca'; // penanda dibaca versi lama (daftar id)
  const UMUR_MAKS = 7 * 24 * 3600 * 1000;
  let daftar = [];
  let siap = false;

  function muatState() {
    try { const s = JSON.parse(localStorage.getItem(KUNCI) || 'null'); if (s && typeof s === 'object') return s; } catch (e) {}
    const s = {};
    // migrasi: id yang dulu sudah dibaca dianggap sudah lama muncul (t = 0), jadi langsung hilang dari daftar
    try { JSON.parse(localStorage.getItem(KUNCI_LAMA) || '[]').forEach(id => { s[id] = { t: 0, b: 1 }; }); localStorage.removeItem(KUNCI_LAMA); } catch (e) {}
    return s;
  }
  let state = muatState();
  const simpanState = () => { try { localStorage.setItem(KUNCI, JSON.stringify(state)); } catch (e) {} };
  /** Notifikasi yang masih ditampilkan: belum dihapus dan belum lewat UMUR_MAKS sejak pertama muncul. */
  const terlihat = () => daftar.filter(n => { const s = state[n.id]; return s && !s.h && Date.now() - s.t < UMUR_MAKS; });

  /** Tutup juga notifikasi yang masih menumpuk di panel notifikasi HP/browser. */
  async function bersihkanTray() {
    try {
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      (await reg.getNotifications()).forEach(n => n.close());
    } catch (e) { /* tidak didukung: abaikan */ }
  }

  function hitung(d) {
    const batas = d.batas || 3;
    const hasil = [];
    const partialLama = d.partialLama || 30;
    // PO partial yang sudah lama (sebagian barang sudah datang) tidak diingatkan lagi; PO yang dibatalkan sudah dibuang di server
    (d.rows || []).filter(r => !r.selesai && !(r.recv > 0 && r.aging !== null && r.aging !== '' && r.aging >= partialLama)).forEach(r => {
      if (r.aging !== null && r.aging >= batas) hasil.push({ id: `rem|${r.key}|${Math.floor(r.aging / batas)}`, jenis: 'reminder', r });
      if (r.etaInput && r.etaInput < d.today) hasil.push({ id: `eta|${r.key}|${r.etaInput}`, jenis: 'eta', r });
    });
    return hasil.sort((a, b) => (b.r.aging || 0) - (a.r.aging || 0));
  }

  function lencana() {
    const baru = terlihat().filter(n => !state[n.id].b).length;
    const el = document.getElementById('lencana');
    if (!el) return;
    el.textContent = baru > 99 ? '99+' : String(baru);
    el.classList.toggle('tampil', baru > 0);
    const b = document.getElementById('btnNotif');
    if (b) b.setAttribute('aria-label', baru ? `Notifikasi, ${baru} baru` : 'Notifikasi');
  }

  function perbarui(d) {
    daftar = hitung(d);
    const sekarang = Date.now(), ada = new Set(daftar.map(n => n.id));
    daftar.forEach(n => { if (!state[n.id]) state[n.id] = { t: sekarang, b: 0 }; });
    Object.keys(state).forEach(id => { if (!ada.has(id) && sekarang - state[id].t > 60 * 24 * 3600 * 1000) delete state[id]; }); // rapikan yang sudah tidak relevan
    simpanState();
    siap = true;
    lencana();
  }

  function item(n, baru) {
    const r = n.r;
    const pesan = n.jenis === 'eta'
      ? `ETA ${tanggal(r.etaInput)} sudah lewat, barang belum lengkap`
      : `${r.aging} hari sejak PO, belum full received`;
    return `<div class="notif-wadah"><button type="button" class="notif ${baru ? 'baru' : ''}" data-key="${esc(r.key)}">
      <span class="notif-ikon ${n.jenis === 'eta' ? 'oranye' : 'merah'}">${n.jenis === 'eta' ? ikon.jam : ikon.kotak}</span>
      <span class="notif-isi">
        <span class="notif-judul"><span class="kode-mono">${esc(r.po)}</span><span class="teks-kecil">${esc(r.cabang)}</span></span>
        <span class="notif-desk" style="display:block">${esc(pesan)}</span>
        <span class="notif-meta" style="display:block">Diterima ${angka(r.recv)}/${angka(r.order)} pcs · PO ${esc(r.tglPO || '-')}</span>
      </span>
      ${baru ? '<span class="titik-baru"><span class="sr">baru</span></span>' : ''}
    </button><button type="button" class="notif-x" data-hapus="${esc(n.id)}" aria-label="Hapus notifikasi ini" title="Hapus">×</button></div>`;
  }

  // ---------- Web Push ----------
  const dukungPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const kunciKeBytes = b64 => { const p = '='.repeat((4 - b64.length % 4) % 4); const s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
  const namaPerangkat = () => ((navigator.userAgentData && navigator.userAgentData.platform) || 'HP') + ' · ' + (/Android/.test(navigator.userAgent) ? 'Android' : 'Browser');

  async function langganan() {
    const reg = await navigator.serviceWorker.ready;
    return { reg, sub: await reg.pushManager.getSubscription() };
  }

  async function statusPush() {
    if (!dukungPush()) return 'tidak-didukung';
    if (Notification.permission === 'denied') return 'ditolak';
    try { return (await langganan()).sub ? 'aktif' : 'mati'; } catch (e) { return 'tidak-didukung'; }
  }

  async function aktifkanPush() {
    const izin = await Notification.requestPermission();
    if (izin !== 'granted') throw new Error('Izin notifikasi tidak diberikan. Aktifkan lewat pengaturan aplikasi/Chrome.');
    const { reg, sub } = await langganan();
    const baru = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunciKeBytes(CFG.vapidPublicKey) });
    await App.api('daftarPush', baru.toJSON(), namaPerangkat());
  }

  async function matikanPush() {
    const { sub } = await langganan();
    if (!sub) return;
    try { await App.api('hapusPush', sub.endpoint); } catch (e) { /* tetap lanjut berhenti berlangganan di perangkat */ }
    await sub.unsubscribe();
  }

  async function gambarPush(wadah) {
    const s = await statusPush();
    const peta = {
      'tidak-didukung': [ikon.loncengMati, 'Notifikasi HP belum didukung di perangkat atau browser ini.', ''],
      ditolak: [ikon.loncengMati, 'Notifikasi diblokir. Buka pengaturan aplikasi, pilih Notifikasi, izinkan, lalu coba lagi.', ''],
      mati: [ikon.lonceng, 'Dapatkan pengingat PO langsung di HP, walau app sedang tertutup.', '<button type="button" class="tombol penuh" id="btnPush">Aktifkan notifikasi di HP</button>'],
      aktif: [ikon.centang, 'Notifikasi HP aktif di perangkat ini.', '<button type="button" class="tombol garis penuh" id="btnPush">Matikan notifikasi di HP</button>'],
    }[s];
    wadah.innerHTML = `<div class="push-kotak"><div class="push-judul">${peta[0]}<span>Notifikasi HP</span></div><div class="teks-kecil" style="margin:4px 0 10px">${peta[1]}</div>${peta[2]}</div>`;
    const b = wadah.querySelector('#btnPush');
    if (b) b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        if (s === 'aktif') { await matikanPush(); toast('Notifikasi HP dimatikan.'); } else { await aktifkanPush(); toast('Notifikasi HP aktif.'); }
      } catch (e) { toast(e.message || 'Gagal mengubah notifikasi.', true); }
      gambarPush(wadah);
    });
  }

  function hapus(ids) {
    ids.forEach(id => { if (state[id]) state[id].h = 1; });
    simpanState();
    bersihkanTray();
    buka(true);
  }

  function buka(sudahTerbuka) {
    const tampil = terlihat();
    const html = !siap
      ? '<div class="kosong">Memuat notifikasi…</div>'
      : !tampil.length
        ? `<div class="kosong">${ikon.centang}<div>Tidak ada notifikasi.<br>Semua PO masih dalam batas waktu, sudah diterima penuh, atau notifikasinya sudah dihapus.</div></div>`
        : `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div class="teks-kecil" style="flex:1">Reminder PO &gt; 3 hari belum full received. Hilang sendiri setelah 7 hari, dan muncul lagi tiap kelipatan 3 hari kalau PO-nya masih tertunda.</div><button type="button" class="tombol halus" id="btnHapusSemua">Hapus semua</button></div>` +
          tampil.map(n => item(n, !state[n.id].b)).join('');
    if (sudahTerbuka === true) {
      document.getElementById('sheetBadan').innerHTML = html + '<div id="kotakPush"></div>'; // segarkan isi tanpa menutup jendela
    } else {
      sheet.buka('Notifikasi', html + '<div id="kotakPush"></div>');
    }
    const badan = sheet.badan();
    badan.querySelectorAll('.notif').forEach(el => el.addEventListener('click', () => {
      App.state.bukaPO = el.dataset.key;
      sheet.tutup();
      App.buka('monitoring');
    }));
    badan.querySelectorAll('.notif-x').forEach(el => el.addEventListener('click', () => hapus([el.dataset.hapus])));
    const semua = document.getElementById('btnHapusSemua');
    if (semua) semua.addEventListener('click', () => hapus(tampil.map(n => n.id)));
    gambarPush(document.getElementById('kotakPush'));
    // tandai semua dibaca (tampilan di atas sudah menandai yang baru) dan kosongkan panel notifikasi HP
    tampil.forEach(n => { state[n.id].b = 1; });
    simpanState();
    bersihkanTray();
    lencana();
  }

  function muat(paksa) {
    App.ambil('getDataApp', paksa ? 0 : 90000).then(perbarui).catch(() => {});
  }

  document.getElementById('btnNotif').addEventListener('click', () => buka());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') bersihkanTray(); }); // app dibuka = notifikasi di panel HP dianggap sudah dilihat
  window.addEventListener('snd:masuk', () => muat(false));
  window.addEventListener('snd:data', e => { if (e.detail && e.detail.aksi === 'getDataApp') perbarui(e.detail.data); });
  setInterval(() => { if (App.state.email) muat(true); }, 10 * 60 * 1000);
})();
