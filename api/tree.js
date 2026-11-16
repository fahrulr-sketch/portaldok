import { list } from '@vercel/blob';
import { dec, json } from './_lib.js';

// Publik: daftar seluruh folder dan dokumen (tanpa login).
// Path blob: files/{folder-b64}/.../{timestamp}-{meta-b64}/{namafile}
const RE = /^files\/((?:[A-Za-z0-9_-]+\/)*)(\d+)-([A-Za-z0-9_-]+)\/([^/]+)$/;

export async function GET() {
  try {
    const blobs = [];
    let cursor;
    do {
      const r = await list({ prefix: 'files/', limit: 1000, cursor });
      blobs.push(...r.blobs);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);

    const files = [];
    const folders = [];
    for (const b of blobs) {
      const m = b.pathname.match(RE);
      if (!m) continue;
      let path;
      try { path = m[1].split('/').filter(Boolean).map(dec); } catch { continue; }
      if (m[4] === '.folder') { folders.push(path); continue; }
      let meta = {};
      try { meta = JSON.parse(dec(m[3])); } catch {}
      const ext = m[4].split('.').pop().toLowerCase();
      files.push({
        id: b.pathname,
        url: b.url,
        downloadUrl: b.downloadUrl,
        name: meta.n || m[4],
        fname: m[4],
        path,
        type: ext === 'pdf' ? 'pdf' : 'xlsx',
        size: b.size,
        ts: Number(m[2]),
      });
    }
    return json({ files, folders }, 200, {
      'cache-control': 'public, s-maxage=15, stale-while-revalidate=30',
    });
  } catch {
    return json({ error: 'Gagal memuat data' }, 500);
  }
}
