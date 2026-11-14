/**
 * Halaman: Monitoring MRP All KS (Kartu Stok).
 * Sumber: tab "KS" di spreadsheet MRP 6 cabang. Tampilan Gabungan (per kode part, total + rincian cabang)
 * atau Per cabang. Baris data: [cabang, kode, desc, awal, masuk, keluar, damage, balance, area, model, url].
 */
(function () {
  const { api, toast, sheet, esc, angka, ikon, $ } = App;
  const C = 0, K = 1, D = 2, AW = 3, IN = 4, OUT = 5, DMG = 6, BAL = 7, AREA = 8, MODEL = 9, URL = 10;
  let DATA = null; // { rows, cabang, gagal, update }
  let ui = null;
  const F = { tampil: 'gabungan', cabang: '', q: '', kpi: '', urut: 'kode', batas: 120 };

  const minus = r => r[BAL] < 0;
  const habis = r => r[BAL] === 0;
  const adaDmg = r => r[DMG] > 0;

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
    u.setAksi(`<button type="button" class="tombol-ikon" id="btnMuat" title="Muat ulang dari sheet MRP">${ikon.sync}</button>`);
    el.innerHTML = `
      <section class="bagian kpi" id="kpi">${Array.from({ length: 6 }, () => '<div class="ubin"><div class="skeleton" style="width:70%"></div><div class="skeleton" style="height:28px;margin-top:8px;width:40%"></div></div>').join('')}</section>
      <section class="bagian kartu">
        <div class="toolbar">
          <div class="segmen" id="segTampil">
            <button type="button" data-t="gabungan" class="aktif">Gabungan</button>
            <button type="button" data-t="cabang">Per cabang</button>
          </div>
          <div class="input-cari">${ikon.cari}<input class="input" id="cari" placeholder="Cari kode part / nama part" autocomplete="off"></div>
          <select class="input" id="urut">
            <option value="kode">Urut: kode part</option>
            <option value="rendah">Urut: balance terendah</option>
            <option value="tinggi">Urut: balance tertinggi</option>
            <option value="keluar">Urut: outgoing terbanyak</option>
          </select>
        </div>
        <div class="chips" id="chips" style="margin-top:10px"></div>
      </section>
      <div class="teks-kecil" id="ringkas" style="margin:10px 2px 8px"></div>
      <div class="daftar" id="daftar">${Array.from({ length: 6 }, () => '<div class="po"><div class="skeleton" style="width:55%"></div><div class="skeleton" style="width:80%;margin-top:8px"></div><div class="skeleton" style="height:10px;margin-top:14px"></div></div>').join('')}</div>`;

    $('btnMuat').addEventListener('click', () => muat(true));
    $('segTampil').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { F.tampil = b.dataset.t; F.batas = 120; semua(); } });
    $('cari').addEventListener('input', e => { F.q = e.target.value.trim().toUpperCase(); F.batas = 120; daftar(); });
    $('urut').addEventListener('change', e => { F.urut = e.target.value; F.batas = 120; daftar(); });
    $('chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { F.cabang = c.dataset.c; F.batas = 120; semua(); } });
    $('kpi').addEventListener('click', e => { const t = e.target.closest('.ubin'); if (!t || !t.dataset.k) return; F.kpi = F.kpi === t.dataset.k ? '' : t.dataset.k; F.batas = 120; semua(); });
    $('daftar').addEventListener('click', e => {
      if (e.target.closest('#lagi')) { F.batas += 120; daftar(); return; }
      const k = e.target.closest('.po');
      if (k && k.dataset.kode) detail(k.dataset.kode);
    });

    if (DATA) semua(); else muat(false);
  }

  function muat(paksa) {
    const b = $('btnMuat');
    if (b) b.disabled = true;
    if (paksa) toast('Membaca tab KS semua cabang…');
    api('getDataKS').then(d => {
      DATA = d; gabungCache = null;
      if (b) b.disabled = false;
      ui.setSub(`${d.update} · ${angka(d.rows.length)} baris · ${d.cabang.length} cabang`);
      if (d.gagal.length) toast('Sebagian cabang gagal dibaca: ' + d.gagal.join('; '), true);
      else if (paksa) toast('KS diperbarui.');
      semua();
    }).catch(e => {
      if (b) b.disabled = false;
      toast(e.message || 'Gagal memuat KS.', true);
      if (!DATA) {
        $('daftar').innerHTML = `<div class="kosong" style="grid-column:1/-1">${ikon.kosong}<div>${esc(e.message || 'Gagal memuat data')}</div><button type="button" class="tombol halus" style="margin-top:12px" id="coba">Coba lagi</button></div>`;
        $('coba').addEventListener('click', () => muat(false));
      }
    });
  }

  function semua() {
    document.querySelectorAll('#segTampil button').forEach(b => b.classList.toggle('aktif', b.dataset.t === F.tampil));
    kpi(); chips(); daftar();
  }

  function dasar() { return DATA.rows.filter(r => !F.cabang || r[C] === F.cabang); }

  function kpi() {
    const r = dasar();
    const kode = new Set(r.map(x => x[K]));
    const u = [
      ['semua', 'Total Part', kode.size, ''],
      ['habis', 'Balance 0', r.filter(habis).length, 'oranye'],
      ['minus', 'Balance Minus', r.filter(minus).length, 'merah'],
      ['dmg', 'Ada Damage', r.filter(adaDmg).length, 'merah'],
      ['bal', 'Total Balance (pcs)', r.reduce((a, x) => a + x[BAL], 0), ''],
      ['out', 'Total Outgoing (pcs)', r.reduce((a, x) => a + x[OUT], 0), ''],
    ];
    $('kpi').innerHTML = u.map(([id, l, n, w]) => `<div class="ubin ${F.kpi === id ? 'aktif' : ''}" data-k="${id}"><div class="label">${esc(l)}</div><div class="nilai ${n && w ? w : ''}">${angka(n)}</div></div>`).join('');
  }

  function chips() {
    const n = {};
    DATA.rows.forEach(r => { n[r[C]] = (n[r[C]] || 0) + 1; });
    $('chips').innerHTML = [`<button type="button" class="chip ${F.cabang ? '' : 'aktif'}" data-c="">Semua cabang</button>`]
      .concat(DATA.cabang.slice().sort().map(c => `<button type="button" class="chip ${F.cabang === c ? 'aktif' : ''}" data-c="${esc(c)}">${esc(c)}<b>${n[c] || 0}</b></button>`)).join('');
  }

  const cocok = teks => !F.q || teks.toUpperCase().includes(F.q);
  const lolosKpi = r => (F.kpi === 'habis' ? habis(r) : F.kpi === 'minus' ? minus(r) : F.kpi === 'dmg' ? adaDmg(r) : true);

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
    const filterAktif = ['habis', 'minus', 'dmg'].includes(F.kpi);
    $('ringkas').textContent = `${angka(item.length)} ${F.tampil === 'gabungan' ? 'kode part' : 'baris'}${F.cabang ? ' · ' + F.cabang : ''}${filterAktif ? ' · filter aktif' : ''}`;
    if (!item.length) {
      $('daftar').innerHTML = `<div class="kosong" style="grid-column:1/-1">${ikon.kosong}<div>Tidak ada part yang cocok.</div></div>`;
      return;
    }
    $('daftar').innerHTML = item.slice(0, F.batas).map(kartu).join('') +
      (item.length > F.batas ? `<div style="grid-column:1/-1"><button type="button" class="tombol halus tombol-lagi" id="lagi">Tampilkan lagi (${angka(item.length - F.batas)} tersisa)</button></div>` : '');
  }

  function kartu(g) {
    const tanda = g.balance < 0 ? 'merah' : g.balance === 0 ? '' : 'hijau';
    const r0 = g.baris[0];
    const rinci = F.tampil === 'gabungan'
      ? `<div class="rincian">${g.baris.slice().sort((a, b) => a[C].localeCompare(b[C])).map(r => `<span class="badge ${r[BAL] < 0 ? 'merah' : r[BAL] === 0 ? 'abu' : ''}">${esc(r[C])} <b>${angka(r[BAL])}</b></span>`).join('')}</div>`
      : `<div class="rincian"><span class="badge abu">${esc(r0[C])}</span><span class="badge">Awal ${angka(r0[AW])}</span><span class="badge">In ${angka(r0[IN])}</span><span class="badge">Out ${angka(r0[OUT])}</span>${r0[DMG] ? `<span class="badge merah">Damage ${angka(r0[DMG])}</span>` : ''}${r0[AREA] ? `<span class="badge abu">📍 ${esc(r0[AREA])}</span>` : ''}</div>`;
    return `<article class="po" data-kode="${esc(g.kode)}">
      <div class="po-atas">
        <div style="min-width:0"><div class="kunci">${esc(g.kode)}</div><div class="po-meta">${esc(g.desc || '-')}</div></div>
        <div class="stok-angka ${tanda}">${angka(g.balance)}<small>BALANCE</small></div>
      </div>${rinci}</article>`;
  }

  function detail(kode) {
    const baris = DATA.rows.filter(r => r[K] === kode).sort((a, b) => a[C].localeCompare(b[C]));
    if (!baris.length) return;
    const tot = k => baris.reduce((a, r) => a + r[k], 0);
    sheet.buka(esc(kode), `
      <div class="detail-baris"><span>Nama part</span><span>${esc(baris[0][D] || '-')}</span></div>
      ${baris[0][MODEL] ? `<div class="detail-baris"><span>Model</span><span>${esc(baris[0][MODEL])}</span></div>` : ''}
      <div class="detail-baris"><span>Total balance</span><span>${angka(tot(BAL))} pcs</span></div>
      <div class="pemisah"></div>
      <div class="gulir-x"><table class="tabel-ks"><thead><tr><th>Cabang</th><th class="angka">Awal</th><th class="angka">In</th><th class="angka">Out</th><th class="angka">Dmg</th><th class="angka">Balance</th></tr></thead><tbody>
        ${baris.map(r => `<tr class="${r[BAL] < 0 ? 'minus' : r[BAL] === 0 ? 'habis' : ''}"><td>${esc(r[C])}${r[AREA] ? `<div class="teks-kecil">📍 ${esc(r[AREA])}</div>` : ''}</td><td class="angka">${angka(r[AW])}</td><td class="angka">${angka(r[IN])}</td><td class="angka">${angka(r[OUT])}</td><td class="angka">${angka(r[DMG])}</td><td class="angka"><b>${angka(r[BAL])}</b></td></tr>`).join('')}
        <tr><td><b>Total</b></td><td class="angka"><b>${angka(tot(AW))}</b></td><td class="angka"><b>${angka(tot(IN))}</b></td><td class="angka"><b>${angka(tot(OUT))}</b></td><td class="angka"><b>${angka(tot(DMG))}</b></td><td class="angka"><b>${angka(tot(BAL))}</b></td></tr>
      </tbody></table></div>
      <div class="pemisah"></div>
      <div class="po-bawah">${baris.map(r => (r[URL] ? `<a class="badge" href="${esc(r[URL])}" target="_blank" rel="noopener">Buka sheet ${esc(r[C])}</a>` : '')).join('')}</div>`);
  }

  App.daftar({
    id: 'ks', label: 'Monitoring MRP All KS', pendek: 'KS', ikon: 'kartu',
    desk: 'Kartu stok (KS) semua part dari 6 cabang: stock awal, incoming, outgoing, damage, dan balance. Lihat gabungan atau per cabang.',
    tanda: 'Buka kartu stok', render,
  });
})();
