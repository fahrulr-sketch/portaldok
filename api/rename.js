import {
  blobPathname, displayName, enc, fail, isAdmin, json, keyOf, lc, listAll, parse, prefixOf, safeName,
  isCategoryPath, validFolderPath, validName,
} from './_lib.js';
import { childFolders, filesIn, folderPairs, hasName, relocate } from './_ops.js';

const EXTS = ['pdf', 'xlsx', 'xls'];

export async function POST(request) {
  if (!isAdmin(request)) return json({ error: 'Perlu login admin' }, 401);
  const body = await request.json().catch(() => ({}));
  try {
    const name = String(body.name ?? '').trim();

    if (body.type === 'file') {
      const pathname = blobPathname(body.url);
      const p = parse(pathname);
      if (!p || p.fname === '.folder') throw fail('File tidak valid');
      if (!validName(name)) throw fail('Nama tidak valid (tidak boleh memuat / atau \\)');
      const oldExt = p.fname.split('.').pop().toLowerCase();
      const given = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
      let finalName = name;
      if (given !== oldExt) {
        if (EXTS.includes(given)) throw fail('Ekstensi file tidak boleh diubah');
        finalName = `${name}.${oldExt}`;
      }
      const sibs = await filesIn(p.path);
      if (sibs.some((s) => s.b.pathname !== pathname && lc(s.name) === lc(finalName))) {
        throw fail('Sudah ada file dengan nama itu di folder ini', 409);
      }
      const to = `${prefixOf(p.path)}${p.ts}-${enc(JSON.stringify({ n: finalName }))}/${safeName(finalName)}`;
      await relocate([{ from: { url: body.url, pathname }, to }]);
      return json({ ok: true, name: finalName });
    }

    if (body.type === 'folder') {
      const path = body.path;
      if (!validFolderPath(path)) throw fail('Folder tidak valid');
      if (isCategoryPath(path)) throw fail('Folder klasifikasi tidak bisa diganti namanya');
      if (!validName(name, 80)) throw fail('Nama folder tidak valid (tidak boleh memuat / atau \\)');
      const parent = path.slice(0, -1);
      const newPath = [...parent, name];
      if (keyOf(newPath) === keyOf(path)) return json({ ok: true });
      if (hasName(await childFolders(parent), name, path[path.length - 1])) {
        throw fail('Sudah ada folder dengan nama itu', 409);
      }
      const blobs = await listAll(prefixOf(path));
      await relocate(folderPairs(blobs, path, newPath));
      return json({ ok: true });
    }
    throw fail('Permintaan tidak valid');
  } catch (e) {
    console.error('rename error:', e);
    return json({ error: e.message }, e.status || 500);
  }
}
