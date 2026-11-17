/**
 * Halaman: Monitoring MRP PO.
 * Semua PO dari sheet Incoming 6 cabang (open + selesai), status terima, umur PO, ETA/catatan, dan status PO di Servia.
 *
 * Filter sengaja dibuat sederhana, satu arti untuk satu kontrol:
 *   - Status  : kartu ringkasan di atas (satu pilihan aktif; default "PO open")
 *   - Cabang  : satu dropdown
 *   - Cari    : kolom pencarian
 * Angka di kartu dan di dropdown cabang selalu dihitung dengan filter LAIN yang sedang aktif, jadi sama dengan
 * jumlah baris yang muncul setelah diklik. Filter tersimpan di URL (#monitoring?s=nol&c=JOGLO&q=...).
 */
(function () {
  const { api, toast, sheet, esc, angka, tanggal, ikon, $ } = App;
  let DATA = { rows: [], batas: 3, today: '', update: '' };
  let dimuat = false;
  const F = { status: 'open', cabang: '', q: '', urut: 'umur' };
  let ui = null; // { setSub, setAksi }

  const simpanFilter = () => App.simpanQuery({ s: F.status !== 'open' ? F.status : '', c: F.cabang, q: F.q, u: F.urut !== 'umur' ? F.urut : '' });
  const adaFilter = () => F.status !== 'open' || !!F.cabang || !!F.q;

  // ---------- turunan per PO ----------
  const nol = r => !r.selesai && r.recv === 0;
  const telat = r => nol(r) && r.aging !== null && r.aging > DATA.batas;
  const adaEta = r => !!(r.etaInput || r.etaText);
  const etaLewat = r => !r.selesai && !!r.etaInput && r.etaInput < DATA.today;
  const tertunda = r => !r.selesai && r.aging !== null && r.aging >= DATA.batas;
  const persen = r => (r.order ? Math.min(100, Math.round(r.recv / r.order * 100)) : 0);
  const serviaInfo = r => {
    const s = r.servia && String(r.servia.status || '').toUpperCase();
    if (!s) return { kelas: 'abu', teks: 'Servia: belum' };
    if (s === 'DIBUAT') return { kelas: 'hijau', teks: 'Servia: dibuat' + (r.servia.noServia ? ' · ' + r.servia.noServia : '') };
    if (s === 'SUDAH ADA') return { kelas: 'hijau', teks: 'Servia: ada' + (r.servia.noServia && r.servia.noServia !== r.po ? ' · ' + r.servia.noServia : '') };
    if (s === 'DIBATALKAN') return { kelas: 'abu', teks: 'Servia: dibatalkan' };
    return { kelas: 'abu', teks: 'Servia: ' + s.toLowerCase() };
  };

  // ---------- filter ----------
  const cocokCari = r => !F.q || (r.po + ' ' + r.items.map(it => it.kode + ' ' + it.desc).join(' ')).toUpperCase().includes(F.q);
  const cocokCabang = r => !F.cabang || r.cabang === F.cabang;
  const STATUS = {
    open: r => !r.selesai,
    nol: nol,
    partial: r => !r.selesai && !nol(r),
    noeta: r => !r.selesai && !adaEta(r),
    lewat: etaLewat,
    selesai: r => r.selesai,
    tertunda: tertunda,
  };
  const labelStatus = () => ({ open: 'PO open', nol: 'Belum ada progres', partial: 'Sebagian', noeta: 'Belum ada ETA', lewat: 'ETA lewat', selesai: 'PO selesai', tertunda: `PO > ${DATA.batas} hari belum lengkap` }[F.status] || 'PO');
  const lolos = r => cocokCabang(r) && cocokCari(r) && (STATUS[F.status] || STATUS.open)(r);

  /** Pemetaan filter lama (k, m) dan kartu di Beranda ke satu status. */
  function statusDariLama(kpi, mode) {
    if (mode === 'selesai') return 'selesai';
    return ({ open: 'open', nol: 'nol', partial: 'partial', telat: 'nol', tertunda: 'tertunda', noeta: 'noeta', lewat: 'lewat' })[kpi] || 'open';
  }

  // ---------- kerangka halaman ----------
  function render(el, u) {
    ui = u;
    u.setAksi(`<button type="button" class="tombol-ikon" id="btnEkspor" title="Ekspor ke Excel" aria-label="Ekspor ke Excel">${ikon.unduh}</button>
      <button type="button" class="tombol-ikon" id="btnSync" title="Sinkron dari sheet MRP" aria-label="Sinkron dari sheet MRP">${ikon.sync}</button>`);
    el.innerHTML = `
      <section class="bagian kpi" id="kpi" aria-label="Status PO">${Array.from({ length: 6 }, () => '<div class="ubin"><div class="skeleton" style="width:70%"></div><div class="skeleton" style="height:26px;margin-top:8px;width:40%"></div></div>').join('')}</section>
      <section class="bagian" id="panelFilter" aria-label="Filter">
        <div class="toolbar">
          <div class="input-cari">${ikon.cari}<input class="input" id="cari" name="cari" type="search" placeholder="Cari No PO, kode part, atau nama part…" aria-label="Cari PO" autocomplete="off" spellcheck="false"></div>
          <select class="input" id="cabang" name="cabang" aria-label="Cabang"></select>
          <select class="input" id="urut" name="urut" aria-label="Urutkan daftar">
            <option value="umur">Urut: paling lama</option>
            <option value="baru">Urut: PO terbaru</option>
            <option value="cabang">Urut: cabang</option>
            <option value="sisa">Urut: sisa qty terbanyak</option>
          </select>
        </div>
      </section>
      <section class="bagian" aria-label="Daftar PO">
        <div class="ringkas-filter"><span class="teks-kecil" id="ringkasDaftar" aria-live="polite"></span><button type="button" class="tombol halus kecil" id="resetFilter" hidden>Reset filter</button></div>
        <div class="daftar" id="daftar">${Array.from({ length: 4 }, () => '<div class="po"><div class="skeleton" style="width:55%"></div><div class="skeleton" style="width:35%;margin-top:8px"></div></div>').join('')}</div>
      </section>
      <section class="bagian grafik-baris" aria-label="Grafik">
        <div class="kartu"><div class="kartu-judul"><h2>PO open per cabang</h2></div><div id="grafikCabang"></div>
          <div class="legenda"><span><i class="seri-crit"></i>Belum ada progres</span><span><i class="seri-warn"></i>Sebagian</span></div></div>
        <div class="kartu"><div class="kartu-judul"><h2>Umur PO open</h2></div><div id="grafikAging"></div></div>
      </section>`;

    $('btnEkspor').addEventListener('click', ekspor);
    $('btnSync').addEventListener('click', sync);
    $('cari').addEventListener('input', e => { F.q = e.target.value.trim().toUpperCase(); simpanFilter(); gambarSemua(); });
    $('cabang').addEventListener('change', e => { F.cabang = e.target.value; simpanFilter(); gambarSemua(); });
    $('urut').addEventListener('change', e => { F.urut = e.target.value; simpanFilter(); gambarDaftar(); });
    $('resetFilter').addEventListener('click', () => { Object.assign(F, { status: 'open', cabang: '', q: '' }); $('cari').value = ''; simpanFilter(); gambarSemua(); $('cari').focus(); });
    $('kpi').addEventListener('click', e => {
      const u = e.target.closest('.ubin');
      if (!u || !u.dataset.status) return;
      F.status = F.status === u.dataset.status ? 'open' : u.dataset.status; // klik lagi = kembali ke "PO open"
      simpanFilter(); gambarSemua();
    });
    $('daftar').addEventListener('click', e => { const k = e.target.closest('.po'); if (k && k.dataset.key) bukaDetail(k.dataset.key); });

    // filter awal: dari tautan (URL), tautan lama, atau dari ringkasan di Beranda
    Object.assign(F, { status: 'open', cabang: '', q: '', urut: 'umur' });
    const q = App.state.query;
    if (q && [...q.keys()].length) {
      F.status = q.get('s') || statusDariLama(q.get('k') || '', q.get('m') || '');
      F.cabang = q.get('c') || ''; F.q = (q.get('q') || '').toUpperCase(); F.urut = q.get('u') || 'umur';
    }
    const awal = App.state.awal;
    if (awal && awal.halaman === 'monitoring') { F.status = statusDariLama(awal.kpi || '', ''); App.state.awal = null; simpanFilter(); }
    $('cari').value = F.q;
    $('urut').value = F.urut;
    if (dimuat) terima(DATA); else muat();
  }

  function muat() {
    App.ambil('getDataApp', 60000).then(d => { dimuat = true; terima(d); }).catch(gagal);
  }

  function sync() {
    setSibuk(true);
    toast('Membaca sheet Incoming semua cabang…');
    api('syncDariApp').then(d => { App.isi('getDataApp', d); terima(d); toast('Sinkron selesai.'); }).catch(gagal);
  }

  function setSibuk(sibuk) {
    const b = $('btnSync');
    if (b) b.disabled = sibuk;
  }

  function gagal(e) {
    setSibuk(false);
    toast(e && e.message ? e.message : 'Terjadi kesalahan.', true);
    if (!dimuat && App.state.aktif === 'monitoring') $('daftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>${esc(e && e.message || 'Data PO belum bisa dimuat.')}</div><button type="button" class="tombol halus" id="coba">Coba lagi</button></div>`, $('coba').addEventListener('click', muat);
  }

  function terima(d) {
    DATA = d;
    setSibuk(false);
    if (App.state.aktif !== 'monitoring') return; // pengguna sudah pindah halaman
    const open = d.rows.filter(r => !r.selesai).length;
    if (ui) ui.setSub(`${d.update || 'Belum sinkron'} · ${open} PO open · ${d.rows.length - open} selesai${d.offlineSejak ? ' · offline' : ''}`);
    gambarSemua();
    if (App.state.bukaPO) { const k = App.state.bukaPO; App.state.bukaPO = ''; bukaDetail(k); } // dibuka dari notifikasi
  }

  function gambarSemua() {
    gambarKpi();
    gambarCabang();
    gambarGrafik();
    gambarDaftar();
  }

  // ---------- bagian-bagian ----------
  /** Angka tiap kartu = jumlah baris yang muncul kalau kartu itu diklik (ikut filter cabang dan pencarian yang aktif). */
  function gambarKpi() {
    const dasar = DATA.rows.filter(r => cocokCabang(r) && cocokCari(r));
    const hitung = s => dasar.filter(STATUS[s]).length;
    const sel = [
      ['open', 'PO open', ''],
      ['nol', 'Belum ada progres', 'merah'],
      ['partial', 'Sebagian', ''],
      ['noeta', 'Belum ada ETA', 'oranye'],
      ['lewat', 'ETA lewat', 'merah'],
      ['selesai', 'Selesai', ''],
    ];
    $('kpi').innerHTML = sel.map(([id, label, warna]) => {
      const n = hitung(id);
      return `<button type="button" class="ubin ${F.status === id ? 'aktif' : ''}" data-status="${id}" aria-pressed="${F.status === id}"><span class="label">${esc(label)}</span><span class="nilai">${angka(n)}</span>${n && warna ? `<span class="penanda ${warna}"><span class="sr">, perlu perhatian</span></span>` : ''}</button>`;
    }).join('');
  }

  /** Dropdown cabang; angka di sebelah nama = jumlah baris dengan status dan pencarian yang sedang aktif. */
  function gambarCabang() {
    const sel = $('cabang');
    const nama = [...new Set(DATA.rows.map(r => r.cabang))].sort();
    const fStatus = STATUS[F.status] || STATUS.open;
    const sesuai = DATA.rows.filter(r => cocokCari(r) && fStatus(r));
    const hitung = c => sesuai.filter(r => r.cabang === c).length;
    sel.innerHTML = `<option value="">Semua cabang (${angka(sesuai.length)})</option>` + nama.map(c => `<option value="${esc(c)}">${esc(c)} (${angka(hitung(c))})</option>`).join('');
    sel.value = F.cabang;
  }

  function gambarGrafik() {
    const open = DATA.rows.filter(r => !r.selesai && cocokCabang(r));
    const grup = {};
    open.forEach(r => { (grup[r.cabang] = grup[r.cabang] || { nol: 0, partial: 0 })[nol(r) ? 'nol' : 'partial']++; });
    const nama = Object.keys(grup).sort();
    const maks = Math.max(1, ...nama.map(c => grup[c].nol + grup[c].partial));
    $('grafikCabang').innerHTML = nama.length ? nama.map(c => {
      const g = grup[c];
      return `<div class="bar" title="${esc(c)}: ${g.nol} belum ada progres, ${g.partial} sebagian"><div class="nama">${esc(c)}</div><div class="jalur"><span class="seri-crit" style="width:${g.nol / maks * 100}%"></span><span class="seri-warn" style="width:${g.partial / maks * 100}%"></span></div><div class="angka">${g.nol + g.partial}</div></div>`;
    }).join('') : '<div class="teks-kecil">Tidak ada PO open.</div>';

    const umur = open.map(r => r.aging).filter(a => a !== null);
    const kelompok = [
      ['0–3 hari', umur.filter(a => a <= 3).length, 'skala-1'],
      ['4–7 hari', umur.filter(a => a >= 4 && a <= 7).length, 'skala-2'],
      ['8–14 hari', umur.filter(a => a >= 8 && a <= 14).length, 'skala-3'],
      ['> 14 hari', umur.filter(a => a > 14).length, 'skala-4'],
    ];
    const maksU = Math.max(1, ...kelompok.map(k => k[1]));
    $('grafikAging').innerHTML = kelompok.map(k => `<div class="bar" title="${k[0]}: ${k[1]} PO"><div class="nama">${k[0]}</div><div class="jalur"><span class="${k[2]}" style="width:${k[1] / maksU * 100}%"></span></div><div class="angka">${k[1]}</div></div>`).join('');
  }

  function urutkan(a, b) {
    switch (F.urut) {
      case 'baru': return (b.tglIso || '').localeCompare(a.tglIso || '');
      case 'cabang': return a.cabang.localeCompare(b.cabang) || (b.aging || 0) - (a.aging || 0);
      case 'sisa': return (b.order - b.recv) - (a.order - a.recv);
      default: return (b.aging === null ? -1 : b.aging) - (a.aging === null ? -1 : a.aging) || (a.tglIso || '').localeCompare(b.tglIso || '');
    }
  }

  function gambarDaftar() {
    const baris = DATA.rows.filter(lolos).sort(urutkan);
    // ringkasan menyebut SEMUA filter yang aktif, supaya jelas kenapa jumlahnya segitu
    const bagian = [`${angka(baris.length)} ${labelStatus()}`];
    if (F.cabang) bagian.push(F.cabang);
    if (F.q) bagian.push(`pencarian “${F.q}”`);
    $('ringkasDaftar').textContent = bagian.join(' · ');
    $('resetFilter').hidden = !adaFilter();
    if (!baris.length) {
      $('daftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>Tidak ada PO yang cocok dengan filter ini.</div>${adaFilter() ? '<button type="button" class="tombol halus" id="resetKosong">Reset filter</button>' : ''}</div>`;
      const r = $('resetKosong');
      if (r) r.addEventListener('click', () => $('resetFilter').click());
      return;
    }
    $('daftar').innerHTML = '<div class="daftar-kepala"><span>PO</span><span>Umur</span><span>Terima</span><span>Status</span><span>ETA</span><span>Servia</span></div>' +
      baris.slice(0, 300).map(kartuPO).join('') +
      (baris.length > 300 ? `<div class="teks-kecil" style="padding:12px 14px">Menampilkan 300 dari ${angka(baris.length)} PO. Persempit dengan filter atau pencarian.</div>` : '');
  }

  function kartuPO(r) {
    const p = persen(r);
    const kelasProgres = r.selesai ? 'penuh' : r.recv === 0 ? 'nol' : '';
    const status = r.selesai ? '<span class="badge hijau titik">Selesai</span>'
      : nol(r) ? '<span class="badge merah titik">Belum ada progres</span>' : '<span class="badge kuning titik">Sebagian</span>';
    const sv = serviaInfo(r);
    const umur = r.selesai || r.aging === null ? '<span class="po-umur"></span>'
      : `<span class="po-umur ${telat(r) ? 'telat' : r.aging > DATA.batas ? 'lama' : ''}">${r.aging} hari</span>`;
    const eta = r.selesai ? '<span class="po-eta"></span>'
      : r.etaInput ? `<span class="po-eta ${etaLewat(r) ? 'lewat' : ''}">${etaLewat(r) ? 'Lewat ' : 'ETA '}${tanggal(r.etaInput)}</span>`
      : r.etaText ? `<span class="po-eta">ETA ${esc(r.etaText)}</span>` : '<span class="po-eta tanpa">Belum ada ETA</span>';
    return `<button type="button" class="po ${telat(r) ? 'telat' : ''} ${r.selesai ? 'selesai' : ''}" data-key="${esc(r.key)}">
      <span class="po-info"><span class="po-no">${esc(r.po)}</span><span class="po-meta">${esc(r.cabang)} · ${esc(r.tglPO || '-')} · ${r.items.length} item</span>${r.catatan ? `<span class="po-cat">Catatan: ${esc(r.catatan)}</span>` : ''}</span>
      ${umur}
      <span class="po-prog"><span class="progres ${kelasProgres}"><span style="width:${p}%"></span></span><span class="po-qty">${angka(r.recv)}/${angka(r.order)}</span></span>
      <span class="po-tanda">${status}${eta}<span class="badge ${sv.kelas}">${esc(sv.teks)}</span></span>
    </button>`;
  }

  // ---------- detail PO (dialog) ----------
  function bukaDetail(key) {
    const r = DATA.rows.find(x => x.key === key);
    if (!r) return;
    const sv = serviaInfo(r);
    const baris = r.items.map(it => `<div class="item-baris ${it.recv >= it.order ? 'penuh' : it.recv === 0 ? 'kurang' : ''}"><span class="item-info"><span class="kode">${esc(it.kode)}</span>${it.desc ? `<span class="desc">${esc(it.desc)}</span>` : ''}</span><span>${angka(it.recv)} / ${angka(it.order)}</span><span>${angka(Math.max(0, it.order - it.recv))}</span></div>`).join('');
    const form = r.selesai ? '' : `
      <div class="pemisah"></div>
      <div class="form-baris"><label class="label" for="fEta">ETA dari VinFast</label><input class="input" type="date" id="fEta" name="eta" autocomplete="off" value="${esc(r.etaInput)}">${r.etaText ? `<div class="teks-kecil" style="margin-top:4px">Teks lama: ${esc(r.etaText)}</div>` : ''}</div>
      <div class="form-baris"><label class="label" for="fCatatan">Catatan follow-up</label><input class="input" type="text" id="fCatatan" name="catatan" maxlength="500" autocomplete="off" placeholder="mis. kirim bertahap…" value="${esc(r.catatan)}"></div>
      <div class="form-baris"><button type="button" class="tombol penuh" id="btnSimpan">Simpan ETA & catatan</button></div>`;
    sheet.buka(esc(r.po), `
      <div class="detail-kepala">${r.selesai ? '<span class="badge hijau titik">Selesai</span>' : nol(r) ? '<span class="badge merah titik">Belum ada progres</span>' : '<span class="badge kuning titik">Sebagian</span>'}<span class="badge ${sv.kelas}">${esc(sv.teks)}</span>${telat(r) ? `<span class="badge merah titik">Lebih dari ${DATA.batas} hari tanpa progres</span>` : ''}</div>
      <div class="detail-baris"><span>Cabang</span><span>${esc(r.cabang)}</span></div>
      <div class="detail-baris"><span>Tanggal PO</span><span>${esc(r.tglPO || '-')}${r.aging !== null && !r.selesai ? ` · ${r.aging} hari` : ''}</span></div>
      <div class="detail-baris"><span>Diterima</span><span>${angka(r.recv)} / ${angka(r.order)} pcs (${persen(r)}%)</span></div>
      ${r.servia && r.servia.waktu ? `<div class="detail-baris"><span>Dicatat Stock Bot</span><span>${esc(r.servia.waktu)}</span></div>` : ''}
      ${r.url ? `<div class="detail-baris"><span>Sumber</span><span><a href="${esc(r.url)}" target="_blank" rel="noopener">Buka sheet MRP</a></span></div>` : ''}
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Item (${r.items.length})</h3>
      <div class="item-kepala"><span>Part</span><span>Terima / Order</span><span>Sisa</span></div>
      ${baris || '<div class="teks-kecil" style="padding:10px 0">Detail item belum tersedia. Jalankan sinkron.</div>'}
      ${form}
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Riwayat ETA & catatan</h3>
      <div id="riwayat" class="teks-kecil">Memuat…</div>`);
    const btn = $('btnSimpan');
    if (btn) btn.addEventListener('click', () => simpan(r.key));
    api('getRiwayat', r.key).then(gambarRiwayat).catch(() => { const el = $('riwayat'); if (el) el.textContent = 'Riwayat belum bisa dimuat. Periksa koneksi.'; });
  }

  function gambarRiwayat(list) {
    const el = $('riwayat');
    if (!el) return;
    if (!list || !list.length) { el.textContent = 'Belum ada perubahan.'; return; }
    const tgl = t => (t ? tanggal(t) : '—');
    el.innerHTML = list.map(x => `<div class="riwayat-item"><div class="riwayat-waktu">${esc(x.waktu)} · ${esc(String(x.email || '').split('@')[0])}</div>` +
      (x.etaLama !== x.etaBaru ? `<div>ETA: ${esc(tgl(x.etaLama))} → <b>${esc(tgl(x.etaBaru))}</b></div>` : '') +
      (x.catLama !== x.catBaru ? `<div>Catatan: ${esc(x.catLama || '—')} → <b>${esc(x.catBaru || '—')}</b></div>` : '') + '</div>').join('');
  }

  // ---------- ekspor Excel (sesuai filter yang sedang aktif) ----------
  function ekspor() {
    if (!window.Ekspor) return;
    const baris = DATA.rows.filter(lolos).sort(urutkan);
    if (!baris.length) { toast('Tidak ada data untuk diekspor.', true); return; }
    const sv = r => serviaInfo(r).teks.replace('Servia: ', '');
    Ekspor.unduh(Ekspor.namaDenganTanggal('snd-monitoring-po'), [
      { nama: 'PO', kolom: ['Cabang', 'No PO', 'Tgl PO', 'Umur (hari)', 'Jumlah Item', 'Qty Order', 'Qty Received', 'Sisa', 'Status', 'ETA', 'Catatan', 'Status Servia'],
        baris: baris.map(r => [r.cabang, r.po, r.tglPO, r.aging === null ? '' : r.aging, r.items.length, r.order, r.recv, Math.max(0, r.order - r.recv), r.status, r.etaInput || r.etaText || '', r.catatan || '', sv(r)]) },
      { nama: 'Item', kolom: ['Cabang', 'No PO', 'Kode Part', 'Deskripsi', 'Qty Order', 'Qty Received', 'Sisa'],
        baris: baris.flatMap(r => r.items.map(it => [r.cabang, r.po, it.kode, it.desc, it.order, it.recv, Math.max(0, it.order - it.recv)])) },
    ]);
    toast(`Mengunduh ${angka(baris.length)} PO ke Excel…`);
  }

  function simpan(key) {
    const btn = $('btnSimpan');
    btn.disabled = true;
    toast('Menyimpan…');
    api('simpanEta', key, $('fEta').value, $('fCatatan').value)
      .then(d => { App.isi('getDataApp', d); terima(d); sheet.tutup(); toast('ETA & catatan tersimpan.'); })
      .catch(e => { btn.disabled = false; toast(e.message || 'Gagal menyimpan.', true); });
  }

  App.daftar({ id: 'monitoring', label: 'Monitoring MRP PO', pendek: 'PO', ikon: 'monitor', desk: 'PO VinFast dari 6 cabang: progres terima, umur PO, ETA, dan status di Servia.', render });
})();
