# Portal Data

Landing page + pusat dokumen (PDF dan Excel) dengan dua peran.

| Halaman | Alamat | Login |
|---|---|---|
| Landing page (Home) | `/` | Tidak perlu |
| Jelajah dokumen (pengguna) | `/data` | Tidak perlu |
| Kelola dokumen (admin) | `/admin` | Username dan password |

## Klasifikasi

Dokumen dikelompokkan dalam **klasifikasi** tetap, yang juga menjadi menu di navbar:
`Bahan`, `Laporan Keuangan`, `Peraturan`, `PIPK`, `POK`.

- Klasifikasi adalah folder tingkat teratas. Tidak bisa diganti nama, dipindah, atau dihapus.
- Admin **wajib memilih klasifikasi** sebelum menambah folder atau file baru. Jika sedang berada di
  Beranda, dialog "Pilih klasifikasi" muncul lebih dulu; jika sudah berada di dalam suatu klasifikasi,
  folder/file langsung masuk ke sana. Aturan ini juga ditegakkan di server (API menolak file/folder
  di luar klasifikasi).
- Mengubah daftar klasifikasi: edit `api/_categories.js`, lalu deploy ulang. Menu navbar, kartu di
  landing page, dan aturan server mengikuti file itu (`public/categories.js` dibuat otomatis saat build).
- Folder lama yang bukan klasifikasi tetap terlihat di Beranda agar bisa dipindahkan ke klasifikasi.

## Landing page

Navbar (Home, klasifikasi, kolom cari), hero "Selamat Datang di Portal Data", tombol **Login Admin**,
dan kartu klasifikasi dengan jumlah dokumen. Kolom cari membuka `/data?q=...`.

- Foto hero: `public/hero.jpg` (foto dermaga oleh Tom Fisk, Pexels; dicerminkan agar sesuai desain).
- Logo: `public/logo.svg` adalah logo pengganti sementara; timpa file itu dengan logo asli.
- Font Jost dimuat dari Google Fonts (cadangan: Century Gothic/Avenir/sistem).

## Fitur

**Pengguna**
- Klik dua kali folder untuk membuka, klik dua kali file untuk **pratinjau**.
- Pratinjau PDF (semua halaman, zoom) dan Excel (tab sheet, 2000 baris pertama),
  dengan tombol Sebelumnya/Berikutnya (atau tombol panah) untuk berpindah antar file di folder yang sama.
- Unduh satu atau banyak file, salin tautan folder, lihat properti (ukuran, lokasi, tanggal).
- Shift+klik / Ctrl+klik untuk memilih banyak item, Ctrl+A pilih semua.

**Admin**
- **Folder baru** muncul langsung di daftar dengan kolom nama yang bisa diketik (seperti Windows Explorer).
- **Ganti nama** file dan folder (F2, tombol, atau klik kanan). Ekstensi file dijaga.
- **Potong dan Tempel** (Ctrl+X / Ctrl+V) atau **seret item ke folder** untuk memindahkan.
- **Unggah file**, **unggah folder** utuh (subfolder dipertahankan), atau seret dari komputer
  (bisa dijatuhkan langsung ke sebuah folder).
- **Hapus** (Delete). Menghapus folder ikut menghapus isinya.

## Struktur

```
api/_categories.js  daftar klasifikasi (sumber tunggal)
api/tree.js      daftar folder dan file (publik)
api/file.js      proxy baca-saja untuk pratinjau (cadangan jika fetch langsung diblokir)
api/login.js, logout.js, me.js   sesi admin (cookie HttpOnly, 8 jam)
api/upload.js    token unggah (hanya admin)
api/folder.js    buat folder (hanya admin)
api/rename.js    ganti nama file/folder (hanya admin)
api/move.js      pindahkan file/folder (hanya admin)
api/delete.js    hapus file/folder (hanya admin)
api/diag.js      diagnosis konfigurasi (hanya admin)
public/index.html     landing page
public/data.html      explorer pengguna
public/admin.html     explorer admin
public/site.js, site.css   navbar dan gaya landing
public/app.js, style.css   explorer
scripts/copy-assets.mjs   menyalin PDF.js dan SheetJS ke public/vendor saat build
```

Penyimpanan memakai Vercel Blob tanpa database. Struktur folder disimpan pada path file
`files/{folder}/.../{waktu}-{metadata}/{namafile}`; ganti nama dan pindah dilakukan dengan
menyalin ke path baru lalu menghapus yang lama.

## Deploy ke Vercel

1. Push folder ini ke GitHub.
2. Di Vercel: **Add New > Project**, pilih repository, Framework Preset: **Other**.
3. Tab **Storage**: **Create > Blob** (akses Public), hubungkan ke project.
4. **Settings > Environment Variables**: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
5. **Redeploy**.
6. Landing page: `https://domain-anda/`. Pengguna: `/data`. Admin: `/admin`.

Build menjalankan `npm install` lalu `npm run build` (bundle klien unggah + salin pustaka penampil).
Pustaka SheetJS diambil dari `cdn.sheetjs.com` (cara pemasangan resmi), jadi build butuh akses internet.

## Jalankan lokal

```
npm install
npm i -g vercel
vercel link
vercel env pull .env.local
npm run build
vercel dev
```

## Catatan

- File di Vercel Blob berstatus publik: siapa pun yang punya link langsungnya bisa membukanya.
  Jangan unggah dokumen rahasia.
- Batas per file 50 MB; unggah folder hanya membawa PDF/Excel.
- Nama file saat diunduh dibersihkan dari spasi dan karakter khusus
  (mis. `Laporan Kas.xlsx` menjadi `Laporan_Kas.xlsx`); nama aslinya tetap tampil di portal.
- Ganti nama/pindah folder besar menyalin semua isinya, jadi butuh beberapa detik
  (batas fungsi diatur 60 detik di `vercel.json`).
- Pratinjau Excel menampilkan nilai dan format teks sel; rumus, gambar, dan sel gabungan tidak ditampilkan persis seperti di Excel.
- Daftar untuk pengguna di-cache sekitar 15 detik; admin langsung melihat perubahan.
- Jangan ubah isi folder `files/` lewat dashboard Blob secara manual.
