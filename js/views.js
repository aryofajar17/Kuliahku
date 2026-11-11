/* Render tampilan-tampilan KuliahKu */
'use strict';

const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3.5"/><path d="M8 3v4M16 3v4M3 10.5h18"/></svg>`,
  task: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="m8.5 12.4 2.4 2.4 4.8-5.2"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/></svg>`,
};

function emptyState(emo, title, desc, ctaLabel, action) {
  return `<div class="empty-state">
    <div class="emo">${emo}</div>
    <b>${escapeHTML(title)}</b>
    <p>${escapeHTML(desc)}</p>
    ${ctaLabel ? `<button class="btn primary sm" data-action="${action}">${ctaLabel}</button>` : ''}
  </div>`;
}

/* ---------- Kartu kelas & item tugas ---------- */

function classCard(c, status) {
  let pill = '';
  if (status) {
    const ico = status === 'ongoing' ? '<span class="dot"></span>' : status === 'soon' ? '⏰ ' : '';
    pill = `<span class="status-pill ${status}">${ico}${STATUS_LABEL[status]}</span>`;
  }
  const chips = [
    c.room && `<span class="chip">📍 ${escapeHTML(c.room)}</span>`,
    c.lecturer && `<span class="chip">👤 ${escapeHTML(c.lecturer)}</span>`,
  ].filter(Boolean).join('');
  return `
  <div class="class-card ${status === 'done' ? 'is-done' : ''}" data-class="${c.id}">
    <div class="bar" style="background:${c.color}"></div>
    <div class="time-col">
      <span class="start">${c.start}</span>
      <span class="end">${c.end}</span>
    </div>
    <div class="info-col">
      <div class="name">${escapeHTML(c.name)}</div>
      ${pill}
      ${chips ? `<div class="meta-line">${chips}</div>` : ''}
    </div>
  </div>`;
}

function taskItem(t) {
  const info = dueInfo(t);
  const course = t.courseId ? Store.getClass(t.courseId) : null;
  return `
  <div class="task-item ${t.done ? 'is-done' : ''}" data-task="${t.id}">
    <button class="task-check" data-toggle-task="${t.id}" aria-label="tandai selesai">✓</button>
    <div class="task-info">
      <div class="title">${escapeHTML(t.title)}</div>
      <div class="task-meta">
        <span class="due-chip ${info.cls}">${t.done ? '✓' : '⏳'} ${info.rel} · ${info.date}</span>
        ${course ? `<span class="chip"><span class="course-dot" style="background:${course.color}"></span>${escapeHTML(course.name)}</span>` : ''}
      </div>
    </div>
  </div>`;
}

/* ---------- Beranda: Hari Ini ---------- */

function renderHome() {
  const el = $('#view-home');
  const now = new Date();
  const todayList = Store.todayClasses();
  const ongoing = Store.ongoingToday(now);
  const next = Store.nextToday(now);
  const tasks = Store.activeTasks().slice(0, 3);

  let hero;
  if (ongoing) {
    const sisa = hmDate(ongoing.end) - now;
    hero = `
    <div class="hero-card">
      <span class="hero-label">🔴 Sedang Berlangsung</span>
      <h3>${escapeHTML(ongoing.name)}</h3>
      <div class="hero-count">${fmtDuration(sisa)}<small>tersisa</small></div>
      <div class="hero-meta">
        <span>🕐 ${ongoing.start}–${ongoing.end}</span>
        ${ongoing.room ? `<span>📍 ${escapeHTML(ongoing.room)}</span>` : ''}
      </div>
    </div>`;
  } else if (next) {
    const diff = hmDate(next.start) - now;
    hero = `
    <div class="hero-card">
      <span class="hero-label">⏰ Kelas Berikutnya</span>
      <h3>${escapeHTML(next.name)}</h3>
      <div class="hero-count">${fmtDuration(diff)}<small>lagi</small></div>
      <div class="hero-meta">
        <span>🕐 ${next.start}–${next.end}</span>
        ${next.room ? `<span>📍 ${escapeHTML(next.room)}</span>` : ''}
      </div>
    </div>`;
  } else {
    const after = Store.nextAfterToday();
    hero = `
    <div class="hero-card resting">
      <div class="big">${todayList.length ? '🎉' : '🌴'}</div>
      <h3>${todayList.length ? 'Semua kelas hari ini selesai!' : 'Tidak ada kelas hari ini'}</h3>
      ${after ? `<p style="opacity:.85;font-size:13.5px;margin-top:6px">Kelas berikutnya: <b>${escapeHTML(after.class.name)}</b><br>${after.inDays === 1 ? 'besok' : DAY_NAMES[after.day]} · ${after.class.start}</p>`
        : `<p style="opacity:.85;font-size:13.5px;margin-top:6px">Belum ada jadwal — Yuk tambahkan!</p>
           <button class="btn outline mt16" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.4);color:#fff" data-action="add-class">+ Tambah Kelas</button>`}
    </div>`;
  }

  const listHtml = todayList.length
    ? todayList.map(c => classCard(c, classStatus(c, now))).join('')
    : emptyState('🗓️', 'Tidak ada kelas hari ini', 'Nikmati harimu, atau tambah jadwal baru.', 'Tambah Kelas', 'add-class');

  const taskHtml = tasks.length
    ? tasks.map(taskItem).join('')
    : `<p class="muted center" style="padding:8px 0 4px">Tidak ada tugas aktif ✨</p>`;

  el.innerHTML = `
    ${hero}
    <div class="section">
      <div class="section-head">
        <h2>Jadwal Hari Ini</h2>
        <span class="muted">${todayList.length} kelas</span>
      </div>
      ${listHtml}
    </div>
    <div class="section">
      <div class="section-head">
        <h2>Tugas Terdekat</h2>
        <button class="link" data-nav="tugas">Lihat semua</button>
      </div>
      ${taskHtml}
    </div>`;
}

/* ---------- Jadwal mingguan ---------- */

function renderJadwal(day) {
  const el = $('#view-jadwal');
  if (day == null) day = App.state.day ?? dayIdxToday();
  App.state.day = day;

  const now = new Date();
  const today = dayIdxToday();

  const chips = DAY_SHORT.map((d, i) =>
    `<button class="day-chip ${i === day ? 'active' : ''} ${i === today ? 'today' : ''}" data-day="${i}">
      <span class="d">${d}</span>
    </button>`).join('');

  const list = Store.classesOnDay(day);
  const body = list.length
    ? list.map(c => classCard(c, day === today ? classStatus(c, now) : null)).join('')
    : emptyState('📆', `Tidak ada kelas hari ${DAY_NAMES[day]}`, 'Tap tombol + untuk menambah kelas.', 'Tambah Kelas', 'add-class');

  el.innerHTML = `
    <div class="day-chips">${chips}</div>
    <div class="agenda-title"><h3>${DAY_NAMES[day]}</h3><span>${list.length} kelas</span></div>
    ${body}`;
}

/* ---------- Tugas ---------- */

function renderTugas() {
  const el = $('#view-tugas');
  const filter = App.state.taskFilter || 'aktif';
  const all = Store.data.tasks;
  const doneCount = all.filter(t => t.done).length;
  const activeCount = all.length - doneCount;

  let body = '';
  if (filter === 'selesai') {
    const list = all.filter(t => t.done).sort((a, b) => new Date(b.due) - new Date(a.due));
    body = list.length
      ? list.map(taskItem).join('')
      : emptyState('✅', 'Belum ada tugas selesai', 'Tandai tugas selesai setelah kamu mengumpulkannya.');
  } else {
    const list = filter === 'semua'
      ? [...all].sort((a, b) => new Date(a.due) - new Date(b.due))
      : Store.activeTasks();

    if (filter === 'aktif') {
      if (!list.length) {
        body = emptyState('📚', 'Tidak ada tugas aktif', 'Santai dulu, atau catat tugas baru.', 'Tambah Tugas', 'add-task');
      } else {
        const groups = { overdue: [], today: [], tomorrow: [], later: [] };
        const today0 = new Date(); today0.setHours(0, 0, 0, 0);
        list.forEach(t => {
          const d = new Date(t.due); d.setHours(0, 0, 0, 0);
          const diff = Math.round((d - today0) / 86400000);
          if (diff < 0) groups.overdue.push(t);
          else if (diff === 0) groups.today.push(t);
          else if (diff === 1) groups.tomorrow.push(t);
          else groups.later.push(t);
        });
        const titles = { overdue: '⚠️ Terlambat', today: '📌 Hari Ini', tomorrow: 'Besok', later: 'Mendatang' };
        body = ['overdue', 'today', 'tomorrow', 'later']
          .filter(g => groups[g].length)
          .map(g => `<div class="task-group-title ${g === 'overdue' ? 'overdue' : ''}">${titles[g]} · ${groups[g].length}</div>${groups[g].map(taskItem).join('')}`)
          .join('');
      }
    } else {
      body = list.length
        ? list.map(taskItem).join('')
        : emptyState('📚', 'Belum ada tugas', 'Tap tombol + untuk menambah tugas.');
    }
  }

  el.innerHTML = `
    <div class="seg">
      <button data-filter="aktif" class="${filter === 'aktif' ? 'active' : ''}">Aktif (${activeCount})</button>
      <button data-filter="selesai" class="${filter === 'selesai' ? 'active' : ''}">Selesai (${doneCount})</button>
      <button data-filter="semua" class="${filter === 'semua' ? 'active' : ''}">Semua</button>
    </div>
    ${body}`;
}

/* ---------- Lainnya / pengaturan ---------- */

function renderLainnya() {
  const el = $('#view-lainnya');
  const s = Store.data.settings;
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const canNotify = s.notifyEnabled && perm === 'granted';

  const installRow = App.state.deferredPrompt
    ? `<div class="setting-row" data-action="install"><div class="ic">📲</div><div class="tx"><b>Install Aplikasi</b><small>Pasang KuliahKu di layar utama</small></div><span class="ctrl">›</span></div>`
    : '';

  el.innerHTML = `
    <div class="setting-card">
      <div class="setting-row no-click">
        <div class="ic">🔔</div>
        <div class="tx"><b>Notifikasi Pengingat</b><small>${perm === 'denied' ? 'Izin diblokir browser' : canNotify ? 'Aktif — kamu akan diingatkan' : 'Mati'}</small></div>
        <label class="toggle">
          <input type="checkbox" id="tg-notify" ${canNotify ? 'checked' : ''} ${perm === 'denied' ? 'disabled' : ''}>
          <span class="track"></span>
        </label>
      </div>
      <div class="setting-row no-click">
        <div class="ic">⏱️</div>
        <div class="tx"><b>Jeda Pengingat</b><small>Dikirim sebelum kelas dimulai</small></div>
        <select id="sel-reminder">
          ${[5, 10, 15, 30, 60].map(m => `<option value="${m}" ${s.reminderMinutes === m ? 'selected' : ''}>${m} mnt</option>`).join('')}
        </select>
      </div>
      <div class="setting-row" data-action="test-notify">
        <div class="ic">📣</div>
        <div class="tx"><b>Uji Notifikasi</b><small>Kirim notifikasi contoh sekarang</small></div>
        <span class="ctrl">›</span>
      </div>
    </div>
    ${perm === 'denied' ? `<div class="err-list" style="margin:-6px 0 16px">Izin notifikasi diblokir. Buka pengaturan situs (ikon 🔒 di address bar) lalu izinkan notifikasi, kemudian muat ulang halaman.</div>` : ''}
    <div class="setting-card">
      <div class="setting-row" data-action="import"><div class="ic">📥</div><div class="tx"><b>Import Jadwal</b><small>Dari file CSV atau Excel (.xlsx)</small></div><span class="ctrl">›</span></div>
      <div class="setting-row" data-action="export-csv"><div class="ic">📤</div><div class="tx"><b>Export Jadwal (CSV)</b><small>Simpan jadwal sebagai file CSV</small></div><span class="ctrl">›</span></div>
      <div class="setting-row" data-action="download-sample"><div class="ic">🧾</div><div class="tx"><b>Contoh Format CSV</b><small>Unduh contoh untuk melihat formatnya</small></div><span class="ctrl">›</span></div>
      <div class="setting-row" data-action="backup"><div class="ic">💾</div><div class="tx"><b>Backup Data</b><small>Unduh seluruh data (JSON)</small></div><span class="ctrl">›</span></div>
      <div class="setting-row" data-action="restore"><div class="ic">♻️</div><div class="tx"><b>Pulihkan Backup</b><small>Kembalikan data dari file backup</small></div><span class="ctrl">›</span></div>
    </div>
    <div class="setting-card">
      ${installRow}
      <div class="setting-row" data-action="how-install"><div class="ic">❓</div><div class="tx"><b>Cara Install di HP</b><small>Panduan singkat memasang aplikasi</small></div><span class="ctrl">›</span></div>
    </div>
    <div class="setting-card">
      <div class="setting-row danger" data-action="reset"><div class="ic">🗑️</div><div class="tx"><b>Hapus Semua Data</b><small>Jadwal, tugas & pengaturan akan dihapus permanen</small></div><span class="ctrl">›</span></div>
    </div>
    <p class="about-footer">KuliahKu v1.0 · Dibuat dengan ❤️ untuk mahasiswa<br>Semua data tersimpan lokal di perangkatmu</p>`;
}
