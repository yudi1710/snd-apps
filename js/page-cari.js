/**
 * Halaman: Cari Part & Transfer.
 * Cari satu part (kode atau nama), lihat stoknya di semua cabang sekaligus (KS + Servia), dan dapat saran transfer
 * antar cabang sebelum order ke VinFast. Pakai data kartu stok yang sama dengan halaman KS.
 * Baris data KS: [cabang, kode, desc, awal, masuk, keluar, damage, balance, area, model, url, servia, jumlahProdukServia].
 */
(function () {
  const { sheet, esc, angka, ikon, toast, $ } = App;
  const C = 0, K = 1, D = 2, DMG = 6, BAL = 7, AREA = 8, SV = 11, NSV = 12;
  let DATA = null;
  let indeks = null; // Map kode -> { kode, desc, baris }
  let ui = null;
  let q = '';

  const adaSv = r => r[SV] !== null && r[SV] !== undefined;
  const BATAS_TAMPIL = 40;

  function bangunIndeks() {
    indeks = new Map();
    DATA.rows.forEach(r => {
      const g = indeks.get(r[K]) || { kode: r[K], desc: r[D], baris: [] };
      if (!g.desc && r[D]) g.desc = r[D];
      g.baris.push(r);
      indeks.set(r[K], g);
    });
  }

  /**
   * Saran transfer sederhana dari saldo KS: cabang dengan balance <= 0 butuh isi minimal 1 pcs (atau menutup minus),
   * cabang dengan balance >= 2 boleh memberi (sisakan 1). Cocokkan dari donor terbanyak. Hanya saran kasar.
   */
  function saranTransfer(baris) {
    const donor = baris.filter(r => r[BAL] >= 2).map(r => ({ cabang: r[C], sedia: r[BAL] - 1 })).sort((a, b) => b.sedia - a.sedia);
    const butuh = baris.filter(r => r[BAL] <= 0).map(r => ({ cabang: r[C], perlu: Math.max(1, 1 - r[BAL]) })).sort((a, b) => b.perlu - a.perlu);
    const hasil = [];
    for (const b of butuh) {
      let sisa = b.perlu;
      for (const d of donor) {
        if (!sisa) break;
        const ambil = Math.min(d.sedia, sisa);
        if (ambil > 0) { hasil.push({ dari: d.cabang, ke: b.cabang, qty: ambil }); d.sedia -= ambil; sisa -= ambil; }
      }
    }
    return hasil;
  }

  function render(el, u) {
    ui = u;
    u.setAksi('');
    el.innerHTML = `
      <section class="bagian" aria-label="Pencarian part">
        <div class="input-cari besar">${ikon.cari}<input class="input" id="cariPart" name="cari-part" type="search" placeholder="Ketik kode part atau nama part…" aria-label="Cari part" autocomplete="off" spellcheck="false" autocapitalize="characters"></div>
        <div class="teks-kecil" id="infoCari" aria-live="polite" style="margin:8px 2px 0"></div>
      </section>
      <section class="bagian" aria-label="Hasil">
        <div class="daftar" id="hasilCari"><div class="kosong">${ikon.cari}<div>Mulai dengan mengetik kode atau nama part.</div></div></div>
      </section>`;
    const input = $('cariPart');
    const awal = App.state.query && App.state.query.get('q');
    if (awal) { q = awal.toUpperCase(); input.value = awal; }
    input.addEventListener('input', e => { q = e.target.value.trim().toUpperCase(); App.simpanQuery({ q }); gambar(); });
    $('hasilCari').addEventListener('click', e => { const k = e.target.closest('.po'); if (k && k.dataset.kode) detail(k.dataset.kode); });
    if (DATA) { ui.setSub(subTeks()); gambar(); } else muat();
  }

  const subTeks = () => `KS ${DATA.update}${DATA.updateServia ? ' · Servia ' + DATA.updateServia : ''}${DATA.offlineSejak ? ' · offline' : ''}`;

  function muat() {
    App.ambil('getDataKS', 120000).then(d => {
      DATA = d; bangunIndeks();
      if (App.state.aktif !== 'cari') return;
      ui.setSub(subTeks());
      gambar();
    }).catch(e => {
      if (App.state.aktif !== 'cari') return;
      $('hasilCari').innerHTML = `<div class="kosong">${ikon.kosong}<div>${esc(e.message || 'Data kartu stok belum bisa dimuat.')}</div><button type="button" class="tombol halus" id="coba">Coba lagi</button></div>`;
      $('coba').addEventListener('click', muat);
    });
  }

  function gambar() {
    if (!DATA) { $('infoCari').textContent = 'Memuat data kartu stok…'; return; }
    if (!q) { $('infoCari').textContent = `${angka(indeks.size)} part terdaftar di kartu stok.`; $('hasilCari').innerHTML = `<div class="kosong">${ikon.cari}<div>Mulai dengan mengetik kode atau nama part.</div></div>`; return; }
    const cocok = [...indeks.values()].filter(g => (g.kode + ' ' + g.desc).toUpperCase().includes(q))
      .sort((a, b) => (a.kode.toUpperCase() === q ? -1 : 0) - (b.kode.toUpperCase() === q ? -1 : 0) || String(a.kode).localeCompare(String(b.kode)));
    $('infoCari').textContent = `${angka(cocok.length)} part cocok${cocok.length > BATAS_TAMPIL ? `, menampilkan ${BATAS_TAMPIL} pertama` : ''}.`;
    if (!cocok.length) { $('hasilCari').innerHTML = `<div class="kosong">${ikon.kosong}<div>Tidak ada part yang cocok dengan “${esc(q)}”.</div></div>`; return; }
    $('hasilCari').innerHTML = '<div class="daftar-kepala"><span>Kode part</span><span style="text-align:right">Total</span><span>Per cabang</span></div>' +
      cocok.slice(0, BATAS_TAMPIL).map(g => {
        const total = g.baris.reduce((a, r) => a + r[BAL], 0);
        const ada = g.baris.filter(r => r[BAL] > 0).length;
        const kosong = g.baris.filter(r => r[BAL] <= 0).length;
        const saran = ada && kosong ? `<span class="badge oranye titik">Ada saran transfer</span>` : '';
        return `<button type="button" class="po ks" data-kode="${esc(g.kode)}">
          <span class="po-info"><span class="po-no">${esc(g.kode)}</span><span class="po-meta">${esc(g.desc || '-')}</span></span>
          <span class="ks-bal ${total < 0 ? 'minus' : ''}">${angka(total)}<small>total</small></span>
          <span class="rincian">${g.baris.slice().sort((a, b) => a[C].localeCompare(b[C])).map(r => `<span class="badge ${r[BAL] < 0 ? 'merah' : r[BAL] === 0 ? 'abu' : ''}">${esc(r[C])} <b>${angka(r[BAL])}</b></span>`).join('')}${saran}</span>
        </button>`;
      }).join('');
  }

  function detail(kode) {
    const g = indeks.get(kode);
    if (!g) return;
    const baris = g.baris.slice().sort((a, b) => b[BAL] - a[BAL] || a[C].localeCompare(b[C]));
    const saran = saranTransfer(baris);
    const total = baris.reduce((a, r) => a + r[BAL], 0);
    sheet.buka(esc(kode), `
      <div class="detail-baris"><span>Nama part</span><span>${esc(g.desc || '-')}</span></div>
      <div class="detail-baris"><span>Total semua cabang</span><span>${angka(total)} pcs</span></div>
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Stok per cabang</h3>
      ${baris.map(r => `<div class="ks-cab">
        <div class="ks-cab-kepala"><span class="ks-cab-nama">${esc(r[C])}</span>${r[AREA] ? `<span class="ks-cab-area">Area ${esc(r[AREA])}</span>` : ''}</div>
        <div class="ks-angka-grid">
          <div class="${r[BAL] < 0 ? 'minus' : ''}"><small>Balance KS</small>${angka(r[BAL])}</div>
          <div><small>Servia</small>${adaSv(r) ? angka(r[SV]) : '—'}${r[NSV] > 1 ? `<span class="teks-kecil" style="display:block;font-weight:400">${r[NSV]} produk berkode sama</span>` : ''}</div>
          <div class="${r[DMG] ? 'minus' : ''}"><small>Damage</small>${angka(r[DMG])}</div>
        </div>
      </div>`).join('')}
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Saran transfer</h3>
      ${saran.length
        ? `<ul class="daftar-saran">${saran.map(s => `<li><b>${angka(s.qty)} pcs</b> dari <b>${esc(s.dari)}</b> ke <b>${esc(s.ke)}</b></li>`).join('')}</ul>
           <div class="teks-kecil">Saran kasar dari saldo kartu stok: cabang yang kosong atau minus diisi dari cabang yang punya 2 pcs atau lebih (disisakan 1). Belum memperhitungkan kebutuhan atau penjualan, cek dulu sebelum transfer.</div>`
        : `<div class="teks-kecil">${baris.some(r => r[BAL] <= 0) ? 'Tidak ada cabang yang bisa memberi (semua stok tinggal 0 atau 1). Perlu order ke VinFast.' : 'Semua cabang punya stok, tidak perlu transfer.'}</div>`}`);
  }

  App.daftar({
    id: 'cari', label: 'Cari Part & Transfer', pendek: 'Cari', ikon: 'cari',
    desk: 'Cari satu part, lihat stoknya di semua cabang, dan dapat saran transfer sebelum order ke VinFast.',
    render,
  });
})();
