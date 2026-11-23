import { checkLogin, json, makeToken, sessionCookie } from './_lib.js';

export async function POST(request) {
  const { username, password } = await request.json().catch(() => ({}));
  if (!checkLogin(username, password)) {
    await new Promise((r) => setTimeout(r, 700)); // perlambat tebak password
    return json({ error: 'Username atau password salah' }, 401);
  }
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(makeToken(), 8 * 3600) });
}
