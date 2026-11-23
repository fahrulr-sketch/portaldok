import { isAdmin, json } from './_lib.js';

// Diagnosis konfigurasi (hanya admin yang sudah login). Hanya mengembalikan true/false.
export async function GET(request) {
  if (!isAdmin(request)) return json({ admin: false }, 401);
  return json({
    admin: true,
    blobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    sessionSecret: !!process.env.SESSION_SECRET,
  });
}
