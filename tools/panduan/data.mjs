// Data CONTOH untuk screenshot panduan (bukan data produksi, kecuali kode/nama 5 part yang sama dengan panduan sebelumnya)
const baris = (kode, nama, m, stok, lt, po, sumber, whs) => [kode, nama, ...m, stok, lt, po, sumber, whs, null];
const FM = 'Fast Move';
export const rows = [
  baris('EEP20032003', '12V_BATTERY', [40, 55, 70, 60, 63, 30], 0, 9.5, 8, FM, 1112300),
  baris('EEP30032001', '12V_BATTERY', [70, 82, 90, 78, 75, 41], 0, 8, 9, FM, 1105300),
  baris('SVK73000020', 'FRONT_PAD_KIT-BOTH_SIDES_RHD', [38, 44, 50, 45, 48, 20], 0, 7, 6, FM, 690900),
  baris('EEP73320001AB', 'LV_BATTERY_RHD', [49, 51, 55, 52, 57, 25], 36, 12, 4, FM, null),
  baris('PWT20000519AA', 'FAN', [18, 40, 54, 32, 21, 9], 0, 6, 11, FM, 1900500),
  baris('BRK10000412', 'REAR_PAD_KIT-BOTH_SIDES', [20, 24, 28, 25, 26, 12], 30, 7, 5, FM, 585000),
  baris('FLT30000118', 'CABIN_AIR_FILTER', [60, 66, 72, 70, 69, 31], 150, 5, 12, FM, 148000),
  baris('FLT30000124', 'OIL_FILTER_ASSY', [44, 41, 47, 50, 46, 22], 120, 5, 10, FM, 96500),
  baris('WPR40000207', 'WIPER_BLADE_SET', [30, 33, 35, 31, 34, 15], 90, 6, 7, FM, 212000),
  baris('SUS50000331', 'FRONT_SHOCK_ABSORBER_LH', [10, 12, 14, 11, 13, 5], 18, 14, 3, FM, 1450000),
  baris('SUS50000332', 'FRONT_SHOCK_ABSORBER_RH', [9, 12, 13, 12, 12, 6], 20, 14, 3, FM, 1450000),
  baris('LMP60000045', 'HEADLAMP_BULB_LED', [16, 18, 17, 19, 18, 8], 70, 4, 6, FM, 189000),
  baris('BRK10000419', 'BRAKE_DISC_FRONT', [14, 15, 16, 15, 16, 7], 40, 9, 5, FM, 735000),
  baris('COL70000088', 'COOLANT_5L', [25, 28, 30, 29, 27, 13], 200, 3, 14, FM, 128000),
];
export const bulan = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
export const hargaManual = { 'EEP73320001AB': 960000 };
export const hargaInfo = { 'EEP73320001AB': { oleh: 'ani.pratama@otoklix.com', waktu: '17-11-2026 14:32' } };
const ks = (c, k, d, bal) => [c, k, d, 0, 0, 0, 0, bal, '', '', '', null, 0];
export const ksRows = [
  ...rows.map(r => ks('CINERE', r[0], r[1], r[8])),
  ks('CINERE', 'SVK73000031', 'REAR_PAD_KIT-BOTH_SIDES_RHD', 24),
  ks('CINERE', 'BAT90000012', 'AUX_BATTERY_12V_60AH', 7),
  ks('DEPOK', 'SVK73000031', 'REAR_PAD_KIT-BOTH_SIDES_RHD', 10),
  ks('DEPOK', 'SPK80000003', 'SPARK_PLUG_SET', 33),
  ks('DAAN MOGOT', 'TYR11000051', 'TYRE_VALVE_KIT', 80),
  ks('DAAN MOGOT', 'GSK12000009', 'ENGINE_OIL_DRAIN_GASKET', 220),
];
export const forecast = { rows, bulan, update: '17-11-2026 16:05', hargaManual, hargaInfo, tambahan: {} };
export const riwayat = {
  'EEP73320001AB': [
    { waktu: '17-11-2026 14:32', email: 'ani.pratama@otoklix.com', aksi: 'Harga', lama: 940000, baru: 960000 },
    { waktu: '16-11-2026 09:10', email: 'budi.santoso@otoklix.com', aksi: 'Harga', lama: 0, baru: 940000 },
  ],
  'SVK73000031': [
    { waktu: '17-11-2026 15:40', email: 'budi.santoso@otoklix.com', aksi: 'Tambah part', lama: null, baru: null },
  ],
};
