/**
 * Halaman: Forecast Cinere (fast moving, skenario 2 shift).
 * Data dasar dari tab "Forecast Cinere" (Stock Bot, dari Moving + Incoming Part MRP Cinere).
 * Baris: [kode, nama, juni, juli, agustus, september, oktober, stok, leadTimeHari|null, jumlahPO].
 * Baseline 1 shift = rata-rata Juli-Oktober (Juni tidak dipakai: data MRP mulai 18 Juni, bulan belum penuh).
 * Pengali shift, hari cadangan, dan lead time bawaan bisa diatur dan diingat di perangkat.
 */
(function () {
  const { sheet, esc, angka, ikon, $ } = App;
  const KUNCI = 'snd_fc_param';
  const BULAN_DIPAKAI = [3, 4, 5, 6]; // indeks Juli..Oktober di baris
  const HARI_KERJA = 26;
  let DATA = null;
  let ui = null;
  let p = Object.assign({ pengali: 2, cadangan: 7, ltDefault: 7 }, (() => { try { return JSON.parse(localStorage.getItem(KUNCI)) || {}; } catch (e) { return {}; } })());

  const desimal = n => (Math.round(n * 10) / 10).toLocaleString('id-ID');

  function hitung(r) {
    const base = BULAN_DIPAKAI.reduce((s, i) => s + r[i], 0) / BULAN_DIPAKAI.length; // 1 shift per bulan
    const fc = base * p.pengali; // skenario per bulan
    const lt = r[8] == null ? p.ltDefault : r[8];
    const perHari = fc / HARI_KERJA;
    const target = Math.ceil(fc + perHari * (lt + p.cadangan)); // kebutuhan 1 bulan + penyangga selama lead time & cadangan
    const order = Math.max(0, target - r[7]);
    const cover = perHari > 0 ? r[7] / perHari : null; // stok cukup berapa hari kerja
    return { kode: r[0], nama: r[1], base, fc, lt, ltAsli: r[8] != null, stok: r[7], target, order, cover, bulan: r.slice(2, 7), po: r[9] };
  }

  function render(el, u) {
    ui = u;
    u.setAksi('');
    el.innerHTML = `
      <section class="bagian" aria-label="Pengaturan skenario">
        <div class="kartu">
          <div class="kartu-judul"><h2>Skenario</h2><small>Fast moving Cinere</small></div>
          <div class="fc-param">
            <label>Pengali shift<input class="input" id="fcPengali" type="number" min="0.5" max="4" step="0.1" inputmode="decimal" value="${p.pengali}"></label>
            <label>Cadangan (hari)<input class="input" id="fcCadangan" type="number" min="0" max="60" step="1" inputmode="numeric" value="${p.cadangan}"></label>
            <label>Lead time bawaan (hari)<input class="input" id="fcLt" type="number" min="0" max="90" step="1" inputmode="numeric" value="${p.ltDefault}"></label>
          </div>
          <div class="teks-kecil" style="margin-top:10px">Baseline 1 shift = rata-rata pemakaian Juli–Oktober. Skenario 2 shift = baseline × pengali (2 = permintaan naik dua kali lipat). Saran order = kebutuhan 1 bulan + pemakaian selama lead time dan cadangan − stok Cinere. Lead time dari riwayat PO VinFast per part; kalau belum ada riwayat dipakai lead time bawaan.</div>
        </div>
      </section>
      <section class="bagian" id="fcRingkas" aria-label="Ringkasan"></section>
      <section class="bagian" aria-label="Daftar part"><div class="daftar" id="fcDaftar"><div class="kosong">${ikon.kosong}<div>Memuat data…</div></div></div></section>`;
    const simpan = () => { try { localStorage.setItem(KUNCI, JSON.stringify(p)); } catch (e) {} };
    const ambilAngka = (id, awal, min, max) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : awal; };
    const ubah = () => {
      p.pengali = ambilAngka('fcPengali', 2, 0.5, 4);
      p.cadangan = ambilAngka('fcCadangan', 7, 0, 60);
      p.ltDefault = ambilAngka('fcLt', 7, 0, 90);
      simpan(); gambar();
    };
    ['fcPengali', 'fcCadangan', 'fcLt'].forEach(id => $(id).addEventListener('input', ubah));
    $('fcDaftar').addEventListener('click', e => { const k = e.target.closest('.po'); if (k && k.dataset.kode) detail(k.dataset.kode); });
    if (DATA) { ui.setSub(subTeks()); gambar(); } else muat();
  }

  const subTeks = () => `Cinere · diperbarui ${DATA.update || '-'}${DATA.offlineSejak ? ' · offline' : ''}`;

  function muat() {
    App.ambil('getDataForecast', 60000).then(d => {
      DATA = d;
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
      <div class="detail-baris"><span>Target stok</span><span>${angka(x.target)} pcs</span></div>
      <div class="detail-baris"><span>Stok Cinere</span><span>${angka(x.stok)} pcs${x.cover != null ? ` · cukup ±${desimal(x.cover)} hari kerja` : ''}</span></div>
      <div class="detail-baris"><span><b>Saran order</b></span><span><b>${angka(x.order)} pcs</b></span></div>`);
  }

  App.daftar({
    id: 'forecast', label: 'Forecast Cinere', pendek: 'Forecast', ikon: 'grafik',
    desk: 'Perkiraan kebutuhan part fast moving Cinere untuk skenario 2 shift, lengkap dengan saran order.',
    render,
  });
})();
