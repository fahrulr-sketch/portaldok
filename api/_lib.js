import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

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

// Nama folder disimpan di path blob dalam bentuk base64url (aman untuk karakter apa pun).
export const enc = (s) => Buffer.from(String(s), 'utf8').toString('base64url');
export const dec = (s) => Buffer.from(s, 'base64url').toString('utf8');

export function validFolderPath(p) {
  return (
    Array.isArray(p) &&
    p.length >= 1 &&
    p.length <= 12 &&
    p.every((n) => typeof n === 'string' && n.trim() && n.length <= 80 && !/[\u0000-\u001f\/\\]/.test(n))
  );
}
