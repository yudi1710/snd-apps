/**
 * Halaman: Forecast Cinere (fast moving, skenario 2 shift).
 * Data dasar dari tab "Forecast Cinere" (Stock Bot, dari Moving + Incoming Part MRP Cinere).
 * Baris: [kode, nama, m0..m5 (6 bulan, m5 = bulan berjalan), stokSnapshot, leadTimeHari|null, jumlahPO, sumber, hargaWholesale|null, hargaNormal|null].
 * Label bulan dari DATA.bulan ('YYYY-MM'). Baseline 1 shift = 3 bulan penuh terakhir (m2..m4); m0, m1 (lebih lama) dan m5 (bulan berjalan, belum penuh) tidak masuk baseline.
 * Tombol Sinkron memanggil backend (sinkronForecast) yang membaca ulang MRP Cinere, jadi periode baseline bergeser otomatis tiap bulan.
 * Jumlah shift, stok pengaman, dan lead time bawaan bisa diatur dan diingat di perangkat.
 */
(function () {
  const { sheet, esc, angka, rp, ikon, $ } = App;
  const KUNCI = 'snd_fc_param4';
  const BULAN_DIPAKAI = [4, 5, 6]; // m2..m4 di baris: tiga bulan penuh terakhir
  const NAMA_BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const lblBulan = i => { const k = DATA && DATA.bulan && DATA.bulan[i]; const m = /^(\d{4})-(\d{2})$/.exec(k || ''); return m ? NAMA_BLN[+m[2] - 1] + ' ' + m[1] : 'bulan ' + (i + 1); };
  const periodeBaseline = () => lblBulan(2) + '–' + lblBulan(4);
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
    return { kode: r[0], nama: r[1], base, fc, lt, ltAsli: r[9] != null, stok, dariKS, target, order, cover, bulan: r.slice(2, 8), po: r[10], sumber: r[11], fast: /fast/i.test(r[11] || ''),
      harga: r[12] || null, hargaNormal: r[13] || null,
      nilai: r[12] ? order * r[12] : null,
      o1: Math.ceil(order / 2), o2: order - Math.ceil(order / 2), // Order Pertama (dibulatkan ke atas) dan Order Kedua
      n1: r[12] ? Math.ceil(order / 2) * r[12] : null, n2: r[12] ? (order - Math.ceil(order / 2)) * r[12] : null };
  }

  // ---------- buku panduan (dipakai di aplikasi dan di sheet Panduan pada Excel) ----------
  const PANDUAN = [
    ['Gambaran alur', 'Alur membuat forecast dari awal sampai jadi: (1) Sinkron data, (2) pilih jumlah shift, (3) pilih stok pengaman, (4) baca ringkasan dan tabel, (5) buka rincian part bila perlu, (6) Export Excel. Seluruhnya untuk part Fast Move Cinere.'],
    ['Langkah 1: Sinkron data', 'Tekan tombol Sinkron (ikon panah putar, pojok kanan atas halaman). Server membaca ulang MRP Cinere: pemakaian per bulan (tab Outgoing Part), lead time dan harga beli (tab Incoming Part), serta daftar Fast Move (tab Moving). Proses bisa sampai satu menit, tunggu sampai muncul pesan "Sinkron selesai". Lakukan Sinkron setiap mau membuat forecast baru, misalnya di awal bulan. Periode baseline ikut bergeser otomatis ke tiga bulan penuh terakhir. Waktu sinkron terakhir tampil di bawah judul halaman. Stok tidak perlu disinkron karena selalu diambil langsung dari menu KS.'],
    ['Langkah 2: Pilih jumlah shift', 'Pilih 1 shift (pemakaian apa adanya) atau 2 shift (pemakaian naik 100%, jadi dua kali lipat). Untuk angka lain pilih Atur sendiri, lalu isi berapa persen pemakaian naik dari 1 shift (0% = 1 shift, 50% = 1,5 kali, 100% = 2 shift). Angka kenaikan ini asumsi, cocokkan lagi dengan data nyata setelah shift tambahan berjalan beberapa minggu.'],
    ['Langkah 3: Pilih stok pengaman', 'Stok pengaman = tambahan stok sebagai persen dari lead time part itu. Pilihan: Tipis 15%, Normal 30%, Aman 50%. Pilih Aman kalau takut barang telat dari VinFast, Tipis kalau stok mau diketatkan. Contoh Normal 30%: lead time 20 hari dapat pengaman 6 hari, lead time 2 hari dapat 0,6 hari. Di Pengaturan lanjutan ada lead time bila belum ada riwayat PO (bawaan 7 hari) dan cara hitung baseline (rata-rata atau median; median tidak ikut tertarik lonjakan sekali jalan).'],
    ['Langkah 4: Baca ringkasan dan tabel', 'Kartu ringkasan: jumlah part, pemakaian 1 shift per bulan, hasil skenario per bulan, jumlah part yang perlu order, dan estimasi nilai order beserta nilai Order 1 dan Order 2. Tabel diurutkan dari part yang paling perlu order. Kolom: 1 shift (pemakaian baseline per bulan), Skenario (forecast per bulan sesuai shift yang dipilih), Stok (balance KS Cinere sekarang, merah kalau 0), Saran order (total pcs yang perlu dipesan), Order 1 dan Order 2 (saran order dibagi dua tahap; angka kecil di bawahnya nilai Rp tiap tahap), serta Total (Rp) dengan harga per pcs di bawahnya (tulisan @).'],
    ['Langkah 5: Rincian part', 'Klik satu baris untuk membuka rincian: pemakaian tiap bulan, baseline, forecast, lead time (dan jumlah PO yang jadi dasarnya), stok pengaman, target stok, stok sekarang dan cukup berapa hari kerja, saran order, harga, total, serta pembagian Order Pertama dan Order Kedua (dibagi dua, pertama dibulatkan ke atas).'],
    ['Langkah 6: Export Excel', 'Tekan tombol unduh (ikon panah ke bawah) untuk mengunduh file .xlsx berisi tiga sheet: Forecast (semua part lengkap dengan pemakaian bulanan, baseline, forecast, lead time, pengaman, target stok, stok, saran order, harga, total, order pertama dan kedua), Parameter (shift, pengaman, dan pengaturan yang dipakai saat unduh), dan Panduan (isi buku ini). Isi Excel mengikuti pengaturan di layar saat tombol ditekan, jadi atur dulu skenarionya baru unduh. Angka di Excel berupa hasil hitung, bukan rumus.'],
    ['Cara hitung: baseline', 'Baseline 1 shift = pemakaian tiga bulan penuh terakhir dari tab Outgoing Part (bulan berjalan tidak dihitung karena belum penuh), dirata-rata atau diambil mediannya. Pemakaian negatif karena retur dihitung 0. Forecast per bulan = baseline × (1 + kenaikan%).'],
    ['Cara hitung: target dan saran order', 'Pemakaian per hari = forecast per bulan ÷ 26 hari kerja. Lead time = rata-rata jarak hari dari PO dibuat sampai barang diterima (riwayat PO VinFast per part; kalau belum ada pakai lead time bawaan). Target stok = forecast 1 bulan + pemakaian per hari × lead time × (1 + pengaman%). Saran order = target stok − stok Cinere sekarang (minimal 0). Artinya stok harus cukup untuk bertahan sampai barang datang (plus pengaman) dan melayani 1 bulan setelahnya.'],
    ['Cara hitung: harga dan total', 'Harga per pcs = harga wholesale, yaitu harga beli (sebelum pajak) pada PO terakhir part itu di tab Incoming Part. Total = saran order × harga. Pembagian dua tahap: Order 1 (Order Pertama) = separuh saran order dibulatkan ke atas, Order 2 (Order Kedua) = sisanya, jadi dua tahap pemesanan dengan total sama dengan saran order. Pembagian ini default 50:50; kalau mau memecah dengan komposisi lain, sesuaikan manual di Excel. Part yang belum pernah di-PO belum punya harga dan ditandai strip. Estimasi nilai order di ringkasan adalah jumlah total semua part yang punya harga.'],
    ['Contoh', 'Baseline 40 pcs/bulan, kenaikan 50% (×1,5), lead time 20 hari, pengaman 30%, stok 20 pcs, harga Rp 100.000. Forecast = 60 pcs/bulan (±2,3 pcs/hari). Pemakaian selama 26 hari (20 × 1,3) = ±60 pcs. Target = 60 + 60 = 120 pcs. Saran order = 120 − 20 = 100 pcs. Total = 100 × Rp 100.000 = Rp 10.000.000.'],
    ['Catatan dan batasan', 'Daftar part adalah part berlabel Fast Move di tab Moving MRP Cinere; HANKOOK dan Massive/Massiv EV dikecualikan. Pemakaian beberapa part bergelombang (misalnya 240 pcs di satu bulan lalu 3 dan 0), sehingga rata-rata bisa menyesatkan; coba baseline median dan cek rincian bulanannya. Stok mengikuti KS terkini (kalau part tidak ada di KS dipakai angka snapshot dari sinkron). Ini alat bantu perkiraan, keputusan order tetap perlu dicek manual.'],
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
        kolom: ['Kode Part', 'Nama Part', ...[0, 1, 2, 3, 4, 5].map(i => lblBulan(i) + (i < 2 ? '*' : i === 5 ? '* (parsial)' : '')), 'Baseline 1 shift/bln', 'Pengali', 'Forecast/bln', 'Pemakaian/hari', 'Lead time (hari)', 'Sumber lead time', 'Cadangan (hari)', 'Target stok', 'Stok Cinere (KS)', 'Cukup (hari kerja)', 'Saran order', 'Harga Wholesale/pcs', 'Harga Normal/pcs', 'Total Saran Order (Rp)', 'Order Pertama (pcs)', 'Total Order Pertama (Rp)', 'Order Kedua (pcs)', 'Total Order Kedua (Rp)'],
        baris: h.map(x => [x.kode, x.nama, ...bulan(x), Math.round(x.base * 10) / 10, mult(), Math.round(x.fc * 10) / 10, Math.round(x.fc / HARI_KERJA * 100) / 100,
          x.lt, x.ltAsli ? x.po + ' PO' : 'bawaan', Math.round(x.lt * p.cadangan / 100 * 10) / 10, x.target, x.stok, x.cover == null ? '' : Math.round(x.cover * 10) / 10, x.order,
          x.harga || '', x.hargaNormal || '', x.harga ? Math.round(x.nilai) : '', x.o1, x.harga ? x.n1 : '', x.o2, x.harga ? x.n2 : '',
          ]),
      },
      {
        nama: 'Parameter',
        kolom: ['Parameter', 'Nilai'],
        baris: [['Skenario', namaSkenario()], ['Pengali', mult()], ['Stok pengaman (% dari lead time)', p.cadangan], ['Lead time bawaan (hari)', p.ltDefault], ['Hari kerja per bulan', HARI_KERJA], ['Data diperbarui', DATA.update || '-'], ['Metode baseline', (p.metode === 'median' ? 'Median ' : 'Rata-rata ') + periodeBaseline()], ['*Bulan tidak masuk baseline', lblBulan(0) + ', ' + lblBulan(1) + ' (lebih lama dari periode baseline), ' + lblBulan(5) + ' (bulan berjalan, belum penuh)']],
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
    u.setAksi(`<button type="button" class="tombol-ikon" id="btnSinkron" title="Sinkron data dari MRP Cinere" aria-label="Sinkron data dari MRP Cinere">${ikon.sync}</button>
      <button type="button" class="tombol-ikon" id="btnPanduan" title="Panduan forecasting" aria-label="Panduan forecasting">${ikon.kartu}</button>
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
              <label class="fc-grup"><span class="fc-label">Cara hitung baseline</span><select class="input" id="fcMetode"><option value="rata"${p.metode === 'rata' ? ' selected' : ''}>Rata-rata 3 bulan</option><option value="median"${p.metode === 'median' ? ' selected' : ''}>Median 3 bulan (tahan lonjakan)</option></select></label>
            </div>
          </details>
          <div class="teks-kecil" style="margin-top:10px"><b>1 shift</b> = pemakaian sekarang (rata-rata <span id="fcPeriode">tiga bulan penuh terakhir</span>). <b>Skenario</b> = perkiraan pemakaian per bulan kalau jumlah shift diubah sesuai pilihan di atas. <b>Order 1 dan Order 2</b> = saran order dibagi dua tahap pemesanan. Stok pengaman = tambahan stok sebesar persen dari lead time part itu. Cara hitung lengkap ada di tombol Panduan.</div>
        </div>
      </section>
      <section class="bagian" id="fcRingkas" aria-label="Ringkasan"></section>
      <section class="bagian" aria-label="Daftar part"><div class="daftar" id="fcDaftar"><div class="kosong">${ikon.kosong}<div>Memuat data…</div></div></div></section>`;
    $('btnSinkron').addEventListener('click', sinkron);
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

  function terap(d, ks) {
    DATA = d;
    KS = null; infoKS = '';
    if (ks && ks.rows) {
      KS = new Map();
      ks.rows.forEach(x => { if (String(x[0]).toUpperCase() === 'CINERE') { const k = String(x[1]).trim().toUpperCase(); KS.set(k, (KS.get(k) || 0) + (Number(x[7]) || 0)); } });
      infoKS = ks.update || '';
    }
    if (App.state.aktif !== 'forecast') return;
    ui.setSub(subTeks());
    const per = $('fcPeriode'); if (per && d.bulan && d.bulan.length) per.textContent = periodeBaseline();
    gambar();
  }

  function muat() {
    Promise.all([
      App.ambil('getDataForecast', 60000),
      App.ambil('getDataKS', 120000).catch(() => null), // stok terkini dari menu KS; kalau gagal pakai angka snapshot
    ]).then(([d, ks]) => terap(d, ks)).catch(e => {
      if (App.state.aktif !== 'forecast') return;
      $('fcDaftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>${esc(e.message || 'Data forecast belum bisa dimuat.')}</div><button type="button" class="tombol halus" id="coba">Coba lagi</button></div>`;
      $('coba').addEventListener('click', muat);
    });
  }

  let sedangSinkron = false;
  /** Baca ulang MRP Cinere lewat backend (bisa 20-60 detik), lalu muat ulang tampilan. */
  function sinkron() {
    if (sedangSinkron) return;
    sedangSinkron = true;
    const b = $('btnSinkron'); if (b) b.disabled = true;
    App.toast('Sinkron dari MRP Cinere… (bisa sampai satu menit)');
    App.api('sinkronForecast').then(d => {
      App.isi('getDataForecast', d);
      return App.ambil('getDataKS', 120000).catch(() => null).then(ks => { terap(d, ks); App.toast('Sinkron selesai: ' + (d.info || (d.rows.length + ' part'))); });
    }).catch(e => App.toast(e.message || 'Sinkron gagal.', true)).finally(() => { sedangSinkron = false; const b2 = $('btnSinkron'); if (b2) b2.disabled = false; });
  }

  function gambar() {
    if (!DATA) return;
    const h = DATA.rows.map(hitung).sort((a, b) => b.order - a.order || b.fc - a.fc);
    if (!h.length) { $('fcRingkas').innerHTML = ''; $('fcDaftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>Data forecast belum ada. Tekan Sinkron untuk mengambil dari MRP Cinere.</div><button type="button" class="tombol" id="sinkronKosong">Sinkron sekarang</button></div>`; const sk = $('sinkronKosong'); if (sk) sk.addEventListener('click', sinkron); return; }
    const tot = h.reduce((s, x) => ({ base: s.base + x.base, fc: s.fc + x.fc, order: s.order + x.order, perlu: s.perlu + (x.order > 0 ? 1 : 0), nilai: s.nilai + (x.nilai || 0), n1: s.n1 + (x.n1 || 0), n2: s.n2 + (x.n2 || 0), tanpaHarga: s.tanpaHarga + (x.order > 0 && !x.harga ? 1 : 0) }), { base: 0, fc: 0, order: 0, perlu: 0, nilai: 0, n1: 0, n2: 0, tanpaHarga: 0 });
    $('fcRingkas').innerHTML = `<div class="fc-tiles">
      <div class="fc-tile"><small>Part Fast Move</small><b>${angka(h.length)}</b></div>
      <div class="fc-tile"><small>Pemakaian 1 shift / bln</small><b>${angka(Math.round(tot.base))}</b><span>pcs</span></div>
      <div class="fc-tile"><small>Skenario ${esc(namaSkenario())} / bln</small><b>${angka(Math.round(tot.fc))}</b><span>pcs</span></div>
      <div class="fc-tile"><small>Perlu order</small><b>${angka(tot.perlu)}</b><span>${angka(tot.order)} pcs</span></div>
      <div class="fc-tile fc-tile-lebar"><small>Estimasi nilai order</small><b>${rp(tot.nilai)}</b><span>Order 1: ${rp(tot.n1)} · Order 2: ${rp(tot.n2)}${tot.tanpaHarga ? ' · ' + tot.tanpaHarga + ' part belum ada harga' : ''}</span></div></div>`;
    $('fcDaftar').innerHTML = '<div class="fc-kepala"><span>Part</span><span>1 shift</span><span>Skenario</span><span>Stok</span><span>Saran order</span><span>Order 1</span><span>Order 2</span><span>Total (Rp)</span></div>' + h.map(x => `
      <button type="button" class="fc-baris" data-kode="${esc(x.kode)}">
        <span class="fc-part"><span class="fc-kode">${esc(x.kode)}</span><span class="fc-nama">${esc(x.nama)}</span></span>
        <span class="fc-sel" data-l="1 shift">${angka(Math.round(x.base))}</span>
        <span class="fc-sel" data-l="Skenario">${angka(Math.round(x.fc))}</span>
        <span class="fc-sel ${x.stok <= 0 ? 'habis' : ''}" data-l="Stok">${angka(x.stok)}</span>
        <span class="fc-sel fc-order ${x.order > 0 ? 'perlu' : 'cukup'}" data-l="Saran order">${x.order > 0 ? angka(x.order) : 'Cukup'}</span>
        <span class="fc-sel fc-o" data-l="Order 1">${x.o1 > 0 ? angka(x.o1) : '–'}${x.o1 > 0 && x.harga ? `<small class="fc-sub">${angka(Math.round(x.n1))}</small>` : ''}</span>
        <span class="fc-sel fc-o" data-l="Order 2">${x.o2 > 0 ? angka(x.o2) : '–'}${x.o2 > 0 && x.harga ? `<small class="fc-sub">${angka(Math.round(x.n2))}</small>` : ''}</span>
        <span class="fc-sel fc-total" data-l="Total (Rp)">${x.order > 0 && x.harga ? angka(Math.round(x.nilai)) : '–'}${x.harga ? `<small class="fc-sub">@ ${angka(x.harga)}</small>` : ''}</span>

      </button>`).join('');
  }

  function detail(kode) {
    const x = DATA.rows.map(hitung).find(y => y.kode === kode);
    if (!x) return;
    const nama = [0, 1, 2, 3, 4, 5].map(i => lblBulan(i) + (i < 2 || i === 5 ? '*' : ''));
    sheet.buka(esc(x.kode), `
      <div class="detail-baris"><span>Nama part</span><span>${esc(x.nama)}</span></div>
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Pemakaian Cinere (1 shift)</h3>
      ${x.bulan.map((v, i) => `<div class="detail-baris"><span>${nama[i]}</span><span>${angka(v)} pcs</span></div>`).join('')}
      <div class="teks-kecil">Baseline = ${periodeBaseline()} (${p.metode === 'median' ? 'median' : 'rata-rata'}). *Tidak masuk baseline: bulan yang lebih lama dan bulan berjalan (belum penuh).</div>
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Skenario ×${desimal(mult())}</h3>
      <div class="detail-baris"><span>Baseline 1 shift / bulan</span><span>${desimal(x.base)} pcs</span></div>
      <div class="detail-baris"><span>Forecast / bulan</span><span>${desimal(x.fc)} pcs</span></div>
      <div class="detail-baris"><span>Lead time</span><span>${desimal(x.lt)} hari${x.ltAsli ? ` (${x.po} PO)` : ' (bawaan)'}</span></div>
      <div class="detail-baris"><span>Cadangan (${p.cadangan}%)</span><span>${desimal(x.lt * p.cadangan / 100)} hari</span></div>
      <div class="detail-baris"><span>Target stok</span><span>${angka(x.target)} pcs</span></div>
      <div class="detail-baris"><span>Stok Cinere (${x.dariKS ? 'KS' : 'snapshot, tidak ada di KS'})</span><span>${angka(x.stok)} pcs${x.cover != null ? ` · cukup ±${desimal(x.cover)} hari kerja` : ''}</span></div>
      <div class="detail-baris"><span><b>Saran order</b></span><span><b>${angka(x.order)} pcs</b></span></div>
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Harga</h3>
      ${x.harga ? `<div class="detail-baris"><span>Harga wholesale / pcs</span><span>${rp(x.harga)}</span></div>
      ${x.hargaNormal ? `<div class="detail-baris"><span>Harga normal / pcs</span><span>${rp(x.hargaNormal)}</span></div>` : ''}
      <div class="detail-baris"><span><b>Total saran order</b></span><span><b>${rp(x.nilai)}</b></span></div>
      ${x.order > 0 ? `<div class="detail-baris"><span>Order pertama (${angka(x.o1)} pcs)</span><span>${rp(x.n1)}</span></div>
      <div class="detail-baris"><span>Order kedua (${angka(x.o2)} pcs)</span><span>${rp(x.n2)}</span></div>` : ''}

      <div class="teks-kecil">Harga wholesale = harga beli PO terakhir dari VinFast.</div>` : `<div class="teks-kecil">Belum ada harga untuk part ini (belum pernah di-PO).</div>`}`);
  }

  App.daftar({
    id: 'forecast', label: 'Forecast Cinere', pendek: 'Forecast', ikon: 'grafik',
    desk: 'Perkiraan kebutuhan part fast moving Cinere untuk skenario shift pilihan, lengkap dengan saran order dan harga.',
    render,
  });
})();
