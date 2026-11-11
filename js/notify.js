/* Sistem notifikasi pengingat KuliahKu */
'use strict';

const Notify = {
  swReg: null,

  init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => { this.swReg = reg; })
        .catch(err => console.warn('Registrasi service worker gagal:', err));
    }
    setInterval(() => this.check(), 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
  },

  enabled() {
    return !!(Store.data.settings.notifyEnabled
      && 'Notification' in window && Notification.permission === 'granted');
  },

  async toggle(on) {
    if (!on) { Store.data.settings.notifyEnabled = false; Store.save(); return false; }
    if (!('Notification' in window)) {
      App.toast('Browser ini tidak mendukung notifikasi', 'err');
      return false;
    }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      Store.data.settings.notifyEnabled = false; Store.save();
      App.toast('Izin notifikasi tidak diberikan', 'err');
      return false;
    }
    Store.data.settings.notifyEnabled = true; Store.save();
    await this.show('🔔 Notifikasi aktif!',
      `Kamu akan diingatkan ${Store.data.settings.reminderMinutes} menit sebelum kelas dimulai.`, 'notify-on');
    return true;
  },

  /* Dicek berkala: kelas yang mau mulai & tugas yang mau lewat deadline */
  check() {
    if (!this.enabled()) return;
    const now = new Date();
    const rm = Store.data.settings.reminderMinutes;
    const notified = Store.data.notified;
    const today = dateKey();
    let changed = false;

    Store.todayClasses().forEach(c => {
      const s = hmDate(c.start);
      const diffMin = (s - now) / 60000;
      const key = `${today}:c:${c.id}`;
      if (diffMin > 0 && diffMin <= rm && !notified[key]) {
        notified[key] = 1; changed = true;
        const m = Math.max(1, Math.round(diffMin));
        this.show(`📖 ${c.name}`,
          `Dimulai ${m} menit lagi (pukul ${c.start})${c.room ? ' · ' + c.room : ''}`,
          `class-${c.id}-${today}`);
      }
    });

    Store.data.tasks.forEach(t => {
      if (t.done) return;
      const due = new Date(t.due);
      const diff = due - now;
      const key = `${today}:t:${t.id}`;
      if (diff > 0 && diff <= 60 * 60000 && !notified[key]) {
        notified[key] = 1; changed = true;
        this.show(`📝 Tugas: ${t.title}`,
          `Deadline dalam ${fmtDuration(diff)} (pukul ${pad2(due.getHours())}:${pad2(due.getMinutes())})`,
          `task-${t.id}-${today}`);
      }
    });

    if (changed) Store.save();
  },

  async show(title, body, tag) {
    try {
      if (this.swReg) {
        await this.swReg.showNotification(title, {
          body, tag, renotify: true,
          icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
          vibrate: [80, 40, 80],
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, tag });
      }
    } catch (e) { console.warn('Gagal menampilkan notifikasi:', e); }
  },
};
