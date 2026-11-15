/**
 * Halaman: Monitoring MRP All KS (Kartu Stok).
 * Sumber: tab "KS" di spreadsheet MRP 6 cabang + stok Servia (ditarik Stock Bot tiap hari jam 12).
 * Tampilan Gabungan (satu baris per kode part) atau Per cabang. Filter tersimpan di URL (#ks?k=selisih&c=JOGLO).
 * Baris data: [cabang, kode, desc, awal, masuk, keluar, damage, balance, area, model, url, servia, jumlahProdukServia].
 */
(function () {
  const { toast, sheet, esc, angka, ikon, $ } = App;
  const C = 0, K = 1, D = 2, AW = 3, IN = 4, OUT = 5, DMG = 6, BAL = 7, AREA = 8, MODEL = 9, URL = 10, SV = 11, NSV = 12;
  let DATA = null; // { rows, cabang, gagal, update, updateServia }
  let ui = null;
  let subTeks = '';
  const F = { tampil: 'gabungan', cabang: '', q: '', kpi: '', urut: 'kode', batas: 120 };

  const simpanFilter = () => App.simpanQuery({ t: F.tampil !== 'gabungan' ? F.tampil : '', c: F.cabang, q: F.q, u: F.urut !== 'kode' ? F.urut : '', k: F.kpi });

  const minus = r => r[BAL] < 0;
  const habis = r => r[BAL] === 0;
  const adaDmg = r => r[DMG] > 0;
  // rekonsiliasi dengan stok Servia: SV = null kalau part tidak ketemu di Servia cabang itu
  const adaSv = r => r[SV] !== null && r[SV] !== undefined;
  const selisih = r => adaSv(r) && r[BAL] !== r[SV];
  const beda = r => r[BAL] - r[SV];
  const fmtBeda = r => (beda(r) > 0 ? '+' : '') + angka(beda(r));

  // ---------- gabungan per kode ----------
  let gabungCache = null;
  function gabung() {
    if (gabungCache) return gabungCache;
    const peta = new Map();
    DATA.rows.forEach(r => {
      const g = peta.get(r[K]) || { kode: r[K], desc: r[D], baris: [] };
      if (!g.desc && r[D]) g.desc = r[D];
      g.baris.push(r);
      peta.set(r[K], g);
    });
    gabungCache = [...peta.values()];
    return gabungCache;
  }

  // ---------- kerangka ----------
  function render(el, u) {
    ui = u;
    u.setAksi(`<button type="button" class="tombol-ikon" id="btnEkspor" title="Ekspor ke Excel" aria-label="Ekspor ke Excel">${ikon.unduh}</button>
      <button type="button" class="tombol-ikon" id="btnMuat" title="Muat ulang dari sheet MRP" aria-label="Muat ulang dari sheet MRP">${ikon.sync}</button>`);
    el.innerHTML = `
      <section class="bagian kpi" id="kpi" aria-label="Ringkasan kartu stok">${Array.from({ length: 6 }, () => '<div class="ubin"><div class="skeleton" style="width:70%"></div><div class="skeleton" style="height:26px;margin-top:8px;width:40%"></div></div>').join('')}</section>
      <section class="bagian" aria-label="Filter">
        <div class="toolbar">
          <div class="segmen" id="segTampil" role="group" aria-label="Tampilan">
            <button type="button" data-t="gabungan">Gabungan</button>
            <button type="button" data-t="cabang">Per cabang</button>
          </div>
          <div class="input-cari">${ikon.cari}<input class="input" id="cari" name="cari" type="search" placeholder="Cari kode part atau nama part…" aria-label="Cari part" autocomplete="off" spellcheck="false"></div>
          <select class="input" id="urut" name="urut" aria-label="Urutkan daftar">
            <option value="kode">Urut: kode part</option>
            <option value="rendah">Urut: balance terendah</option>
            <option value="tinggi">Urut: balance tertinggi</option>
            <option value="keluar">Urut: outgoing terbanyak</option>
          </select>
        </div>
        <div class="chips" id="chips" role="group" aria-label="Cabang" style="margin-top:10px"></div>
      </section>
      <section class="bagian" aria-label="Daftar part">
        <div class="teks-kecil" id="ringkas" aria-live="polite" style="margin:0 2px 8px"></div>
        <div class="daftar ks-daftar" id="daftar">${Array.from({ length: 6 }, () => '<div class="po ks"><div class="skeleton" style="width:55%"></div><div class="skeleton" style="width:80%;margin-top:8px"></div></div>').join('')}</div>
      </section>`;

    $('btnEkspor').addEventListener('click', ekspor);
    $('btnMuat').addEventListener('click', () => muat(true));
    $('segTampil').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { F.tampil = b.dataset.t; F.batas = 120; simpanFilter(); semua(); } });
    $('cari').addEventListener('input', e => { F.q = e.target.value.trim().toUpperCase(); F.batas = 120; simpanFilter(); daftar(); });
    $('urut').addEventListener('change', e => { F.urut = e.target.value; F.batas = 120; simpanFilter(); daftar(); });
    $('chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { F.cabang = c.dataset.c; F.batas = 120; simpanFilter(); semua(); } });
    $('kpi').addEventListener('click', e => { const t = e.target.closest('.ubin'); if (!t || !t.dataset.k) return; F.kpi = F.kpi === t.dataset.k ? '' : t.dataset.k; F.batas = 120; simpanFilter(); semua(); });
    $('daftar').addEventListener('click', e => {
      if (e.target.closest('#lagi')) { F.batas += 120; daftar(); return; }
      const k = e.target.closest('.po');
      if (k && k.dataset.kode) detail(k.dataset.kode);
    });

    // filter awal: dari tautan (URL) atau dari ringkasan di Beranda
    Object.assign(F, { tampil: 'gabungan', cabang: '', q: '', kpi: '', urut: 'kode', batas: 120 });
    const q = App.state.query;
    if (q && [...q.keys()].length) { F.tampil = q.get('t') || 'gabungan'; F.cabang = q.get('c') || ''; F.q = (q.get('q') || '').toUpperCase(); F.urut = q.get('u') || 'kode'; F.kpi = q.get('k') || ''; }
    const awal = App.state.awal;
    if (awal && awal.halaman === 'ks') { F.kpi = awal.kpi || ''; F.cabang = ''; F.tampil = 'gabungan'; App.state.awal = null; simpanFilter(); }
    $('cari').value = F.q;
    $('urut').value = F.urut;
    if (DATA) { ui.setSub(subTeks); semua(); } else muat(false);
  }

  function muat(paksa) {
    const b = $('btnMuat');
    if (b) b.disabled = true;
    if (paksa) toast('Membaca tab KS semua cabang…');
    App.ambil('getDataKS', paksa ? 0 : 120000).then(d => {
      DATA = d; gabungCache = null;
      subTeks = `${d.update} · ${angka(d.rows.length)} baris · ${d.cabang.length} cabang · Servia: ${d.updateServia || 'belum ada data (bot sinkron jam 12:00)'}${d.offlineSejak ? ' · offline' : ''}`;
      if (App.state.aktif !== 'ks') return; // pengguna sudah pindah halaman
      if (b) b.disabled = false;
      ui.setSub(subTeks);
      if (d.gagal.length) toast('Sebagian cabang gagal dibaca: ' + d.gagal.join('; '), true);
      else if (paksa) toast('KS diperbarui.');
      semua();
    }).catch(e => {
      if (App.state.aktif !== 'ks') return;
      if (b) b.disabled = false;
      toast(e.message || 'Gagal memuat KS.', true);
      if (!DATA) {
        $('daftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>${esc(e.message || 'Data kartu stok belum bisa dimuat.')}</div><button type="button" class="tombol halus" id="coba">Coba lagi</button></div>`;
        $('coba').addEventListener('click', () => muat(false));
      }
    });
  }

  function semua() {
    document.querySelectorAll('#segTampil button').forEach(b => { const on = b.dataset.t === F.tampil; b.classList.toggle('aktif', on); b.setAttribute('aria-pressed', on); });
    kpi(); chips(); daftar();
  }

  const dasar = () => DATA.rows.filter(r => !F.cabang || r[C] === F.cabang);

  function kpi() {
    const r = dasar();
    const kode = new Set(r.map(x => x[K]));
    const u = [
      ['semua', 'Total part', kode.size, ''],
      ['habis', 'Balance 0', r.filter(habis).length, 'oranye'],
      ['minus', 'Balance minus', r.filter(minus).length, 'merah'],
      ['dmg', 'Ada damage', r.filter(adaDmg).length, 'merah'],
      ['selisih', 'Selisih vs Servia', r.filter(selisih).length, 'oranye'],
      ['belumsv', 'Belum ada di Servia', DATA.updateServia ? r.filter(x => !adaSv(x)).length : 0, 'oranye'],
    ];
    $('kpi').innerHTML = u.map(([id, l, n, w]) =>
      `<button type="button" class="ubin ${F.kpi === id ? 'aktif' : ''}" data-k="${id}" aria-pressed="${F.kpi === id}"><span class="label">${esc(l)}</span><span class="nilai">${angka(n)}</span>${n && w ? `<span class="penanda ${w}"><span class="sr">, perlu perhatian</span></span>` : ''}</button>`).join('');
  }

  function chips() {
    const n = {};
    DATA.rows.forEach(r => { n[r[C]] = (n[r[C]] || 0) + 1; });
    $('chips').innerHTML = [`<button type="button" class="chip ${F.cabang ? '' : 'aktif'}" data-c="" aria-pressed="${!F.cabang}">Semua cabang</button>`]
      .concat(DATA.cabang.slice().sort().map(c => `<button type="button" class="chip ${F.cabang === c ? 'aktif' : ''}" data-c="${esc(c)}" aria-pressed="${F.cabang === c}">${esc(c)}<b>${n[c] || 0}</b></button>`)).join('');
  }

  const cocok = teks => !F.q || teks.toUpperCase().includes(F.q);
  const lolosKpi = r => (F.kpi === 'habis' ? habis(r) : F.kpi === 'minus' ? minus(r) : F.kpi === 'dmg' ? adaDmg(r) : F.kpi === 'selisih' ? selisih(r) : F.kpi === 'belumsv' ? !adaSv(r) : true);

  function urut(a, b) {
    switch (F.urut) {
      case 'rendah': return a.balance - b.balance;
      case 'tinggi': return b.balance - a.balance;
      case 'keluar': return b.keluar - a.keluar;
      default: return String(a.kode).localeCompare(String(b.kode));
    }
  }

  function daftar() {
    let item;
    if (F.tampil === 'gabungan') {
      item = gabung()
        .map(g => ({ kode: g.kode, desc: g.desc, baris: g.baris.filter(r => (!F.cabang || r[C] === F.cabang) && lolosKpi(r)) }))
        .filter(g => g.baris.length && cocok(g.kode + ' ' + g.desc))
        .map(g => ({ ...g, balance: g.baris.reduce((a, r) => a + r[BAL], 0), keluar: g.baris.reduce((a, r) => a + r[OUT], 0) }));
    } else {
      item = dasar().filter(lolosKpi).filter(r => cocok(r[K] + ' ' + r[D]))
        .map(r => ({ kode: r[K], desc: r[D], balance: r[BAL], keluar: r[OUT], baris: [r] }));
    }
    item.sort(urut);
    const filterAktif = ['habis', 'minus', 'dmg', 'selisih', 'belumsv'].includes(F.kpi);
    $('ringkas').textContent = `${angka(item.length)} ${F.tampil === 'gabungan' ? 'kode part' : 'baris'}${F.cabang ? ' · ' + F.cabang : ''}${filterAktif ? ' · filter aktif' : ''}${F.q ? ' · “' + F.q + '”' : ''}`;
    if (!item.length) {
      $('daftar').innerHTML = `<div class="kosong">${ikon.kosong}<div>Tidak ada part yang cocok dengan filter ini.</div></div>`;
      return;
    }
    $('daftar').innerHTML = `<div class="daftar-kepala"><span>Kode part</span><span style="text-align:right">Balance</span><span>${F.tampil === 'gabungan' ? 'Per cabang' : 'Rincian'}</span></div>` +
      item.slice(0, F.batas).map(kartu).join('') +
      (item.length > F.batas ? `<div style="padding:4px"><button type="button" class="tombol halus tombol-lagi" id="lagi">Tampilkan lagi (${angka(item.length - F.batas)} tersisa)</button></div>` : '');
  }

  function kartu(g) {
    const r0 = g.baris[0];
    const rinci = F.tampil === 'gabungan'
      ? `<span class="rincian">${g.baris.slice().sort((a, b) => a[C].localeCompare(b[C])).map(r => `<span class="badge ${selisih(r) ? 'oranye' : r[BAL] < 0 ? 'merah' : r[BAL] === 0 ? 'abu' : ''}" ${selisih(r) ? `title="Servia ${angka(r[SV])}"` : ''}>${esc(r[C])} <b>${angka(r[BAL])}</b>${selisih(r) ? ` · Servia ${angka(r[SV])}` : ''}</span>`).join('')}</span>`
      : `<span class="rincian"><span class="badge">${esc(r0[C])}</span><span class="badge">Awal ${angka(r0[AW])}</span><span class="badge">In ${angka(r0[IN])}</span><span class="badge">Out ${angka(r0[OUT])}</span>${r0[DMG] ? `<span class="badge merah">Damage ${angka(r0[DMG])}</span>` : ''}${adaSv(r0) ? `<span class="badge ${selisih(r0) ? 'oranye' : 'hijau'}">Servia ${angka(r0[SV])}${selisih(r0) ? ` · selisih ${fmtBeda(r0)}` : ' · sama'}</span>` : ''}${r0[AREA] ? `<span class="badge">Area ${esc(r0[AREA])}</span>` : ''}</span>`;
    return `<button type="button" class="po ks" data-kode="${esc(g.kode)}">
      <span class="po-info"><span class="po-no">${esc(g.kode)}</span><span class="po-meta">${esc(g.desc || '-')}</span></span>
      <span class="ks-bal ${g.balance < 0 ? 'minus' : ''}">${angka(g.balance)}<small>balance</small></span>
      ${rinci}
    </button>`;
  }

  function detail(kode) {
    const baris = DATA.rows.filter(r => r[K] === kode).sort((a, b) => a[C].localeCompare(b[C]));
    if (!baris.length) return;
    const tot = k => baris.reduce((a, r) => a + r[k], 0);
    const totSv = baris.reduce((a, r) => a + (adaSv(r) ? r[SV] : 0), 0);
    sheet.buka(esc(kode), `
      <div class="detail-baris"><span>Nama part</span><span>${esc(baris[0][D] || '-')}</span></div>
      ${baris[0][MODEL] ? `<div class="detail-baris"><span>Model</span><span>${esc(baris[0][MODEL])}</span></div>` : ''}
      <div class="detail-baris"><span>Total balance</span><span>${angka(tot(BAL))} pcs</span></div>
      <div class="pemisah"></div>
      <h3 class="judul-kecil">Per cabang</h3>
      ${baris.map(r => `<div class="ks-cab">
        <div class="ks-cab-kepala"><span class="ks-cab-nama">${esc(r[C])}</span>${r[AREA] ? `<span class="ks-cab-area">Area ${esc(r[AREA])}</span>` : ''}</div>
        <div class="ks-angka-grid">
          <div><small>Stock awal</small>${angka(r[AW])}</div>
          <div><small>Incoming</small>${angka(r[IN])}</div>
          <div><small>Outgoing</small>${angka(r[OUT])}</div>
          <div><small>Damage</small>${angka(r[DMG])}</div>
          <div class="${r[BAL] < 0 ? 'minus' : ''}"><small>Balance</small>${angka(r[BAL])}</div>
          <div class="${selisih(r) ? 'selisih' : ''}"><small>Servia</small>${adaSv(r) ? angka(r[SV]) + (selisih(r) ? ` (${fmtBeda(r)})` : '') : '—'}${r[NSV] > 1 ? `<span class="teks-kecil" style="display:block;font-weight:400">${r[NSV]} produk berkode sama</span>` : ''}</div>
        </div>
      </div>`).join('')}
      <div class="ks-total"><span>Total</span><span>Balance ${angka(tot(BAL))} · Servia ${angka(totSv)}</span></div>
      <div class="pemisah"></div>
      <div class="detail-kepala">${baris.map(r => (r[URL] ? `<a href="${esc(r[URL])}" target="_blank" rel="noopener">Buka sheet ${esc(r[C])}</a>` : '')).join('')}</div>`);
  }

  // ---------- ekspor Excel (per baris cabang, sesuai filter aktif) ----------
  function ekspor() {
    if (!DATA || !window.Ekspor) return;
    const baris = dasar().filter(lolosKpi).filter(r => cocok(r[K] + ' ' + r[D])).sort((a, b) => String(a[K]).localeCompare(String(b[K])) || a[C].localeCompare(b[C]));
    if (!baris.length) { toast('Tidak ada data untuk diekspor.', true); return; }
    Ekspor.unduh(Ekspor.namaDenganTanggal('snd-kartu-stok'), [{
      nama: 'KS',
      kolom: ['Cabang', 'Kode Part', 'Deskripsi', 'Stock Awal', 'Incoming', 'Outgoing', 'Damage', 'Balance', 'Stok Servia', 'Selisih (KS - Servia)', 'Jumlah Produk Servia', 'Area', 'Model'],
      baris: baris.map(r => [r[C], r[K], r[D], r[AW], r[IN], r[OUT], r[DMG], r[BAL], adaSv(r) ? r[SV] : '', adaSv(r) ? beda(r) : '', adaSv(r) ? r[NSV] : '', r[AREA], r[MODEL]]),
    }]);
    toast(`Mengunduh ${angka(baris.length)} baris KS ke Excel…`);
  }

  App.daftar({
    id: 'ks', label: 'Monitoring MRP All KS', pendek: 'KS', ikon: 'kartu',
    desk: 'Kartu stok semua part dari 6 cabang: stock awal, incoming, outgoing, damage, balance, dan selisih dengan Servia.',
    render,
  });
})();
