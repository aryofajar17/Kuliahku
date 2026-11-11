# 🎓 KuliahKu — Pengingat & Jadwal Kuliah

Aplikasi mobile (PWA) untuk melihat jadwal kuliah dan mendapat pengingat sebelum kelas dimulai. Semua data tersimpan **lokal di perangkat** — tanpa server, tanpa akun, bisa dipakai **offline**.

## ✨ Fitur

| Fitur | Keterangan |
|---|---|
| 🔴 Beranda "Hari Ini" | Kartu kelas berikutnya dengan **hitung mundur**, status kelas (Berlangsung / Segera / Akan datang / Selesai), dan tugas terdekat |
| 📅 Jadwal Mingguan | Chip hari Senin–Minggu dengan tanggal, daftar kelas per hari |
| ⏰ Notifikasi Pengingat | Peringatan **5/10/15/30/60 menit** sebelum kelas (diatur sendiri) + pengingat 1 jam sebelum deadline tugas |
| 📝 Catatan Tugas | Deadline, matkul terkait, catatan; dikelompokkan otomatis: Terlambat / Hari Ini / Besok / Mendatang |
| 📥 Import Jadwal | Dari file **CSV atau Excel (.xlsx)** — deteksi kolom otomatis (Indonesia & Inggris) |
| 📤 Export & Backup | Export jadwal ke CSV, backup/pulihkan seluruh data (JSON) |
| 📲 Install ke HP | Dipasang seperti aplikasi biasa, tampil layar penuh |

## 🚀 Cara Menjalankan

Aplikasi ini statis — cukup disajikan lewat server HTTP lokal (tidak bisa dibuka langsung via file `index.html` karena batasan service worker):

```bash
# di folder ini, pilih salah satu:
python -m http.server 8420
# atau
npx serve .
```

Lalu buka **http://localhost:8420** di browser (Chrome/Edge disarankan).

> 💡 Untuk pemakaian harian di HP, lihat "Cara Install di HP" di dalam aplikasi (tab **Lainnya**), atau sajikan lewat HTTPS (mis. GitHub Pages / Netlify) agar bisa di-install dan menerima notifikasi.

## 📲 Install di HP

- **Android (Chrome)**: buka aplikasi → menu **⋮** → *Install aplikasi / Tambahkan ke layar utama*
- **iPhone (Safari)**: tombol bagikan **⬆️** → *Tambah ke Layar Utama*
- **PC (Chrome/Edge)**: ikon install **⊕** di address bar

Setelah terpasang: tampil layar penuh tanpa address bar, tetap bisa dibuka saat offline.

## 🔔 Mengaktifkan Pengingat

1. Buka tab **Lainnya** → nyalakan **Notifikasi Pengingat** → izinkan saat browser bertanya.
2. Atur **Jeda Pengingat** (default 15 menit sebelum kelas).
3. Tap **Uji Notifikasi** untuk memastikan notifikasi muncul.
4. Biarkan aplikasi terbuka/berjalan di latar belakang agar pengecekan berkala tetap jalan (notifikasi diperiksa tiap ±20 detik).

> ⚠️ Jika izin notifikasi pernah diblokir: buka pengaturan situs (ikon 🔒 di address bar) → izinkan notifikasi → muat ulang.

## 📥 Format Import CSV/Excel

Header yang dikenali (urutan bebas, besar/kecil huruf bebas, Indonesia maupun Inggris):

| Kolom wajib | Alias yang diterima |
|---|---|
| Matkul | matkul, mata kuliah, nama, name, subject |
| Hari | hari, day (nama hari atau angka 1–7) |
| Jam mulai | jam mulai, mulai, start, begin, waktu |
| Jam selesai | jam selesai, selesai, end, finish (kosong = otomatis +90 menit) |
| Ruangan *(opsional)* | ruangan, ruang, room, lokasi |
| Dosen *(opsional)* | dosen, pengajar, lecturer |

Jam ditulis `07:00`, `7.30`, `7`, `9.5`, atau `7 wib` — semuanya terbaca. Contoh: lihat [`sample-jadwal.csv`](sample-jadwal.csv) atau unduh dari menu **Lainnya → Contoh Format CSV**.

## 🗂️ Struktur Proyek

```
├── index.html            # Kerangka aplikasi + semua modal
├── manifest.webmanifest  # Metadata PWA (nama, ikon, warna)
├── sw.js                 # Service worker: cache offline + kanal notifikasi
├── css/styles.css        # Seluruh gaya (tema gelap aksen ungu, mobile-first)
├── js/
│   ├── utils.js          # Helper waktu, format, status kelas
│   ├── data.js           # Store localStorage: CRUD kelas & tugas
│   ├── views.js          # Render 4 layar (Hari Ini, Jadwal, Tugas, Lainnya)
│   ├── importer.js       # Parser CSV/Excel + export CSV
│   ├── notify.js         # Penjadwal notifikasi berkala
│   └── app.js            # Controller: event, modal, navigasi
├── icons/                # Ikon PWA (192/512/maskable/apple)
├── tools/gen-icons.js    # Generator ikon (node tools/gen-icons.js)
└── sample-jadwal.csv     # Contoh format import
```

## 💾 Penyimpanan Data

Seluruh data ada di `localStorage` bawah kunci `kuliahku:v1` — tidak pernah keluar dari perangkat. Hapus browser data = hapus data aplikasi, jadi rutinlah **backup** (Lainnya → Backup Data).
