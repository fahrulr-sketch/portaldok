import { isAdmin, json } from './_lib.js';

export async function GET(request) {
  return json({ admin: isAdmin(request) }, 200, { 'cache-control': 'no-store' });
}
