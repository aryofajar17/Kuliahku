/* Utilitas umum KuliahKu */
'use strict';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad2 = n => String(n).padStart(2, '0');

/* Hari: indeks 0 = Senin ... 6 = Minggu (penyimpanan internal) */
const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/* Konversi dari getDay() (0=Minggu) ke indeks kita (0=Senin) */
const dayIdxToday = () => (new Date().getDay() + 6) % 7;

const fmtDateID = (d) =>
  `${['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;

const fmtDateShort = (d) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;

const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

const minutesToHHMM = (m) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(Math.round(m) % 60)}`;

/* Tanggal hari ini dengan jam tertentu */
const hmDate = (hhmm) => {
  const d = new Date();
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

const escapeHTML = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* Durasi milidetik → teks ringkas, mis. "1 j 5 mnt" / "45 mnt" / "40 dtk" */
const fmtDuration = (ms) => {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min >= 60) {
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} j ${m} mnt` : `${h} jam`;
  }
  return min > 0 ? `${min} mnt` : `${Math.max(0, Math.floor(ms / 1000))} dtk`;
};

/* Status kelas relatif terhadap waktu sekarang */
function classStatus(c, now = new Date()) {
  const s = hmDate(c.start), e = hmDate(c.end);
  if (now > e) return 'done';
  if (now >= s) return 'ongoing';
  if (s - now <= 30 * 60000) return 'soon';
  return 'upcoming';
}

const STATUS_LABEL = {
  ongoing: 'Berlangsung',
  soon: 'Segera',
  upcoming: 'Akan datang',
  done: 'Selesai',
};

/* Deadline tugas → info relatif */
function dueInfo(t) {
  const d = new Date(t.due);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(d); due.setHours(0, 0, 0, 0);
  const diffDay = Math.round((due - today) / 86400000);
  let rel, cls = '';
  if (t.done) rel = 'Selesai';
  else if (diffDay < 0) { rel = `Terlambat ${Math.abs(diffDay)} hr`; cls = 'overdue'; }
  else if (diffDay === 0) { rel = 'Hari ini'; cls = 'today'; }
  else if (diffDay === 1) rel = 'Besok';
  else rel = `${diffDay} hari`;
  return { date: `${fmtDateShort(d)} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`, rel, cls };
}

/* Unduh file teks dari browser */
function downloadFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
