import { put } from '@vercel/blob';
import { NEED_CATEGORY, enc, fail, inCategory, isAdmin, json, validFolderPath } from './_lib.js';
import { childFolders, hasName } from './_ops.js';

// Membuat folder kosong lewat berkas penanda ".folder".
export async function POST(request) {
  if (!isAdmin(request)) return json({ error: 'Perlu login admin' }, 401);
  const { path } = await request.json().catch(() => ({}));
  try {
    if (!validFolderPath(path)) throw fail('Nama folder tidak valid');
    if (path.length < 2 || !inCategory(path)) throw fail(NEED_CATEGORY);
    const parent = path.slice(0, -1);
    if (hasName(await childFolders(parent), path[path.length - 1])) {
      throw fail('Sudah ada folder dengan nama itu', 409);
    }
    const pathname = `files/${path.map(enc).join('/')}/0-${enc('{}')}/.folder`;
    await put(pathname, '{}', {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return json({ ok: true });
  } catch (e) {
    console.error('folder error:', e);
    return json({ error: e.message }, e.status || 500);
  }
}
