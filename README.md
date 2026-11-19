# Portal Dokumen

Distribusi folder dan dokumen (PDF dan Excel) dengan dua peran:

| Peran | Alamat | Login | Kemampuan |
|---|---|---|---|
| Pengguna | `/` | Tidak perlu | Menjelajah folder, mencari, **pratinjau**, mengunduh |
| Admin | `/admin` | Username dan password | Semua kemampuan pengguna, plus unggah, folder baru, ganti nama, potong/tempel, seret-pindah, hapus |

Tampilan meniru file explorer desktop: pohon folder di kiri, breadcrumb, pencarian,
tampilan ikon atau daftar, urutkan (nama, tanggal, ukuran, jenis), menu klik kanan.

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
api/tree.js      daftar folder dan file (publik)
api/file.js      proxy baca-saja untuk pratinjau (cadangan jika fetch langsung diblokir)
api/login.js, logout.js, me.js   sesi admin (cookie HttpOnly, 8 jam)
api/upload.js    token unggah (hanya admin)
api/folder.js    buat folder (hanya admin)
api/rename.js    ganti nama file/folder (hanya admin)
api/move.js      pindahkan file/folder (hanya admin)
api/delete.js    hapus file/folder (hanya admin)
api/diag.js      diagnosis konfigurasi (hanya admin)
public/          antarmuka (index.html, admin.html, app.js, style.css)
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
6. Admin: `https://domain-anda/admin`. Pengguna: `https://domain-anda/`.

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
