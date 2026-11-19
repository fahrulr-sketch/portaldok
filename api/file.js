import { blobPathname, json } from './_lib.js';

// Proxy baca-saja untuk pratinjau (dipakai jika browser tidak boleh mengambil langsung dari Blob).
export async function GET(request) {
  try {
    const url = new URL(request.url).searchParams.get('url') || '';
    blobPathname(url);
    const r = await fetch(url);
    if (!r.ok || !r.body) return json({ error: 'File tidak ditemukan' }, 404);
    return new Response(r.body, {
      headers: {
        'content-type': r.headers.get('content-type') || 'application/octet-stream',
        'content-disposition': 'inline',
        'cache-control': 'public, max-age=300',
      },
    });
  } catch (e) {
    return json({ error: e.message || 'Gagal' }, e.status || 500);
  }
}
