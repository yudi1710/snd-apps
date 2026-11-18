import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire((process.env.PUPPETEER_DIR || 'C:/Users/Akbar Riyadi/Downloads/stockbot/stock-bot') + '/package.json');
const puppeteer = require('puppeteer-core');
import * as D from './data.mjs';
const SP = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(SP, 'Panduan-Forecast-Cinere.pdf');
const img = n => 'data:image/png;base64,' + fs.readFileSync(path.join(SP, 'img', n + '.png')).toString('base64');
const logo = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(SP, '../../icons/favicon.svg')).toString('base64');
const VERSI = /versi: '([^']+)'/.exec(fs.readFileSync(path.join(SP, '../../js/config.js'), 'utf8'))[1];
const fmt = n => Number(n).toLocaleString('id-ID');

// ---- data contoh untuk tabel cuplikan Excel (rumus sama dengan aplikasi: 2 shift, pengaman 30%) ----
const hitung = r => {
  const base = (r[4] + r[5] + r[6]) / 3, fc = base * 2, lt = r[9], stok = r[8];
  const target = Math.ceil(fc + fc / 26 * lt * 1.3), order = Math.max(0, target - stok);
  const harga = r[12] || (D.hargaManual[r[0]] || null);
  return { kode: r[0], nama: r[1], fc, target, stok, order, harga, total: harga ? order * harga : null, manual: !r[12] && !!harga };
};
const cuplikan = D.rows.map(hitung).sort((a, b) => b.order - a.order).slice(0, 5);

let no = 0;
const gambar = (n, teks, maks) => `<figure><img src="${img(n)}"${maks ? ` style="max-height:${maks}mm"` : ''}><figcaption>Gambar ${++no}. ${teks}</figcaption></figure>`;
const leg = items => `<ol class="leg">${items.map((t, i) => `<li><span class="no">${typeof t === 'object' ? t[0] : i + 1}</span><div>${typeof t === 'object' ? t[1] : t}</div></li>`).join('')}</ol>`;
const tips = (judul, isi, kelas = '') => `<div class="kotak ${kelas}"><b>${judul}</b> ${isi}</div>`;
const langkah = (n, judul, sub) => `<div class="judul-langkah"><span class="bulat">${n}</span><div><h2>${judul}</h2><p class="sub">${sub}</p></div></div>`;
let hal = 0;
const halaman = isi => `<section class="halaman"><header><span>Panduan Forecast Cinere</span><span>SND Apps</span></header><div class="isi">${isi}</div><footer><span>Gambar memakai data contoh dari aplikasi SND Apps v${VERSI}</span><span>${++hal + 1}</span></footer></section>`;

