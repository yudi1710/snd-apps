/**
 * Halaman: Forecast Cinere (fast moving, skenario 2 shift).
 * Data dasar dari tab "Forecast Cinere" (Stock Bot, dari Moving + Incoming Part MRP Cinere).
 * Baris: [kode, nama, juni, juli, agustus, september, oktober, stok, leadTimeHari|null, jumlahPO].
 * Baseline 1 shift = rata-rata Juli-Oktober (Juni tidak dipakai: data MRP mulai 18 Juni, bulan belum penuh).
 * Pengali shift, hari cadangan, dan lead time bawaan bisa diatur dan diingat di perangkat.
 */
(function () {
  const { sheet, esc, angka, ikon, $ } = App;
  const KUNCI = 'snd_fc_param2';
  const BULAN_DIPAKAI = [3, 4, 5, 6]; // indeks Juli..Oktober di baris
  const HARI_KERJA = 26;
  let DATA = null;
  let KS = null; // Map kode -> balance KS Cinere (stok terkini dari menu KS)
  let infoKS = '';
  let ui = null;
  let p = Object.assign({ pengali: 2, cadangan: 30, ltDefault: 7 }, (() => { try { return JSON.parse(localStorage.getItem(KUNCI)) || {}; } catch (e) { return {}; } })());

  const desimal = n => (Math.round(n * 10) / 10).toLocaleString('id-ID');

  function hitung(r) {
    const base = BULAN_DIPAKAI.reduce((s, i) => s + r[i], 0) / BULAN_DIPAKAI.length; // 1 shift per bulan
    const fc = base * p.pengali; // skenario per bulan
    const lt = r[8] == null ? p.ltDefault : r[8];
    const perHari = fc / HARI_KERJA;
    const target = Math.ceil(fc + perHari * lt * (1 + p.cadangan / 100)); // kebutuhan 1 bulan + penyangga selama lead time & cadangan
    const order = Math.max(0, target - stok);
    const cover = perHari > 0 ? stok / perHari : null; // stok cukup berapa hari kerja
    const dariKS = KS && KS.has(r[0].toUpperCase());
    const stok = dariKS ? KS.get(r[0].toUpperCase()) : r[7];
    return { kode: r[0], nama: r[1], base, fc, lt, ltAsli: r[8] != null, stok, dariKS, target, order, cover, bulan: r.slice(2, 7), po: r[9] };
  }

  // ---------- buku panduan (dipakai di aplikasi dan di sheet Panduan pada Excel) ----------
  const PANDUAN = [
    ['Tujuan', 'Memperkirakan kebutuhan part fast moving Cinere kalau jam kerja naik dari 1 shift ke 2 shift, lalu menghitung berapa yang perlu di-order ke VinFast supaya stok tidak habis.'],
    ['Langkah 1: Baseline', 'Ambil pemakaian per bulan dari tab Moving MRP Cinere. Baseline 1 shift = rata-rata pemakaian Juli sampai Oktober. Juni tidak dipakai karena data MRP baru mulai 18 Juni (bulan belum penuh). Hanya part berlabel Fast Move yang masuk.'],
    ['Langkah 2: Pengali shift', 'Forecast per bulan = baseline × pengali. Pengali 2 artinya permintaan naik dua kali lipat. Kalau 2 shift tidak menggandakan pemakaian (misalnya ×1,5), ubah pengalinya. Angka ini asumsi, cocokkan lagi dengan data nyata setelah 2 shift berjalan beberapa minggu.'],
    ['Langkah 3: Pemakaian per hari', 'Pemakaian per hari = forecast per bulan ÷ 26 hari kerja.'],
    ['Langkah 4: Lead time', 'Lead time = jarak hari dari PO dibuat sampai barang diterima di Cinere, rata-rata dari riwayat PO VinFast per part (tab Incoming Part). Part tanpa riwayat PO memakai lead time bawaan.'],
    ['Langkah 5: Cadangan', 'Cadangan = pengaman sebagai persen dari lead time part itu. Contoh 30%: lead time 20 hari dapat cadangan 6 hari, lead time 2 hari dapat 0,6 hari. Naikkan kalau mau lebih aman dari keterlambatan, turunkan kalau stok mau diketatkan.'],
    ['Langkah 6: Target stok', 'Target stok = forecast 1 bulan + pemakaian per hari × lead time × (1 + cadangan%). Artinya stok harus cukup untuk bertahan sampai barang datang (plus pengaman) dan melayani 1 bulan setelahnya.'],
    ['Langkah 7: Saran order', 'Saran order = target stok − stok Cinere sekarang (minimal 0). Daftar diurutkan dari yang paling perlu order.'],
    ['Contoh', 'Baseline 40 pcs/bulan, pengali 1,5, lead time 20 hari, cadangan 30%, stok 20 pcs. Forecast = 60 pcs/bulan (2,3 pcs/hari). Pemakaian selama 26 hari (20 × 1,3) = ±60 pcs. Target = 60 + 60 = 120 pcs. Saran order = 120 − 20 = 100 pcs.'],
    ['Batasan', 'Pemakaian beberapa part bergelombang (misalnya 155 pcs di satu bulan lalu 0 di bulan berikutnya), sehingga rata-rata bisa menyesatkan; cek rincian bulanannya. Stok Cinere diambil dari balance menu KS (kartu stok Cinere), jadi mengikuti data KS terkini; part yang tidak ada di KS memakai angka snapshot dari tab Moving. Ini alat bantu perkiraan, keputusan order tetap perlu dicek manual. Data diperbarui oleh Stock Bot, lihat waktu pembaruan di bawah judul halaman.'],
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
        kolom: ['Kode Part', 'Nama Part', 'Juni*', 'Juli', 'Agustus', 'September', 'Oktober', 'Baseline 1 shift/bln', 'Pengali', 'Forecast/bln', 'Pemakaian/hari', 'Lead time (hari)', 'Sumber lead time', 'Cadangan (hari)', 'Target stok', 'Stok Cinere (KS)', 'Cukup (hari kerja)', 'Saran order'],
        baris: h.map(x => [x.kode, x.nama, ...bulan(x), Math.round(x.base * 10) / 10, p.pengali, Math.round(x.fc * 10) / 10, Math.round(x.fc / HARI_KERJA * 100) / 100,
          x.lt, x.ltAsli ? x.po + ' PO' : 'bawaan', Math.round(x.lt * p.cadangan / 100 * 10) / 10, x.target, x.stok, x.cover == null ? '' : Math.round(x.cover * 10) / 10, x.order]),
      },
      {
        nama: 'Parameter',
        kolom: ['Parameter', 'Nilai'],
        baris: [['Pengali shift', p.pengali], ['Cadangan (% dari lead time)', p.cadangan], ['Lead time bawaan (hari)', p.ltDefault], ['Hari kerja per bulan', HARI_KERJA], ['Data diperbarui', DATA.update || '-'], ['*Juni', 'tidak masuk baseline (data MRP mulai 18 Juni)']],
        lebar: [32, 44],
      },
      { nama: 'Panduan', kolom: ['Topik', 'Penjelasan'], baris: PANDUAN, lebar: [28, 110] },
    ]);
    App.toast(`Mengunduh forecast ${angka(h.length)} part ke Excel…`);
  }

  function render(el, u) {
    ui = u;
    u.setAksi(`<button type="button" class="tombol-ikon" id="btnPanduan" title="Panduan forecasting" aria-label="Panduan forecasting">${ikon.kartu}</button>
      <button type="button" class="tombol-ikon" id="btnEkspor" title="Ekspor ke Excel" aria-label="Ekspor ke Excel">${ikon.unduh}</button>`);
    el.innerHTML = `
      <section class="bagian" aria-label="Pengaturan skenario">
        <div class="kartu">
          <div class="kartu-judul"><h2>Skenario</h2><small>Fast moving Cinere</small></div>
          <div class="fc-param">
            <label>Pengali shift<input class="input" id="fcPengali" type="number" min="0.5" max="4" step="0.1" inputmode="decimal" value="${p.pengali}"></label>
            <label>Cadangan (% lead time)<input class="input" id="fcCadangan" type="number" min="0" max="200" step="5" inputmode="numeric" value="${p.cadangan}"></label>
            <label>Lead time bawaan (hari)<input class="input" id="fcLt" type="number" min="0" max="90" step="1" inputmode="numeric" value="${p.ltDefault}"></label>
          </div>
          <div class="teks-kecil" style="margin-top:10px">Baseline 1 shift = rata-rata pemakaian Juli–Oktober. Skenario = baseline × pengali (2 = permintaan naik dua kali lipat). Cadangan = pengaman sebagai persen dari lead time part itu (lead time 20 hari dengan cadangan 30% = 6 hari ekstra). Saran order = kebutuhan 1 bulan + pemakaian selama (lead time + cadangan) − stok Cinere. Lead time dari riwayat PO VinFast per part; kalau belum ada riwayat dipakai lead time bawaan.</div>
        </div>
      </section>
      <section class="bagian" id="fcRingkas" aria-label="Ringkasan"></section>
      <section class="bagian" aria-label="Daftar part"><div class="daftar" id="fcDaftar"><div class="kosong">${ikon.kosong}<div>Memuat data…</div></div></div></section>`;
    $('btnPanduan').addEventListener('click', panduan);
    $('btnEkspor').addEventListener('click', ekspor);
    const simpan = () => { try { localStorage.setItem(KUNCI, JSON.stringify(p)); } catch (e) {} };
    const ambilAngka = (id, awal, min, max) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : awal; };
    const ubah = () => {
      p.pengali = ambilAngka('fcPengali', 2, 0.5, 4);
      p.cadangan = ambilAngka('fcCadangan', 30, 0, 200);
      p.ltDefault = ambilAngka('fcLt', 7, 0, 90);
      simpan(); gambar();
    };
    ['fcPengali', 'fcCadangan', 'fcLt'].forEach(id => $(id).addEventListener('input', ubah));
    $('fcDaftar').addEventListener('click', e => { const k = e.target.closest('.po'); if (k && k.dataset.kode) detail(k.dataset.kode); });
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
      <div class="fc-tile"><small>Part fast moving</small><b>${angka(h.length)}</b></div>
      <div class="fc-tile"><small>1 shift / bulan</small><b>${angka(Math.round(tot.base))}</b><span>pcs</span></div>
      <div class="fc-tile"><small>Skenario ×${desimal(p.pengali)} / bulan</small><b>${angka(Math.round(tot.fc))}</b><span>pcs</span></div>
      <div class="fc-tile"><small>Perlu order</small><b>${angka(tot.perlu)}</b><span>${angka(tot.order)} pcs</span></div></div>`;
    $('fcDaftar').innerHTML = '<div class="daftar-kepala"><span>Part</span><span style="text-align:right">Skenario/bln</span><span>Stok</span></div>' + h.map(x => `
      <button type="button" class="po ks fc-baris" data-kode="${esc(x.kode)}">
        <span class="po-info"><span class="po-no">${esc(x.kode)}</span><span class="po-meta">${esc(x.nama)}</span></span>
        <span class="ks-bal">${angka(Math.round(x.fc))}<small>per bulan</small></span>
        <span class="rincian">
          <span class="badge abu">1 shift <b>${angka(Math.round(x.base))}</b></span>
          <span class="badge ${x.stok <= 0 ? 'merah' : ''}">Stok <b>${angka(x.stok)}</b></span>
          <span class="badge ${x.order > 0 ? 'oranye titik' : ''}">${x.order > 0 ? 'Order <b>' + angka(x.order) + '</b>' : 'Cukup'}</span>
        </span>
      </button>`).join('');
  }

  function detail(kode) {
    const x = DATA.rows.map(hitung).find(y => y.kode === kode);
    if (!x) return;
    const nama = ['Juni*', 'Juli', 'Agustus', 'September', 'Oktober'];
    sheet.buka(esc(x.kode), `
      <div class="detail-baris"><span>Nama part</span><span>${esc(x.nama)}</span></div>
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Pemakaian Cinere (1 shift)</h3>
      ${x.bulan.map((v, i) => `<div class="detail-baris"><span>${nama[i]}</span><span>${angka(v)} pcs</span></div>`).join('')}
      <div class="teks-kecil">*Juni belum penuh (data MRP mulai 18 Juni), tidak masuk baseline.</div>
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Skenario ×${desimal(p.pengali)}</h3>
      <div class="detail-baris"><span>Baseline 1 shift / bulan</span><span>${desimal(x.base)} pcs</span></div>
      <div class="detail-baris"><span>Forecast / bulan</span><span>${desimal(x.fc)} pcs</span></div>
      <div class="detail-baris"><span>Lead time</span><span>${desimal(x.lt)} hari${x.ltAsli ? ` (${x.po} PO)` : ' (bawaan)'}</span></div>
      <div class="detail-baris"><span>Cadangan (${p.cadangan}%)</span><span>${desimal(x.lt * p.cadangan / 100)} hari</span></div>
      <div class="detail-baris"><span>Target stok</span><span>${angka(x.target)} pcs</span></div>
      <div class="detail-baris"><span>Stok Cinere (${x.dariKS ? 'KS' : 'snapshot, tidak ada di KS'})</span><span>${angka(x.stok)} pcs${x.cover != null ? ` · cukup ±${desimal(x.cover)} hari kerja` : ''}</span></div>
      <div class="detail-baris"><span><b>Saran order</b></span><span><b>${angka(x.order)} pcs</b></span></div>`);
  }

  App.daftar({
    id: 'forecast', label: 'Forecast Cinere', pendek: 'Forecast', ikon: 'grafik',
    desk: 'Perkiraan kebutuhan part fast moving Cinere untuk skenario 2 shift, lengkap dengan saran order.',
    render,
  });
})();
