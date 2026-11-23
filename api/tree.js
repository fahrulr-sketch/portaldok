import { CATEGORIES, displayName, json, listAll, parse } from './_lib.js';

// Publik: daftar seluruh folder dan dokumen (tanpa login).
export async function GET() {
  try {
    const files = [];
    const folders = [];
    for (const b of await listAll('files/')) {
      const p = parse(b.pathname);
      if (!p) continue;
      if (p.fname === '.folder') { folders.push(p.path); continue; }
      const ext = p.fname.split('.').pop().toLowerCase();
      files.push({
        id: b.pathname,
        url: b.url,
        downloadUrl: b.downloadUrl,
        name: displayName(p),
        fname: p.fname,
        path: p.path,
        type: ext === 'pdf' ? 'pdf' : 'xlsx',
        size: b.size,
        ts: Number(p.ts),
      });
    }
    return json({ files, folders, categories: CATEGORIES }, 200, {
      'cache-control': 'public, s-maxage=15, stale-while-revalidate=30',
    });
  } catch {
    return json({ error: 'Gagal memuat data' }, 500);
  }
}
