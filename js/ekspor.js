/**
 * Ekspor ke Excel (.xlsx) tanpa library: XML minimal + ZIP "store" (tanpa kompresi) yang ditulis sendiri.
 * Ekspor.bangun(sheets) -> Uint8Array (bisa diuji di Node); Ekspor.unduh(namaFile, sheets) -> memicu unduhan di browser.
 * sheets = [{ nama, kolom: ['A','B'], baris: [[...], ...], lebar?: [angka,...] }]  (angka tetap angka, selain itu teks)
 */
(function (root) {
  const enc = new TextEncoder();

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // karakter kontrol tidak valid di XML

  function hurufKolom(i) { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; }

  function xmlSheet(sh) {
    const lebar = sh.lebar || sh.kolom.map((k, i) => {
      const maks = Math.max(String(k).length, ...sh.baris.slice(0, 200).map(r => String(r[i] == null ? '' : r[i]).length));
      return Math.min(60, Math.max(8, maks + 2));
    });
    const sel = (v, c, r, gaya) => {
      const ref = hurufKolom(c) + r;
      if (v === null || v === undefined || v === '') return gaya ? `<c r="${ref}" s="${gaya}"/>` : '';
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${gaya ? ` s="${gaya}"` : ''}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${gaya ? ` s="${gaya}"` : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    };
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<cols>' + lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols><sheetData>';
    x += '<row r="1">' + sh.kolom.map((k, i) => sel(String(k), i, 1, 1)).join('') + '</row>';
    sh.baris.forEach((b, ri) => { x += `<row r="${ri + 2}">` + b.map((v, ci) => sel(v, ci, ri + 2, 0)).join('') + '</row>'; });
    x += '</sheetData>';
    if (sh.baris.length) x += `<autoFilter ref="A1:${hurufKolom(sh.kolom.length - 1)}${sh.baris.length + 1}"/>`;
    return x + '</worksheet>';
  }

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF002EB4"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  // ---- ZIP (store) ----
  const TABEL = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABEL[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zip(berkas) { // berkas: [{ nama, isi: Uint8Array }]
    const bagian = [], pusat = [];
    let offset = 0;
    berkas.forEach(f => {
      const nama = enc.encode(f.nama), crc = crc32(f.isi), n = f.isi.length;
      const lokal = new DataView(new ArrayBuffer(30));
      lokal.setUint32(0, 0x04034B50, true); lokal.setUint16(4, 20, true); lokal.setUint16(6, 0x0800, true); lokal.setUint16(8, 0, true);
      lokal.setUint16(10, 0, true); lokal.setUint16(12, 0x21, true); lokal.setUint32(14, crc, true); lokal.setUint32(18, n, true); lokal.setUint32(22, n, true);
      lokal.setUint16(26, nama.length, true); lokal.setUint16(28, 0, true);
      bagian.push(new Uint8Array(lokal.buffer), nama, f.isi);
      const pd = new DataView(new ArrayBuffer(46));
      pd.setUint32(0, 0x02014B50, true); pd.setUint16(4, 20, true); pd.setUint16(6, 20, true); pd.setUint16(8, 0x0800, true); pd.setUint16(10, 0, true);
      pd.setUint16(12, 0, true); pd.setUint16(14, 0x21, true); pd.setUint32(16, crc, true); pd.setUint32(20, n, true); pd.setUint32(24, n, true);
      pd.setUint16(28, nama.length, true); pd.setUint32(42, offset, true);
      pusat.push(new Uint8Array(pd.buffer), nama);
      offset += 30 + nama.length + n;
    });
    const ukuranPusat = pusat.reduce((a, b) => a + b.length, 0);
    const akhir = new DataView(new ArrayBuffer(22));
    akhir.setUint32(0, 0x06054B50, true); akhir.setUint16(8, berkas.length, true); akhir.setUint16(10, berkas.length, true);
    akhir.setUint32(12, ukuranPusat, true); akhir.setUint32(16, offset, true);
    const semua = [...bagian, ...pusat, new Uint8Array(akhir.buffer)];
    const hasil = new Uint8Array(semua.reduce((a, b) => a + b.length, 0));
    let p = 0; semua.forEach(b => { hasil.set(b, p); p += b.length; });
    return hasil;
  }

  function bangun(sheets) {
    const namaAman = (s, i) => String(s || 'Sheet' + (i + 1)).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31);
    const f = (nama, isi) => ({ nama, isi: enc.encode(isi) });
    const berkas = [
      f('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>'),
      f('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
      f('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        sheets.map((s, i) => `<sheet name="${esc(namaAman(s.nama, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'),
      f('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
      f('xl/styles.xml', STYLES),
      ...sheets.map((s, i) => f(`xl/worksheets/sheet${i + 1}.xml`, xmlSheet(s))),
    ];
    return zip(berkas);
  }

  function unduh(namaFile, sheets) {
    const data = bangun(sheets);
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = namaFile.endsWith('.xlsx') ? namaFile : namaFile + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /** Nama file dengan tanggal hari ini, mis. snd-monitoring-po-2026-11-15 */
  const namaDenganTanggal = dasar => `${dasar}-${new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)}`;

  root.Ekspor = { bangun, unduh, namaDenganTanggal };
  if (typeof module !== 'undefined') module.exports = root.Ekspor;
})(typeof window !== 'undefined' ? window : globalThis);
