// Membuat ikon PNG (tanpa library): kotak navy membulat + tulisan "SND" + aksen oranye.
// Jalankan: node tools/buat-ikon.mjs  -> icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NAVY = [0, 46, 180], PUTIH = [255, 255, 255], ORANYE = [255, 100, 0], LATAR = [244, 246, 251];
const FONT = {
  S: ['01110', '10001', '10000', '01110', '00001', '10001', '01110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
};

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tipe, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(tipe), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, px) { // px: Uint8Array RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function gambar(ukuran, { maskable = false, latarPutih = false } = {}) {
  const S = ukuran, px = Buffer.alloc(S * S * 4);
  const set = (x, y, c, a = 255) => { if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a; };
  const isi = (c) => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, c); };
  const kotakBulat = (x0, y0, w, h, r, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const dx = Math.max(x0 + r - x, 0, x - (x0 + w - 1 - r)), dy = Math.max(y0 + r - y, 0, y - (y0 + h - 1 - r));
      if (dx * dx + dy * dy <= r * r) set(x, y, c);
    }
  };
  if (maskable) isi(NAVY); // maskable: warna penuh sampai tepi (zona aman 80%)
  else if (latarPutih) { isi(LATAR); kotakBulat(0, 0, S, S, Math.round(S * 0.22), NAVY); }
  else { for (let i = 3; i < px.length; i += 4) px[i] = 0; kotakBulat(0, 0, S, S, Math.round(S * 0.22), NAVY); }

  // tulisan SND: 3 huruf x 5 kolom + 2 spasi = 17 kolom, 7 baris
  const skala = maskable ? 0.52 : 0.62;
  const sel = Math.floor(S * skala / 17);
  const lebar = sel * 17, tinggi = sel * 7;
  const x0 = Math.floor((S - lebar) / 2), y0 = Math.floor((S - tinggi) / 2) - Math.floor(S * 0.03);
  ['S', 'N', 'D'].forEach((h, k) => FONT[h].forEach((baris, y) => [...baris].forEach((b, x) => {
    if (b === '1') kotakBulat(x0 + (k * 6 + x) * sel, y0 + y * sel, sel, sel, Math.floor(sel * 0.25), PUTIH);
  })));
  // aksen oranye di bawah tulisan
  const aw = Math.floor(lebar * 0.55), ah = Math.max(4, Math.floor(S * 0.045));
  kotakBulat(Math.floor((S - aw) / 2), y0 + tinggi + Math.floor(S * 0.07), aw, ah, Math.floor(ah / 2), ORANYE);
  return png(S, S, px);
}

writeFileSync('icons/icon-192.png', gambar(192));
writeFileSync('icons/icon-512.png', gambar(512));
writeFileSync('icons/maskable-512.png', gambar(512, { maskable: true }));
writeFileSync('icons/apple-touch-icon.png', gambar(180, { latarPutih: true }));
writeFileSync('icons/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#002EB4"/>` +
  `<text x="32" y="38" text-anchor="middle" font-family="Poppins,Arial,sans-serif" font-weight="700" font-size="22" fill="#fff">SND</text>` +
  `<rect x="20" y="45" width="24" height="4" rx="2" fill="#FF6400"/></svg>`);
console.log('ikon dibuat di icons/');
