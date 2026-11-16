(() => {
const ADMIN = !!window.PORTAL_ADMIN;
const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
};
const MAXB = 50 * 1024 * 1024;
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sz = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const tgl = t => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const b64 = s => { let bin = ''; new TextEncoder().encode(s).forEach(x => bin += String.fromCharCode(x)); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const ext = n => (n.split('.').pop() || '').toLowerCase();
const cmp = (a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
const key = p => p.join('\u0001');
const ICON = {
  dir: '<svg viewBox="0 0 24 24" class="ico"><path fill="#f2b84b" d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  file: c => `<svg viewBox="0 0 24 24" class="ico"><path fill="#fff" stroke="#9aa4b2" d="M6 2h8l5 5v15H6z"/><rect x="2" y="12" width="15" height="8" rx="1.5" fill="${c[0]}"/><text x="9.5" y="18.2" font-size="5.5" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">${c[1]}</text></svg>`,
};
const fileIcon = t => t === 'pdf' ? ICON.file(['#c0392b', 'PDF']) : ICON.file(['#1a7f4b', 'XLS']);
const coarse = matchMedia('(pointer:coarse)').matches;

let data = { files: [], folders: [] }, allFolders = [];
let cwd = [], mode = 'grid', q = '', sel = new Set(), expanded = new Set(), side = false;
let loading = true, loadErr = '', admin = false, loginErr = '', up = null, note = '';
try { mode = localStorage.getItem('mode') || 'grid'; } catch {}

function derive() {
  const m = new Map();
  const add = p => { for (let i = 1; i <= p.length; i++) { const s = p.slice(0, i); m.set(key(s), s); } };
  data.files.forEach(f => add(f.path)); data.folders.forEach(add);
  allFolders = [...m.values()];
}
const isSub = (f, p) => f.length === p.length + 1 && key(f.slice(0, p.length)) === key(p);
const sub = p => allFolders.filter(f => isSub(f, p)).map(f => f[f.length - 1]).sort(cmp);
const items = () => {
  if (q) {
    const n = q.toLowerCase();
    return [
      ...allFolders.filter(p => p[p.length - 1].toLowerCase().includes(n)).sort((a, b) => cmp(a.join('/'), b.join('/'))).map(p => ({ t: 'd', path: p, name: p[p.length - 1] })),
      ...data.files.filter(f => f.name.toLowerCase().includes(n)).sort((a, b) => cmp(a.name, b.name)).map(f => ({ t: 'f', f, name: f.name })),
    ];
  }
  return [
    ...sub(cwd).map(n => ({ t: 'd', path: [...cwd, n], name: n })),
    ...data.files.filter(f => key(f.path) === key(cwd)).sort((a, b) => cmp(a.name, b.name)).map(f => ({ t: 'f', f, name: f.name })),
  ];
};
const iid = it => it.t === 'd' ? 'd:' + key(it.path) : 'f:' + it.f.id;
const toHash = p => '#/' + p.map(encodeURIComponent).join('/');
const fromHash = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

async function load() {
  try {
    const r = await fetch('/api/tree?t=' + Date.now());
    if (!r.ok) throw 0;
    data = await r.json(); loadErr = '';
  } catch { loadErr = 'Gagal memuat data. Coba muat ulang halaman.'; }
  loading = false; derive(); sel.clear(); render();
}
function route() {
  cwd = fromHash(); q = ''; sel.clear(); side = false;
  for (let i = 1; i <= cwd.length; i++) expanded.add(key(cwd.slice(0, i)));
  render();
}
const go = p => { if (key(p) === key(cwd)) return; location.hash = toHash(p); };

function treeHtml(p, d) {
  return sub(p).map(n => {
    const c = [...p, n], k = key(c), has = sub(c).length > 0, open = expanded.has(k);
    return `<div class="tn ${k === key(cwd) ? 'on' : ''}" style="padding-left:${8 + d * 16}px" data-nav="${esc(JSON.stringify(c))}"><span class="tg" data-tog="${esc(k)}">${has ? (open ? '▾' : '▸') : ''}</span>${ICON.dir}<span>${esc(n)}</span></div>` + (open && has ? treeHtml(c, d + 1) : '');
  }).join('');
}
function crumbs() {
  let h = `<button data-nav="[]">Beranda</button>`;
  cwd.forEach((n, i) => { h += `<span>›</span><button data-nav="${esc(JSON.stringify(cwd.slice(0, i + 1)))}">${esc(n)}</button>`; });
  return h;
}
const typeLabel = it => it.t === 'd' ? 'Folder' : it.f.type === 'pdf' ? 'Dokumen PDF' : 'Lembar Excel';
function mainHtml(list) {
  if (loading) return '<div class="empty">Memuat...</div>';
  if (loadErr) return `<div class="empty err">${esc(loadErr)}</div>`;
  if (!list.length) return `<div class="empty">${q ? 'Tidak ada hasil untuk "' + esc(q) + '".' : 'Folder ini kosong.' + (ADMIN ? '<br>Seret file atau folder ke sini untuk mengunggah.' : '')}</div>`;
  if (mode === 'grid') return `<div class="grid">${list.map(it => `<div class="it ${sel.has(iid(it)) ? 'sel' : ''}" data-id="${esc(iid(it))}" title="${esc(it.name)}">${it.t === 'd' ? ICON.dir : fileIcon(it.f.type)}<span class="nm">${esc(it.name)}</span></div>`).join('')}</div>`;
  const s = q ? ' s' : '';
  return `<div class="rows"><div class="rw h${s}"><span>Nama</span>${q ? '<span class="c x">Lokasi</span>' : ''}<span class="c x">Tanggal</span><span class="c x">Jenis</span><span class="c">Ukuran</span></div>${list.map(it => {
    const loc = (it.t === 'd' ? it.path.slice(0, -1) : it.f.path).join(' / ') || 'Beranda';
    return `<div class="it rw${s} ${sel.has(iid(it)) ? 'sel' : ''}" data-id="${esc(iid(it))}"><div class="n">${it.t === 'd' ? ICON.dir : fileIcon(it.f.type)}<span title="${esc(it.name)}">${esc(it.name)}</span></div>${q ? `<span class="c x">${esc(loc)}</span>` : ''}<span class="c x">${it.t === 'f' ? tgl(it.f.ts) : ''}</span><span class="c x">${typeLabel(it)}</span><span class="c">${it.t === 'f' ? sz(it.f.size) : ''}</span></div>`;
  }).join('')}</div>`;
}
function loginHtml() {
  return `<div class="win"><div class="title"><span class="dots"><i></i><i></i><i></i></span>Admin - Portal Dokumen</div>
  <form class="login" id="lf"><h2>Login admin</h2><input type="text" name="username" placeholder="Username" autocomplete="username" required>
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" required>
  <button class="pri" style="justify-content:center">Masuk</button><div class="err">${esc(loginErr)}</div><a href="/">Lihat tampilan pengguna</a></form></div>`;
}
function statusText(list) {
  const base = `${list.length} item`, s = sel.size ? ` · ${sel.size} dipilih` : '';
  return base + s;
}
function render() {
  if (ADMIN && !admin) { $('#app').innerHTML = loginHtml(); return; }
  const keepQ = document.activeElement && document.activeElement.id === 'q';
  const list = items();
  const upTxt = up ? `Mengunggah ${up.done}/${up.total}${up.fail ? ' (gagal ' + up.fail + ')' : ''}...` : note;
  $('#app').innerHTML = `<div class="win">
  <div class="title"><span class="dots"><i></i><i></i><i></i></span>Portal Dokumen<span class="tag">${ADMIN ? 'Mode Admin' : 'Akses publik'}</span></div>
  <div class="tb"><button class="menu" data-act="side" title="Folder">☰</button>
   <button data-act="back" title="Kembali">←</button><button data-act="up" title="Naik satu tingkat" ${cwd.length ? '' : 'disabled'}>↑</button>
   <div class="addr">${crumbs()}</div><input id="q" type="search" placeholder="Cari file atau folder" value="${esc(q)}">
   <button data-act="grid" class="${mode === 'grid' ? 'on' : ''}" title="Ikon">▦</button><button data-act="list" class="${mode === 'list' ? 'on' : ''}" title="Daftar">≣</button></div>
  <div class="cmd"><button data-act="download" ${[...sel].some(i => i.startsWith('f:')) ? '' : 'disabled'}>⬇ Unduh</button>
   ${ADMIN ? `<button class="pri" data-act="upfile">⬆ Unggah file</button><button data-act="updir">📁 Unggah folder</button><button data-act="newdir">＋ Folder baru</button><button class="dng" data-act="delete" ${sel.size ? '' : 'disabled'}>🗑 Hapus</button><button data-act="logout" style="margin-left:auto">Keluar</button>` : ''}</div>
  <div class="body"><div class="aside ${side ? 'show' : ''}"><div class="tn ${cwd.length ? '' : 'on'}" data-nav="[]"><span class="tg"></span>${ICON.dir}<span>Beranda</span></div>${treeHtml([], 0)}</div>
   <div class="main" id="main">${mainHtml(list)}</div></div>
  <div class="st"><span id="stt">${statusText(list)}</span><span>${esc(upTxt)}</span><span class="sp"></span>${ADMIN ? '<a href="/">Lihat sebagai pengguna</a>' : '<a href="/admin">Masuk admin</a>'}</div></div>
  ${ADMIN ? '<input class="hid" id="fi" type="file" multiple accept=".pdf,.xlsx,.xls"><input class="hid" id="di" type="file" webkitdirectory multiple>' : ''}`;
  if (keepQ) { const qi = $('#q'); qi.focus(); qi.setSelectionRange(q.length, q.length); }
}
function updateSel() {
  document.querySelectorAll('.it').forEach(el => el.classList.toggle('sel', sel.has(el.dataset.id)));
  const d = $('[data-act=download]'); if (d) d.disabled = ![...sel].some(i => i.startsWith('f:'));
  const x = $('[data-act=delete]'); if (x) x.disabled = !sel.size;
  const s = $('#stt'); if (s) s.textContent = statusText(items());
}
const find = id => items().find(i => iid(i) === id);
function dlFile(f) { const a = document.createElement('a'); a.href = f.downloadUrl; a.download = f.fname; document.body.appendChild(a); a.click(); a.remove(); }
function open(it) { if (it.t === 'd') go(it.path); else dlFile(it.f); }

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Terjadi kesalahan');
  return j;
}
async function act(a) {
  if (a === 'back') return history.back();
  if (a === 'up') return go(cwd.slice(0, -1));
  if (a === 'side') { side = !side; return render(); }
  if (a === 'grid' || a === 'list') { mode = a; try { localStorage.setItem('mode', a); } catch {} return render(); }
  if (a === 'download') { [...sel].map(find).filter(i => i && i.t === 'f').forEach((i, n) => setTimeout(() => dlFile(i.f), n * 500)); return; }
  if (!ADMIN) return;
  if (a === 'upfile') return $('#fi').click();
  if (a === 'updir') return $('#di').click();
  if (a === 'logout') { await post('/api/logout'); admin = false; return render(); }
  if (a === 'newdir') {
    const name = (prompt('Nama folder baru:') || '').trim();
    if (!name) return;
    if (/[\/\\]/.test(name) || name.length > 80) return alert('Nama folder tidak boleh memuat / atau \\ dan maksimal 80 karakter.');
    try { await post('/api/folder', { path: [...cwd, name] }); await load(); } catch (e) { alert(e.message); }
    return;
  }
  if (a === 'delete') {
    const list = [...sel].map(find).filter(Boolean);
    if (!list.length || !confirm(`Hapus ${list.length} item terpilih secara permanen? Isi folder ikut terhapus.`)) return;
    try {
      for (const it of list) await post('/api/delete', it.t === 'd' ? { folder: it.path } : { url: it.f.url });
      note = 'Item dihapus.';
    } catch (e) { alert(e.message); }
    await load();
  }
}
async function runUpload(entries) {
  const ok = entries.filter(e => MIME[ext(e.file.name)] && e.file.size <= MAXB);
  const skip = entries.length - ok.length;
  if (!ok.length) { note = 'Tidak ada file PDF/Excel yang valid (maks 50 MB).'; return render(); }
  up = { done: 0, total: ok.length, fail: 0 }; note = ''; render();
  let i = 0; const base = Date.now(); let lastErr = '';
  const worker = async () => {
    while (i < ok.length) {
      const idx = i++, { file, rel } = ok[idx];
      const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
      const segs = [...cwd, ...rel].map(b64);
      const path = `files/${segs.length ? segs.join('/') + '/' : ''}${base + idx}-${b64(JSON.stringify({ n: file.name }))}/${safe}`;
      try {
        await window.blobUpload(path, file, { access: 'public', contentType: MIME[ext(file.name)], handleUploadUrl: '/api/upload' });
      } catch (e) { up.fail++; lastErr = await explain(e); }
      up.done++; render();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  note = `Selesai: ${up.total - up.fail} diunggah${up.fail ? `, ${up.fail} gagal (${lastErr})` : ''}${skip ? `, ${skip} dilewati (bukan PDF/Excel atau >50 MB)` : ''}.`;
  up = null; await load();
}
async function explain(e) {
  const m = (e && e.message) || '';
  if (!/client token/i.test(m)) return m;
  try {
    const j = await (await fetch('/api/diag')).json();
    if (!j.admin) return 'sesi login habis, silakan keluar lalu login ulang';
    if (!j.blobToken) return 'BLOB_READ_WRITE_TOKEN belum terpasang: hubungkan Blob store ke project lalu Redeploy';
  } catch {}
  return m + ' - buka tab Network di browser, klik permintaan /api/upload, lalu lihat isi responsnya';
}
async function walk(entry, rel, out) {
  if (entry.isFile) { out.push({ file: await new Promise(r => entry.file(r)), rel }); return; }
  const rd = entry.createReader(), all = [];
  for (;;) { const b = await new Promise(r => rd.readEntries(r)); if (!b.length) break; all.push(...b); }
  for (const e of all) await walk(e, [...rel, entry.name], out);
}

document.addEventListener('click', e => {
  const t = e.target;
  const tog = t.closest('[data-tog]');
  if (tog) { const k = tog.dataset.tog; expanded.has(k) ? expanded.delete(k) : expanded.add(k); return render(); }
  const nav = t.closest('[data-nav]'); if (nav) { go(JSON.parse(nav.dataset.nav)); return; }
  const a = t.closest('[data-act]'); if (a) return act(a.dataset.act);
  const el = t.closest('.it');
  if (el) {
    const it = find(el.dataset.id); if (!it) return;
    if (coarse) return open(it);
    if (e.ctrlKey || e.metaKey) sel.has(el.dataset.id) ? sel.delete(el.dataset.id) : sel.add(el.dataset.id); else sel = new Set([el.dataset.id]);
    return updateSel();
  }
  if (t.closest('#main') && sel.size) { sel.clear(); updateSel(); }
});
document.addEventListener('dblclick', e => { const el = e.target.closest('.it'); if (el) { const it = find(el.dataset.id); if (it) open(it); } });
document.addEventListener('input', e => { if (e.target.id === 'q') { q = e.target.value; sel.clear(); render(); } });
document.addEventListener('keydown', e => {
  if (e.target.id === 'q' || !$('#main')) return;
  if (e.key === 'Backspace' && cwd.length) { e.preventDefault(); go(cwd.slice(0, -1)); }
  if (e.key === 'Enter' && sel.size === 1) { const it = find([...sel][0]); if (it) open(it); }
  if (e.key === 'Delete' && ADMIN && sel.size) act('delete');
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'lf') return; e.preventDefault();
  const fd = new FormData(e.target);
  try { await post('/api/login', { username: fd.get('username'), password: fd.get('password') }); admin = true; loginErr = ''; render(); }
  catch (err) { loginErr = err.message; render(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'fi') { runUpload([...e.target.files].map(file => ({ file, rel: [] }))); e.target.value = ''; }
  if (e.target.id === 'di') {
    runUpload([...e.target.files].map(file => ({ file, rel: (file.webkitRelativePath || file.name).split('/').slice(0, -1) })));
    e.target.value = '';
  }
});
if (ADMIN) {
  document.addEventListener('dragover', e => { if (admin) { e.preventDefault(); const m = $('#main'); if (m) m.classList.add('drag'); } });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) { const m = $('#main'); if (m) m.classList.remove('drag'); } });
  document.addEventListener('drop', async e => {
    if (!admin) return; e.preventDefault();
    const m = $('#main'); if (m) m.classList.remove('drag');
    const ents = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const out = []; for (const en of ents) await walk(en, [], out);
    runUpload(out);
  });
}
window.addEventListener('hashchange', route);
(async () => {
  if (ADMIN) { try { admin = (await (await fetch('/api/me')).json()).admin; } catch {} }
  route(); load();
})();
})();