const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; font: 10.5pt/1.5 'Segoe UI', Arial, sans-serif; color: #14142B }
.halaman { width: 210mm; height: 297mm; padding: 16mm 17mm 18mm; position: relative; page-break-after: always; overflow: hidden }
.halaman header { display: flex; justify-content: space-between; font-size: 8.5pt; color: #6E7191; border-bottom: 1px solid #E1E5F0; padding-bottom: 5px; margin-bottom: 14px }
.halaman footer { position: absolute; left: 17mm; right: 17mm; bottom: 9mm; display: flex; justify-content: space-between; font-size: 8pt; color: #8A8FA8 }
h1 { font-size: 30pt; color: #002EB4; margin: 0 0 8px; line-height: 1.1 }
h2 { font-size: 17pt; margin: 0; color: #14142B }
h3 { font-size: 11.5pt; color: #002EB4; margin: 14px 0 5px }
.sub { margin: 2px 0 0; color: #6E7191; font-size: 10pt }
.judul-langkah { display: flex; gap: 12px; align-items: center; margin-bottom: 12px }
.bulat { flex: none; width: 38px; height: 38px; border-radius: 50%; background: #002EB4; color: #fff; font: 700 17pt/38px Arial; text-align: center }
figure { margin: 10px 0; text-align: center } figure img { max-width: 100%; border: 1px solid #D5DAEA; border-radius: 6px }
figcaption { font-size: 8.5pt; color: #6E7191; margin-top: 4px }
.leg { list-style: none; padding: 0; margin: 8px 0 } .leg li { display: flex; gap: 9px; margin: 5px 0; align-items: flex-start }
.no { flex: none; width: 20px; height: 20px; border-radius: 50%; background: #E5342E; color: #fff; font: 700 9pt/20px Arial; text-align: center; margin-top: 1px }
.kotak { border-left: 4px solid #002EB4; background: #F1F4FD; padding: 7px 11px; margin: 9px 0; border-radius: 4px; font-size: 10pt }
.kotak.awas { border-color: #E8A33D; background: #FFF7E8 } .kotak.merah { border-color: #E5342E; background: #FDEEEE }
table { border-collapse: collapse; width: 100%; font-size: 9.2pt; margin: 6px 0 } th { background: #002EB4; color: #fff; text-align: left; padding: 5px 7px } td { border-bottom: 1px solid #E1E5F0; padding: 5px 7px; vertical-align: top }
td.r, th.r { text-align: right }
.rumus { border: 1px solid #D5DAEA; border-radius: 6px; padding: 7px 11px; margin: 7px 0 } .rumus b { color: #002EB4; font-size: 9pt; letter-spacing: .04em }
.panah { text-align: center; color: #002EB4; font-size: 13pt; line-height: 1 }
.alur { display: flex; gap: 6px; margin: 10px 0 } .alur div { flex: 1; text-align: center; font-size: 8.8pt } .alur .bulat { width: 30px; height: 30px; font-size: 13pt; line-height: 30px; margin: 0 auto 4px }
.sampul { display: flex; flex-direction: column; justify-content: center; height: 100%; padding-bottom: 40mm }
.sampul img { width: 70px; margin-bottom: 18px } .sampul p { font-size: 13pt; color: #3A3D5C; max-width: 140mm }
.tanya { margin: 8px 0 } .tanya b { display: block; color: #002EB4 } ul { margin: 4px 0; padding-left: 18px } .cek li { list-style: '☐  ' }
</style></head><body>

<section class="halaman"><div class="sampul"><img src="${logo}"><h1>Panduan<br>Forecast Cinere</h1>
<p>Cara menghitung kebutuhan part Fast Move Cinere untuk skenario 1 atau 2 shift, lengkap dengan saran order, harga, part tambahan, dan file Excel, langkah demi langkah di SND Apps.</p>
<p style="font-size:10.5pt;color:#6E7191;margin-top:30px">Tim Supply &amp; Demand (SND) &nbsp;·&nbsp; Diperbarui 17 November 2026 (SND Apps v${VERSI})</p></div></section>

${halaman(`<h2>Sebelum mulai</h2>
<p>Halaman Forecast Cinere di SND Apps membantu menjawab satu pertanyaan: kalau jam kerja Cinere ditambah, berapa pcs tiap part yang perlu dipesan ke VinFast, dan berapa nilainya? Hasilnya bisa dilihat di layar dan diunduh sebagai file Excel.</p>
<h3>Yang perlu disiapkan</h3><ul><li>Akun Google <b>@otoklix.com</b> (hanya akun ini yang bisa masuk).</li><li>SND Apps di browser (<b>snd.ryukakirin.me</b>) atau aplikasi SND di HP Android.</li><li>Koneksi internet. Sinkron data butuh sampai sekitar satu menit.</li></ul>
<h3>Alur singkat: 9 langkah sampai jadi</h3>
<div class="alur">${['Buka menu Forecast', 'Sinkron data', 'Pilih shift &amp; pengaman', 'Baca ringkasan &amp; tabel', 'Lihat rincian part', 'Isi harga manual', 'Tambah part dari KS', 'Keluarkan part dari order', 'Unduh Excel'].map((t, i) => `<div><span class="bulat">${i + 1}</span>${t}</div>`).join('')}</div>
${tips('Yang baru di versi ini:', 'kolom <b>Harga satuan</b> di samping Order 2, harga manual yang <b>tercatat siapa yang mengisi</b> beserta riwayatnya, tombol <b>+</b> untuk menambah part dari KS, <b>mengeluarkan part yang tidak akan di-order</b>, dan kolom baru di Excel.')}
<h3>Daftar isi</h3>
<table><tbody>${[['Langkah 1: Membuka menu Forecast Cinere', 3], ['Langkah 2: Sinkron data dari MRP Cinere', 4], ['Langkah 3: Memilih jumlah shift dan stok pengaman', '5 - 6'], ['Langkah 4: Membaca ringkasan dan tabel', 7], ['Langkah 5: Melihat rincian satu part', 8], ['Langkah 6: Mengisi harga manual dan melihat riwayat', 9], ['Langkah 7: Menambah part dari KS', 10], ['Langkah 8: Mengeluarkan part dari order', 11], ['Langkah 9: Mengunduh Excel', 12], ['Cara hitung dan contoh angka', '13 - 14'], ['Memakai dari HP', 15], ['Pertanyaan dan masalah yang sering muncul', 16], ['Daftar periksa setiap kali membuat forecast', 17]].map(([a, b]) => `<tr><td>${a}</td><td class="r" style="width:60px">${b}</td></tr>`).join('')}</tbody></table>
${tips('Catatan:', 'gambar di panduan ini diambil dari aplikasi asli dengan <b>data contoh</b> (kode part dan angka tidak sama persis dengan data kamu). Angka di layar kamu akan berbeda tergantung tanggal sinkron dan pengaturan yang dipilih.', 'awas')}`)}

${halaman(`${langkah(1, 'Buka menu Forecast Cinere', 'Dari menu samping (komputer) atau menu bawah (HP)')}
<p>Masuk ke SND Apps dengan akun Google @otoklix.com. Di menu sebelah kiri pilih <b>Forecast Cinere</b> (ikon grafik batang di urutan paling bawah). Di HP, tombolnya ada di bar bawah dengan nama <b>Forecast</b>.</p>
${gambar('d1-menu', 'Menu Forecast Cinere di sisi kiri layar.')}
${leg(['Klik <b>Forecast Cinere</b>. Menu yang aktif ditandai warna biru muda.'])}
<p>Setelah terbuka, bagian atas halaman menampilkan waktu pemakaian terakhir disinkron (di bawah judul), waktu stok KS yang dipakai, dan empat tombol di pojok kanan atas yang dijelaskan di langkah berikutnya.</p>
${tips('Tips:', 'kalau halaman menampilkan tulisan "Data forecast belum ada", artinya sinkron belum pernah dijalankan. Langsung ke Langkah 2.')}`)}

${halaman(`${langkah(2, 'Sinkron data dari MRP Cinere', 'Lakukan setiap kali mau membuat forecast baru, misalnya di awal bulan')}
<p>Sinkron membaca ulang MRP Cinere supaya hitungan memakai data terbaru. Yang dibaca: pemakaian per bulan (tab Outgoing Part), lead time dan harga beli (tab Incoming Part), daftar part Fast Move (tab Moving), serta part tambahan yang sudah kamu pilih.</p>
${gambar('d2-tombol', 'Empat tombol di pojok kanan atas halaman.')}
${leg(['<b>Tambah part</b> (ikon plus). Memilih part dari KS untuk ikut diforecast, dijelaskan di Langkah 7.', '<b>Sinkron</b> (ikon dua panah melingkar). Tekan satu kali, lalu tunggu.', '<b>Panduan</b> (ikon lembar dokumen). Membuka ringkasan cara kerja di dalam aplikasi.', '<b>Unduh Excel</b> (ikon panah ke bawah). Dipakai di Langkah 9.'])}
<h3>Yang terjadi setelah menekan Sinkron</h3>
${gambar('d3a-toast-jalan', 'Saat berjalan muncul pesan di bagian bawah layar. Tombol sinkron tidak bisa ditekan lagi selama proses berjalan.')}
${gambar('d3b-toast-selesai', 'Saat selesai muncul "Sinkron selesai" dan tabel otomatis diperbarui.')}
${tips('Jangan tutup halaman', 'selama proses berjalan (bisa sampai satu menit). Kalau muncul "Sinkron lain sedang berjalan", tunggu sebentar lalu coba lagi. Kalau gagal, data lama tetap tampil.', 'awas')}
${tips('Stok tidak perlu disinkron.', 'Stok selalu diambil langsung dari menu Monitoring MRP All KS setiap halaman dibuka. Yang disinkron hanya pemakaian, lead time, harga, dan daftar part.')}`)}

${halaman(`${langkah(3, 'Pilih jumlah shift dan stok pengaman', 'Dua pilihan inilah yang menentukan hasil forecast')}
${gambar('d4-skenario', 'Kartu Skenario di bagian atas halaman.')}
${leg(['<b>Jumlah shift.</b> Pilih salah satu tombol.', '<b>Stok pengaman.</b> Pilih salah satu tombol.', '<b>Pengaturan lanjutan.</b> Klik untuk membuka, jarang perlu diubah.'])}
<table><thead><tr><th>Jumlah shift</th><th></th><th>Stok pengaman</th><th></th></tr></thead><tbody>
<tr><td><b>1 shift</b></td><td>Pemakaian apa adanya (kondisi sekarang).</td><td><b>Tipis 15%</b></td><td>Stok diketatkan, risiko kehabisan lebih besar.</td></tr>
<tr><td><b>2 shift</b></td><td>Pemakaian naik 100%, jadi dua kali lipat.</td><td><b>Normal 30%</b></td><td>Pilihan standar.</td></tr>
<tr><td><b>Atur sendiri</b></td><td>Isi sendiri persen kenaikannya. 0% = 1 shift, 50% = 1,5 kali, 100% = 2 shift.</td><td><b>Aman 50%</b></td><td>Lebih tahan kalau VinFast telat.</td></tr></tbody></table>
<p>Angka pengaman adalah persen dari lead time part itu. Contoh 30%: lead time 20 hari dapat pengaman 6 hari, lead time 2 hari dapat 0,6 hari.</p>`)}

${halaman(`${langkah(3, 'Pilih jumlah shift dan stok pengaman (lanjutan)', 'Opsi "Atur sendiri" dan Pengaturan lanjutan')}
${gambar('d5-lanjutan', 'Kolom kenaikan persen dan pengaturan lanjutan.')}
${leg(['Isi persen kenaikan pemakaian dari 1 shift.', 'Lead time bila belum ada riwayat PO (bawaan 7 hari). Dipakai untuk part yang belum pernah di-PO.', 'Cara hitung baseline: <b>Rata-rata 3 bulan</b> (standar) atau <b>Median 3 bulan</b> yang tidak ikut tertarik lonjakan sekali jalan.'])}
${tips('Kapan memakai Median?', 'Kalau pemakaian satu part sangat naik-turun, misalnya 240 pcs di satu bulan lalu 3 dan 0, rata-rata jadi terlalu besar. Median mengambil nilai tengah sehingga lebih realistis. Cek juga rincian bulanan part itu.')}
${tips('Pilihan di halaman ini', 'tersimpan otomatis di perangkat kamu dan dipakai lagi saat halaman dibuka berikutnya.')}`)}

${halaman(`${langkah(4, 'Baca ringkasan dan tabel', 'Hasil langsung berubah setiap kali pilihan di Langkah 3 diganti')}
${gambar('d6-tabel', 'Kartu ringkasan dan tabel part. Tabel diurutkan dari part yang paling perlu order.')}
${leg([
  'Kartu ringkasan: jumlah part, total pemakaian 1 shift per bulan, total hasil skenario per bulan, jumlah part yang perlu order, dan estimasi nilai order beserta nilai Order 1 dan Order 2.',
  '<b>1 shift</b>: pemakaian rata-rata per bulan (baseline) dari tiga bulan penuh terakhir.',
  '<b>Skenario</b>: perkiraan pemakaian per bulan sesuai shift yang dipilih.',
  '<b>Stok</b>: balance KS Cinere saat ini. Merah kalau 0.',
  '<b>Saran order</b>: total pcs yang perlu dipesan. Tulisan "Cukup" kalau stok sudah memadai.',
  '<b>Order 1</b>: tahap pemesanan pertama (separuh saran order, dibulatkan ke atas). Angka kecil di bawahnya nilai Rp.',
  '<b>Order 2</b>: tahap kedua (sisanya). Order 1 + Order 2 = Saran order.',
  '<b>Harga satuan</b>: harga per pcs. Tanda pensil berarti harga diisi manual. Tulisan "isi harga" berarti belum ada harga.',
  '<b>Total (Rp)</b>: saran order × harga satuan.'])}
${tips('Tanda strip (–)', 'di kolom Order atau Total berarti tidak ada order, atau part itu belum punya harga. Jumlah part tanpa harga tertulis di kartu estimasi nilai order. Cara mengisinya ada di Langkah 6.')}`)}

${halaman(`${langkah(5, 'Lihat rincian satu part', 'Klik baris part mana saja di tabel')}
<p>Rincian menunjukkan bagaimana angka satu part didapat, dari pemakaian tiap bulan sampai saran order dan harga. Tutup dengan tombol silang di pojok kanan atas jendela.</p>
<div style="display:flex;gap:12px;align-items:flex-start">
<div style="flex:1">${gambar("d7-rincian", "Bagian atas rincian part PWT20000519AA (FAN).", 118)}</div>
<div style="flex:1">${gambar("d8-rincian-bawah", "Bagian bawah rincian: saran order, harga, Order pertama dan kedua, riwayat.", 118)}</div></div>
${leg([
"<b>Pemakaian tiap bulan</b> dan baseline dari tiga bulan penuh terakhir. Bulan bertanda * tidak ikut dihitung (terlalu lama, atau bulan berjalan yang belum penuh).",
"<b>Lead time</b> rata-rata dari riwayat PO VinFast, beserta jumlah PO yang jadi dasarnya.",
"<b>Target stok</b>: stok yang seharusnya dimiliki.",
"<b>Stok Cinere</b> juga menulis cukup berapa hari kerja, berguna untuk menilai seberapa mendesak sebuah part.",
"<b>Saran order</b>: target dikurangi stok sekarang.",
"<b>Order pertama dan kedua</b> beserta nilai Rp masing-masing.",
"<b>Riwayat perubahan</b>: siapa mengubah harga atau menambah part (Langkah 6 dan 7)."])}`)}
${halaman(`${langkah(6, 'Isi harga manual dan lihat riwayat', 'Untuk part yang belum pernah di-PO sehingga belum punya harga')}
<p>Part yang belum punya harga PO ditandai <b>isi harga</b> di kolom Harga satuan. Siapa saja yang login boleh mengisi atau mengubah harga, dan setiap perubahan <b>tercatat</b>: siapa, kapan, dari berapa ke berapa.</p>
${gambar('d9-harga-manual', 'Rincian part dengan harga manual dan riwayat perubahannya.', 95)}
${leg(['Isi <b>Harga manual / pcs (Rp)</b> dengan angka saja, tanpa titik.', 'Klik <b>Simpan harga</b>. Total order dan estimasi nilai langsung ikut terhitung. Tombol <b>Hapus</b> mengosongkan harga manual.', '<b>Riwayat perubahan</b>: daftar siapa mengubah harga, kapan, dan dari berapa ke berapa (terbaru di atas, maksimal 30).'])}
<h3>Hasil di tabel</h3>
${gambar('d10-baris-manual', 'Part dengan harga manual muncul di kolom Harga satuan, ditandai pensil.', 36)}
${leg(['Harga manual ditandai <b>pensil</b>. Semua pengguna melihat harga yang sama, dan harga ini tidak hilang saat Sinkron.'])}
${tips('Harga PO selalu menang.', 'Begitu part itu sudah pernah di-PO, harga dari PO terakhir (tab Incoming Part) otomatis dipakai menggantikan harga manual.')}`)}

${halaman(`${langkah(7, 'Tambah part dari KS', 'Untuk part di luar daftar Fast Move yang ingin ikut diforecast')}
<p>Secara bawaan forecast hanya memuat part berlabel Fast Move di tab Moving. Part lain bisa ditambahkan sendiri, tanpa mengetik ulang kode dan nama, karena dipilih dari daftar KS semua cabang.</p>
${gambar('d11-tambah', 'Jendela Tambah part ke forecast, dengan kolom pencarian.', 45)}
${leg(['Ketik sebagian <b>kode atau nama part</b>. Part yang sudah ada di forecast tidak ditampilkan.', 'Klik <b>part yang dimaksud</b>. Server membaca MRP Cinere lagi (bisa sampai satu menit), lalu pemakaian dan lead time part itu langsung terhitung.'])}
<p>Harga part tambahan mengikuti PO terakhir di Incoming Part Cinere. Kalau belum pernah di-PO, isi harga manual seperti di Langkah 6.</p>
<h3>Menghapus part tambahan</h3>
${gambar('d12-part-tambahan', 'Rincian part tambahan: ada nama yang menambahkan dan tombol Hapus dari forecast.', 85)}
${leg(['Klik <b>Hapus dari forecast</b> untuk mengeluarkan part tambahan. Part Fast Move tidak bisa dihapus dari sini.', 'Tambah dan hapus part juga tercatat di <b>Riwayat perubahan</b>.'])}
${tips('Batas:', 'maksimal 200 part tambahan. Part tambahan tetap ada setelah Sinkron.')}`)}

${halaman(`${langkah(8, 'Keluarkan part dari order', 'Untuk part yang tidak akan kamu order')}
<p>Tidak semua part di daftar perlu dipesan, misalnya stoknya sudah cukup atau sedang tidak dipakai. Part seperti itu bisa dikeluarkan supaya tidak ikut ringkasan, estimasi nilai order, dan Excel. Part tidak dihapus dan bisa dikembalikan kapan saja.</p>
${gambar('d13-keluarkan', 'Bagian Order part ini di rincian part.', 90)}
${leg(['Isi <b>alasan</b> (boleh dikosongkan), misalnya "stok cukup, tidak dipesan bulan ini".', 'Klik <b>Keluarkan dari order</b>. Part langsung hilang dari tabel dan dari hitungan.'])}
<h3>Mengembalikan part</h3>
${gambar('d14-dikeluarkan', 'Daftar Dikeluarkan dari order di bawah tabel.', 50)}
${leg(['Part yang dikeluarkan pindah ke daftar <b>Dikeluarkan dari order</b> di bawah tabel (klik judulnya untuk membuka), lengkap dengan siapa, kapan, dan alasannya.', 'Klik <b>Kembalikan</b> untuk memasukkan part itu lagi ke order.'])}
${tips('Berlaku untuk semua pengguna.', 'Daftar dikeluarkan sama untuk semua akun, tetap ada setelah Sinkron, dan setiap pengeluaran atau pengembalian tercatat di Riwayat perubahan. Kartu ringkasan "Part" menulis berapa part yang dikeluarkan.')}`)}

${halaman(`${langkah(9, 'Unduh Excel', 'Atur skenario dulu, baru unduh')}
<p>Tekan tombol <b>Unduh Excel</b> (panah ke bawah). Browser menyimpan file bernama <b>snd-forecast-cinere-(tanggal).xlsx</b>. Isi file mengikuti pengaturan yang sedang aktif di layar, jadi pilih shift dan stok pengaman yang diinginkan lebih dulu. Semua akun boleh mengunduh.</p>
${leg(['Klik tombol Unduh Excel (nomor 4 di Gambar 2). Muncul pesan "Mengunduh forecast ... part ke Excel".'])}
<h3>Isi file Excel (3 sheet, atau 4 kalau ada part yang dikeluarkan)</h3>
<table><tbody>
<tr><td style="width:90px"><b>Forecast</b></td><td>Semua part: pemakaian tiap bulan, baseline, forecast, lead time, pengaman, target stok, stok, saran order, harga, total, serta Order Pertama dan Kedua (pcs dan Rp). Di ujung kanan ada kolom <b>Sumber harga</b> (Manual / PO terakhir / Belum ada), <b>Harga diisi oleh</b> (siapa dan kapan, untuk harga manual), dan <b>Sumber part</b> (Fast Move / Tambahan).</td></tr>
<tr><td><b>Dikeluarkan</b></td><td>Hanya ada kalau ada part yang dikeluarkan dari order: kode, nama, alasan, siapa, dan kapan. Part ini tidak muncul di sheet Forecast.</td></tr>
<tr><td><b>Parameter</b></td><td>Pengaturan saat diunduh: skenario, pengali, stok pengaman, lead time bawaan, metode baseline, dan waktu data diperbarui.</td></tr>
<tr><td><b>Panduan</b></td><td>Ringkasan cara hitung di dalam file, supaya file bisa dibaca orang lain tanpa panduan ini.</td></tr></tbody></table>
<h3>Cuplikan sheet Forecast (sebagian kolom, data contoh)</h3>
<table><thead><tr><th>Kode Part</th><th>Nama Part</th><th class="r">Forecast/bln</th><th class="r">Target</th><th class="r">Stok</th><th class="r">Saran order</th><th class="r">Harga/pcs</th><th class="r">Total (Rp)</th></tr></thead><tbody>
${cuplikan.map(x => `<tr><td>${x.kode}</td><td>${x.nama}</td><td class="r">${(Math.round(x.fc * 10) / 10).toLocaleString('id-ID')}</td><td class="r">${x.target}</td><td class="r">${x.stok}</td><td class="r">${x.order}</td><td class="r">${x.harga ? fmt(x.harga) : ''}</td><td class="r">${x.total ? fmt(x.total) : ''}</td></tr>`).join('')}</tbody></table>
<p style="margin-top:8px">Angka di Excel berupa hasil hitung, bukan rumus. Kalau mau mengganti shift atau pengaman, ubah di aplikasi lalu unduh ulang. Pembagian Order Pertama dan Kedua otomatis 50:50; kalau perlu komposisi lain, ubah manual di Excel.</p>`)}

${halaman(`<h2>Cara hitung dan contoh angka</h2>
<p>Rumusnya berjalan dari atas ke bawah. Intinya: stok harus cukup untuk bertahan sampai barang baru datang (ditambah pengaman), lalu masih melayani satu bulan setelahnya.</p>
<div class="rumus"><b>1 · BASELINE (1 SHIFT)</b><br>rata-rata pemakaian 3 bulan penuh terakhir (retur / minus dihitung 0, bulan berjalan tidak ikut)</div><div class="panah">▼</div>
<div class="rumus"><b>2 · FORECAST PER BULAN</b><br>baseline × (1 + kenaikan%). 2 shift = baseline × 2</div><div class="panah">▼</div>
<div class="rumus"><b>3 · TARGET STOK</b><br>forecast 1 bulan + (forecast ÷ 26 hari kerja) × lead time × (1 + pengaman%)</div><div class="panah">▼</div>
<div class="rumus"><b>4 · SARAN ORDER</b><br>target stok − stok Cinere sekarang (minimal 0)</div><div class="panah">▼</div>
<div class="rumus"><b>5 · HARGA, TOTAL, DAN DUA TAHAP</b><br>total = saran order × harga satuan. Order 1 = saran order ÷ 2 (naik), Order 2 = sisanya</div>
<h3>Dari mana datanya?</h3>
<table><thead><tr><th>Data</th><th>Sumber</th><th>Diperbarui saat</th></tr></thead><tbody>
<tr><td>Pemakaian per bulan</td><td>Tab Outgoing Part di MRP Cinere</td><td>Tombol Sinkron</td></tr>
<tr><td>Lead time dan harga beli</td><td>Tab Incoming Part (tanggal PO dibuat, tanggal diterima, harga beli)</td><td>Tombol Sinkron</td></tr>
<tr><td>Daftar part</td><td>Part Fast Move di tab Moving (HANKOOK dan Massive/Massiv EV dikecualikan), ditambah part tambahan pilihan pengguna</td><td>Tombol Sinkron</td></tr>
<tr><td>Harga manual</td><td>Diisi pengguna di aplikasi, tersimpan di sheet monitor beserta riwayatnya</td><td>Saat disimpan</td></tr>
<tr><td>Stok Cinere</td><td>Balance di menu Monitoring MRP All KS (tab KS Cinere)</td><td>Setiap halaman dibuka</td></tr></tbody></table>`)}

${halaman(`<h2>Contoh angka</h2>
<p>Part PWT20000519AA (FAN), skenario 2 shift, stok pengaman Normal 30%. Setiap baris di bawah sama dengan yang tampil di rincian part dan di Excel.</p>
<table><thead><tr><th>Langkah</th><th>Perhitungan</th><th class="r">Hasil</th></tr></thead><tbody>
<tr><td>Pemakaian Agu · Sep · Okt (3 bulan penuh)</td><td></td><td class="r">54 · 32 · 21 pcs</td></tr>
<tr><td>Baseline 1 shift</td><td>(54 + 32 + 21) ÷ 3</td><td class="r">35,7 pcs/bulan</td></tr>
<tr><td>Forecast 2 shift</td><td>35,7 × 2</td><td class="r">71,3 pcs/bulan</td></tr>
<tr><td>Pemakaian per hari</td><td>71,3 ÷ 26 hari kerja</td><td class="r">2,74 pcs/hari</td></tr>
<tr><td>Lead time (riwayat 11 PO)</td><td>rata-rata PO dibuat → barang diterima</td><td class="r">6 hari</td></tr>
<tr><td>Stok pengaman 30%</td><td>6 hari × 30%</td><td class="r">1,8 hari</td></tr>
<tr><td>Kebutuhan sampai barang datang</td><td>2,74 × (6 + 1,8) hari</td><td class="r">21,4 pcs</td></tr>
<tr><td>Target stok</td><td>71,3 + 21,4 (dibulatkan ke atas)</td><td class="r">93 pcs</td></tr>
<tr><td>Stok Cinere (KS)</td><td>dari menu KS saat halaman dibuka</td><td class="r">0 pcs</td></tr>
<tr><td><b>Saran order</b></td><td>93 − 0</td><td class="r"><b>93 pcs</b></td></tr>
<tr><td>Harga satuan</td><td>harga beli PO terakhir</td><td class="r">Rp 1.900.500 / pcs</td></tr>
<tr><td>Total saran order</td><td>93 × 1.900.500</td><td class="r">Rp 176.746.500</td></tr>
<tr><td>Order 1 (pertama)</td><td>47 pcs × 1.900.500</td><td class="r">Rp 89.323.500</td></tr>
<tr><td>Order 2 (kedua)</td><td>46 pcs × 1.900.500</td><td class="r">Rp 87.423.000</td></tr></tbody></table>
<p>Harga satuan adalah harga beli sebelum pajak pada PO terakhir part tersebut. Untuk part tanpa PO, harga satuan adalah harga manual yang diisi di Langkah 6.</p>
${tips('Cara memeriksa sendiri:', 'buka rincian sebuah part di aplikasi, pilih 2 shift dan Normal 30%, lalu cocokkan angka-angkanya dengan tabel ini. Stok bisa berbeda kalau KS sudah berubah.')}`)}

${halaman(`<h2>Memakai dari HP</h2>
<p>Tampilan HP berisi hal yang sama dengan di komputer. Perbedaannya, tiap part tampil sebagai kartu, dan menu ada di bar bawah.</p>
<div style="display:flex;gap:14px;align-items:flex-start">
<div style="flex:1">${gambar('m1-atas', 'Halaman Forecast di HP, bagian atas.', 135)}</div>
<div style="flex:1">${gambar('m2-kartu', 'Setelah digulir: ringkasan dan kartu part.', 135)}</div></div>
${leg([['A', 'Tombol di bar atas: lonceng (notifikasi), Tambah part, Sinkron, Panduan, dan Unduh Excel, dengan fungsi yang sama seperti di komputer.'], ['B', 'Kartu Skenario: pilih shift dan stok pengaman dengan menyentuh tombolnya.'], ['C', 'Kartu ringkasan: jumlah part, pemakaian, jumlah yang perlu order, dan estimasi nilai.'], ['D', 'Kartu part: kode, nama, lalu angka berlabel (1 shift, Skenario, Stok, Saran order, Order 1, Order 2, Harga satuan, Total). Sentuh kartu untuk membuka rincian.']])}
${tips('File Excel dari HP', 'tersimpan di folder Unduhan. Buka lewat aplikasi Excel atau Google Sheets. Pengaturan (shift, pengaman, lead time bawaan) tersimpan di perangkat masing-masing, jadi di HP dan komputer bisa berbeda.')}`)}

${halaman(`<h2>Pertanyaan dan masalah yang sering muncul</h2>
<div class="tanya"><b>Apa maksud "Skenario"?</b>Perkiraan pemakaian per bulan kalau jumlah shift diubah sesuai pilihan di kartu Skenario. Kolom "1 shift" adalah pemakaian sekarang (kondisi nyata), sedangkan kolom "Skenario" adalah hasil pengandaian.</div>
<div class="tanya"><b>Kenapa saran order dibagi Order 1 dan Order 2?</b>Pemesanan dilakukan dua tahap. Order 1 separuh saran order (dibulatkan ke atas), Order 2 sisanya, sehingga Order 1 + Order 2 selalu sama dengan saran order. Pembagian otomatis 50:50; ubah manual di Excel bila perlu komposisi lain.</div>
<div class="tanya"><b>Siapa yang boleh mengubah harga?</b>Semua akun @otoklix.com. Setiap perubahan tercatat (siapa, kapan, dari berapa ke berapa) dan bisa dilihat di Riwayat perubahan pada rincian part.</div>
<div class="tanya"><b>Harga satuan tidak muncul / tertulis "isi harga".</b>Part itu belum pernah di-PO di MRP Cinere. Isi harga manual di rincian part (Langkah 6). Kalau harga PO yang biasanya ada ikut hilang, tekan Sinkron lagi dan muat ulang halaman.</div>
<div class="tanya"><b>Part yang saya cari tidak ada di daftar Tambah part.</b>Part sudah ada di forecast (Fast Move atau tambahan sebelumnya), atau tidak ada di data KS. Cek lewat menu Monitoring MRP All KS.</div>
<div class="tanya"><b>Tidak ada tombol untuk membuka sheet MRP.</b>Tautan ke spreadsheet hanya tampil untuk akun admin. Akun lain memang tidak menerima tautan sheet demi keamanan data. Semua yang dibutuhkan untuk forecast sudah ada di aplikasi dan di file Excel.</div>
<div class="tanya"><b>Part yang saya keluarkan hilang dari tabel.</b>Part itu pindah ke daftar "Dikeluarkan dari order" di bawah tabel. Klik judul daftarnya untuk membuka, lalu tekan Kembalikan di partnya. Daftar ini sama untuk semua pengguna dan tetap ada setelah Sinkron.</div>
<div class="tanya"><b>Halaman menulis "Data forecast belum ada".</b>Sinkron belum pernah dijalankan atau datanya kosong. Tekan Sinkron (atau "Sinkron sekarang") dan tunggu sampai muncul pesan selesai.</div>
<div class="tanya"><b>Sinkron gagal atau lama sekali.</b>Cek koneksi internet lalu tekan lagi. Kalau muncul "Sinkron lain sedang berjalan", tunggu sekitar satu menit. Data lama tetap bisa dipakai. Kalau terus gagal, kabari tim yang mengelola aplikasi.</div>
<div class="tanya"><b>Bulan depan, apa yang harus dilakukan?</b>Cukup tekan Sinkron lagi. Periode baseline bergeser sendiri ke tiga bulan penuh terakhir (Desember memakai September sampai November).</div>
<div class="tanya"><b>Stok terbaca 0 padahal barangnya ada.</b>Stok diambil dari kartu stok (KS) Cinere. Cek angkanya di menu Monitoring MRP All KS dan muat ulang. Kalau part tidak ada di KS Cinere, dipakai angka snapshot saat sinkron.</div>
<div class="tanya"><b>Tampilan belum berubah setelah ada pembaruan aplikasi.</b>Tutup lalu buka lagi aplikasinya (atau muat ulang halaman) supaya versi terbaru terbaca.</div>`)}

${halaman(`<h2>Daftar periksa setiap kali membuat forecast</h2>
<ul class="cek" style="font-size:11.5pt;line-height:1.9;margin-top:14px">
<li>Buka SND Apps dengan akun @otoklix.com dan pilih menu <b>Forecast Cinere</b>.</li>
<li>Tekan <b>Sinkron</b>, tunggu pesan "Sinkron selesai".</li>
<li>Kalau ada part yang perlu ikut diforecast, tekan <b>+</b> dan pilih dari KS.</li>
<li>Pilih <b>jumlah shift</b> dan <b>stok pengaman</b>.</li>
<li>Cek kartu ringkasan: berapa part perlu order, dan berapa part belum ada harga.</li>
<li>Untuk part yang menulis <b>isi harga</b>: klik barisnya, isi harga manual, <b>Simpan harga</b>.</li>
<li>Part yang tidak akan di-order: buka rinciannya, isi alasan, lalu <b>Keluarkan dari order</b>.</li>
<li>Buka rincian beberapa part terbesar, cocokkan pemakaian bulanan, lead time, dan stoknya.</li>
<li>Untuk part yang pemakaiannya naik-turun tajam, coba baseline <b>Median</b>.</li>
<li>Tekan <b>Unduh Excel</b> dan simpan file-nya.</li>
<li>Bagi pesanan jadi Order 1 dan Order 2 sesuai kebutuhan, lalu kirim ke VinFast.</li></ul>
${tips('Ingat:', 'forecast ini alat bantu perkiraan. Keputusan order tetap perlu dicek manual, terutama untuk part dengan pemakaian yang bergelombang.', 'awas')}`)}
</body></html>`;

fs.writeFileSync(path.join(SP, 'panduan.html'), html);
const browser = await puppeteer.launch({ executablePath: (process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'), headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
const lebih = await page.evaluate(() => [...document.querySelectorAll('.halaman')].map((h, i) => {
  const isi = h.querySelector('.isi'); const batas = h.clientHeight - 18 * 3.78 - 10;
  return isi ? { i: i + 1, tinggi: Math.round(isi.getBoundingClientRect().bottom - h.getBoundingClientRect().top), batas: Math.round(h.clientHeight - 14 * 3.78) } : { i: i + 1 };
}));
console.log(JSON.stringify(lebih.filter(x => x.tinggi > x.batas)));
await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log('ok', OUT);
