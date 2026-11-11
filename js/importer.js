/* Import jadwal dari CSV/Excel + export CSV */
'use strict';

const Importer = {
  pending: null, // hasil parse yang menunggu konfirmasi pratinjau
  _libPromise: null,

  /* ---------- Baca file (dispatcher) ---------- */
  async readFile(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    let rows;
    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await this.loadLib();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    } else {
      const text = await file.text();
      rows = this.parseCSV(text);
    }
    return this.parseSchedule(rows);
  },

  /* Pustaka SheetJS dimuat hanya saat dibutuhkan */
  loadLib() {
    if (this._libPromise) return this._libPromise;
    this._libPromise = new Promise((resolve, reject) => {
      if (window.XLSX) return resolve(window.XLSX);
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => {
        this._libPromise = null;
        reject(new Error('Gagal memuat pembaca Excel (butuh internet). Simpan sebagai CSV lalu coba lagi.'));
      };
      document.head.appendChild(s);
    });
    return this._libPromise;
  },

  /* ---------- Parser CSV ---------- */
  parseCSV(text) {
    const lines = text.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return [];
    const delim = lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';
    return lines.map(line => this.parseLine(line, delim));
  },

  parseLine(line, delim) {
    const out = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  },

  /* ---------- Pemetaan kolom ---------- */
  FIELDS: {
    name:     ['matkul', 'mata kuliah', 'nama matkul', 'nama', 'name', 'subject', 'mapel'],
    day:      ['hari', 'day', 'days'],
    start:    ['jam mulai', 'mulai', 'start', 'jam', 'dari', 'begin', 'waktu mulai'],
    end:      ['jam selesai', 'selesai', 'end', 'sampai', 'until', 'finish', 'waktu selesai'],
    room:     ['ruangan', 'ruang', 'room', 'tempat', 'lokasi'],
    lecturer: ['dosen', 'pengajar', 'lecturer', 'guru', 'dos'],
  },

  normHeader(s) { return String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); },

  findHeader(rows) {
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const cells = (rows[i] || []).map(c => this.normHeader(c));
      let hits = 0;
      for (const f of Object.values(this.FIELDS)) {
        if (cells.some(c => c && f.some(k => c === k || (k.length > 3 && c.includes(k))))) hits++;
      }
      if (hits >= 2) return i;
    }
    return -1;
  },

  parseSchedule(rows) {
    rows = (rows || []).filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim() !== ''));
    if (!rows.length) return { rows: [], errors: ['File kosong atau tidak terbaca.'] };

    const headerIdx = this.findHeader(rows);
    const map = {};
    if (headerIdx >= 0) {
      const header = rows[headerIdx].map(c => this.normHeader(c));
      for (const [field, keys] of Object.entries(this.FIELDS)) {
        for (const key of keys) {
          const idx = header.findIndex(h => h && (h === key || (key.length > 3 && h.includes(key))));
          if (idx >= 0) { map[field] = idx; break; }
        }
      }
      if (map.name == null || map.day == null || map.start == null) {
        return { rows: [], errors: ['Kolom tidak dikenali. Minimal butuh kolom: matkul, hari, jam mulai.'] };
      }
    } else {
      // tanpa header: asumsikan urutan matkul, hari, mulai, selesai, ruangan, dosen
      Object.assign(map, { name: 0, day: 1, start: 2, end: 3, room: 4, lecturer: 5 });
    }

    const out = [], errors = [];
    rows.slice(headerIdx + 1).forEach((r, i) => {
      const n = headerIdx + 1 + i + 1; // nomor baris manusiawi
      const get = f => map[f] != null ? String(r[map[f]] ?? '').trim() : '';
      const name = get('name');
      if (!name) { errors.push(`Baris ${n}: nama matkul kosong`); return; }
      const day = this.normalizeDay(get('day'));
      if (day == null) { errors.push(`Baris ${n}: hari "${get('day')}" tidak dikenali`); return; }
      const start = this.normalizeTime(get('start'));
      if (!start) { errors.push(`Baris ${n}: jam mulai "${get('start')}" tidak valid`); return; }
      let end = this.normalizeTime(get('end'));
      if (!end) end = minutesToHHMM(minutesOf(start) + 90); // default durasi 90 menit
      if (minutesOf(end) <= minutesOf(start)) { errors.push(`Baris ${n}: jam selesai harus setelah jam mulai`); return; }
      out.push({ name, day, start, end, room: get('room'), lecturer: get('lecturer') });
    });
    return { rows: out, errors };
  },

  DAY_ALIAS: {
    senin: 0, sen: 0, monday: 0, mon: 0,
    selasa: 1, sel: 1, tuesday: 1, tue: 1, tues: 1,
    rabu: 2, rab: 2, wednesday: 2, wed: 2,
    kamis: 3, kam: 3, thursday: 3, thu: 3, thurs: 3,
    jumat: 4, jum: 4, jim: 4, friday: 4, fri: 4,
    sabtu: 5, sab: 5, saturday: 5, sat: 5,
    minggu: 6, min: 6, ahad: 6, ah: 6, sunday: 6, sun: 6,
  },

  normalizeDay(v) {
    if (v == null) return null;
    const s = String(v).toLowerCase().trim();
    if (!s) return null;
    if (this.DAY_ALIAS[s] != null) return this.DAY_ALIAS[s];
    const n = parseInt(s, 10);
    if (!isNaN(n) && n >= 1 && n <= 7) return n - 1; // 1=Senin … 7=Minggu
    return null;
  },

  normalizeTime(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return `${pad2(v.getHours())}:${pad2(v.getMinutes())}`;
    let s = String(v).trim().replace(/\s*(wib|wita|wit)\s*$/i, '').trim();
    const mColon = s.match(/^(\d{1,2}):(\d{1,2})/);
    if (mColon) {
      const h = +mColon[1], mi = +mColon[2];
      return (h < 24 && mi < 60) ? `${pad2(h)}:${pad2(mi)}` : null;
    }
    const mDot = s.match(/^(\d{1,2})[.,](\d{1,2})$/);
    if (mDot) {
      const h = +mDot[1], mi = +mDot[2];
      return (h < 24 && mi < 60) ? `${pad2(h)}:${pad2(mi)}` : null;
    }
    const num = parseFloat(s.replace(',', '.'));
    if (!isNaN(num)) {
      if (num >= 1 && num < 24) return `${pad2(Math.floor(num))}:00`; // "7" → 07:00
      if (num > 0 && num < 1) return minutesToHHMM(Math.round(num * 1440) % 1440); // fraksi waktu Excel
      if (num === 0) return '00:00';
    }
    return null;
  },

  /* ---------- Konfirmasi & commit ---------- */
  commitPending() {
    const parsed = this.pending;
    if (!parsed) return;
    let added = 0, dup = 0;
    parsed.rows.forEach(r => {
      const exists = Store.data.classes.some(c =>
        c.name.toLowerCase() === r.name.toLowerCase() && c.day === r.day && c.start === r.start);
      if (exists) { dup++; return; }
      Store.addClass({
        name: r.name, day: r.day, start: r.start, end: r.end,
        room: r.room || '', lecturer: r.lecturer || '',
        color: Store.nextColor(),
      });
      added++;
    });
    this.pending = null;
    App.closeSheet('modal-import');
    App.toast(`✓ ${added} kelas diimpor${dup ? ` · ${dup} duplikat dilewati` : ''}`);
    App.render();
  },

  /* ---------- Export ---------- */
  exportCSV() {
    const esc = v => {
      const s = String(v ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = ['matkul;hari;jam mulai;jam selesai;ruangan;dosen'];
    Store.data.classes.forEach(c =>
      lines.push([c.name, DAY_NAMES[c.day], c.start, c.end, c.room || '', c.lecturer || ''].map(esc).join(';')));
    downloadFile(`jadwal-kuliah-${dateKey()}.csv`, '\ufeff' + lines.join('\n'), 'text/csv');
  },
};
