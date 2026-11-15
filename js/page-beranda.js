/**
 * Halaman Beranda: ringkasan harian (satu strip), PO yang paling lama belum lengkap, dan pintasan ke fitur.
 * Data PO (getDataApp) dan kartu stok (getDataKS) dimuat terpisah; tiap sel terisi begitu datanya tiba.
 * Ketuk sel ringkasan -> halaman terkait terbuka dengan filter sudah aktif (lewat App.state.awal).
 */
(function () {
  const { esc, ikon, state, angka, tanggal } = App;
  const $ = id => document.getElementById(id);
  let po = null, ks = null; // data terakhir, supaya gambar ulang tanpa muat lagi

  function sapaan() {
    const j = new Date().getHours();
    return j < 4 ? 'Selamat malam' : j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam';
  }
  const hariIni = () => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const SKELETON = '<div class="ubin"><div class="skeleton" style="width:70%"></div><div class="skeleton" style="height:26px;margin-top:8px;width:40%"></div></div>';

  function sel(id, halaman, kpi, label, nilai, warna) {
    const ada = nilai !== null && nilai !== undefined;
    const penanda = ada && nilai && warna ? `<span class="penanda ${warna}"><span class="sr">, perlu perhatian</span></span>` : '';
    return `<button type="button" class="ubin" id="${id}" data-halaman="${halaman}" data-kpi="${kpi}"><span class="label">${esc(label)}</span><span class="nilai">${ada ? angka(nilai) : '–'}</span>${penanda}</button>`;
  }

  function gambarRingkasan() {
    const batas = po ? po.batas || 3 : 3;
    const open = po ? po.rows.filter(r => !r.selesai) : null;
    const tertunda = open ? open.filter(r => r.aging !== null && r.aging >= batas).length : null;
    const etaLewat = open ? open.filter(r => r.etaInput && r.etaInput < po.today).length : null;
    const sv = f => (ks ? ks.rows.filter(f).length : null);
    $('kpiHari').innerHTML = [
      sel('k1', 'monitoring', 'open', 'PO open', open ? open.length : null, ''),
      sel('k2', 'monitoring', 'tertunda', `PO > ${batas} hari belum lengkap`, tertunda, 'merah'),
      sel('k3', 'monitoring', 'lewat', 'ETA lewat', etaLewat, 'merah'),
      sel('k4', 'ks', 'minus', 'Part balance minus', sv(r => r[7] < 0), 'merah'),
      sel('k5', 'ks', 'selisih', 'Selisih KS vs Servia', sv(r => r[11] !== null && r[11] !== undefined && r[7] !== r[11]), 'oranye'),
      sel('k6', 'ks', 'dmg', 'Part ada damage', sv(r => r[6] > 0), 'merah'),
    ].join('');
    const sub = [];
    if (po) sub.push(`PO ${po.update || 'belum sync'}`);
    if (ks) sub.push(`KS ${ks.update}`);
    if (po && po.offlineSejak) sub.push('offline');
    const el = $('ringkasSub');
    if (el) el.textContent = sub.join(' · ');
  }

  function gambarPerhatian() {
    const el = $('perhatian');
    if (!el || !po) return;
    const batas = po.batas || 3;
    const daftar = po.rows.filter(r => !r.selesai && r.aging !== null && r.aging >= batas).sort((a, b) => b.aging - a.aging).slice(0, 6);
    if (!daftar.length) {
      el.innerHTML = `<div class="kosong">${ikon.centang}<div>Tidak ada PO yang tertunda.</div></div>`;
      return;
    }
    el.innerHTML = '<div class="daftar-kepala"><span>PO</span><span>Umur</span><span>Terima</span></div>' + daftar.map(r => {
      const p = r.order ? Math.min(100, Math.round(r.recv / r.order * 100)) : 0;
      const kelas = r.aging >= 7 ? 'telat' : 'lama';
      const eta = r.etaInput ? (r.etaInput < po.today ? `ETA ${tanggal(r.etaInput)} sudah lewat` : `ETA ${tanggal(r.etaInput)}`) : 'belum ada ETA';
      return `<button type="button" class="po ${r.aging >= 7 ? 'telat' : ''}" data-key="${esc(r.key)}">
        <span class="po-info"><span class="po-no">${esc(r.po)}</span><span class="po-meta">${esc(r.cabang)} · ${esc(eta)}</span></span>
        <span class="po-umur ${kelas}">${r.aging} hari</span>
        <span class="po-prog"><span class="progres ${r.recv === 0 ? 'kosong' : ''}"><span style="width:${p}%"></span></span><span class="po-qty">${angka(r.recv)}/${angka(r.order)}</span></span>
      </button>`;
    }).join('');
    el.querySelectorAll('.po').forEach(n => n.addEventListener('click', () => { state.bukaPO = n.dataset.key; App.buka('monitoring'); }));
  }

  function render(el, ui) {
    const dariEmail = state.email ? state.email.split('@')[0].split(/[._-]/)[0] : '';
    const nama = state.nama ? state.nama.split(/\s+/)[0] : dariEmail;
    const sebut = nama ? nama[0].toUpperCase() + nama.slice(1) : 'tim SND';
    ui.setSub('Workspace Supply & Demand');
    const fitur = App.halaman().filter(h => h.id !== 'beranda');
    el.innerHTML = `
      <div class="salam"><h2>${sapaan()}, ${esc(sebut)}</h2><p>${esc(hariIni())}. Ini kondisi supply hari ini.</p></div>
      <section class="bagian" aria-labelledby="hRingkasan">
        <div class="kartu-judul"><h2 id="hRingkasan">Ringkasan</h2><small id="ringkasSub"></small></div>
        <div class="kpi" id="kpiHari">${Array.from({ length: 6 }, () => SKELETON).join('')}</div>
      </section>
      <section class="bagian" aria-labelledby="hPerhatian">
        <div class="kartu-judul"><h2 id="hPerhatian">PO paling lama belum lengkap</h2><button type="button" class="tombol halus" id="lihatSemua">Lihat semua</button></div>
        <div class="daftar ringkas" id="perhatian"><div style="padding:16px"><div class="skeleton" style="height:14px;width:60%"></div><div class="skeleton" style="height:14px;width:40%;margin-top:10px"></div></div></div>
      </section>
      <section class="bagian" aria-labelledby="hMenu">
        <div class="kartu-judul"><h2 id="hMenu">Menu</h2></div>
        <div class="daftar-menu">
          ${fitur.map(h => `
            <button type="button" class="menu-kartu" data-buka="${esc(h.id)}">
              <span class="menu-ikon">${ikon[h.ikon] || ikon.monitor}</span>
              <span class="menu-teks"><span class="menu-judul">${esc(h.label)}</span><span class="menu-desk" style="display:block">${esc(h.desk || '')}</span></span>
              ${ikon.panah}
            </button>`).join('')}
        </div>
      </section>`;
    el.querySelectorAll('[data-buka]').forEach(b => b.addEventListener('click', () => App.buka(b.dataset.buka)));
    $('lihatSemua').addEventListener('click', () => { state.awal = { halaman: 'monitoring', kpi: 'tertunda' }; App.buka('monitoring'); });
    $('kpiHari').addEventListener('click', e => {
      const t = e.target.closest('.ubin');
      if (!t || !t.dataset.halaman) return;
      state.awal = { halaman: t.dataset.halaman, kpi: t.dataset.kpi };
      App.buka(t.dataset.halaman);
    });

    const aktif = () => state.aktif === 'beranda';
    if (po || ks) { gambarRingkasan(); gambarPerhatian(); }
    App.ambil('getDataApp', 90000).then(d => { po = d; if (aktif()) { gambarRingkasan(); gambarPerhatian(); } })
      .catch(() => { if (aktif() && !po) $('perhatian').innerHTML = '<div class="kosong">Data PO belum bisa dimuat.</div>'; });
    App.ambil('getDataKS', 180000).then(d => { ks = d; if (aktif()) gambarRingkasan(); }).catch(() => {});
  }

  App.daftar({ id: 'beranda', label: 'Beranda', pendek: 'Beranda', ikon: 'beranda', render });
})();
