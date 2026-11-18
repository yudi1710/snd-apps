/**
 * Halaman: Tugas Saya (pribadi). Hanya tampil untuk akun pemilik: server mengirim konteks.tugas = true, dan SETIAP panggilan
 * data (getTugas, simpanTugas, setStatusTugas, hapusTugas) dicek lagi di server. Akun lain mendapat 403 dan tidak melihat menunya.
 * Tugas: { id, judul, catatan, tenggat 'yyyy-MM-dd' | '', prioritas tinggi|normal|rendah, status belum|dikerjakan|selesai, dibuat, selesai }.
 */
(function () {
  const { sheet, esc, ikon, toast, $ } = App;
  let DATA = null;
  let ui = null;
  let filter = 'belum'; // belum | selesai | semua
  const BOBOT = { tinggi: 0, normal: 1, rendah: 2 };
  const LABEL_ULANG = { harian: 'Tiap hari', mingguan: 'Tiap minggu', bulanan: 'Tiap bulan' };
  let PO = null; // data PO (getDataApp) untuk bagian Saran dari data

  const selisih = t => App.hariAntara(DATA.hariIni, t); // hari dari sekarang ke tenggat (negatif = lewat)
  const belum = t => t.status !== 'selesai';

  function urut(a, b) {
    return (a.tenggat || '9999') < (b.tenggat || '9999') ? -1 : (a.tenggat || '9999') > (b.tenggat || '9999') ? 1
      : (BOBOT[a.prioritas] - BOBOT[b.prioritas]) || (a.dibuat < b.dibuat ? -1 : 1);
  }

  /** Kelompok tugas yang belum selesai, dari yang paling mendesak. */
  function kelompok(daftar) {
    const g = [['Terlambat', 'tg-merah', []], ['Hari ini', 'tg-kuning', []], ['7 hari ke depan', '', []], ['Nanti', '', []], ['Tanpa tenggat', '', []]];
    daftar.slice().sort(urut).forEach(t => {
      if (!t.tenggat) return g[4][2].push(t);
      const s = selisih(t.tenggat);
      (s < 0 ? g[0] : s === 0 ? g[1] : s <= 7 ? g[2] : g[3])[2].push(t);
    });
    return g.filter(x => x[2].length);
  }

  function pilTenggat(t) {
    if (!t.tenggat || !belum(t)) return '';
    const s = selisih(t.tenggat);
    if (s < 0) return `<span class="tg-pil tg-merah">Terlambat ${-s} hari</span>`;
    if (s === 0) return '<span class="tg-pil tg-kuning">Hari ini</span>';
    if (s === 1) return '<span class="tg-pil">Besok</span>';
    return `<span class="tg-pil">${esc(App.tanggal(t.tenggat))}</span>`;
  }

  function itemHtml(t) {
    const sel = !belum(t);
    return `<div class="tg-item${sel ? ' tg-selesai' : ''}" data-id="${esc(t.id)}">
      <button type="button" class="tg-cek" data-cek="${esc(t.id)}" aria-label="${sel ? 'Tandai belum selesai' : 'Tandai selesai'}" title="${sel ? 'Tandai belum selesai' : 'Tandai selesai'}">${sel ? ikon.centang : ''}</button>
      <button type="button" class="tg-isi" data-buka="${esc(t.id)}">
        <span class="tg-judul">${esc(t.judul)}</span>
        <span class="tg-meta">${pilTenggat(t)}${t.status === 'dikerjakan' ? '<span class="tg-pil tg-biru">Dikerjakan</span>' : ''}${t.ulang ? `<span class="tg-pil">↻ ${esc(LABEL_ULANG[t.ulang] || t.ulang)}</span>` : ''}${t.prioritas === 'tinggi' && belum(t) ? '<span class="tg-pil tg-merah-garis">Prioritas tinggi</span>' : ''}${sel && t.selesai ? `<span class="tg-pil">Selesai ${esc(t.selesai.slice(0, 10) === DATA.hariIni ? 'hari ini' : App.tanggal(t.selesai.slice(0, 10)))}</span>` : ''}</span>
        ${t.catatan ? `<span class="tg-catatan">${esc(t.catatan)}</span>` : ''}
      </button></div>`;
  }

  function render(el, u) {
    ui = u;
    u.setAksi(`<button type="button" class="tombol-ikon" id="btnMuatTugas" title="Muat ulang" aria-label="Muat ulang">${ikon.sync}</button>`);
    el.innerHTML = `
      <section class="bagian" aria-label="Tambah tugas"><div class="kartu">
        <form id="tgForm" class="tg-form" autocomplete="off">
          <input class="input" id="tgJudul" type="text" maxlength="200" placeholder="Tambah tugas baru, lalu tekan Enter" aria-label="Judul tugas" required>
          <input class="input" id="tgTenggat" type="date" aria-label="Tenggat">
          <select class="input" id="tgPrioritas" aria-label="Prioritas"><option value="normal">Normal</option><option value="tinggi">Prioritas tinggi</option><option value="rendah">Rendah</option></select>
          <select class="input" id="tgUlang" aria-label="Ulangi"><option value="">Tidak berulang</option><option value="harian">Tiap hari</option><option value="mingguan">Tiap minggu</option><option value="bulanan">Tiap bulan</option></select>
          <button type="submit" class="tombol" id="tgTambah">Tambah</button>
        </form>
      </div></section>
      <section class="bagian" id="tgRingkas" aria-label="Ringkasan"></section>
      <section class="bagian" id="tgSaran" aria-label="Saran dari data"></section>
      <section class="bagian"><div class="chips" id="tgFilter" role="tablist" aria-label="Filter tugas"></div></section>
      <section class="bagian" id="tgDaftar" aria-label="Daftar tugas"><div class="kosong">${ikon.kosong}<div>Memuat tugas…</div></div></section>`;
    $('btnMuatTugas').addEventListener('click', () => muat(true));
    $('tgForm').addEventListener('submit', e => {
      e.preventDefault();
      const judul = $('tgJudul').value.trim();
      if (!judul) return;
      simpan({ judul, tenggat: $('tgTenggat').value, prioritas: $('tgPrioritas').value, ulang: $('tgUlang').value }, 'Tugas ditambahkan.', () => { $('tgJudul').value = ''; $('tgTenggat').value = ''; $('tgPrioritas').value = 'normal'; $('tgUlang').value = ''; $('tgJudul').focus(); });
    });
    $('tgFilter').addEventListener('click', e => { const c = e.target.closest('[data-f]'); if (c) { filter = c.dataset.f; gambar(); } });
    $('tgSaran').addEventListener('click', e => {
      const b = e.target.closest('[data-saran]'); if (!b) return;
      const x = saranPO().find(y => y.key === b.dataset.saran); if (!x) return;
      b.disabled = true;
      simpan({ judul: x.judul, catatan: x.catatan, tenggat: DATA.hariIni, prioritas: x.prioritas, ulang: '' }, 'Dijadikan tugas.');
    });
    $('tgDaftar').addEventListener('click', e => {
      const c = e.target.closest('[data-cek]');
      if (c) { const t = DATA.tugas.find(x => x.id === c.dataset.cek); if (t) ubahStatus(t.id, belum(t) ? 'selesai' : 'belum'); return; }
      const b = e.target.closest('[data-buka]'); if (b) ubah(b.dataset.buka);
    });
    if (DATA) { gambar(); } else muat(false);
  }

  function muat(paksa) {
    App.ambil('getDataApp', 90000).then(d => { PO = d; if (DATA && App.state.aktif === 'tugas') gambarSaran(); }).catch(() => {}); // pelengkap; gagal = bagian saran tidak tampil
    App.ambil('getTugas', paksa ? 0 : 30000).then(d => { DATA = d; if (App.state.aktif === 'tugas') gambar(); })
      .catch(e => {
        if (App.state.aktif !== 'tugas') return;
        $('tgDaftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>${esc(e.message || 'Tugas belum bisa dimuat.')}</div><button type="button" class="tombol halus" id="tgCoba">Coba lagi</button></div>`;
        $('tgCoba').addEventListener('click', () => muat(true));
      });
  }

  function gambar() {
    if (!DATA || App.state.aktif !== 'tugas') return;
    const bel = DATA.tugas.filter(belum), sel = DATA.tugas.filter(t => !belum(t));
    const terlambat = bel.filter(t => t.tenggat && selisih(t.tenggat) < 0).length;
    const hariIni = bel.filter(t => t.tenggat && selisih(t.tenggat) === 0).length;
    const selMinggu = sel.filter(t => t.selesai && App.hariAntara(t.selesai.slice(0, 10), DATA.hariIni) <= 6).length;
    ui.setSub(bel.length ? `${bel.length} belum selesai${terlambat ? ' · ' + terlambat + ' terlambat' : ''}` : 'Semua tugas selesai');
    $('tgRingkas').innerHTML = `<div class="fc-tiles">
      <div class="fc-tile tg-tile-merah"><small>Terlambat</small><b>${terlambat}</b></div>
      <div class="fc-tile"><small>Hari ini</small><b>${hariIni}</b></div>
      <div class="fc-tile"><small>Belum selesai</small><b>${bel.length}</b></div>
      <div class="fc-tile"><small>Selesai 7 hari terakhir</small><b>${selMinggu}</b></div></div>`;
    const chip = (f, t, n) => `<button type="button" class="chip${filter === f ? ' aktif' : ''}" data-f="${f}">${t} (${n})</button>`;
    $('tgFilter').innerHTML = chip('belum', 'Belum', bel.length) + chip('selesai', 'Selesai', sel.length) + chip('semua', 'Semua', DATA.tugas.length);

    let html = '';
    if (filter !== 'selesai') {
      html += kelompok(bel).map(([judul, kelas, daftar]) => `<div class="tg-kelompok ${kelas}"><h3>${judul} <span>${daftar.length}</span></h3><div class="kartu tg-kartu">${daftar.map(itemHtml).join('')}</div></div>`).join('');
    }
    if (filter !== 'belum') {
      const urutSel = sel.slice().sort((a, b) => (a.selesai < b.selesai ? 1 : -1)).slice(0, 60);
      if (urutSel.length) html += `<div class="tg-kelompok"><h3>Selesai <span>${sel.length}</span></h3><div class="kartu tg-kartu">${urutSel.map(itemHtml).join('')}</div></div>`;
    }
    gambarSaran();
    $('tgDaftar').innerHTML = html || `<div class="kosong">${ikon.kosong}<div>${filter === 'selesai' ? 'Belum ada tugas yang selesai.' : 'Tidak ada tugas yang belum selesai. Tambahkan di atas.'}</div></div>`;
  }

  /** PO yang tertunda (umur >= batas, belum selesai) dan belum jadi tugas, paling lama dulu. */
  function saranPO() {
    if (!PO || !DATA) return [];
    const ada = new Set(DATA.tugas.filter(belum).map(t => t.judul));
    return PO.rows.filter(r => !r.selesai && r.aging !== null && r.aging >= PO.batas).sort((a, b) => b.aging - a.aging).map(r => ({
      key: r.key, judul: `Follow up PO ${r.po} (${r.cabang})`,
      catatan: `Umur ${r.aging} hari, terima ${r.recv}/${r.order} pcs, ${r.etaInput || r.etaText ? 'ETA ' + (r.etaInput || r.etaText) : 'belum ada ETA'}`,
      prioritas: r.aging >= 7 ? 'tinggi' : 'normal', aging: r.aging,
    })).filter(x => !ada.has(x.judul));
  }

  function gambarSaran() {
    const el = $('tgSaran'); if (!el) return;
    const daftar = saranPO();
    el.innerHTML = daftar.length ? `<div class="kartu"><details><summary class="fc-label" style="cursor:pointer">Saran dari data: ${daftar.length} PO tertunda belum jadi tugas</summary>${daftar.slice(0, 8).map(x => `<div style="display:flex;align-items:center;gap:8px;border-top:1px solid var(--line);padding:8px 0"><div style="flex:1;min-width:0"><div class="tg-judul">${esc(x.judul)}</div><div class="tg-catatan">${esc(x.catatan)}</div></div><button type="button" class="tombol halus" data-saran="${esc(x.key)}">Jadikan tugas</button></div>`).join('')}${daftar.length > 8 ? `<div class="teks-kecil" style="padding-top:6px">Menampilkan 8 PO paling lama dari ${daftar.length}.</div>` : ''}</details></div>` : '';
  }

  /** Terapkan daftar terbaru dari server (sumber kebenaran) dan simpan ke cache bersama. */
  function terapServer(d) { DATA = d; App.isi('getTugas', d); gambar(); }

  function simpan(obj, pesan, sesudah) {
    const b = $('tgTambah'); if (b) b.disabled = true;
    App.api('simpanTugas', obj).then(d => { terapServer(d); if (sheet.tutup) sheet.tutup(); toast(pesan); if (sesudah) sesudah(); })
      .catch(e => toast(e.message || 'Gagal menyimpan tugas.', true)).finally(() => { const b2 = $('tgTambah'); if (b2) b2.disabled = false; });
  }

  /** Ganti status langsung di layar dulu (terasa instan), lalu kirim ke server; gagal = kembalikan. */
  function ubahStatus(id, status) {
    const t = DATA.tugas.find(x => x.id === id); if (!t) return;
    const lama = Object.assign({}, t);
    t.status = status; t.selesai = status === 'selesai' ? DATA.hariIni + ' 00:00' : '';
    gambar();
    const sebelum = DATA.tugas.length;
    App.api('setStatusTugas', id, status).then(d => { terapServer(d); if (d.tugas.length > sebelum) toast('Selesai. Tugas berulang berikutnya sudah dibuat.'); })
      .catch(e => { Object.assign(t, lama); gambar(); toast(e.message || 'Gagal menyimpan status.', true); });
  }

  function ubah(id) {
    const t = DATA.tugas.find(x => x.id === id); if (!t) return;
    const opsi = (arr, nilai) => arr.map(([v, l]) => `<option value="${v}"${v === nilai ? ' selected' : ''}>${l}</option>`).join('');
    sheet.buka('Ubah tugas', `
      <div class="fc-grup"><label class="fc-label" for="tgeJudul">Judul</label><input class="input" id="tgeJudul" type="text" maxlength="200" value="${esc(t.judul)}"></div>
      <div class="fc-grup" style="margin-top:10px"><label class="fc-label" for="tgeCatatan">Catatan</label><textarea class="input" id="tgeCatatan" rows="3" maxlength="1000" style="min-height:76px">${esc(t.catatan)}</textarea></div>
      <div class="fc-param" style="margin-top:10px">
        <div class="fc-grup"><label class="fc-label" for="tgeTenggat">Tenggat</label><input class="input" id="tgeTenggat" type="date" value="${esc(t.tenggat)}"></div>
        <div class="fc-grup"><label class="fc-label" for="tgePrioritas">Prioritas</label><select class="input" id="tgePrioritas">${opsi([['tinggi', 'Prioritas tinggi'], ['normal', 'Normal'], ['rendah', 'Rendah']], t.prioritas)}</select></div>
        <div class="fc-grup"><label class="fc-label" for="tgeUlang">Ulangi</label><select class="input" id="tgeUlang">${opsi([['', 'Tidak berulang'], ['harian', 'Tiap hari'], ['mingguan', 'Tiap minggu'], ['bulanan', 'Tiap bulan']], t.ulang || '')}</select></div>
        <div class="fc-grup"><label class="fc-label" for="tgeStatus">Status</label><select class="input" id="tgeStatus">${opsi([['belum', 'Belum'], ['dikerjakan', 'Sedang dikerjakan'], ['selesai', 'Selesai']], t.status)}</select></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button type="button" class="tombol" id="tgeSimpan">Simpan</button><button type="button" class="tombol halus" id="tgeHapus">Hapus</button></div>
      <div class="teks-kecil" style="margin-top:10px">Dibuat ${esc(t.dibuat)}${t.selesai ? ' · selesai ' + esc(t.selesai) : ''}</div>`);
    $('tgeSimpan').addEventListener('click', () => {
      const judul = $('tgeJudul').value.trim();
      if (!judul) { toast('Judul tugas wajib diisi.', true); return; }
      const status = $('tgeStatus').value;
      App.api('simpanTugas', { id, judul, catatan: $('tgeCatatan').value, tenggat: $('tgeTenggat').value, prioritas: $('tgePrioritas').value, ulang: $('tgeUlang').value })
        .then(d => status !== t.status ? App.api('setStatusTugas', id, status) : d)
        .then(d => { terapServer(d); if (sheet.tutup) sheet.tutup(); toast('Tugas disimpan.'); })
        .catch(e => toast(e.message || 'Gagal menyimpan tugas.', true));
    });
    $('tgeHapus').addEventListener('click', () => {
      if (!window.confirm('Hapus tugas ini?')) return;
      App.api('hapusTugas', id).then(d => { terapServer(d); if (sheet.tutup) sheet.tutup(); toast('Tugas dihapus.'); })
        .catch(e => toast(e.message || 'Gagal menghapus tugas.', true));
    });
  }

  // pribadi: true = menu hanya dipasang bila server mengizinkan (lihat App.aktifkanPribadi)
  App.daftar({ id: 'tugas', label: 'Tugas Saya', pendek: 'Tugas', ikon: 'tugas', pribadi: true, desk: 'Daftar tugas pribadi: mana yang belum dan mana yang sudah dikerjakan.', render });
})();
