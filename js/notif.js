/**
 * Notifikasi di SND Apps (lonceng di appbar) + aktivasi Web Push ke HP.
 * Aturan sama dengan reminder bot WA ke grup Partman:
 *  - PO open yang umurnya >= batas (3 hari) dan belum full received -> "reminder", muncul lagi tiap kelipatan 3 hari.
 *  - PO yang ETA-nya sudah lewat -> "ETA lewat".
 * "Sudah dibaca" disimpan di perangkat (localStorage), jadi kelipatan hari berikutnya muncul sebagai notifikasi baru.
 * Push: Stock Bot mengirim ke HP (reminder tiap pagi 09:00, PO baru yang perlu diproses); langganan didaftarkan lewat Apps Script.
 */
(function () {
  const { esc, angka, sheet, tanggal, toast } = App;
  const CFG = window.SND_CONFIG || {};
  const KUNCI = 'snd_notif_dibaca';
  let daftar = [];
  let siap = false;

  const dibaca = () => { try { return new Set(JSON.parse(localStorage.getItem(KUNCI) || '[]')); } catch (e) { return new Set(); } };
  const simpanDibaca = s => { try { localStorage.setItem(KUNCI, JSON.stringify([...s].slice(-600))); } catch (e) {} };

  function hitung(d) {
    const batas = d.batas || 3;
    const hasil = [];
    (d.rows || []).filter(r => !r.selesai).forEach(r => {
      if (r.aging !== null && r.aging >= batas) hasil.push({ id: `rem|${r.key}|${Math.floor(r.aging / batas)}`, jenis: 'reminder', r });
      if (r.etaInput && r.etaInput < d.today) hasil.push({ id: `eta|${r.key}|${r.etaInput}`, jenis: 'eta', r });
    });
    return hasil.sort((a, b) => (b.r.aging || 0) - (a.r.aging || 0));
  }

  function lencana() {
    const baru = daftar.filter(n => !dibaca().has(n.id)).length;
    const el = document.getElementById('lencana');
    if (!el) return;
    el.textContent = baru > 99 ? '99+' : String(baru);
    el.classList.toggle('tampil', baru > 0);
    const b = document.getElementById('btnNotif');
    if (b) b.setAttribute('aria-label', baru ? `Notifikasi, ${baru} baru` : 'Notifikasi');
  }

  function perbarui(d) {
    daftar = hitung(d);
    siap = true;
    lencana();
  }

  function item(n, baru) {
    const r = n.r;
    const pesan = n.jenis === 'eta'
      ? `ETA ${tanggal(r.etaInput)} sudah lewat, barang belum lengkap`
      : `${r.aging} hari sejak PO, belum full received`;
    return `<div class="notif ${baru ? 'baru' : ''}" data-key="${esc(r.key)}">
      <div class="notif-ikon ${n.jenis === 'eta' ? 'oranye' : 'merah'}">${n.jenis === 'eta' ? '⏰' : '📦'}</div>
      <div class="notif-isi">
        <div class="notif-judul">${esc(r.po)} <span class="teks-kecil">· ${esc(r.cabang)}</span></div>
        <div class="notif-desk">${esc(pesan)}</div>
        <div class="notif-meta">Diterima ${angka(r.recv)}/${angka(r.order)} pcs · PO ${esc(r.tglPO || '-')}</div>
      </div>
      ${baru ? '<span class="titik-baru" aria-label="baru"></span>' : ''}
    </div>`;
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
      'tidak-didukung': ['🔕', 'Notifikasi HP belum didukung di perangkat/browser ini.', ''],
      ditolak: ['🔕', 'Notifikasi diblokir. Buka pengaturan aplikasi → Notifikasi → izinkan, lalu coba lagi.', ''],
      mati: ['🔔', 'Dapatkan pengingat PO langsung di HP, walau app sedang tertutup.', '<button type="button" class="tombol penuh" id="btnPush">Aktifkan notifikasi di HP</button>'],
      aktif: ['✅', 'Notifikasi HP aktif di perangkat ini.', '<button type="button" class="tombol garis penuh" id="btnPush">Matikan notifikasi di HP</button>'],
    }[s];
    wadah.innerHTML = `<div class="push-kotak"><div class="push-judul"><span>${peta[0]}</span> Notifikasi HP</div><div class="teks-kecil" style="margin:4px 0 10px">${peta[1]}</div>${peta[2]}</div>`;
    const b = wadah.querySelector('#btnPush');
    if (b) b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        if (s === 'aktif') { await matikanPush(); toast('Notifikasi HP dimatikan.'); } else { await aktifkanPush(); toast('Notifikasi HP aktif.'); }
      } catch (e) { toast(e.message || 'Gagal mengubah notifikasi.', true); }
      gambarPush(wadah);
    });
  }

  function buka() {
    const sudah = dibaca();
    const html = !siap
      ? '<div class="kosong">Memuat notifikasi…</div>'
      : !daftar.length
        ? '<div class="kosong"><div style="font-size:34px">🎉</div><div>Tidak ada notifikasi.<br>Semua PO masih dalam batas waktu atau sudah diterima penuh.</div></div>'
        : `<div class="teks-kecil" style="margin-bottom:10px">Reminder PO &gt; 3 hari belum full received. Bot juga mengirimnya ke grup Partman tiap pagi 09:00 WIB.</div>` +
          daftar.map(n => item(n, !sudah.has(n.id))).join('');
    sheet.buka('Notifikasi', html + '<div id="kotakPush"></div>');
    sheet.badan().querySelectorAll('.notif').forEach(el => el.addEventListener('click', () => {
      App.state.bukaPO = el.dataset.key;
      sheet.tutup();
      App.buka('monitoring');
    }));
    gambarPush(document.getElementById('kotakPush'));
    // tandai semua dibaca (tampilan di atas sudah menandai yang baru)
    daftar.forEach(n => sudah.add(n.id));
    simpanDibaca(sudah);
    lencana();
  }

  function muat(paksa) {
    App.ambil('getDataApp', paksa ? 0 : 90000).then(perbarui).catch(() => {});
  }

  document.getElementById('btnNotif').addEventListener('click', buka);
  window.addEventListener('snd:masuk', () => muat(false));
  window.addEventListener('snd:data', e => { if (e.detail && e.detail.aksi === 'getDataApp') perbarui(e.detail.data); });
  setInterval(() => { if (App.state.token) muat(true); }, 10 * 60 * 1000);
})();
