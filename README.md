# Portal Dokumen

Distribusi folder dan dokumen (PDF dan Excel) dengan dua peran:

| Peran | Alamat | Login | Kemampuan |
|---|---|---|---|
| Pengguna | `/` | Tidak perlu | Menjelajah folder, mencari, mengunduh |
| Admin | `/admin` | Username dan password | Unggah file, unggah folder utuh, buat folder, hapus |

Tampilan pengguna meniru file explorer desktop: panel pohon folder di kiri,
breadcrumb, pencarian, tampilan ikon atau daftar, klik dua kali untuk membuka
folder atau mengunduh file. Di ponsel panel folder bisa dibuka lewat tombol menu.

## Struktur

```
api/tree.js      daftar folder dan file (publik)
api/login.js     login admin (cookie sesi HttpOnly, berlaku 8 jam)
api/logout.js    keluar
api/me.js        status login
api/upload.js    token unggah (hanya admin)
api/folder.js    buat folder kosong (hanya admin)
api/delete.js    hapus file atau folder beserta isinya (hanya admin)
public/index.html, admin.html, app.js, style.css   antarmuka
src/client.js    pembungkus @vercel/blob/client (di-bundle esbuild)
```

Penyimpanan memakai Vercel Blob, tanpa database. Struktur folder disimpan pada
path file: `files/{folder}/.../{waktu}-{metadata}/{namafile}`.

## Deploy ke Vercel

1. Push folder ini ke GitHub.
2. Di Vercel: **Add New > Project**, pilih repository, Framework Preset: **Other**.
3. Tab **Storage**: **Create > Blob** (akses Public), lalu hubungkan ke project.
   `BLOB_READ_WRITE_TOKEN` terisi otomatis.
4. **Settings > Environment Variables**, tambahkan:
   - `ADMIN_USERNAME` (mis. `admin`)
   - `ADMIN_PASSWORD` (password kuat)
   - `SESSION_SECRET` (string acak panjang)
5. **Redeploy**.
6. Buka `https://domain-anda/admin`, login, lalu unggah.
   Bagikan `https://domain-anda/` kepada pengguna.

## Cara pakai admin

- **Unggah file**: pilih satu atau banyak file PDF/Excel ke folder yang sedang dibuka.
- **Unggah folder**: pilih satu folder dari komputer. Seluruh subfolder dan
  isinya (hanya PDF/Excel) dibuat ulang di dalam folder yang sedang dibuka.
- **Seret dan lepas** file atau folder ke area utama untuk mengunggah.
- **Folder baru** membuat folder kosong. **Hapus** menghapus item terpilih;
  menghapus folder ikut menghapus isinya.
- Pintasan: Ctrl+klik pilih banyak, Enter buka, Delete hapus, Backspace naik.

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

- File di Vercel Blob berstatus publik: siapa pun yang tahu link langsungnya bisa
  mengunduh. Jangan unggah dokumen rahasia.
- Batas per file 50 MB. File selain PDF/Excel dilewati saat unggah folder.
- Nama file saat diunduh dibersihkan dari spasi dan karakter khusus
  (mis. `Laporan Kas.xlsx` menjadi `Laporan_Kas.xlsx`); nama aslinya tetap tampil di portal.
- Daftar untuk pengguna di-cache sekitar 15 detik, jadi unggahan baru bisa muncul
  sedikit terlambat. Untuk admin, daftar langsung diperbarui setelah unggah.
- Folder kosong hanya bisa ada karena berkas penanda `.folder` di storage;
  jangan hapus manual lewat dashboard Blob.
