/**
 * Halaman: Forecast Cinere (fast moving, skenario 2 shift).
 * Data dasar dari tab "Forecast Cinere" (Stock Bot, dari Moving + Incoming Part MRP Cinere).
 * Baris: [kode, nama, juni, juli, agustus, september, oktober, november(parsial), stokSnapshot, leadTimeHari|null, jumlahPO, sumber, orderFR].
 * Pemakaian dari Outgoing Part (sumber sama dengan FR Nov). Baseline 1 shift = Agustus-Oktober (3 bulan, sama dengan FR Nov);
 * Juni (data mulai 18 Juni), Juli (ada lonjakan sekali jalan), dan November (belum penuh) tidak masuk baseline.
 * Jumlah shift, stok pengaman, dan lead time bawaan bisa diatur dan diingat di perangkat.
 */
(function () {
  const { sheet, esc, angka, ikon, $ } = App;
  const KUNCI = 'snd_fc_param4';
  const BULAN_DIPAKAI = [4, 5, 6]; // indeks Agustus..Oktober di baris
  const HARI_KERJA = 26;
  let DATA = null;
  let KS = null; // Map kode -> balance KS Cinere (stok terkini dari menu KS)
  let infoKS = '';
  let ui = null;
  let p = Object.assign({ naik: 100, cadangan: 30, ltDefault: 7, metode: 'rata', lain: false }, (() => { try { return JSON.parse(localStorage.getItem(KUNCI)) || {}; } catch (e) { return {}; } })());

  const mult = () => 1 + p.naik / 100; // 0% = 1 shift, 100% = 2 shift
  const namaSkenario = () => (p.naik === 0 ? '1 shift' : p.naik === 100 ? '2 shift' : '+' + desimal(p.naik) + '% dari 1 shift');
  const desimal = n => (Math.round(n * 10) / 10).toLocaleString('id-ID');

  function hitung(r) {
    const dariKS = KS && KS.has(r[0].toUpperCase());
    const stok = dariKS ? KS.get(r[0].toUpperCase()) : r[8];
    const bln = BULAN_DIPAKAI.map(i => Math.max(0, r[i])); // retur (minus) tidak dihitung sebagai pemakaian negatif
    const base = p.metode === 'median' ? bln.slice().sort((a, b) => a - b)[1] : bln.reduce((s, v) => s + v, 0) / bln.length; // 1 shift per bulan
    const fc = base * mult(); // skenario per bulan
    const lt = r[9] == null ? p.ltDefault : r[9];
    const perHari = fc / HARI_KERJA;
    const target = Math.ceil(fc + perHari * lt * (1 + p.cadangan / 100)); // kebutuhan 1 bulan + penyangga selama lead time & cadangan
    const order = Math.max(0, target - stok);
    const cover = perHari > 0 ? stok / perHari : null; // stok cukup berapa hari kerja
    return { kode: r[0], nama: r[1], base, fc, lt, ltAsli: r[9] != null, stok, dariKS, target, order, cover, bulan: r.slice(2, 8), po: r[10], sumber: r[11], orderFR: r[12] };
  }

  // ---------- buku panduan (dipakai di aplikasi dan di sheet Panduan pada Excel) ----------
  const PANDUAN = [
    ['Tujuan', 'Memperkirakan kebutuhan part fast moving Cinere kalau jam kerja naik dari 1 shift ke 2 shift, lalu menghitung berapa yang perlu di-order ke VinFast supaya stok tidak habis.'],
    ['Langkah 1: Baseline', 'Pemakaian per bulan dihitung dari tab Outgoing Part MRP Cinere (sumber yang sama dengan FR). Baseline 1 shift = pemakaian Agustus sampai Oktober, rata-rata atau median (median tidak ikut tertarik lonjakan sekali jalan). Tidak masuk baseline: Juni (data mulai 18 Juni), Juli (sering ada lonjakan), November (bulan berjalan, belum penuh). Part yang masuk daftar: berlabel Fast Move di tab Moving, ditambah part yang punya Qty Order di sheet FR bulan ini. HANKOOK dan Massive/Massiv EV dikecualikan.'],
    ['Langkah 2: Jumlah shift', 'Pilih 1 shift (pemakaian apa adanya, sama dengan FR) atau 2 shift (pemakaian naik 100%, jadi dua kali lipat). Untuk angka lain pilih Atur sendiri: isi berapa persen pemakaian naik dari 1 shift (0% = 1 shift, 50% = 1,5 kali, 100% = 2 shift). Forecast per bulan = baseline × (1 + kenaikan%). Angka kenaikan ini asumsi, cocokkan lagi dengan data nyata setelah 2 shift berjalan beberapa minggu.'],
    ['Langkah 3: Pemakaian per hari', 'Pemakaian per hari = forecast per bulan ÷ 26 hari kerja.'],
    ['Langkah 4: Lead time', 'Lead time = jarak hari dari PO dibuat sampai barang diterima di Cinere, rata-rata dari riwayat PO VinFast per part (tab Incoming Part). Part tanpa riwayat PO memakai lead time bawaan.'],
    ['Langkah 5: Cadangan', 'Stok pengaman = tambahan stok sebagai persen dari lead time part itu. Contoh 30%: lead time 20 hari dapat cadangan 6 hari, lead time 2 hari dapat 0,6 hari. Pilihan: Tipis 15%, Normal 30%, Aman 50%. Pilih Aman kalau takut telat dari VinFast, Tipis kalau stok mau diketatkan.'],
    ['Langkah 6: Target stok', 'Target stok = forecast 1 bulan + pemakaian per hari × lead time × (1 + cadangan%). Artinya stok harus cukup untuk bertahan sampai barang datang (plus pengaman) dan melayani 1 bulan setelahnya.'],
    ['Langkah 7: Saran order', 'Saran order = target stok − stok Cinere sekarang (minimal 0). Daftar diurutkan dari yang paling perlu order.'],
    ['Contoh', 'Baseline 40 pcs/bulan, kenaikan 50% (×1,5), lead time 20 hari, stok pengaman 30%, stok 20 pcs. Forecast = 60 pcs/bulan (2,3 pcs/hari). Pemakaian selama 26 hari (20 × 1,3) = ±60 pcs. Target = 60 + 60 = 120 pcs. Saran order = 120 − 20 = 100 pcs.'],
    ['Batasan', 'Pemakaian beberapa part bergelombang (misalnya 240 pcs di satu bulan lalu 3 dan 0), sehingga rata-rata bisa menyesatkan; coba baseline median dan cek rincian bulanannya. Kolom Qty Order FR Nov dipakai sebagai pembanding dengan order yang sudah direncanakan di sheet FR. Stok Cinere diambil dari balance menu KS (kartu stok Cinere), jadi mengikuti data KS terkini; part yang tidak ada di KS memakai angka snapshot dari tab Moving. Ini alat bantu perkiraan, keputusan order tetap perlu dicek manual. Data diperbarui oleh Stock Bot, lihat waktu pembaruan di bawah judul halaman.'],
  ];

  function panduan() {
    sheet.buka('Panduan forecasting', PANDUAN.map(([j, t]) => `<h3 class="judul-kecil">${esc(j)}</h3><div class="teks-kecil" style="margin-bottom:10px">${esc(t)}</div>`).join(''));
  }

  function ekspor() {
    if (!DATA || !window.Ekspor) return;
    const h = DATA.rows.map(hitung).sort((a, b) => b.order - a.order || b.fc - a.fc);
    if (!h.length) { App.toast('Tidak ada data untuk diekspor.', true); return; }
    const bulan = x => x.bulan;
    Ekspor.unduh(Ekspor.namaDenganTanggal('snd-forecast-cinere'), [
      {
        nama: 'Forecast',
        kolom: ['Kode Part', 'Nama Part', 'Juni*', 'Juli*', 'Agustus', 'September', 'Oktober', 'November* (parsial)', 'Baseline 1 shift/bln', 'Pengali', 'Forecast/bln', 'Pemakaian/hari', 'Lead time (hari)', 'Sumber lead time', 'Cadangan (hari)', 'Target stok', 'Stok Cinere (KS)', 'Cukup (hari kerja)', 'Saran order', 'Qty Order FR Nov', 'Sumber part'],
        baris: h.map(x => [x.kode, x.nama, ...bulan(x), Math.round(x.base * 10) / 10, mult(), Math.round(x.fc * 10) / 10, Math.round(x.fc / HARI_KERJA * 100) / 100,
          x.lt, x.ltAsli ? x.po + ' PO' : 'bawaan', Math.round(x.lt * p.cadangan / 100 * 10) / 10, x.target, x.stok, x.cover == null ? '' : Math.round(x.cover * 10) / 10, x.order, x.orderFR, x.sumber]),
      },
      {
        nama: 'Parameter',
        kolom: ['Parameter', 'Nilai'],
        baris: [['Skenario', namaSkenario()], ['Pengali', mult()], ['Stok pengaman (% dari lead time)', p.cadangan], ['Lead time bawaan (hari)', p.ltDefault], ['Hari kerja per bulan', HARI_KERJA], ['Data diperbarui', DATA.update || '-'], ['Metode baseline', p.metode === 'median' ? 'Median Agustus–Oktober' : 'Rata-rata Agustus–Oktober'], ['*Bulan tidak masuk baseline', 'Juni (data mulai 18 Juni), Juli (lonjakan sekali jalan), November (belum penuh)']],
        lebar: [32, 44],
      },
      { nama: 'Panduan', kolom: ['Topik', 'Penjelasan'], baris: PANDUAN, lebar: [28, 110] },
    ]);
    App.toast(`Mengunduh forecast ${angka(h.length)} part ke Excel…`);
  }

  const PENGAMAN = [['Tipis', 15], ['Normal', 30], ['Aman', 50]];

  function kontrolHtml() {
    const lain = p.lain || (p.naik !== 0 && p.naik !== 100);
    const chip = (aktif, data, teks) => '<button type="button" class="chip' + (aktif ? ' aktif' : '') + '" ' + data + '>' + teks + '</button>';
    return '<div class="fc-grup"><div class="fc-label">Jumlah shift</div>' +
      '<div class="chips">' + chip(p.naik === 0 && !lain, 'data-naik="0"', '1 shift') + chip(p.naik === 100 && !lain, 'data-naik="100"', '2 shift') + chip(lain, 'data-naik="lain"', 'Atur sendiri') + '</div>' +
      (lain ? '<label class="fc-inline">Pemakaian naik <input class="input" id="fcNaik" type="number" min="0" max="300" step="5" inputmode="numeric" value="' + p.naik + '"> % dari 1 shift</label>' : '') +
      '</div>' +
      '<div class="fc-grup"><div class="fc-label">Stok pengaman</div><div class="chips">' +
      PENGAMAN.map(([n, v]) => chip(p.cadangan === v, 'data-aman="' + v + '"', n + ' ' + v + '%')).join('') + '</div></div>';
  }

  function render(el, u) {
    ui = u;
    u.setAksi(`<button type="button" class="tombol-ikon" id="btnPanduan" title="Panduan forecasting" aria-label="Panduan forecasting">${ikon.kartu}</button>
      <button type="button" class="tombol-ikon" id="btnEkspor" title="Ekspor ke Excel" aria-label="Ekspor ke Excel">${ikon.unduh}</button>`);
    el.innerHTML = `
      <section class="bagian" aria-label="Pengaturan skenario">
        <div class="kartu">
          <div class="kartu-judul"><h2>Skenario</h2><small>Fast moving Cinere</small></div>
          <div class="fc-param" id="fcKontrol">${kontrolHtml()}</div>
          <details class="fc-lanjut">
            <summary>Pengaturan lanjutan</summary>
            <div class="fc-param" style="margin-top:10px">
              <label class="fc-grup"><span class="fc-label">Lead time bila belum ada riwayat PO (hari)</span><input class="input" id="fcLt" type="number" min="0" max="90" step="1" inputmode="numeric" value="${p.ltDefault}"></label>
              <label class="fc-grup"><span class="fc-label">Cara hitung baseline</span><select class="input" id="fcMetode"><option value="rata"${p.metode === 'rata' ? ' selected' : ''}>Rata-rata 3 bulan (seperti FR)</option><option value="median"${p.metode === 'median' ? ' selected' : ''}>Median 3 bulan (tahan lonjakan)</option></select></label>
            </div>
          </details>
          <div class="teks-kecil" style="margin-top:10px">Pemakaian 1 shift = rata-rata Agustus–Oktober. Stok pengaman = tambahan stok sebesar persen dari lead time part itu. Cara hitung lengkap ada di tombol Panduan.</div>
        </div>
      </section>
      <section class="bagian" id="fcRingkas" aria-label="Ringkasan"></section>
      <section class="bagian" aria-label="Daftar part"><div class="daftar" id="fcDaftar"><div class="kosong">${ikon.kosong}<div>Memuat data…</div></div></div></section>`;
    $('btnPanduan').addEventListener('click', panduan);
    $('btnEkspor').addEventListener('click', ekspor);
    const simpan = () => { try { localStorage.setItem(KUNCI, JSON.stringify(p)); } catch (e) {} };
    const segar = () => { $('fcKontrol').innerHTML = kontrolHtml(); simpan(); gambar(); };
    $('fcKontrol').addEventListener('click', e => {
      const c = e.target.closest('.chip'); if (!c) return;
      if (c.dataset.naik === 'lain') { p.lain = true; if (p.naik === 0 || p.naik === 100) p.naik = 50; }
      else if (c.dataset.naik !== undefined) { p.lain = false; p.naik = Number(c.dataset.naik); }
      else if (c.dataset.aman !== undefined) p.cadangan = Number(c.dataset.aman);
      segar();
    });
    $('fcKontrol').addEventListener('input', e => {
      if (e.target.id !== 'fcNaik') return;
      const v = parseFloat(e.target.value);
      p.naik = Number.isFinite(v) ? Math.min(300, Math.max(0, v)) : 0; p.lain = true;
      simpan(); gambar(); // kolom isian tidak digambar ulang supaya fokus tetap
    });
    $('fcLt').addEventListener('input', e => { const v = parseFloat(e.target.value); p.ltDefault = Number.isFinite(v) ? Math.min(90, Math.max(0, v)) : 7; simpan(); gambar(); });
    $('fcMetode').addEventListener('change', e => { p.metode = e.target.value === 'median' ? 'median' : 'rata'; simpan(); gambar(); });
    $('fcDaftar').addEventListener('click', e => { const k = e.target.closest('[data-kode]'); if (k) detail(k.dataset.kode); });
    if (DATA) { ui.setSub(subTeks()); gambar(); } else muat();
  }

  const subTeks = () => `Cinere · pemakaian ${DATA.update || '-'}${infoKS ? ' · stok KS ' + infoKS : ''}${DATA.offlineSejak ? ' · offline' : ''}`;

  function muat() {
    Promise.all([
      App.ambil('getDataForecast', 60000),
      App.ambil('getDataKS', 120000).catch(() => null), // stok terkini dari menu KS; kalau gagal pakai angka snapshot
    ]).then(([d, ks]) => {
      DATA = d;
      KS = null; infoKS = '';
      if (ks && ks.rows) {
        KS = new Map();
        ks.rows.forEach(x => { if (String(x[0]).toUpperCase() === 'CINERE') KS.set(String(x[1]).trim().toUpperCase(), (KS.get(String(x[1]).trim().toUpperCase()) || 0) + (Number(x[7]) || 0)); });
        infoKS = ks.update || '';
      }
      if (App.state.aktif !== 'forecast') return;
      ui.setSub(subTeks());
      gambar();
    }).catch(e => {
      if (App.state.aktif !== 'forecast') return;
      $('fcDaftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>${esc(e.message || 'Data forecast belum bisa dimuat.')}</div><button type="button" class="tombol halus" id="coba">Coba lagi</button></div>`;
      $('coba').addEventListener('click', muat);
    });
  }

  function gambar() {
    if (!DATA) return;
    const h = DATA.rows.map(hitung).sort((a, b) => b.order - a.order || b.fc - a.fc);
    if (!h.length) { $('fcRingkas').innerHTML = ''; $('fcDaftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>Belum ada data fast moving. Jalankan sinkron forecast di Stock Bot.</div></div>`; return; }
    const tot = h.reduce((s, x) => ({ base: s.base + x.base, fc: s.fc + x.fc, order: s.order + x.order, perlu: s.perlu + (x.order > 0 ? 1 : 0) }), { base: 0, fc: 0, order: 0, perlu: 0 });
    $('fcRingkas').innerHTML = `<div class="fc-tiles">
      <div class="fc-tile"><small>Jumlah part</small><b>${angka(h.length)}</b></div>
      <div class="fc-tile"><small>Pemakaian 1 shift / bln</small><b>${angka(Math.round(tot.base))}</b><span>pcs</span></div>
      <div class="fc-tile"><small>Skenario ${esc(namaSkenario())} / bln</small><b>${angka(Math.round(tot.fc))}</b><span>pcs</span></div>
      <div class="fc-tile"><small>Perlu order</small><b>${angka(tot.perlu)}</b><span>${angka(tot.order)} pcs</span></div></div>`;
    $('fcDaftar').innerHTML = '<div class="fc-kepala"><span>Part</span><span>1 shift</span><span>Skenario</span><span>Stok</span><span>Saran order</span><span>FR Nov</span></div>' + h.map(x => `
      <button type="button" class="fc-baris" data-kode="${esc(x.kode)}">
        <span class="fc-part"><span class="fc-kode">${esc(x.kode)}</span><span class="fc-nama">${esc(x.nama)}</span></span>
        <span class="fc-sel" data-l="1 shift">${angka(Math.round(x.base))}</span>
        <span class="fc-sel" data-l="Skenario">${angka(Math.round(x.fc))}</span>
        <span class="fc-sel ${x.stok <= 0 ? 'habis' : ''}" data-l="Stok">${angka(x.stok)}</span>
        <span class="fc-sel fc-order ${x.order > 0 ? 'perlu' : 'cukup'}" data-l="Saran order">${x.order > 0 ? angka(x.order) : 'Cukup'}</span>
        <span class="fc-sel fc-fr" data-l="FR Nov">${x.orderFR > 0 ? angka(x.orderFR) : '–'}</span>
      </button>`).join('');
  }

  function detail(kode) {
    const x = DATA.rows.map(hitung).find(y => y.kode === kode);
    if (!x) return;
    const nama = ['Juni*', 'Juli*', 'Agustus', 'September', 'Oktober', 'November*'];
    sheet.buka(esc(x.kode), `
      <div class="detail-baris"><span>Nama part</span><span>${esc(x.nama)}</span></div>
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Pemakaian Cinere (1 shift)</h3>
      ${x.bulan.map((v, i) => `<div class="detail-baris"><span>${nama[i]}</span><span>${angka(v)} pcs</span></div>`).join('')}
      <div class="teks-kecil">Baseline = Agustus–Oktober (${p.metode === 'median' ? 'median' : 'rata-rata'}). *Tidak masuk baseline: Juni (data mulai 18 Juni), Juli (sering ada lonjakan sekali jalan), November (bulan berjalan, belum penuh). Sumber: ${esc(x.sumber)}.</div>
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Skenario ×${desimal(mult())}</h3>
      <div class="detail-baris"><span>Baseline 1 shift / bulan</span><span>${desimal(x.base)} pcs</span></div>
      <div class="detail-baris"><span>Forecast / bulan</span><span>${desimal(x.fc)} pcs</span></div>
      <div class="detail-baris"><span>Lead time</span><span>${desimal(x.lt)} hari${x.ltAsli ? ` (${x.po} PO)` : ' (bawaan)'}</span></div>
      <div class="detail-baris"><span>Cadangan (${p.cadangan}%)</span><span>${desimal(x.lt * p.cadangan / 100)} hari</span></div>
      <div class="detail-baris"><span>Target stok</span><span>${angka(x.target)} pcs</span></div>
      <div class="detail-baris"><span>Stok Cinere (${x.dariKS ? 'KS' : 'snapshot, tidak ada di KS'})</span><span>${angka(x.stok)} pcs${x.cover != null ? ` · cukup ±${desimal(x.cover)} hari kerja` : ''}</span></div>
      <div class="detail-baris"><span><b>Saran order</b></span><span><b>${angka(x.order)} pcs</b></span></div>
      <div class="detail-baris"><span>Qty Order di FR Nov</span><span>${angka(x.orderFR)} pcs</span></div>`);
  }

  App.daftar({
    id: 'forecast', label: 'Forecast Cinere', pendek: 'Forecast', ikon: 'grafik',
    desk: 'Perkiraan kebutuhan part fast moving Cinere untuk skenario 2 shift, lengkap dengan saran order.',
    render,
  });
})();
