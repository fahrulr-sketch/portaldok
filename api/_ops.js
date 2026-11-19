import { copy, del } from '@vercel/blob';
import { displayName, lc, listAll, parse, prefixOf } from './_lib.js';

const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
};

// Nama subfolder langsung di bawah "parent".
export async function childFolders(parent) {
  const names = new Set();
  for (const b of await listAll(prefixOf(parent))) {
    const p = parse(b.pathname);
    if (p && p.path.length > parent.length) names.add(p.path[parent.length]);
  }
  return names;
}

// File (bukan penanda folder) yang langsung berada di "path".
export async function filesIn(path) {
  const out = [];
  for (const b of await listAll(prefixOf(path))) {
    const p = parse(b.pathname);
    if (p && p.path.length === path.length && p.fname !== '.folder') out.push({ b, p, name: displayName(p) });
  }
  return out;
}

export const hasName = (names, name, except) =>
  [...names].some((n) => lc(n) === lc(name) && n !== except);

export const folderPairs = (blobs, oldPath, newPath) =>
  blobs.flatMap((b) => {
    const p = parse(b.pathname);
    if (!p) return [];
    const np = [...newPath, ...p.path.slice(oldPath.length)];
    return [{ from: b, to: `${prefixOf(np)}${p.ts}-${p.metaB64}/${p.fname}` }];
  });

// Salin semua ke lokasi baru, lalu hapus yang lama. Jika ada yang gagal, salinan dibatalkan.
export async function relocate(pairs) {
  const made = [];
  try {
    for (let i = 0; i < pairs.length; i += 5) {
      await Promise.all(
        pairs.slice(i, i + 5).map(async ({ from, to }) => {
          if (from.pathname === to) return;
          const opts = { access: 'public', addRandomSuffix: false, allowOverwrite: false };
          const ct = MIME[to.split('.').pop().toLowerCase()];
          if (ct) opts.contentType = ct;
          const r = await copy(from.url, to, opts);
          made.push(r.url);
        })
      );
    }
  } catch (e) {
    for (let i = 0; i < made.length; i += 100) await del(made.slice(i, i + 100)).catch(() => {});
    throw e;
  }
  const olds = pairs.filter((x) => x.from.pathname !== x.to).map((x) => x.from.url);
  for (let i = 0; i < olds.length; i += 100) await del(olds.slice(i, i + 100));
  return made.length;
}
