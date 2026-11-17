import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire((process.env.PUPPETEER_DIR || 'C:/Users/Akbar Riyadi/Downloads/stockbot/stock-bot') + '/package.json');
const puppeteer = require('puppeteer-core');
import * as D from './data.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SP = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(SP, 'img'), { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
}).listen(0);
const port = srv.address().port;

let tambahan = {};
const respon = (aksi, args) => {
  switch (aksi) {
    case 'getDataForecast': return { ...D.forecast, tambahan };
    case 'getDataKS': return { rows: D.ksRows, cabang: ['CINERE', 'DEPOK', 'DAAN MOGOT'], gagal: [], update: '17-11-2026 16:06' };
    case 'getRiwayatForecast': return D.riwayat[args[0]] || [];
    case 'getKonteks': return { email: 'nama@otoklix.com', today: '2026-11-17', batas: 3, spreadsheetUrl: '', admin: false };
    case 'getDataApp': return { rows: [], update: '', batas: 3, today: '2026-11-17', email: 'nama@otoklix.com' };
    default: return null;
  }
};

const browser = await puppeteer.launch({ executablePath: (process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'), headless: true, args: ['--no-sandbox'] });
const tunggu = ms => new Promise(r => setTimeout(r, ms));

async function buka(mobile) {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  page.on('console', m => { if (m.type() === 'log' && m.text().startsWith('tidak ada')) console.log(m.text()); });
  await page.setViewport(mobile ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost')) return req.continue();
    if (u.includes('script.google.com')) {
      let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
      return req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: respon(b.aksi, b.args || []) }) });
    }
    if (u.includes('fonts.g')) return req.continue();
    return req.abort();
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('snd_sesi', JSON.stringify({ sesi: 'x', exp: Date.now() + 6e7, email: 'nama@otoklix.com', nama: 'Nama Anda' }));
    localStorage.removeItem('snd_fc_param4');
    window.__tandai = (daftar) => {
      document.querySelectorAll('.__pn').forEach(e => e.remove());
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('class', '__pn');
      svg.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:99999';
      svg.innerHTML = '<defs><marker id="pk" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:#E5342E !important;stroke:#E5342E !important"/></marker></defs>';
      document.body.appendChild(svg);
      daftar.forEach(d => {
        const el = typeof d.el === 'string' ? document.querySelectorAll(d.el)[d.nth || 0] : d.el;
        if (!el) { console.log('tidak ada: ' + d.el); return; }
        const r = el.getBoundingClientRect(), p = d.pad == null ? 3 : d.pad;
        const kotak = document.createElement('div'); kotak.className = '__pn';
        kotak.style.cssText = `position:fixed;left:${r.left - p}px;top:${r.top - p}px;width:${r.width + 2 * p}px;height:${r.height + 2 * p}px;border:2px solid #E5342E;border-radius:8px;pointer-events:none;z-index:99998;background:rgba(229,52,46,.06)`;
        document.body.appendChild(kotak);
        const jr = d.jarak == null ? 34 : d.jarak, sisi = d.sisi || 'a';
        let cx = r.left + r.width / 2, cy = r.top + r.height / 2, ax = cx, ay = cy;
        if (sisi === 'a') { cy = r.top - p - jr; ay = r.top - p; }
        if (sisi === 'b') { cy = r.bottom + p + jr; ay = r.bottom + p; }
        if (sisi === 'k') { cx = r.left - p - jr; ax = r.left - p; }
        if (sisi === 'r') { cx = r.right + p + jr; ax = r.right + p; }
        if (d.dx) cx += d.dx; if (d.dy) cy += d.dy;
        if (!d.tanpaPanah) {
          const gr = document.createElementNS(ns, 'line');
          gr.setAttribute('x1', cx); gr.setAttribute('y1', cy); gr.setAttribute('x2', ax); gr.setAttribute('y2', ay);
          gr.setAttribute('stroke', '#E5342E'); gr.setAttribute('stroke-width', '2'); gr.setAttribute('marker-end', 'url(#pk)');
          svg.appendChild(gr);
        }
        const b = document.createElement('div'); b.className = '__pn'; b.textContent = d.n;
        b.style.cssText = `position:fixed;left:${cx - 12}px;top:${cy - 12}px;width:24px;height:24px;border-radius:50%;background:#E5342E;color:#fff;font:700 13px/24px Arial,sans-serif;text-align:center;z-index:100000;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
        document.body.appendChild(b);
      });
    };
  });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.goto(`http://localhost:${port}/#forecast`, { waitUntil: 'networkidle0' });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  await page.waitForSelector('.fc-baris');
  await tunggu(500);
  return page;
}
const simpan = (page, nama, clip) => page.screenshot({ path: path.join(SP, 'img', nama + '.png'), ...(clip ? { clip } : {}) });
const rect = (page, sel, nth = 0) => page.evaluate((s, n) => { const e = document.querySelectorAll(s)[n].getBoundingClientRect(); return { x: e.x, y: e.y, width: e.width, height: e.height }; }, sel, nth);
const pad = (r, p) => ({ x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: r.width + 2 * p, height: r.height + 2 * p });
const hapusTanda = page => page.evaluate(() => document.querySelectorAll('.__pn').forEach(e => e.remove()));
const sheetRect = async (page, kiri = 60) => { const e = await rect(page, '.sheet-isi'); return { x: Math.max(0, e.x - kiri), y: e.y, width: e.width + kiri, height: e.height }; };

// ===== DESKTOP =====
let page = await buka(false);
await page.evaluate(() => __tandai([{ el: '#navSamping button.aktif', n: 1, sisi: 'r', jarak: 60 }]));
await simpan(page, 'd1-menu', { x: 0, y: 0, width: 520, height: 470 });

await page.evaluate(() => __tandai([
  { el: '#btnTambah', n: 1, sisi: 'b', jarak: 40 }, { el: '#btnSinkron', n: 2, sisi: 'b', jarak: 40 },
  { el: '#btnPanduan', n: 3, sisi: 'b', jarak: 40 }, { el: '#btnEkspor', n: 4, sisi: 'b', jarak: 40 }]));
await simpan(page, 'd2-tombol', { x: 640, y: 0, width: 640, height: 130 });
await hapusTanda(page);

await page.evaluate(() => App.toast('Sinkron dari MRP Cinere… (bisa sampai satu menit)'));
await tunggu(300);
await simpan(page, 'd3a-toast-jalan', { x: 240, y: 690, width: 800, height: 110 });
await page.evaluate(() => App.toast('Sinkron selesai: 14 part Fast Move'));
await tunggu(300);
await simpan(page, 'd3b-toast-selesai', { x: 240, y: 690, width: 800, height: 110 });
await tunggu(2800);

await page.evaluate(() => __tandai([
  { el: '#fcKontrol .fc-grup:nth-child(1) .chips', n: 1, sisi: 'r', jarak: 36 },
  { el: '#fcKontrol .fc-grup:nth-child(2) .chips', n: 2, sisi: 'r', jarak: 36 },
  { el: '.fc-lanjut summary', n: 3, sisi: 'r', jarak: 36 }]));
await simpan(page, 'd4-skenario', pad(await rect(page, '.kartu'), 6));
await hapusTanda(page);

await page.evaluate(() => { document.querySelector('[data-naik="lain"]').click(); document.querySelector('.fc-lanjut summary').click(); });
await tunggu(300);
await page.evaluate(() => __tandai([{ el: '#fcNaik', n: 1, sisi: 'r', jarak: 60 }, { el: '#fcLt', n: 2, sisi: 'r', jarak: 36 }, { el: '#fcMetode', n: 3, sisi: 'r', jarak: 36 }]));
await simpan(page, 'd5-lanjutan', pad(await rect(page, '.kartu'), 6));
await hapusTanda(page);
await page.evaluate(() => { document.querySelector('[data-naik="100"]').click(); document.querySelector('.fc-lanjut summary').click(); });
await tunggu(300);

await page.evaluate(() => window.scrollTo(0, 0));
const rt = await rect(page, '#fcRingkas');
await page.evaluate(() => __tandai([
  { el: '.fc-tile-lebar', n: 1, sisi: 'b', jarak: 0, dx: 0, dy: 0 },
  ...[2, 3, 4, 5, 6, 7, 8, 9].map((i, k) => ({ el: `.fc-kepala span:nth-child(${i})`, n: i, sisi: 'a', jarak: 22 }))].map((d, i) => i === 0 ? { ...d, sisi: 'r', jarak: -26, tanpaPanah: true } : d)));
await simpan(page, 'd6-tabel', { x: 250, y: Math.max(0, rt.y - 36), width: 1030, height: 800 - Math.max(0, rt.y - 36) });
await hapusTanda(page);

await page.evaluate(() => { [...document.querySelectorAll('.fc-baris')].find(b => b.dataset.kode === 'PWT20000519AA').click(); });
await tunggu(700);
const sh = await sheetRect(page, 60);
const baris = t => `(() => [...document.querySelectorAll('#sheetBadan .detail-baris, #sheetBadan .judul-kecil')].find(e => e.textContent.trim().startsWith(${JSON.stringify(t)})))()`;
await page.evaluate(`__tandai([
  { el: ${baris('Agu 2026')}, n: 1, sisi: 'k', jarak: 36 },
  { el: ${baris('Lead time')}, n: 2, sisi: 'k', jarak: 36 },
  { el: ${baris('Target stok')}, n: 3, sisi: 'k', jarak: 36 },
  { el: ${baris('Stok Cinere')}, n: 4, sisi: 'k', jarak: 36 }])`);
await simpan(page, 'd7-rincian', sh);
await hapusTanda(page);
await page.evaluate(() => { const b = document.querySelector('#sheetBadan'); b.scrollTop = b.scrollHeight; });
await tunggu(300);
await page.evaluate(`__tandai([
  { el: ${baris('Saran order')}, n: 5, sisi: 'k', jarak: 36 },
  { el: ${baris('Order pertama')}, n: 6, sisi: 'k', jarak: 36 },
  { el: ${baris('Riwayat perubahan')}, n: 7, sisi: 'k', jarak: 36 }])`);
await simpan(page, 'd8-rincian-bawah', sh);
await hapusTanda(page);
await page.evaluate(() => document.querySelector('.sheet-kepala [data-tutup]').click());
await tunggu(300);

await page.evaluate(() => { [...document.querySelectorAll('.fc-baris')].find(b => b.dataset.kode === 'EEP73320001AB').click(); });
await tunggu(700);
await page.evaluate(() => { const b = document.querySelector('#sheetBadan'); b.scrollTop = b.scrollHeight; });
await tunggu(300);
await page.evaluate(() => __tandai([{ el: '#fcHargaIn', n: 1, sisi: 'k', jarak: 36 }, { el: '#fcHargaSimpan', n: 2, sisi: 'k', jarak: 36 }, { el: '#fcRiwayat', n: 3, sisi: 'k', jarak: 36 }]));
await simpan(page, 'd9-harga-manual', await sheetRect(page, 60));
await hapusTanda(page);
await page.evaluate(() => document.querySelector('.sheet-kepala [data-tutup]').click());
await tunggu(300);

const idx = await page.evaluate(() => [...document.querySelectorAll('.fc-baris')].findIndex(b => b.dataset.kode === 'EEP73320001AB'));
await page.evaluate(i => document.querySelectorAll('.fc-baris')[i].scrollIntoView({ block: 'center' }), idx);
await tunggu(300);
await page.evaluate(i => __tandai([{ el: document.querySelectorAll('.fc-baris')[i].querySelector('.fc-harga'), n: 1, sisi: 'a', jarak: 34 }]), idx);
const bm = pad(await rect(page, '.fc-baris', idx), 0);
const sy = await page.evaluate(() => window.scrollY);
await simpan(page, 'd10-baris-manual', { x: 250, y: Math.max(0, bm.y + sy - 50), width: 1030, height: bm.height + 90 });
await hapusTanda(page);

await page.evaluate(() => window.scrollTo(0, 0));
await page.evaluate(() => document.querySelector('#btnTambah').click());
await tunggu(500);
await page.type('#fcCariPart', 'rear');
await tunggu(400);
await page.evaluate(() => __tandai([{ el: '#fcCariPart', n: 1, sisi: 'k', jarak: 36 }, { el: '[data-tambah]', n: 2, sisi: 'k', jarak: 36 }]));
const st = await sheetRect(page, 60); st.height = Math.min(st.height, 420);
await simpan(page, 'd11-tambah', st);
await hapusTanda(page);
await page.evaluate(() => document.querySelector('.sheet-kepala [data-tutup]').click());
await page.close();

tambahan = { 'SVK73000031': { kode: 'SVK73000031', nama: 'REAR_PAD_KIT-BOTH_SIDES_RHD', oleh: 'budi.santoso@otoklix.com', waktu: '17-11-2026 15:40' } };
D.rows.push(['SVK73000031', 'REAR_PAD_KIT-BOTH_SIDES_RHD', 22, 25, 27, 24, 26, 11, 34, 8, 3, 'Tambahan', null, null]);
page = await buka(false);
await page.evaluate(() => { [...document.querySelectorAll('.fc-baris')].find(b => b.dataset.kode === 'SVK73000031').click(); });
await tunggu(700);
await page.evaluate(() => { const b = document.querySelector('#sheetBadan'); b.scrollTop = b.scrollHeight; });
await tunggu(300);
await page.evaluate(() => __tandai([{ el: '#fcHapusPart', n: 1, sisi: 'k', jarak: 36 }, { el: '#fcRiwayat', n: 2, sisi: 'k', jarak: 36 }]));
await simpan(page, 'd12-part-tambahan', await sheetRect(page, 60));
await page.close();

// ===== MOBILE =====
D.rows.pop(); tambahan = {};
page = await buka(true);
await page.evaluate(() => __tandai([{ el: '.appbar-aksi', n: 'A', sisi: 'b', jarak: 30 }, { el: '#fcKontrol', n: 'B', sisi: 'r', jarak: 0, dx: -20, dy: 0 }]));
await simpan(page, 'm1-atas');
await hapusTanda(page);
await page.evaluate(() => window.scrollTo(0, 520));
await tunggu(300);
await page.evaluate(() => __tandai([{ el: '.fc-tile-lebar', n: 'C', sisi: 'b', jarak: 0, dy: 0 }, { el: '.fc-baris', n: 'D', sisi: 'b', jarak: 0 }]));
await simpan(page, 'm2-kartu');
await page.close();
await browser.close(); srv.close();
console.log('selesai');
