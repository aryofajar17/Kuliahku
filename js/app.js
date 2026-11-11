/* KuliahKu — controller utama aplikasi */
'use strict';

const App = {
  state: { view: 'home', day: null, taskFilter: 'aktif', deferredPrompt: null, detail: null },
  _confirmResolve: null,
  _toastTimer: null,
  _dayKey: null,

  init() {
    Store.load();
    this._dayKey = dateKey();
    this.buildSwatches();
    this.bindNav();
    this.bindGlobal();
    this.bindForms();
    Notify.init();
    this.render();
    setInterval(() => this.tick(), 15000);

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.state.deferredPrompt = e;
      if (this.state.view === 'lainnya') this.render();
    });
  },

  /* ============ Navigasi & render ============ */

  goto(view) {
    this.state.view = view;
    $$('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    this.render();
    window.scrollTo({ top: 0 });
  },

  render() {
    this.renderHeader();
    if (this.state.view === 'home') renderHome();
    else if (this.state.view === 'jadwal') renderJadwal(this.state.day);
    else if (this.state.view === 'tugas') renderTugas();
    else renderLainnya();
    this.updateBadge();
  },

  renderHeader() {
    const active = Store.activeTasks().length;
    const titles = {
      home: ['Hari Ini', fmtDateID(new Date())],
      jadwal: ['Jadwal Kuliah', `${Store.data.classes.length} kelas per minggu`],
      tugas: ['Tugas', active ? `${active} tugas aktif` : 'Semua tugas beres ✨'],
      lainnya: ['Lainnya', 'Pengaturan, data & bantuan'],
    };
    const [t, s] = titles[this.state.view] || titles.home;
    $('#hdr-title').textContent = t;
    $('#hdr-sub').textContent = s;
  },

  updateBadge() {
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const n = Store.activeTasks().filter(t => new Date(t.due) < today0).length;
    const badge = $('#nav-tugas .nav-badge');
    badge.style.display = n ? 'flex' : 'none';
    badge.textContent = n > 9 ? '9+' : n;
  },

  tick() {
    Notify.check();
    const today = dateKey();
    if (today !== this._dayKey) { this._dayKey = today; this.render(); return; }
    if (this.state.view === 'home') { renderHome(); this.updateBadge(); }
  },

  /* ============ Binding event ============ */

  bindNav() {
    $$('.bottom-nav button').forEach(b =>
      b.addEventListener('click', () => this.goto(b.dataset.view)));
  },

  bindGlobal() {
    document.addEventListener('click', (e) => {
      const t = e.target;

      const nav = t.closest('[data-nav]');
      if (nav) { this.goto(nav.dataset.nav); return; }

      const fab = t.closest('#fab');
      if (fab) { this.openSheet('modal-quickadd'); return; }

      const toggle = t.closest('[data-toggle-task]');
      if (toggle) {
        Store.toggleTask(toggle.dataset.toggleTask);
        this.toast(Store.getTask(toggle.dataset.toggleTask)?.done ? 'Tugas selesai 🎉' : 'Tugas dibuka kembali');
        this.render();
        return;
      }

      const swatch = t.closest('.swatch');
      if (swatch) { this.selectSwatch(swatch.dataset.color); return; }

      const dayBtn = t.closest('[data-day]');
      if (dayBtn) { renderJadwal(+dayBtn.dataset.day); return; }

      const filter = t.closest('[data-filter]');
      if (filter) { this.state.taskFilter = filter.dataset.filter; renderTugas(); return; }

      const cls = t.closest('[data-class]');
      if (cls) { this.openClassDetail(cls.dataset.class); return; }

      const task = t.closest('[data-task]');
      if (task) { this.openTaskDetail(task.dataset.task); return; }

      const act = t.closest('[data-action]');
      if (act) { this.handleAction(act.dataset.action); return; }

      if (t.classList && t.classList.contains('modal-overlay')) this.closeSheet(t.id);
    });

    document.addEventListener('change', async (e) => {
      if (e.target.id === 'tg-notify') {
        const ok = await Notify.toggle(e.target.checked);
        e.target.checked = ok;
        if (this.state.view === 'lainnya') this.render();
      }
      if (e.target.id === 'sel-reminder') {
        Store.data.settings.reminderMinutes = +e.target.value;
        Store.save();
        this.toast(`Pengingat diatur ${e.target.value} menit sebelum kelas`);
      }
    });
  },

  bindForms() {
    $('#form-class').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const name = f.elements.name.value.trim();
      const day = +f.elements.day.value;
      const start = f.elements.start.value;
      const end = f.elements.end.value;
      if (!name) return this.toast('Nama matkul wajib diisi', 'err');
      if (!start || !end) return this.toast('Jam mulai & selesai wajib diisi', 'err');
      if (minutesOf(end) <= minutesOf(start)) return this.toast('Jam selesai harus setelah jam mulai', 'err');
      const color = $('#swatches .swatch.active')?.dataset.color || Store.nextColor();
      const data = { name, day, start, end, room: f.elements.room.value.trim(), lecturer: f.elements.lecturer.value.trim(), color };
      if (f.dataset.editId) {
        data.id = f.dataset.editId;
        Store.updateClass(data);
        this.toast('Kelas diperbarui ✓');
      } else {
        Store.addClass(data);
        this.toast('Kelas ditambahkan ✓');
      }
      this.closeSheet('modal-class');
      if (this.state.view === 'jadwal') this.state.day = day;
      this.render();
    });

    $('#form-task').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const title = f.elements.title.value.trim();
      const dueDate = f.elements.dueDate.value;
      if (!title) return this.toast('Judul tugas wajib diisi', 'err');
      if (!dueDate) return this.toast('Tanggal tenggat wajib diisi', 'err');
      const dueTime = f.elements.dueTime.value || '23:59';
      const data = {
        title,
        courseId: f.elements.courseId.value || null,
        due: `${dueDate}T${dueTime}`,
        notes: f.elements.notes.value.trim(),
        done: false,
      };
      if (f.dataset.editId) {
        data.id = f.dataset.editId;
        const old = Store.getTask(data.id);
        data.done = old ? old.done : false;
        data.createdAt = old ? old.createdAt : new Date().toISOString();
        Store.updateTask(data);
        this.toast('Tugas diperbarui ✓');
      } else {
        Store.addTask(data);
        this.toast('Tugas ditambahkan ✓');
      }
      this.closeSheet('modal-task');
      this.render();
    });

    $('#file-import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      this.toast('Membaca file…');
      try {
        this.showImportPreview(await Importer.readFile(file));
      } catch (err) {
        console.error(err);
        this.toast(err.message || 'Gagal membaca file', 'err');
      }
    });

    $('#file-restore').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        if (await this.confirm('Pulihkan backup? Data saat ini akan DIGANTI dengan isi backup.', 'Pulihkan', true)) {
          Store.replaceAll(text);
          this.state.day = null;
          this.toast('Backup berhasil dipulihkan ✓');
          this.render();
        }
      } catch (err) {
        this.toast(err.message || 'File backup tidak valid', 'err');
      }
    });
  },

  /* ============ Aksi global ============ */

  async handleAction(action) {
    switch (action) {
      case 'add-class': this.closeAllSheets(); this.openClassForm(); break;
      case 'add-task': this.closeAllSheets(); this.openTaskForm(); break;
      case 'close': this.closeAllSheets(); break;

      case 'edit-class': {
        const c = Store.getClass(this.state.detail);
        this.closeAllSheets();
        if (c) this.openClassForm(c);
        break;
      }
      case 'del-class': {
        const c = Store.getClass(this.state.detail);
        this.closeAllSheets();
        if (c && await this.confirm(`Hapus kelas "${c.name}"?`, 'Hapus', true)) {
          Store.deleteClass(c.id);
          this.toast('Kelas dihapus');
          this.render();
        }
        break;
      }
      case 'edit-task': {
        const t = Store.getTask(this.state.detail);
        this.closeAllSheets();
        if (t) this.openTaskForm(t);
        break;
      }
      case 'del-task': {
        const t = Store.getTask(this.state.detail);
        this.closeAllSheets();
        if (t && await this.confirm(`Hapus tugas "${t.title}"?`, 'Hapus', true)) {
          Store.deleteTask(t.id);
          this.toast('Tugas dihapus');
          this.render();
        }
        break;
      }
      case 'toggle-task-detail': {
        const t = Store.toggleTask(this.state.detail);
        this.closeAllSheets();
        this.toast(t?.done ? 'Tugas selesai 🎉' : 'Tugas dibuka kembali');
        this.render();
        break;
      }

      case 'import': $('#file-import').click(); break;
      case 'export-csv':
        if (!Store.data.classes.length) return this.toast('Belum ada jadwal untuk diekspor', 'err');
        Importer.exportCSV();
        this.toast('Jadwal diekspor ke CSV');
        break;
      case 'download-sample':
        fetch('sample-jadwal.csv')
          .then(r => r.text())
          .then(t => downloadFile('contoh-jadwal.csv', t, 'text/csv'));
        this.toast('Contoh CSV diunduh');
        break;
      case 'backup':
        downloadFile(`backup-kuliahku-${dateKey()}.json`, Store.exportBackup(), 'application/json');
        this.toast('Backup diunduh');
        break;
      case 'restore': $('#file-restore').click(); break;

      case 'test-notify':
        if (!Notify.enabled()) return this.toast('Aktifkan dulu toggle notifikasinya', 'err');
        Notify.show('📣 Uji notifikasi', 'Notifikasi KuliahKu berfungsi dengan baik!', 'test-' + Date.now());
        break;

      case 'install': await this.promptInstall(); break;
      case 'how-install': this.showInstallGuide(); break;

      case 'reset':
        if (await this.confirm('Hapus SEMUA data? Jadwal & tugas akan hilang permanen.', 'Ya, hapus semua', true)) {
          Store.resetAll();
          this.state.day = null;
          this.toast('Semua data dihapus');
          this.render();
        }
        break;

      case 'confirm-import': Importer.commitPending(); break;
      case 'confirm-ok':
        $('#modal-confirm').classList.remove('open');
        if (this._confirmResolve) { this._confirmResolve(true); this._confirmResolve = null; }
        break;
      case 'confirm-cancel':
        $('#modal-confirm').classList.remove('open');
        if (this._confirmResolve) { this._confirmResolve(false); this._confirmResolve = null; }
        break;
    }
  },

  /* ============ Modal / sheet ============ */

  openSheet(id) { $('#' + id).classList.add('open'); },
  closeSheet(id) { $('#' + id).classList.remove('open'); },
  closeAllSheets() { $$('.modal-overlay.open').forEach(m => m.classList.remove('open')); },

  buildSwatches() {
    $('#swatches').innerHTML = PALETTE.map(p =>
      `<button type="button" class="swatch" data-color="${p}" style="background:${p}" aria-label="pilih warna">✓</button>`).join('');
  },

  selectSwatch(color) {
    $$('#swatches .swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
  },

  openClassForm(c = null) {
    const f = $('#form-class');
    f.dataset.editId = c?.id || '';
    $('#class-modal-title').textContent = c ? 'Edit Kelas' : 'Tambah Kelas';
    f.elements.name.value = c?.name || '';
    f.elements.day.value = c?.day ?? (this.state.view === 'jadwal' && this.state.day != null ? this.state.day : dayIdxToday());
    f.elements.start.value = c?.start || '08:00';
    f.elements.end.value = c?.end || '10:00';
    f.elements.room.value = c?.room || '';
    f.elements.lecturer.value = c?.lecturer || '';
    this.selectSwatch(c?.color || Store.nextColor());
    this.openSheet('modal-class');
    setTimeout(() => f.elements.name.focus(), 250);
  },

  openTaskForm(t = null) {
    const f = $('#form-task');
    f.dataset.editId = t?.id || '';
    $('#task-modal-title').textContent = t ? 'Edit Tugas' : 'Tambah Tugas';
    f.elements.title.value = t?.title || '';
    const sel = f.elements.courseId;
    sel.innerHTML = '<option value="">— Tanpa matkul —</option>' +
      Store.data.classes.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
    sel.value = t?.courseId || '';
    if (t) {
      const d = new Date(t.due);
      f.elements.dueDate.value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      f.elements.dueTime.value = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    } else {
      f.elements.dueDate.value = dateKey();
      f.elements.dueTime.value = '23:59';
    }
    f.elements.notes.value = t?.notes || '';
    this.openSheet('modal-task');
    setTimeout(() => f.elements.title.focus(), 250);
  },

  openClassDetail(id) {
    const c = Store.getClass(id);
    if (!c) return;
    this.state.detail = id;
    const st = c.day === dayIdxToday() ? classStatus(c) : null;
    $('#detail-body').innerHTML = `
      <div class="detail-name"><span class="dot" style="background:${c.color}"></span><h3>${escapeHTML(c.name)}</h3></div>
      <div class="detail-rows">
        <div class="detail-row"><span class="k">Hari</span><span class="v">${DAY_NAMES[c.day]}</span></div>
        <div class="detail-row"><span class="k">Jam</span><span class="v">${c.start} – ${c.end}</span></div>
        ${c.room ? `<div class="detail-row"><span class="k">Ruangan</span><span class="v">${escapeHTML(c.room)}</span></div>` : ''}
        ${c.lecturer ? `<div class="detail-row"><span class="k">Dosen</span><span class="v">${escapeHTML(c.lecturer)}</span></div>` : ''}
        ${st ? `<div class="detail-row"><span class="k">Status</span><span class="v">${STATUS_LABEL[st]}</span></div>` : ''}
      </div>
      <div class="sheet-actions">
        <button class="btn primary" data-action="edit-class">✏️ Edit Kelas</button>
        <div class="sheet-actions cols">
          <button class="btn outline" data-action="close">Tutup</button>
          <button class="btn danger" data-action="del-class">🗑️ Hapus</button>
        </div>
      </div>`;
    this.openSheet('modal-detail');
  },

  openTaskDetail(id) {
    const t = Store.getTask(id);
    if (!t) return;
    this.state.detail = id;
    const info = dueInfo(t);
    const course = t.courseId ? Store.getClass(t.courseId) : null;
    $('#detail-body').innerHTML = `
      <div class="detail-name"><span class="dot" style="background:${course ? course.color : '#94a3b8'}"></span><h3>${escapeHTML(t.title)}</h3></div>
      <div class="detail-rows">
        <div class="detail-row"><span class="k">Deadline</span><span class="v">${info.date}</span></div>
        <div class="detail-row"><span class="k">Status</span><span class="v"><span class="due-chip ${info.cls}">${info.rel}</span></span></div>
        ${course ? `<div class="detail-row"><span class="k">Matkul</span><span class="v">${escapeHTML(course.name)}</span></div>` : ''}
        ${t.notes ? `<div class="detail-row"><span class="k">Catatan</span><span class="v" style="font-weight:500;white-space:pre-wrap">${escapeHTML(t.notes)}</span></div>` : ''}
      </div>
      <div class="sheet-actions">
        <button class="btn primary" data-action="toggle-task-detail">${t.done ? '↩️ Buka Kembali' : '✅ Tandai Selesai'}</button>
        <div class="sheet-actions cols">
          <button class="btn outline" data-action="edit-task">✏️ Edit</button>
          <button class="btn danger" data-action="del-task">🗑️ Hapus</button>
        </div>
      </div>`;
    this.openSheet('modal-detail');
  },

  showImportPreview(parsed) {
    Importer.pending = parsed;
    const body = $('#import-body');
    if (!parsed.rows.length) {
      body.innerHTML = `
        <div class="sheet-title">Hasil Import</div>
        <div class="empty-state">
          <div class="emo">😕</div>
          <b>Tidak ada jadwal yang terbaca</b>
          <p>Pastikan file punya kolom: <b>matkul, hari, jam mulai, jam selesai</b> (ruangan & dosen opsional).</p>
          <button class="btn outline sm" data-action="download-sample">🧾 Unduh contoh CSV</button>
        </div>
        ${parsed.errors.length ? `<div class="err-list">${parsed.errors.slice(0, 5).map(escapeHTML).join('<br>')}</div>` : ''}
        <div class="sheet-actions"><button class="btn outline" data-action="close">Tutup</button></div>`;
      this.openSheet('modal-import');
      return;
    }
    const rows = parsed.rows.slice(0, 60);
    const errHtml = parsed.errors.length
      ? `<div class="err-list"><b>${parsed.errors.length} baris dilewati:</b><br>${parsed.errors.slice(0, 5).map(escapeHTML).join('<br>')}${parsed.errors.length > 5 ? '<br>…' : ''}</div>`
      : '';
    body.innerHTML = `
      <div class="sheet-title">Pratinjau Import</div>
      <p class="preview-note">${parsed.rows.length} jadwal siap diimpor — periksa dulu, lalu tap tombol impor.</p>
      <div class="preview-scroll"><table class="preview">
        <thead><tr><th>Matkul</th><th>Hari</th><th>Jam</th><th>Ruangan</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${escapeHTML(r.name)}</td><td>${DAY_NAMES[r.day]}</td><td>${r.start}–${r.end}</td><td>${escapeHTML(r.room || '—')}</td></tr>`).join('')}</tbody>
      </table></div>
      ${parsed.rows.length > 60 ? `<p class="preview-note mt8">… dan ${parsed.rows.length - 60} baris lainnya</p>` : ''}
      ${errHtml}
      <div class="sheet-actions cols">
        <button class="btn outline" data-action="close">Batal</button>
        <button class="btn primary" data-action="confirm-import">Impor ${parsed.rows.length} Kelas</button>
      </div>`;
    this.openSheet('modal-import');
  },

  confirm(message, okText = 'Ya', danger = false) {
    return new Promise(resolve => {
      $('#confirm-msg').textContent = message;
      const ok = $('#confirm-ok');
      ok.textContent = okText;
      ok.className = 'btn ' + (danger ? 'danger' : 'primary');
      this._confirmResolve = resolve;
      this.openSheet('modal-confirm');
    });
  },

  /* ============ Install PWA ============ */

  async promptInstall() {
    const p = this.state.deferredPrompt;
    if (!p) { this.showInstallGuide(); return; }
    p.prompt();
    await p.userChoice;
    this.state.deferredPrompt = null;
    if (this.state.view === 'lainnya') this.render();
  },

  showInstallGuide() {
    $('#info-title').textContent = 'Cara Install di HP';
    $('#info-body').innerHTML = `
      <div class="detail-rows">
        <div class="detail-row"><span class="k">🤖 Android</span><span class="v" style="font-weight:500;text-align:left">Buka KuliahKu di Chrome → menu <b>⋮</b> → <b>Tambahkan ke layar utama</b> / <b>Install aplikasi</b></span></div>
        <div class="detail-row"><span class="k">🍎 iPhone/iPad</span><span class="v" style="font-weight:500;text-align:left">Buka di Safari → tombol bagikan <b>⬆️</b> → <b>Tambah ke Layar Utama</b></span></div>
        <div class="detail-row"><span class="k">💻 Komputer</span><span class="v" style="font-weight:500;text-align:left">Klik ikon install <b>⊕</b> di ujung address bar Chrome/Edge</span></div>
      </div>
      <p class="muted mt8">Setelah terpasang, KuliahKu terbuka seperti aplikasi biasa, tampil layar penuh, dan tetap bisa dipakai offline. Biarkan aplikasi berjalan di latar belakang agar pengingat selalu terkirim.</p>
      <div class="sheet-actions"><button class="btn primary" data-action="close">Mengerti</button></div>`;
    this.openSheet('modal-info');
  },

  /* ============ Toast ============ */

  toast(msg, type = '') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show' + (type === 'err' ? ' err' : '');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
