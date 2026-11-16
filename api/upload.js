import { handleUpload } from '@vercel/blob/client';
import { isAdmin, json } from './_lib.js';

const PATH_RE =
  /^files\/(?:[A-Za-z0-9_-]+\/){0,12}\d+-[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+\.(pdf|xlsx|xls)$/i;

// Token unggah hanya diberikan kepada admin yang sudah login.
export async function POST(request) {
  const body = await request.json();
  try {
    const res = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAdmin(request)) throw new Error('Perlu login admin');
        if (!PATH_RE.test(pathname)) throw new Error('Path file tidak valid');
        return {
          allowedContentTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return json(res);
  } catch (e) {
    console.error('upload token error:', e);
    return json({ error: e.message }, 400);
  }
}
