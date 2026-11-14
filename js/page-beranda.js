/**
 * Halaman Beranda: ringkasan harian lintas modul + PO yang paling perlu perhatian + kartu menu.
 * Data PO (getDataApp) dan kartu stok (getDataKS) dimuat terpisah; tiap kartu terisi begitu datanya tiba.
 * Tap kartu ringkasan -> buka halaman terkait dengan filter sudah aktif (lewat App.state.awal).
 */
(function () {
  const { esc, ikon, state, angka, tanggal } = App;
  const $ = id => document.getElementById(id);
  let po = null, ks = null; // data terakhir, supaya gambar ulang tanpa muat lagi

  function sapaan() {
    const j = new Date().getHours();
    return j < 4 ? 'Selamat malam' : j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam';
  }

  const SKELETON = '<div class="ubin"><div class="skeleton" style="width:70%"></div><div class="skeleton" style="height:28px;margin-top:8px;width:40%"></div></div>';

  function kartuKpi(id, halaman, kpi, label, nilai, warna) {
    const ada = nilai !== null && nilai !== undefined;
    return `<div class="ubin" data-halaman="${halaman}" data-kpi="${kpi}" id="${id}"><div class="label">${esc(label)}</div><div class="nilai ${ada && nilai && warna ? warna : ''}">${ada ? angka(nilai) : '–'}</div></div>`;
  }

  function gambarRingkasan() {
    const batas = po ? po.batas || 3 : 3;
    const open = po ? po.rows.filter(r => !r.selesai) : null;
    const tertunda = open ? open.filter(r => r.aging !== null && r.aging >= batas).length : null;
    const etaLewat = open ? open.filter(r => r.etaInput && r.etaInput < po.today).length : null;
    const sv = (f) => (ks ? ks.rows.filter(f).length : null);
    $('kpiHari').innerHTML = [
      kartuKpi('k1', 'monitoring', 'open', 'PO Open', open ? open.length : null, ''),
      kartuKpi('k2', 'monitoring', 'tertunda', `PO > ${batas} Hari Belum Lengkap`, tertunda, 'merah'),
      kartuKpi('k3', 'monitoring', 'lewat', 'ETA Lewat', etaLewat, 'merah'),
      kartuKpi('k4', 'ks', 'minus', 'Part Balance Minus', sv(r => r[7] < 0), 'merah'),
      kartuKpi('k5', 'ks', 'selisih', 'Selisih KS vs Servia', sv(r => r[11] !== null && r[11] !== undefined && r[7] !== r[11]), 'oranye'),
      kartuKpi('k6', 'ks', 'dmg', 'Part Ada Damage', sv(r => r[6] > 0), 'merah'),
    ].join('');
    const sub = [];
    if (po) sub.push(`PO: ${po.update || 'belum sync'}`);
    if (ks) sub.push(`KS: ${ks.update}`);
    if (po && po.offlineSejak) sub.push('OFFLINE');
    const el = $('ringkasSub');
    if (el) el.textContent = sub.join(' · ');
  }

  function gambarPerhatian() {
    const el = $('perhatian');
    if (!el || !po) return;
    const batas = po.batas || 3;
    const daftar = po.rows.filter(r => !r.selesai && r.aging !== null && r.aging >= batas).sort((a, b) => b.aging - a.aging).slice(0, 5);
    if (!daftar.length) {
      el.innerHTML = '<div class="kartu-judul"><h2>Perlu perhatian</h2></div><div class="kosong" style="padding:18px"><div style="font-size:30px">🎉</div><div>Tidak ada PO yang tertunda.</div></div>';
      return;
    }
    el.innerHTML = `<div class="kartu-judul"><h2>PO paling lama belum lengkap</h2><button type="button" class="tombol halus" id="lihatSemua" style="min-height:32px;padding:0 12px;font-size:12px">Lihat semua</button></div>` +
      daftar.map(r => `<div class="notif" data-key="${esc(r.key)}">
        <div class="notif-ikon merah">📦</div>
        <div class="notif-isi">
          <div class="notif-judul">${esc(r.po)} <span class="teks-kecil">· ${esc(r.cabang)}</span></div>
          <div class="notif-desk">${r.aging} hari · ${r.etaInput ? 'ETA ' + esc(tanggal(r.etaInput)) : 'belum ada ETA'}</div>
          <div class="notif-meta">Diterima ${angka(r.recv)}/${angka(r.order)} pcs</div>
        </div>
      </div>`).join('');
    el.querySelectorAll('.notif').forEach(n => n.addEventListener('click', () => { state.bukaPO = n.dataset.key; App.buka('monitoring'); }));
    $('lihatSemua').addEventListener('click', () => { state.awal = { halaman: 'monitoring', kpi: 'tertunda' }; App.buka('monitoring'); });
  }

  function render(el, ui) {
    const dariEmail = state.email ? state.email.split('@')[0].split(/[._-]/)[0] : '';
    const nama = state.nama ? state.nama.split(/\s+/)[0] : dariEmail;
    const sebut = nama ? nama[0].toUpperCase() + nama.slice(1) : 'tim SND';
    ui.setSub('Workspace Supply & Demand');
    const fitur = App.halaman().filter(h => h.id !== 'beranda');
    el.innerHTML = `
      <div class="salam"><h2>${sapaan()}, ${esc(sebut)} 👋</h2><p>Ini kondisi supply hari ini.</p></div>
      <section class="bagian">
        <div class="kartu-judul"><h2>Ringkasan hari ini</h2><small id="ringkasSub"></small></div>
        <div class="kpi" id="kpiHari">${Array.from({ length: 6 }, () => SKELETON).join('')}</div>
      </section>
      <section class="bagian kartu" id="perhatian"><div class="skeleton" style="height:90px"></div></section>
      <div class="kartu-judul" style="margin:18px 2px 8px"><h2>Menu</h2></div>
      <div class="menu-grid">
        ${fitur.map((h, i) => `
          <button type="button" class="menu-kartu" data-buka="${esc(h.id)}">
            <div class="menu-ikon ${i % 2 ? 'oranye' : ''}">${ikon[h.ikon] || ikon.monitor}</div>
            <div class="menu-judul">${esc(h.label)}</div>
            <div class="menu-desk">${esc(h.desk || '')}</div>
            <div class="tanda">${esc(h.tanda || 'Buka')} →</div>
          </button>`).join('')}
      </div>`;
    el.querySelectorAll('[data-buka]').forEach(b => b.addEventListener('click', () => App.buka(b.dataset.buka)));
    $('kpiHari').addEventListener('click', e => {
      const t = e.target.closest('.ubin');
      if (!t || !t.dataset.halaman) return;
      state.awal = { halaman: t.dataset.halaman, kpi: t.dataset.kpi };
      App.buka(t.dataset.halaman);
    });

    const aktif = () => state.aktif === 'beranda';
    if (po || ks) { gambarRingkasan(); gambarPerhatian(); }
    App.ambil('getDataApp', 90000).then(d => { po = d; if (aktif()) { gambarRingkasan(); gambarPerhatian(); } }).catch(() => { if (aktif() && !po) { $('perhatian').innerHTML = '<div class="teks-kecil">Data PO belum bisa dimuat.</div>'; } });
    App.ambil('getDataKS', 180000).then(d => { ks = d; if (aktif()) gambarRingkasan(); }).catch(() => {});
  }

  App.daftar({ id: 'beranda', label: 'Beranda', pendek: 'Beranda', ikon: 'beranda', render });
})();
