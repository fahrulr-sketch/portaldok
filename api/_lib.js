import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { list } from '@vercel/blob';

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// ---------- autentikasi ----------
const sha = (s) => createHash('sha256').update(String(s ?? '')).digest();
const safeEq = (a, b) => timingSafeEqual(sha(a), sha(b));
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';

export function checkLogin(user, pass) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const okUser = safeEq(user, process.env.ADMIN_USERNAME || 'admin');
  const okPass = safeEq(pass, pw);
  return okUser && okPass;
}

export function makeToken() {
  const exp = String(Date.now() + 8 * 3600 * 1000);
  const sig = createHmac('sha256', secret()).update(exp).digest('base64url');
  return `${exp}.${sig}`;
}

export function isAdmin(request) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)adm=([^;]+)/);
  if (!m || !secret()) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = createHmac('sha256', secret()).update(exp).digest('base64url');
  return safeEq(sig, good);
}

export const sessionCookie = (value, maxAge) =>
  `adm=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

// ---------- skema path ----------
// files/{folder-b64}/.../{timestamp}-{meta-b64}/{namafile}
export const enc = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
export const dec = (s) => Buffer.from(s, 'base64url').toString('utf8');
export const FILE_RE = /^files\/((?:[A-Za-z0-9_-]+\/)*)(\d+)-([A-Za-z0-9_-]+)\/([^/]+)$/;

export function parse(pathname) {
  const m = String(pathname).match(FILE_RE);
  if (!m) return null;
  let path;
  try { path = m[1].split('/').filter(Boolean).map(dec); } catch { return null; }
  return { path, ts: m[2], metaB64: m[3], fname: m[4] };
}
export const prefixOf = (path) => (path.length ? `files/${path.map(enc).join('/')}/` : 'files/');
export const keyOf = (p) => p.join('\u0001');
export const lc = (s) => String(s).trim().toLowerCase();
export const safeName = (n) =>
  String(n).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
export const displayName = (p) => {
  try { return JSON.parse(dec(p.metaB64)).n || p.fname; } catch { return p.fname; }
};

export const validName = (n, max = 150) =>
  typeof n === 'string' && n.trim().length > 0 && n.length <= max &&
  !/[\u0000-\u001f\/\\]/.test(n) && n.trim() !== '.' && n.trim() !== '..';

export const validFolderPath = (p, min = 1) =>
  Array.isArray(p) && p.length >= min && p.length <= 12 && p.every((n) => validName(n, 80));

// URL blob yang sah milik portal ini (cegah SSRF dan path liar).
export function blobPathname(url) {
  let u;
  try { u = new URL(url); } catch { throw fail('URL tidak valid'); }
  if (!u.hostname.endsWith('.blob.vercel-storage.com') || !u.pathname.startsWith('/files/')) {
    throw fail('URL tidak valid');
  }
  return u.pathname.slice(1);
}

export async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, limit: 1000, cursor });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}
