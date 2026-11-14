/**
 * Halaman: Monitoring MRP.
 * Semua PO dari sheet Incoming 6 cabang (open + selesai), status terima, umur PO, ETA/catatan, dan status PO di Servia.
 */
(function () {
  const { api, toast, sheet, esc, angka, tanggal, ikon, $ } = App;
  let DATA = { rows: [], batas: 3, today: '', update: '' };
  let dimuat = false;
  const F = { mode: 'open', cabang: '', q: '', urut: 'umur', kpi: '' };
  let ui = null; // { setSub, setAksi }

  // ---------- turunan per PO ----------
  const nol = r => !r.selesai && r.recv === 0;
  const telat = r => nol(r) && r.aging !== null && r.aging > DATA.batas;
  const adaEta = r => !!(r.etaInput || r.etaText);
  const etaLewat = r => !r.selesai && !!r.etaInput && r.etaInput < DATA.today;
  const persen = r => (r.order ? Math.min(100, Math.round(r.recv / r.order * 100)) : 0);
  const serviaInfo = r => {
    const s = r.servia && String(r.servia.status || '').toUpperCase();
    if (!s) return { kelas: 'abu', teks: 'Servia: belum' };
    if (s === 'DIBUAT') return { kelas: 'hijau', teks: 'Servia: dibuat' + (r.servia.noServia ? ' · ' + r.servia.noServia : '') };
    if (s === 'SUDAH ADA') return { kelas: 'hijau', teks: 'Servia: ada' + (r.servia.noServia && r.servia.noServia !== r.po ? ' · ' + r.servia.noServia : '') };
    if (s === 'DIBATALKAN') return { kelas: 'abu', teks: 'Servia: dibatalkan' };
    return { kelas: 'abu', teks: 'Servia: ' + s.toLowerCase() };
  };

  // ---------- render kerangka halaman ----------
  function render(el, u) {
    ui = u;
    u.setAksi(`<button type="button" class="tombol-ikon" id="btnSync" title="Sync dari sheet MRP">${ikon.sync}</button>
      <button type="button" class="tombol oranye hanya-desktop" id="btnSyncTeks">${ikon.sync}<span>Sync sekarang</span></button>`);
    el.innerHTML = `
      <section class="bagian kpi" id="kpi">${Array.from({ length: 6 }, () => '<div class="ubin"><div class="skeleton" style="width:70%"></div><div class="skeleton" style="height:28px;margin-top:8px;width:40%"></div></div>').join('')}</section>
      <section class="bagian kartu" id="panelFilter">
        <div class="toolbar">
          <div class="segmen" id="segMode">
            <button type="button" data-mode="open" class="aktif">Open</button>
            <button type="button" data-mode="selesai">Selesai</button>
            <button type="button" data-mode="semua">Semua</button>
          </div>
          <div class="input-cari">${ikon.cari}<input class="input" id="cari" placeholder="Cari No PO / kode part / nama part" autocomplete="off"></div>
          <select class="input" id="urut">
            <option value="umur">Urut: paling lama</option>
            <option value="baru">Urut: PO terbaru</option>
            <option value="cabang">Urut: cabang</option>
            <option value="sisa">Urut: sisa qty terbanyak</option>
          </select>
        </div>
        <div class="chips" id="chipsCabang" style="margin-top:10px"></div>
      </section>
      <div class="dua-kolom bagian">
        <section>
          <div class="teks-kecil" id="ringkasDaftar" style="margin:2px 0 8px"></div>
          <div class="daftar" id="daftar">${Array.from({ length: 4 }, () => '<div class="po"><div class="skeleton" style="width:55%"></div><div class="skeleton" style="width:35%;margin-top:8px"></div><div class="skeleton" style="height:8px;margin-top:14px"></div></div>').join('')}</div>
        </section>
        <aside>
          <div class="kartu"><div class="kartu-judul"><h2>PO Open per Cabang</h2><small>${ikon.grafik}</small></div><div id="grafikCabang"></div>
            <div class="legenda"><span><i style="background:var(--merah)"></i>Belum ada progres</span><span><i style="background:var(--kuning)"></i>Partial</span></div></div>
          <div class="kartu"><div class="kartu-judul"><h2>Umur PO Open</h2></div><div id="grafikAging"></div></div>
        </aside>
      </div>`;

    $('btnSync').addEventListener('click', sync);
    $('btnSyncTeks').addEventListener('click', sync);
    $('segMode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; F.mode = b.dataset.mode; F.kpi = ''; gambarSemua(); });
    $('cari').addEventListener('input', e => { F.q = e.target.value.trim().toUpperCase(); gambarDaftar(); });
    $('urut').addEventListener('change', e => { F.urut = e.target.value; gambarDaftar(); });
    $('chipsCabang').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; F.cabang = c.dataset.cabang; gambarSemua(); });
    $('kpi').addEventListener('click', e => { const u = e.target.closest('.ubin'); if (!u || !u.dataset.kpi) return; F.kpi = F.kpi === u.dataset.kpi ? '' : u.dataset.kpi; if (F.kpi && F.mode === 'selesai') F.mode = 'open'; gambarSemua(); });
    $('daftar').addEventListener('click', e => { const k = e.target.closest('.po'); if (k) bukaDetail(k.dataset.key); });

    if (dimuat) terima(DATA); else muat();
  }

  function muat() {
    api('getDataApp').then(d => { dimuat = true; terima(d); }).catch(gagal);
  }

  function sync() {
    setSibuk(true);
    toast('Membaca sheet Incoming semua cabang…');
    api('syncDariApp').then(d => { terima(d); toast('Sync selesai.'); }).catch(gagal);
  }

  function setSibuk(sibuk) {
    ['btnSync', 'btnSyncTeks'].forEach(id => { const b = $(id); if (b) b.disabled = sibuk; });
  }

  function gagal(e) {
    setSibuk(false);
    toast(e && e.message ? e.message : 'Terjadi kesalahan.', true);
    if (!dimuat && App.state.aktif === 'monitoring') $('daftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>${esc(e && e.message || 'Gagal memuat data')}</div><button type="button" class="tombol halus" style="margin-top:12px" onclick="App.buka('monitoring')">Coba lagi</button></div>`;
  }

  function terima(d) {
    DATA = d;
    setSibuk(false);
    if (App.state.aktif !== 'monitoring') return; // pengguna sudah pindah halaman
    const open = d.rows.filter(r => !r.selesai).length;
    if (ui) ui.setSub(`${d.update || 'Belum sync'} · ${open} PO open · ${d.rows.length - open} selesai`);
    gambarSemua();
  }

  function gambarSemua() {
    gambarSegmen();
    gambarKpi();
    gambarChips();
    gambarGrafik();
    gambarDaftar();
  }

  // ---------- bagian-bagian ----------
  function gambarSegmen() {
    document.querySelectorAll('#segMode button').forEach(b => b.classList.toggle('aktif', b.dataset.mode === F.mode));
  }

  function dasar() {
    return DATA.rows.filter(r => !F.cabang || r.cabang === F.cabang);
  }

  function gambarKpi() {
    const r = dasar().filter(x => !x.selesai);
    const ubin = [
      ['open', 'PO Open', r.length, ''],
      ['nol', 'Belum Ada Progres', r.filter(nol).length, 'merah'],
      ['partial', 'Partial', r.filter(x => !nol(x)).length, 'oranye'],
      ['telat', `> ${DATA.batas} Hari Tanpa Progres`, r.filter(telat).length, 'merah'],
      ['noeta', 'Belum Ada ETA', r.filter(x => !adaEta(x)).length, ''],
      ['lewat', 'ETA Lewat', r.filter(etaLewat).length, 'merah'],
    ];
    $('kpi').innerHTML = ubin.map(([id, label, nilai, warna]) =>
      `<div class="ubin ${F.kpi === id ? 'aktif' : ''}" data-kpi="${id}"><div class="label">${esc(label)}</div><div class="nilai ${nilai && warna ? warna : ''}">${angka(nilai)}</div></div>`).join('');
  }

  function gambarChips() {
    const hitung = {};
    DATA.rows.filter(r => !r.selesai).forEach(r => { hitung[r.cabang] = (hitung[r.cabang] || 0) + 1; });
    const nama = [...new Set(DATA.rows.map(r => r.cabang))].sort();
    $('chipsCabang').innerHTML = [`<button type="button" class="chip ${F.cabang ? '' : 'aktif'}" data-cabang="">Semua cabang</button>`]
      .concat(nama.map(c => `<button type="button" class="chip ${F.cabang === c ? 'aktif' : ''}" data-cabang="${esc(c)}">${esc(c)}<b>${hitung[c] || 0}</b></button>`)).join('');
  }

  function gambarGrafik() {
    const open = dasar().filter(r => !r.selesai);
    const grup = {};
    open.forEach(r => { (grup[r.cabang] = grup[r.cabang] || { nol: 0, partial: 0 })[nol(r) ? 'nol' : 'partial']++; });
    const nama = Object.keys(grup).sort();
    const maks = Math.max(1, ...nama.map(c => grup[c].nol + grup[c].partial));
    $('grafikCabang').innerHTML = nama.length ? nama.map(c => {
      const g = grup[c];
      return `<div class="bar"><div class="nama" title="${esc(c)}">${esc(c)}</div><div class="jalur"><span style="width:${g.nol / maks * 100}%;background:var(--merah)"></span><span style="width:${g.partial / maks * 100}%;background:var(--kuning)"></span></div><div class="angka">${g.nol + g.partial}</div></div>`;
    }).join('') : '<div class="teks-kecil">Tidak ada PO open.</div>';

    const umur = open.map(r => r.aging).filter(a => a !== null);
    const kelompok = [
      ['0 - 3 hari', umur.filter(a => a <= 3).length, 'var(--hijau)'],
      ['4 - 7 hari', umur.filter(a => a >= 4 && a <= 7).length, 'var(--kuning)'],
      ['8 - 14 hari', umur.filter(a => a >= 8 && a <= 14).length, '#EF6C00'],
      ['> 14 hari', umur.filter(a => a > 14).length, 'var(--merah)'],
    ];
    const maksU = Math.max(1, ...kelompok.map(k => k[1]));
    $('grafikAging').innerHTML = kelompok.map(k => `<div class="bar"><div class="nama">${k[0]}</div><div class="jalur"><span style="width:${k[1] / maksU * 100}%;background:${k[2]}"></span></div><div class="angka">${k[1]}</div></div>`).join('');
  }

  function lolos(r) {
    if (F.mode === 'open' && r.selesai) return false;
    if (F.mode === 'selesai' && !r.selesai) return false;
    if (F.q) {
      const teks = (r.po + ' ' + r.items.map(it => it.kode + ' ' + it.desc).join(' ')).toUpperCase();
      if (!teks.includes(F.q)) return false;
    }
    switch (F.kpi) {
      case 'nol': return nol(r);
      case 'partial': return !r.selesai && !nol(r);
      case 'telat': return telat(r);
      case 'noeta': return !r.selesai && !adaEta(r);
      case 'lewat': return etaLewat(r);
      case 'open': return !r.selesai;
    }
    return true;
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
    const baris = dasar().filter(lolos).sort(urutkan);
    const label = { open: 'PO open', selesai: 'PO selesai', semua: 'PO' }[F.mode];
    $('ringkasDaftar').textContent = `${angka(baris.length)} ${label}${F.cabang ? ' · ' + F.cabang : ''}${F.kpi ? ' · filter aktif' : ''}${F.q ? ' · "' + F.q + '"' : ''}`;
    if (!baris.length) {
      $('daftar').innerHTML = `<div class="kosong" style="grid-column:1/-1">${ikon.kosong}<div>Tidak ada PO yang cocok.</div></div>`;
      return;
    }
    $('daftar').innerHTML = baris.slice(0, 300).map(kartuPO).join('') +
      (baris.length > 300 ? `<div class="teks-kecil" style="grid-column:1/-1;text-align:center;padding:8px">Menampilkan 300 dari ${angka(baris.length)} — persempit dengan filter/pencarian.</div>` : '');
  }

  function kartuPO(r) {
    const p = persen(r);
    const kelasProgres = r.selesai ? '' : r.recv === 0 ? 'kosong' : 'sebagian';
    const status = r.selesai ? '<span class="badge hijau titik">Selesai</span>'
      : nol(r) ? '<span class="badge merah titik">Belum ada progres</span>' : '<span class="badge kuning titik">Partial</span>';
    const sv = serviaInfo(r);
    const umur = r.selesai ? '' : r.aging === null ? '' : `<span class="badge ${telat(r) ? 'merah' : r.aging > DATA.batas ? 'oranye' : 'abu'}">${r.aging} hari</span>`;
    const eta = r.selesai ? '' : r.etaInput ? `<span class="badge ${etaLewat(r) ? 'merah' : ''}">ETA ${tanggal(r.etaInput)}${etaLewat(r) ? ' · lewat' : ''}</span>`
      : r.etaText ? `<span class="badge">ETA ${esc(r.etaText)}</span>` : '<span class="badge abu">Belum ada ETA</span>';
    return `<article class="po ${telat(r) ? 'telat' : ''} ${r.selesai ? 'selesai' : ''}" data-key="${esc(r.key)}">
      <div class="po-atas">
        <div><div class="po-no">${esc(r.po)}</div><div class="po-meta">${esc(r.cabang)} · PO ${esc(r.tglPO || '-')} · ${r.items.length} item</div></div>
        ${umur}
      </div>
      <div class="po-tengah"><div class="progres ${kelasProgres}"><span style="width:${p}%"></span></div><div class="po-qty">${angka(r.recv)}/${angka(r.order)} <span class="teks-kecil">(${p}%)</span></div></div>
      <div class="po-bawah">${status}${eta}<span class="badge ${sv.kelas}">${esc(sv.teks)}</span>${r.catatan ? `<span class="kanan" title="${esc(r.catatan)}">📝 ${esc(r.catatan.slice(0, 28))}${r.catatan.length > 28 ? '…' : ''}</span>` : ''}</div>
    </article>`;
  }

  // ---------- detail PO (bottom sheet) ----------
  function bukaDetail(key) {
    const r = DATA.rows.find(x => x.key === key);
    if (!r) return;
    const sv = serviaInfo(r);
    const baris = r.items.map(it => `<tr class="${it.recv >= it.order ? 'penuh' : it.recv === 0 ? 'kurang' : ''}"><td><div class="kode">${esc(it.kode)}</div>${it.desc ? `<div class="desc">${esc(it.desc)}</div>` : ''}</td><td class="angka">${angka(it.recv)} / ${angka(it.order)}</td><td class="angka">${angka(Math.max(0, it.order - it.recv))}</td></tr>`).join('');
    const form = r.selesai ? '' : `
      <div class="pemisah"></div>
      <div class="form-baris"><label class="label" for="fEta">ETA dari VinFast</label><input class="input" type="date" id="fEta" value="${esc(r.etaInput)}">${r.etaText ? `<div class="teks-kecil" style="margin-top:4px">Teks lama: ${esc(r.etaText)}</div>` : ''}</div>
      <div class="form-baris"><label class="label" for="fCatatan">Catatan follow-up</label><input class="input" type="text" id="fCatatan" maxlength="500" placeholder="mis. sudah dikonfirmasi VinFast, kirim bertahap" value="${esc(r.catatan)}"></div>
      <div class="form-baris" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="tombol penuh" id="btnSimpan">Simpan ETA & catatan</button></div>`;
    sheet.buka(esc(r.po), `
      <div class="detail-kepala">
        <div class="po-bawah">${r.selesai ? '<span class="badge hijau titik">Selesai</span>' : nol(r) ? '<span class="badge merah titik">Belum ada progres</span>' : '<span class="badge kuning titik">Partial</span>'}<span class="badge ${sv.kelas}">${esc(sv.teks)}</span>${telat(r) ? `<span class="badge merah">> ${DATA.batas} hari tanpa progres</span>` : ''}</div>
      </div>
      <div class="detail-baris"><span>Cabang</span><span>${esc(r.cabang)}</span></div>
      <div class="detail-baris"><span>Tanggal PO</span><span>${esc(r.tglPO || '-')}${r.aging !== null && !r.selesai ? ` · ${r.aging} hari` : ''}</span></div>
      <div class="detail-baris"><span>Diterima</span><span>${angka(r.recv)} / ${angka(r.order)} pcs (${persen(r)}%)</span></div>
      ${r.servia && r.servia.waktu ? `<div class="detail-baris"><span>Dicatat Stock Bot</span><span>${esc(r.servia.waktu)}</span></div>` : ''}
      ${r.url ? `<div class="detail-baris"><span>Sumber</span><span><a href="${esc(r.url)}" target="_blank" rel="noopener">Buka sheet MRP ${ikon.luar.replace('viewBox', 'style="width:14px;height:14px;vertical-align:-2px" viewBox')}</a></span></div>` : ''}
      <div class="pemisah"></div>
      <h3 style="font-size:13px;margin-bottom:8px">Item (${r.items.length})</h3>
      <table class="tabel-item"><thead><tr><th>Part</th><th class="angka">Terima / Order</th><th class="angka">Sisa</th></tr></thead><tbody>${baris || '<tr><td colspan="3" class="teks-kecil">Detail item belum tersedia, klik Sync.</td></tr>'}</tbody></table>
      ${form}`);
    const btn = $('btnSimpan');
    if (btn) btn.addEventListener('click', () => simpan(r.key));
  }

  function simpan(key) {
    const btn = $('btnSimpan');
    btn.disabled = true;
    toast('Menyimpan…');
    api('simpanEta', key, $('fEta').value, $('fCatatan').value)
      .then(d => { terima(d); sheet.tutup(); toast('ETA & catatan tersimpan.'); })
      .catch(e => { btn.disabled = false; toast(e.message || 'Gagal menyimpan.', true); });
  }

  App.daftar({ id: 'monitoring', label: 'Monitoring MRP PO', pendek: 'PO', ikon: 'monitor', desk: 'PO VinFast dari sheet Incoming 6 cabang: progres terima, umur PO, ETA, dan status PO di Servia.', tanda: 'Buka monitoring PO', render });
})();
