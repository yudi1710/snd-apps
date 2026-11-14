/** Halaman Beranda: sapaan + kartu akses cepat ke semua fitur yang terdaftar. */
(function () {
  const { esc, ikon, state } = App;

  function sapaan() {
    const j = new Date().getHours();
    return j < 4 ? 'Selamat malam' : j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam';
  }

  function render(el, ui) {
    const dariEmail = state.email ? state.email.split('@')[0].split(/[._-]/)[0] : '';
    const nama = state.nama ? state.nama.split(/\s+/)[0] : dariEmail;
    const sebut = nama ? nama[0].toUpperCase() + nama.slice(1) : 'tim SND';
    ui.setSub('Workspace Supply & Demand');
    const fitur = App.halaman().filter(h => h.id !== 'beranda');
    el.innerHTML = `
      <div class="salam"><h2>${sapaan()}, ${esc(sebut)} 👋</h2><p>Pilih menu untuk mulai bekerja.</p></div>
      <div class="menu-grid">
        ${fitur.map((h, i) => `
          <button type="button" class="menu-kartu" data-buka="${esc(h.id)}">
            <div class="menu-ikon ${i % 2 ? 'oranye' : ''}">${ikon[h.ikon] || ikon.monitor}</div>
            <div class="menu-judul">${esc(h.label)}</div>
            <div class="menu-desk">${esc(h.desk || '')}</div>
            <div class="tanda">${esc(h.tanda || 'Buka')} →</div>
          </button>`).join('')}
      </div>`;
    el.querySelectorAll('[data-buka]').forEach(b => b.addEventListener('click', () => App.buka(b.dataset.buka)));
  }

  App.daftar({ id: 'beranda', label: 'Beranda', pendek: 'Beranda', ikon: 'beranda', render });
})();
