/* Data layer KuliahKu — penyimpanan lokal (localStorage) */
'use strict';

const PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#84cc16'];

const Store = {
  KEY: 'kuliahku:v1',
  data: null,

  defaults() {
    return {
      version: 1,
      classes: [],   // {id, name, day:0-6, start:"HH:MM", end:"HH:MM", room, lecturer, color}
      tasks: [],     // {id, title, courseId, due:"YYYY-MM-DDTHH:MM", notes, done, createdAt}
      settings: { reminderMinutes: 15, notifyEnabled: false },
      notified: {},  // kunci "YYYY-MM-DD:id" agar notifikasi tidak dobel
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      this.data = { ...this.defaults(), ...parsed };
      this.data.settings = { ...this.defaults().settings, ...(parsed.settings || {}) };
      this.cleanupNotified();
    } catch (e) {
      console.error('Gagal memuat data, memakai data kosong:', e);
      this.data = this.defaults();
    }
  },

  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    catch (e) { console.error('Gagal menyimpan data:', e); }
  },

  cleanupNotified() {
    const today = dateKey();
    for (const k of Object.keys(this.data.notified)) {
      if (!k.startsWith(today)) delete this.data.notified[k];
    }
  },

  /* ---------- CRUD Kelas ---------- */
  addClass(c) {
    c.id = c.id || uid();
    this.data.classes.push(c);
    this.save();
    return c;
  },
  updateClass(c) {
    const i = this.data.classes.findIndex(x => x.id === c.id);
    if (i >= 0) { this.data.classes[i] = c; this.save(); }
  },
  deleteClass(id) {
    this.data.classes = this.data.classes.filter(c => c.id !== id);
    // lepas tugas yang terhubung ke kelas ini
    this.data.tasks.forEach(t => { if (t.courseId === id) t.courseId = null; });
    this.save();
  },
  getClass(id) { return this.data.classes.find(c => c.id === id) || null; },

  nextColor() {
    const usage = {};
    PALETTE.forEach(p => usage[p] = 0);
    this.data.classes.forEach(c => { if (usage[c.color] != null) usage[c.color]++; });
    return PALETTE.reduce((best, p) => usage[p] < usage[best] ? p : best, PALETTE[0]);
  },

  /* ---------- Kueri jadwal ---------- */
  classesOnDay(day) {
    return this.data.classes
      .filter(c => c.day === day)
      .sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  },
  todayClasses() { return this.classesOnDay(dayIdxToday()); },

  /* Kelas berikutnya hari ini (belum mulai) */
  nextToday(now = new Date()) {
    return this.todayClasses().find(c => hmDate(c.start) > now) || null;
  },
  ongoingToday(now = new Date()) {
    return this.todayClasses().find(c => {
      const s = hmDate(c.start), e = hmDate(c.end);
      return now >= s && now <= e;
    }) || null;
  },

  /* Kelas pertama setelah hari ini (maks 7 hari ke depan) */
  nextAfterToday() {
    const base = dayIdxToday();
    for (let i = 1; i <= 7; i++) {
      const day = (base + i) % 7;
      const list = this.classesOnDay(day);
      if (list.length) return { day, class: list[0], inDays: i };
    }
    return null;
  },

  /* ---------- CRUD Tugas ---------- */
  addTask(t) {
    t.id = t.id || uid();
    t.createdAt = new Date().toISOString();
    this.data.tasks.push(t);
    this.save();
    return t;
  },
  updateTask(t) {
    const i = this.data.tasks.findIndex(x => x.id === t.id);
    if (i >= 0) { this.data.tasks[i] = t; this.save(); }
  },
  deleteTask(id) {
    this.data.tasks = this.data.tasks.filter(t => t.id !== id);
    this.save();
  },
  getTask(id) { return this.data.tasks.find(t => t.id === id) || null; },
  toggleTask(id) {
    const t = this.getTask(id);
    if (t) { t.done = !t.done; this.save(); }
    return t;
  },

  activeTasks() {
    return this.data.tasks.filter(t => !t.done)
      .sort((a, b) => new Date(a.due) - new Date(b.due));
  },

  /* ---------- Backup ---------- */
  exportBackup() {
    const copy = { ...this.data, notified: {} };
    return JSON.stringify(copy, null, 2);
  },
  replaceAll(json) {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.classes) || !Array.isArray(parsed.tasks)) {
      throw new Error('Format backup tidak valid');
    }
    parsed.settings = { ...this.defaults().settings, ...(parsed.settings || {}) };
    parsed.notified = {};
    this.data = { ...this.defaults(), ...parsed };
    this.save();
  },

  resetAll() {
    this.data = this.defaults();
    this.save();
  },
};
