import { put } from '@vercel/blob';
import { enc, isAdmin, json, validFolderPath } from './_lib.js';

// Membuat folder kosong lewat berkas penanda ".folder".
export async function POST(request) {
  if (!isAdmin(request)) return json({ error: 'Perlu login admin' }, 401);
  const { path } = await request.json().catch(() => ({}));
  if (!validFolderPath(path)) return json({ error: 'Nama folder tidak valid' }, 400);
  const pathname = `files/${path.map(enc).join('/')}/0-${enc('{}')}/.folder`;
  await put(pathname, '{}', {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return json({ ok: true });
}
