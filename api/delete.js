import { del, list } from '@vercel/blob';
import { enc, isAdmin, isCategoryPath, json, validFolderPath } from './_lib.js';

// Hapus satu file (url) atau satu folder beserta seluruh isinya (folder: [nama, ...]).
export async function POST(request) {
  if (!isAdmin(request)) return json({ error: 'Perlu login admin' }, 401);
  const { url, folder } = await request.json().catch(() => ({}));

  if (folder) {
    if (!validFolderPath(folder)) return json({ error: 'Folder tidak valid' }, 400);
    if (isCategoryPath(folder)) return json({ error: 'Folder klasifikasi tidak bisa dihapus' }, 400);
    const prefix = `files/${folder.map(enc).join('/')}/`;
    let cursor, count = 0;
    do {
      const r = await list({ prefix, limit: 1000, cursor });
      if (r.blobs.length) { await del(r.blobs.map((b) => b.url)); count += r.blobs.length; }
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return json({ ok: true, deleted: count });
  }

  try {
    if (!new URL(url).pathname.startsWith('/files/')) throw new Error();
  } catch {
    return json({ error: 'URL tidak valid' }, 400);
  }
  await del(url);
  return json({ ok: true });
}
