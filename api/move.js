import {
  blobPathname, displayName, fail, isAdmin, json, keyOf, lc, listAll, parse, prefixOf, validFolderPath,
} from './_lib.js';
import { childFolders, filesIn, folderPairs, hasName, relocate } from './_ops.js';

// Pindahkan file/folder ke folder tujuan (dest = [] berarti Beranda).
export async function POST(request) {
  if (!isAdmin(request)) return json({ error: 'Perlu login admin' }, 401);
  const { items, dest } = await request.json().catch(() => ({}));
  try {
    if (!Array.isArray(items) || !items.length || items.length > 200) throw fail('Item tidak valid');
    if (!Array.isArray(dest) || (dest.length && !validFolderPath(dest))) throw fail('Tujuan tidak valid');

    const destFolders = await childFolders(dest);
    const destFiles = new Set((await filesIn(dest)).map((x) => lc(x.name)));
    const pairs = [];

    for (const it of items) {
      if (it.type === 'file') {
        const pathname = blobPathname(it.url);
        const p = parse(pathname);
        if (!p || p.fname === '.folder') throw fail('File tidak valid');
        if (keyOf(p.path) === keyOf(dest)) continue;
        const nm = lc(displayName(p));
        if (destFiles.has(nm)) throw fail(`"${displayName(p)}" sudah ada di folder tujuan`, 409);
        destFiles.add(nm);
        pairs.push({ from: { url: it.url, pathname }, to: `${prefixOf(dest)}${p.ts}-${p.metaB64}/${p.fname}` });
      } else if (it.type === 'folder') {
        const path = it.path;
        if (!validFolderPath(path)) throw fail('Folder tidak valid');
        if (dest.length >= path.length && keyOf(dest.slice(0, path.length)) === keyOf(path)) {
          throw fail('Folder tidak bisa dipindahkan ke dalam dirinya sendiri');
        }
        if (keyOf(path.slice(0, -1)) === keyOf(dest)) continue;
        const name = path[path.length - 1];
        if (hasName(destFolders, name)) throw fail(`Folder "${name}" sudah ada di folder tujuan`, 409);
        destFolders.add(name);
        const newPath = [...dest, name];
        if (newPath.length > 12) throw fail('Folder terlalu dalam');
        pairs.push(...folderPairs(await listAll(prefixOf(path)), path, newPath));
      } else {
        throw fail('Item tidak valid');
      }
    }
    if (!pairs.length) return json({ ok: true, moved: 0 });
    const moved = await relocate(pairs);
    return json({ ok: true, moved });
  } catch (e) {
    console.error('move error:', e);
    return json({ error: e.message }, e.status || 500);
  }
}
