(() => {
const ADMIN = !!window.PORTAL_ADMIN;
const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
};
const MAXB = 50 * 1024 * 1024;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sz = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(b ? 1 : 0, Math.round(b / 1024)) + ' KB';
const tgl = t => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const b64 = s => { let bin = ''; new TextEncoder().encode(s).forEach(x => bin += String.fromCharCode(x)); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const ext = n => (n.split('.').pop() || '').toLowerCase();
const cmp = (a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
const lc = s => String(s).trim().toLowerCase();
const key = p => p.join('\u0001');
const ICON = {
  dir: '<svg viewBox="0 0 24 24" class="ico"><path fill="#f2b84b" d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  file: c => `<svg viewBox="0 0 24 24" class="ico"><path fill="#fff" stroke="#9aa4b2" d="M6 2h8l5 5v15H6z"/><rect x="2" y="12" width="15" height="8" rx="1.5" fill="${c[0]}"/><text x="9.5" y="18.2" font-size="5.5" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">${c[1]}</text></svg>`,
};
const fileIcon = t => t === 'pdf' ? ICON.file(['#c0392b', 'PDF']) : ICON.file(['#1a7f4b', 'XLS']);
const coarse = matchMedia('(pointer:coarse)').matches;

// ---------- state ----------
let data = { files: [], folders: [] }, allFolders = [];
let cwd = [], mode = 'grid', sortKey = 'name', sortDir = 1, q = '';
let sel = new Set(), lastSel = null, expanded = new Set(), side = false;
let loading = true, loadErr = '', admin = false, loginErr = '', up = null, note = '';
const SORT_KEYS = ['name', 'date', 'size', 'type'];
let editing = null, clip = null, rendering = false;
let cats = window.PORTAL_CATEGORIES || [], uploadBase = null, pickCb = null, pendingNew = false;
let initQ = new URLSearchParams(location.search).get('q') || '';
const isCat = p => p.length === 1 && cats.includes(p[0]);
const inCat = p => p.length >= 1 && cats.includes(p[0]);
try { mode = localStorage.getItem('mode') || 'grid'; sortKey = localStorage.getItem('sortKey') || 'name'; } catch {}
if (!SORT_KEYS.includes(sortKey)) sortKey = 'name';

function derive() {
  const m = new Map();
  const add = p => { for (let i = 1; i <= p.length; i++) { const s = p.slice(0, i); m.set(key(s), s); } };
  data.files.forEach(f => add(f.path)); data.folders.forEach(add); cats.forEach(c => add([c]));
  allFolders = [...m.values()];
}
const isSub = (f, p) => f.length === p.length + 1 && key(f.slice(0, p.length)) === key(p);
const sub = p => {
  const names = allFolders.filter(f => isSub(f, p)).map(f => f[f.length - 1]);
  if (p.length) return names.sort(cmp);
  return [...cats.filter(c => names.includes(c)), ...names.filter(n => !cats.includes(n)).sort(cmp)];
};
const SORT = { name: (a, b) => cmp(a.name, b.name), date: (a, b) => a.f.ts - b.f.ts, size: (a, b) => a.f.size - b.f.size, type: (a, b) => cmp(a.f.type, b.f.type) };
function sortFiles(list) { return list.sort((a, b) => sortDir * (SORT[sortKey](a, b) || cmp(a.name, b.name))); }
function items() {
  if (q) {
    const n = q.toLowerCase();
    return [
      ...allFolders.filter(p => p[p.length - 1].toLowerCase().includes(n)).sort((a, b) => cmp(a.join('/'), b.join('/'))).map(p => ({ t: 'd', path: p, name: p[p.length - 1] })),
      ...sortFiles(data.files.filter(f => f.name.toLowerCase().includes(n)).map(f => ({ t: 'f', f, name: f.name }))),
    ];
  }
  const dirs = sub(cwd).map(n => ({ t: 'd', path: [...cwd, n], name: n }));
  if (sortKey === 'name' && sortDir < 0) dirs.reverse();
  return [...dirs, ...sortFiles(data.files.filter(f => key(f.path) === key(cwd)).map(f => ({ t: 'f', f, name: f.name })))];
}
const viewItems = () => {
  const l = items();
  if (editing && editing.mode === 'new') l.unshift({ t: 'd', path: [...cwd, ''], name: editing.value, temp: true });
  return l;
};
const iid = it => it.temp ? 'new:folder' : it.t === 'd' ? 'd:' + key(it.path) : 'f:' + it.f.id;
const find = id => items().find(i => iid(i) === id);
const selItems = () => [...sel].map(find).filter(Boolean);
const toHash = p => '#/' + p.map(encodeURIComponent).join('/');
const fromHash = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
const typeLabel = it => it.t === 'd' ? 'Folder' : it.f.type === 'pdf' ? 'Dokumen PDF' : 'Lembar Excel';
const clipIds = () => clip ? new Set(clip.map(i => i.id)) : new Set();

// ---------- util UI ----------
function toast(msg, isErr) {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div'); el.className = 'toast' + (isErr ? ' bad' : ''); el.textContent = msg;
  box.appendChild(el); setTimeout(() => el.remove(), isErr ? 5000 : 2500);
}
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Terjadi kesalahan'), { status: r.status });
  return j;
}
async function load() {
  try {
    const r = await fetch('/api/tree?t=' + Date.now());
    if (!r.ok) throw 0;
    data = await r.json(); loadErr = ''; if (Array.isArray(data.categories)) cats = data.categories;
  } catch { loadErr = 'Gagal memuat data. Coba muat ulang halaman.'; }
  loading = false; derive();
  const valid = new Set(items().map(iid)); sel = new Set([...sel].filter(i => valid.has(i)));
  render();
}
function route() {
  closeViewer(); closeMenu(); editing = null;
  cwd = fromHash(); q = initQ; initQ = ''; sel.clear(); lastSel = null; side = false;
  const ni = $('#nav .srch input'); if (ni) ni.value = q;
  for (let i = 1; i <= cwd.length; i++) expanded.add(key(cwd.slice(0, i)));
  render();
  if (pendingNew) { pendingNew = false; startNewFolder(); }
}
const go = p => { if (key(p) !== key(cwd)) location.hash = toHash(p); };

// ---------- render ----------
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
function nameEl(it) {
  if (editing && editing.id === iid(it)) return `<input class="ren" value="${esc(editing.value)}" spellcheck="false" maxlength="150" autocomplete="off">`;
  return `<span class="nm" title="${esc(it.name)}">${esc(it.name)}</span>`;
}
function mainHtml(list) {
  if (loading) return '<div class="empty">Memuat...</div>';
  if (loadErr) return `<div class="empty err">${esc(loadErr)}</div>`;
  if (!list.length) return `<div class="empty">${q ? 'Tidak ada hasil untuk "' + esc(q) + '".' : 'Folder ini kosong.' + (ADMIN ? '<br>Klik kanan untuk membuat folder, atau seret file/folder ke sini untuk mengunggah.' : '')}</div>`;
  const cut = clipIds(), canDrag = it => ADMIN && !editing && !(it.t === 'd' && isCat(it.path)), drag = it => canDrag(it) ? 'draggable="true"' : '';
  const cls = it => `it${sel.has(iid(it)) ? ' sel' : ''}${cut.has(iid(it)) ? ' cut' : ''}`;
  if (mode === 'grid') return `<div class="grid">${list.map(it => `<div class="${cls(it)}" data-id="${esc(iid(it))}" ${drag(it)}>${it.t === 'd' ? ICON.dir : fileIcon(it.f.type)}${nameEl(it)}</div>`).join('')}</div>`;
  const s = q ? ' s' : '', arr = k => sortKey === k ? (sortDir > 0 ? ' ▲' : ' ▼') : '';
  return `<div class="rows"><div class="rw h${s}"><span data-sort="name">Nama${arr('name')}</span>${q ? '<span class="c x">Lokasi</span>' : ''}<span class="c x" data-sort="date">Tanggal${arr('date')}</span><span class="c x" data-sort="type">Jenis${arr('type')}</span><span class="c" data-sort="size">Ukuran${arr('size')}</span></div>${list.map(it => {
    const loc = (it.t === 'd' ? it.path.slice(0, -1) : it.f.path).join(' / ') || 'Beranda';
    return `<div class="${cls(it)} rw${s}" data-id="${esc(iid(it))}" ${drag(it)}><div class="n">${it.t === 'd' ? ICON.dir : fileIcon(it.f.type)}${nameEl(it)}</div>${q ? `<span class="c x">${esc(loc)}</span>` : ''}<span class="c x">${it.t === 'f' ? tgl(it.f.ts) : ''}</span><span class="c x">${typeLabel(it)}</span><span class="c">${it.t === 'f' ? sz(it.f.size) : ''}</span></div>`;
  }).join('')}</div>`;
}
function loginHtml() {
  return `<div class="win"><div class="title"><span class="dots"><i></i><i></i><i></i></span>Admin - Portal Data</div>
  <form class="login" id="lf"><h2>Login admin</h2><input type="text" name="username" placeholder="Username" autocomplete="username" required>
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" required>
  <button class="pri" style="justify-content:center">Masuk</button><div class="err">${esc(loginErr)}</div><a href="/data">Lihat tampilan pengguna</a></form></div>`;
}
function statusText(list) {
  const picked = selItems(), bytes = picked.reduce((a, i) => a + (i.t === 'f' ? i.f.size : 0), 0);
  return `${list.length} item` + (picked.length ? ` · ${picked.length} dipilih${bytes ? ' (' + sz(bytes) + ')' : ''}` : '');
}
const can = a => {
  const n = sel.size, files = selItems().some(i => i.t === 'f'), prot = selItems().some(i => i.t === 'd' && isCat(i.path));
  switch (a) {
    case 'up': return cwd.length > 0;
    case 'open': case 'props': case 'copylink': return n === 1;
    case 'download': return files;
    case 'rename': return ADMIN && n === 1 && !prot;
    case 'cut': case 'delete': return ADMIN && n > 0 && !prot;
    case 'paste': return ADMIN && !!clip && clip.length > 0;
    default: return true;
  }
};
function render() {
  if (ADMIN && !admin) { $('#app').innerHTML = loginHtml(); return; }
  rendering = true;
  const list = viewItems();
  const upTxt = up ? `Mengunggah ${up.done}/${up.total}${up.fail ? ' (gagal ' + up.fail + ')' : ''}...` : note;
  const b = (a, label, cls = '') => `<button class="${cls}" data-act="${a}">${label}</button>`;
  $('#app').innerHTML = `<div class="win">
  <div class="title"><span class="dots"><i></i><i></i><i></i></span>Portal Data<span class="tag">${ADMIN ? 'Mode Admin' : 'Akses publik'}</span>${ADMIN ? '<button data-act="logout">Keluar</button>' : ''}</div>
  <div class="tb"><button class="menu" data-act="side" title="Folder">☰</button>
   ${b('back', '←')}${b('up', '↑')}${b('refresh', '⟳')}
   <div class="addr">${crumbs()}</div>
   <button data-act="grid" class="${mode === 'grid' ? 'on' : ''}" title="Ikon">▦</button><button data-act="list" class="${mode === 'list' ? 'on' : ''}" title="Daftar">≣</button></div>
  <div class="cmd">${b('open', '👁 Pratinjau')}${b('download', '⬇ Unduh')}
   ${ADMIN ? `<span class="vr"></span>${b('upfile', '⬆ Unggah file', 'pri')}${b('updir', '📁 Unggah folder')}${b('newdir', '＋ Folder baru')}<span class="vr"></span>${b('rename', '✎ Ganti nama')}${b('cut', '✂ Potong')}${b('paste', '📋 Tempel')}${b('delete', '🗑 Hapus', 'dng')}` : ''}
   <span class="sp"></span><select id="sort" title="Urutkan"><option value="name">Urut: Nama</option><option value="date">Urut: Tanggal</option><option value="size">Urut: Ukuran</option><option value="type">Urut: Jenis</option></select>${b('sortdir', sortDir > 0 ? '▲' : '▼')}</div>
  <div class="body"><div class="aside ${side ? 'show' : ''}"><div class="tn ${cwd.length ? '' : 'on'}" data-nav="[]"><span class="tg"></span>${ICON.dir}<span>Beranda</span></div>${treeHtml([], 0)}</div>
   <div class="main" id="main">${mainHtml(list)}</div></div>
  <div class="st"><span id="stt">${esc(statusText(items()))}</span><span>${esc(upTxt)}</span><span class="sp"></span>${ADMIN ? '<a href="/data">Lihat sebagai pengguna</a>' : '<a href="/admin">Masuk admin</a>'}</div></div>
  ${ADMIN ? '<input class="hid" id="fi" type="file" multiple accept=".pdf,.xlsx,.xls"><input class="hid" id="di" type="file" webkitdirectory multiple>' : ''}`;
  $('#sort').value = sortKey;
  refreshButtons();
  rendering = false;
  if (editing) {
    const el = $('.ren');
    if (el) { el.focus(); const it = editing.mode === 'rename' && find(editing.id); const dot = it && it.t === 'f' ? el.value.lastIndexOf('.') : -1; dot > 0 ? el.setSelectionRange(0, dot) : el.select(); }
  }
}
function refreshButtons() { $$('[data-act]').forEach(b => { b.disabled = !can(b.dataset.act); }); }
function updateSel() {
  $$('.it').forEach(el => el.classList.toggle('sel', sel.has(el.dataset.id)));
  refreshButtons();
  const s = $('#stt'); if (s) s.textContent = statusText(items());
}

// ---------- aksi umum ----------
function dlFile(f) { const a = document.createElement('a'); a.href = f.downloadUrl; a.download = f.fname; document.body.appendChild(a); a.click(); a.remove(); }
function open(it) { if (it.t === 'd') go(it.path); else openViewer(it.f); }
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Tautan disalin'); } catch { prompt('Salin tautan ini:', t); }
}
function uniqueName(base, names) {
  const have = new Set(names.map(lc)); if (!have.has(lc(base))) return base;
  for (let i = 2; ; i++) { const n = `${base} (${i})`; if (!have.has(lc(n))) return n; }
}
function startNewFolder() {
  if (!cwd.length) return;
  if (q) { q = ''; }
  editing = { mode: 'new', id: 'new:folder', value: uniqueName('Folder baru', sub(cwd)) };
  sel.clear(); render();
}
function startRename() {
  if (!can('rename')) return;
  const it = selItems()[0]; if (!it) return;
  editing = { mode: 'rename', id: iid(it), value: it.name }; render();
}
const badName = (n, max) => /[\/\\]/.test(n) ? 'Nama tidak boleh memuat / atau \\' : n.length > max ? `Nama terlalu panjang (maks ${max} karakter)` : '';
async function commitEdit() {
  const ed = editing; if (!ed) return;
  const inp = $('.ren'), name = (inp ? inp.value : ed.value).trim();
  if (ed.mode === 'new') {
    const err = !name ? '' : badName(name, 80) || (sub(cwd).some(n => lc(n) === lc(name)) ? 'Sudah ada folder dengan nama itu' : '');
    if (!name) { editing = null; return render(); }
    if (err) { toast(err, true); editing = { ...ed, value: name }; return render(); }
    editing = null; render();
    try { await post('/api/folder', { path: [...cwd, name] }); await load(); sel = new Set(['d:' + key([...cwd, name])]); updateSel(); }
    catch (e) { toast(e.message, true); await load(); }
    return;
  }
  const it = find(ed.id); editing = null;
  if (!it || !name || name === it.name) return render();
  const err = badName(name, it.t === 'd' ? 80 : 150);
  if (err) { toast(err, true); editing = { ...ed, value: name }; return render(); }
  try {
    await post('/api/rename', it.t === 'd' ? { type: 'folder', path: it.path, name } : { type: 'file', url: it.f.url, name });
    await load();
    const nn = items().find(i => i.t === it.t && (lc(i.name) === lc(name) || (i.t === 'f' && lc(i.name).startsWith(lc(name) + '.'))));
    if (nn) { sel = new Set([iid(nn)]); updateSel(); }
    toast('Nama diganti');
  } catch (e) {
    toast(e.message, true);
    if (e.status === 409) { editing = { ...ed, value: name }; render(); } else render();
  }
}
const toMoveItems = list => list.map(i => i.t === 'd' ? { type: 'folder', path: i.path } : { type: 'file', url: i.f.url });
async function doMove(moveItems, dest) {
  try {
    const r = await post('/api/move', { items: moveItems, dest });
    toast(r.moved ? 'Dipindahkan' : 'Tidak ada yang dipindahkan');
  } catch (e) { toast(e.message, true); }
  await load();
}
function showProps(it) {
  let rows;
  const loc = it.t === 'f' ? it.f.path : it.path.slice(0, -1);
  if (it.t === 'f') rows = [['Nama', it.f.name], ['Jenis', typeLabel(it)], ['Lokasi', ['Beranda', ...loc].join(' › ')], ['Ukuran', `${sz(it.f.size)} (${it.f.size.toLocaleString('id-ID')} byte)`], ['Diunggah', new Date(it.f.ts).toLocaleString('id-ID')]];
  else {
    const k = key(it.path), inside = p => p.length >= it.path.length && key(p.slice(0, it.path.length)) === k;
    const fs = data.files.filter(f => inside(f.path)), subs = allFolders.filter(p => p.length > it.path.length && inside(p));
    rows = [['Nama', it.name], ['Jenis', 'Folder'], ['Lokasi', ['Beranda', ...loc].join(' › ')], ['Berisi', `${fs.length} file, ${subs.length} subfolder`], ['Ukuran', sz(fs.reduce((a, f) => a + f.size, 0))]];
  }
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="mbox"><h3>Properti</h3><div class="pr">${rows.map(r => `<span>${r[0]}</span><b>${esc(r[1])}</b>`).join('')}</div><div style="text-align:right;margin-top:14px"><button class="pri" data-m="close">Tutup</button></div></div>`;
  document.body.appendChild(m);
}
const closeModal = () => { const m = $('#modal'); if (m) m.remove(); };
function pickCategory(cb) {
  closeModal(); pickCb = cb;
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="mbox wide"><h3>Pilih klasifikasi</h3><p class="sub">Tentukan klasifikasi sebelum menambahkan folder atau file baru.</p>
  <div class="cats">${cats.map(c => `<button data-cat="${esc(c)}">${ICON.dir}<span>${esc(c)}</span></button>`).join('')}</div>
  <div style="text-align:right;margin-top:14px"><button data-m="close">Batal</button></div></div>`;
  document.body.appendChild(m);
}

async function act(a) {
  closeMenu();
  if (['rename', 'cut', 'delete'].includes(a) && !can(a)) return;
  if (a === 'back') return history.back();
  if (a === 'up') return go(cwd.slice(0, -1));
  if (a === 'refresh') { await load(); return toast('Daftar diperbarui'); }
  if (a === 'side') { side = !side; return render(); }
  if (a === 'grid' || a === 'list') { mode = a; try { localStorage.setItem('mode', a); } catch {} return render(); }
  if (a === 'sortdir') { sortDir *= -1; return render(); }
  if (a === 'selectall') { sel = new Set(items().map(iid)); return updateSel(); }
  if (a === 'open') { const it = selItems()[0]; return it && open(it); }
  if (a === 'props') { const it = selItems()[0]; return it && showProps(it); }
  if (a === 'copylink') {
    const it = selItems()[0]; if (!it) return;
    return copyText(it.t === 'd' ? location.origin + '/data' + toHash(it.path) : it.f.url);
  }
  if (a === 'download') {
    const fs = selItems().filter(i => i.t === 'f');
    if (!fs.length) return toast('Pilih file untuk diunduh', true);
    return fs.forEach((i, n) => setTimeout(() => dlFile(i.f), n * 500));
  }
  if (!ADMIN) return;
  if (['upfile', 'updir', 'newdir', 'paste'].includes(a) && !cwd.length) {
    if (a === 'paste' && !(clip && clip.length)) return;
    return pickCategory(cat => {
      if (a === 'upfile') { uploadBase = [cat]; $('#fi').click(); }
      else if (a === 'updir') { uploadBase = [cat]; $('#di').click(); }
      else if (a === 'newdir') { pendingNew = true; go([cat]); }
      else { const its = clip.map(c => c.item); clip = null; doMove(its, [cat]); }
    });
  }
  if (a === 'upfile') { uploadBase = null; return $('#fi').click(); }
  if (a === 'updir') { uploadBase = null; return $('#di').click(); }
  if (a === 'logout') { await post('/api/logout'); admin = false; return render(); }
  if (a === 'newdir') return startNewFolder();
  if (a === 'rename') return startRename();
  if (a === 'cut') {
    const l = selItems(); if (!l.length) return;
    clip = l.map(i => ({ id: iid(i), item: toMoveItems([i])[0] })); toast(`${l.length} item dipotong. Buka folder tujuan lalu pilih Tempel.`); return render();
  }
  if (a === 'paste') {
    if (!clip || !clip.length) return;
    const its = clip.map(c => c.item); clip = null; return doMove(its, cwd);
  }
  if (a === 'delete') {
    const l = selItems();
    if (!l.length || !confirm(`Hapus ${l.length} item terpilih secara permanen? Isi folder ikut terhapus.`)) return;
    try { for (const it of l) await post('/api/delete', it.t === 'd' ? { folder: it.path } : { url: it.f.url }); toast('Item dihapus'); }
    catch (e) { toast(e.message, true); }
    await load();
  }
}

// ---------- menu klik kanan ----------
function closeMenu() { const m = $('#cm'); if (m) m.remove(); }
function showMenu(x, y, onItem) {
  closeMenu();
  const e = (a, l, extra = '') => can(a) || a === 'selectall' || a === 'refresh' || a === 'newdir' || a === 'upfile' || a === 'updir' ? `<button data-cm="${a}" ${can(a) ? '' : 'disabled'} class="${extra}">${l}</button>` : '';
  const sep = '<hr>';
  let h;
  if (onItem) {
    const one = sel.size === 1;
    h = (one ? e('open', 'Buka / Pratinjau') : '') + e('download', 'Unduh') + (one ? e('copylink', 'Salin tautan') : '') +
      (ADMIN ? sep + (one ? e('rename', 'Ganti nama (F2)') : '') + e('cut', 'Potong') + e('delete', 'Hapus', 'dng') : '') + (one ? sep + e('props', 'Properti') : '');
  } else {
    h = ADMIN ? e('newdir', 'Folder baru') + e('upfile', 'Unggah file') + e('updir', 'Unggah folder') + (clip ? e('paste', 'Tempel') : '') + sep : '';
    h += e('selectall', 'Pilih semua') + e('refresh', 'Segarkan');
  }
  const m = document.createElement('div'); m.id = 'cm'; m.className = 'cm'; m.innerHTML = h;
  document.body.appendChild(m);
  m.style.left = Math.max(4, Math.min(x, innerWidth - m.offsetWidth - 4)) + 'px';
  m.style.top = Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 4)) + 'px';
}

// ---------- viewer ----------
let V = null, vtok = 0, vpdf = null, vgen = 0, vzoom = 1, vwb = null, vobs = null;
function closeViewer() {
  vtok++; vgen++; if (vobs) { vobs.disconnect(); vobs = null; }
  if (vpdf) { try { vpdf.destroy(); } catch {} vpdf = null; }
  const el = $('#viewer'); if (el) el.remove(); V = null; vwb = null;
}
function openViewer(f) {
  const list = items().filter(i => i.t === 'f').map(i => i.f);
  const idx = list.findIndex(x => x.id === f.id);
  V = { list: idx < 0 ? [f] : list, idx: Math.max(idx, 0) };
  let el = $('#viewer');
  if (!el) { el = document.createElement('div'); el.id = 'viewer'; el.className = 'vw'; document.body.appendChild(el); }
  showViewer();
}
async function fetchBuf(f) {
  try { const r = await fetch(f.url); if (!r.ok) throw 0; return await r.arrayBuffer(); }
  catch { const r = await fetch('/api/file?url=' + encodeURIComponent(f.url)); if (!r.ok) throw new Error('File tidak bisa dimuat'); return await r.arrayBuffer(); }
}
async function showViewer() {
  const f = V.list[V.idx], tok = ++vtok; vgen++;
  if (vobs) { vobs.disconnect(); vobs = null; }
  if (vpdf) { try { vpdf.destroy(); } catch {} vpdf = null; }
  vwb = null; vzoom = 1;
  const pdf = f.type === 'pdf', multi = V.list.length > 1;
  $('#viewer').innerHTML = `<div class="vh"><button data-v="close" title="Tutup (Esc)">✕</button>${fileIcon(f.type)}<span class="vt" title="${esc(f.name)}">${esc(f.name)}</span><span class="sp"></span>
   ${pdf ? '<span id="vpage" class="vm2"></span><button data-v="zout" title="Perkecil">−</button><button data-v="zin" title="Perbesar">＋</button>' : ''}
   ${multi ? `<button data-v="prev" title="Sebelumnya (←)" ${V.idx ? '' : 'disabled'}>‹</button><span class="vm2">${V.idx + 1}/${V.list.length}</span><button data-v="next" title="Berikutnya (→)" ${V.idx < V.list.length - 1 ? '' : 'disabled'}>›</button>` : ''}
   <a class="btn" href="${esc(f.url)}" target="_blank" rel="noopener">Buka di tab baru</a><button class="pri" data-v="dl">⬇ Unduh</button></div>
   <div class="vb" id="vb"><div class="vm">Memuat pratinjau...</div></div>`;
  try { if (pdf) await renderPdf(f, tok); else await renderXlsx(f, tok); }
  catch (e) { if (tok === vtok) $('#vb').innerHTML = `<div class="vm">Pratinjau tidak tersedia (${esc(e.message || 'error')}).<br>Silakan unduh file untuk membukanya.</div>`; }
}
async function renderPdf(f, tok) {
  if (!window.__pdfjs) {
    const m = await import('/vendor/pdf.min.mjs'); m.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs'; window.__pdfjs = m;
  }
  const buf = await fetchBuf(f); if (tok !== vtok) return;
  const doc = await window.__pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  if (tok !== vtok) { doc.destroy(); return; }
  vpdf = doc;
  const vb = $('#vb'); vb.innerHTML = '<div class="pages" id="pg"></div>'; const pg = $('#pg');
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i); if (tok !== vtok) return;
    const w = document.createElement('div'); w.className = 'pgw'; w._page = page; w._vp = page.getViewport({ scale: 1 }); w.dataset.n = i; pg.appendChild(w);
  }
  layoutPages();
  vb.onscroll = () => {
    const ws = $$('.pgw'), top = vb.scrollTop + vb.clientHeight / 3; let cur = 1;
    for (const w of ws) { if (w.offsetTop <= top) cur = Number(w.dataset.n); else break; }
    const pEl = $('#vpage'); if (pEl) pEl.textContent = `Hal ${cur}/${doc.numPages}`;
  };
  vb.onscroll();
}
function layoutPages() {
  const vb = $('#vb'); if (!vb || !vpdf) return;
  vgen++; if (vobs) vobs.disconnect();
  const base = Math.max(240, Math.min(vb.clientWidth - 32, 900)) * vzoom;
  vobs = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { vobs.unobserve(en.target); drawPage(en.target, vgen); } }), { root: vb, rootMargin: '800px 0px' });
  $$('.pgw').forEach(w => {
    const s = base / w._vp.width; w._scale = s;
    w.style.width = w._vp.width * s + 'px'; w.style.height = w._vp.height * s + 'px'; w.innerHTML = '';
    vobs.observe(w);
  });
}
async function drawPage(w, gen) {
  const dpr = Math.min(devicePixelRatio || 1, 2), vp = w._page.getViewport({ scale: w._scale * dpr });
  const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  try { await w._page.render({ canvas: c, canvasContext: c.getContext('2d'), viewport: vp }).promise; } catch { return; }
  if (gen === vgen) { w.innerHTML = ''; w.appendChild(c); }
}
const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
async function renderXlsx(f, tok) {
  if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/vendor/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('penampil Excel gagal dimuat')); document.head.appendChild(s); });
  const buf = await fetchBuf(f); if (tok !== vtok) return;
  vwb = window.XLSX.read(buf, { type: 'array', sheetRows: 2001 });
  showSheet(0);
}
function showSheet(i) {
  const name = vwb.SheetNames[i], ws = vwb.Sheets[name];
  const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const cut = rows.length > 2000, R = rows.slice(0, 2000), nc = Math.min(100, R.reduce((a, r) => Math.max(a, r.length), 0));
  const tabs = vwb.SheetNames.map((n, k) => `<button data-sheet="${k}" class="${k === i ? 'on' : ''}">${esc(n)}</button>`).join('');
  const table = nc ? `<table class="xl"><thead><tr><th></th>${Array.from({ length: nc }, (_, c) => `<th>${colName(c)}</th>`).join('')}</tr></thead><tbody>${R.map((r, k) => `<tr><th>${k + 1}</th>${Array.from({ length: nc }, (_, c) => `<td>${esc(r[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<div class="vm">Sheet ini kosong.</div>';
  $('#vb').innerHTML = `<div class="xw">${table}</div><div class="xt">${tabs}${cut ? '<span class="vm2">Menampilkan 2000 baris pertama. Unduh untuk melihat seluruhnya.</span>' : ''}</div>`;
}

// ---------- unggah ----------
async function runUpload(entries, base = cwd) {
  if (!base.length) return toast('Pilih klasifikasi terlebih dahulu', true);
  const ok = entries.filter(e => MIME[ext(e.file.name)] && e.file.size <= MAXB);
  const skip = entries.length - ok.length;
  if (!ok.length) { note = 'Tidak ada file PDF/Excel yang valid (maks 50 MB).'; return render(); }
  up = { done: 0, total: ok.length, fail: 0 }; note = ''; render();
  let i = 0; const t0 = Date.now(); let lastErr = '';
  const worker = async () => {
    while (i < ok.length) {
      const idx = i++, { file, rel } = ok[idx];
      const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
      const segs = [...base, ...rel].map(b64);
      const path = `files/${segs.length ? segs.join('/') + '/' : ''}${t0 + idx}-${b64(JSON.stringify({ n: file.name }))}/${safe}`;
      try { await window.blobUpload(path, file, { access: 'public', contentType: MIME[ext(file.name)], handleUploadUrl: '/api/upload' }); }
      catch (e) { up.fail++; lastErr = await explain(e); }
      up.done++; render();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  note = `Selesai: ${up.total - up.fail} diunggah${up.fail ? `, ${up.fail} gagal (${lastErr})` : ''}${skip ? `, ${skip} dilewati (bukan PDF/Excel atau >50 MB)` : ''}.`;
  up = null; await load();
  if (key(base) !== key(cwd)) go(base);
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

// ---------- event ----------
let dropEl = null;
const folderTarget = el => {
  const t = el && el.closest('[data-id^="d:"],.tn[data-nav],.addr [data-nav]'); if (!t) return null;
  if (t.dataset.nav) return { el: t, path: JSON.parse(t.dataset.nav) };
  const it = find(t.dataset.id); return it && it.t === 'd' ? { el: t, path: it.path } : null;
};
const setDrop = el => { if (dropEl && dropEl !== el) dropEl.classList.remove('dt'); dropEl = el; if (el) el.classList.add('dt'); };

document.addEventListener('click', e => {
  const t = e.target;
  if (!t.closest('#cm')) closeMenu();
  if (t.closest('.ren')) return;
  const cm = t.closest('[data-cm]'); if (cm) return act(cm.dataset.cm);
  const ct = t.closest('[data-cat]'); if (ct) { const cb = pickCb; pickCb = null; closeModal(); return cb && cb(ct.dataset.cat); }
  const mv = t.closest('[data-m]'); if (mv) { pickCb = null; return closeModal(); }
  if (t.id === 'modal') return closeModal();
  const sh = t.closest('[data-sheet]'); if (sh) return showSheet(Number(sh.dataset.sheet));
  const v = t.closest('[data-v]');
  if (v) {
    const a = v.dataset.v;
    if (a === 'close') return closeViewer();
    if (a === 'dl') return dlFile(V.list[V.idx]);
    if (a === 'prev' && V.idx > 0) { V.idx--; return showViewer(); }
    if (a === 'next' && V.idx < V.list.length - 1) { V.idx++; return showViewer(); }
    if (a === 'zin' || a === 'zout') { vzoom = Math.min(4, Math.max(0.4, vzoom * (a === 'zin' ? 1.25 : 0.8))); return layoutPages(); }
    return;
  }
  if (t.closest('#viewer')) return;
  const tog = t.closest('[data-tog]');
  if (tog) { const k = tog.dataset.tog; expanded.has(k) ? expanded.delete(k) : expanded.add(k); return render(); }
  const nav = t.closest('[data-nav]'); if (nav) return go(JSON.parse(nav.dataset.nav));
  const srt = t.closest('[data-sort]'); if (srt) { const k = srt.dataset.sort; sortDir = sortKey === k ? -sortDir : 1; sortKey = k; try { localStorage.setItem('sortKey', k); } catch {} return render(); }
  const a = t.closest('[data-act]'); if (a) return act(a.dataset.act);
  const el = t.closest('.it');
  if (el) {
    const it = find(el.dataset.id); if (!it) return;
    if (coarse && !ADMIN) return open(it);
    if (coarse && ADMIN && sel.size === 1 && sel.has(el.dataset.id)) return open(it);
    const cur = items().map(iid);
    if (e.shiftKey && lastSel && cur.includes(lastSel)) {
      const a1 = cur.indexOf(lastSel), b1 = cur.indexOf(el.dataset.id);
      sel = new Set(cur.slice(Math.min(a1, b1), Math.max(a1, b1) + 1));
    } else if (e.ctrlKey || e.metaKey) { sel.has(el.dataset.id) ? sel.delete(el.dataset.id) : sel.add(el.dataset.id); lastSel = el.dataset.id; }
    else { sel = new Set([el.dataset.id]); lastSel = el.dataset.id; }
    return updateSel();
  }
  if (t.closest('#main') && sel.size) { sel.clear(); updateSel(); }
});
document.addEventListener('dblclick', e => {
  if (e.target.closest('.ren')) return;
  const el = e.target.closest('.it'); if (el) { const it = find(el.dataset.id); if (it) open(it); }
});
document.addEventListener('contextmenu', e => {
  if (!$('#main') || e.target.closest('#viewer,#modal,.ren')) return;
  if (!e.target.closest('#main')) return;
  e.preventDefault();
  const el = e.target.closest('.it');
  if (el) { if (!sel.has(el.dataset.id)) { sel = new Set([el.dataset.id]); lastSel = el.dataset.id; updateSel(); } showMenu(e.clientX, e.clientY, true); }
  else { if (sel.size) { sel.clear(); updateSel(); } showMenu(e.clientX, e.clientY, false); }
});
document.addEventListener('input', e => {
  if (e.target.classList.contains('ren') && editing) editing.value = e.target.value;
});
document.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('ren') && !rendering && editing) commitEdit(); });
document.addEventListener('keydown', e => {
  if (e.target.classList && e.target.classList.contains('ren')) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); editing = null; render(); }
    return;
  }
  if (V) {
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'ArrowLeft' && V.idx > 0) { V.idx--; showViewer(); }
    else if (e.key === 'ArrowRight' && V.idx < V.list.length - 1) { V.idx++; showViewer(); }
    return;
  }
  if (e.key === 'Escape') { closeMenu(); closeModal(); if (sel.size) { sel.clear(); updateSel(); } return; }
  if (!$('#main') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); act('selectall'); }
  else if (e.key === 'Backspace' && cwd.length) { e.preventDefault(); go(cwd.slice(0, -1)); }
  else if (e.key === 'Enter' && sel.size === 1) act('open');
  else if (ADMIN && e.key === 'F2' && sel.size === 1) { e.preventDefault(); startRename(); }
  else if (ADMIN && e.key === 'Delete' && sel.size) act('delete');
  else if (ADMIN && mod && e.key.toLowerCase() === 'x' && sel.size) { e.preventDefault(); act('cut'); }
  else if (ADMIN && mod && e.key.toLowerCase() === 'v' && clip) { e.preventDefault(); act('paste'); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'lf') return; e.preventDefault();
  const fd = new FormData(e.target);
  try { await post('/api/login', { username: fd.get('username'), password: fd.get('password') }); admin = true; loginErr = ''; render(); }
  catch (err) { loginErr = err.message; render(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'sort') { sortKey = e.target.value; try { localStorage.setItem('sortKey', sortKey); } catch {} render(); }
  if (e.target.id === 'fi') { runUpload([...e.target.files].map(file => ({ file, rel: [] })), uploadBase || cwd); uploadBase = null; e.target.value = ''; }
  if (e.target.id === 'di') {
    runUpload([...e.target.files].map(file => ({ file, rel: (file.webkitRelativePath || file.name).split('/').slice(0, -1) })), uploadBase || cwd);
    uploadBase = null; e.target.value = '';
  }
});
if (ADMIN) {
  // seret-pindah internal (item -> folder) dan unggah dengan seret dari komputer
  document.addEventListener('dragstart', e => {
    const el = e.target.closest && e.target.closest('.it'); if (!el) return;
    if (!sel.has(el.dataset.id)) { sel = new Set([el.dataset.id]); updateSel(); }
    e.dataTransfer.setData('application/x-portal', JSON.stringify([...sel])); e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragend', () => setDrop(null));
  document.addEventListener('dragover', e => {
    if (!admin) return;
    const types = [...e.dataTransfer.types];
    if (types.includes('application/x-portal')) {
      const ft = folderTarget(e.target);
      if (ft) { e.preventDefault(); setDrop(ft.el); } else setDrop(null);
    } else if (types.includes('Files')) {
      e.preventDefault(); const ft = folderTarget(e.target);
      if (ft) { setDrop(ft.el); const m = $('#main'); if (m) m.classList.remove('drag'); }
      else { setDrop(null); const m = $('#main'); if (m) m.classList.add('drag'); }
    }
  });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) { setDrop(null); const m = $('#main'); if (m) m.classList.remove('drag'); } });
  document.addEventListener('drop', async e => {
    if (!admin) return;
    const types = [...e.dataTransfer.types], m = $('#main'); if (m) m.classList.remove('drag');
    const ft = folderTarget(e.target); setDrop(null);
    if (types.includes('application/x-portal')) {
      e.preventDefault(); if (!ft) return;
      if (!inCat(ft.path)) return toast('Pilih folder tujuan di dalam salah satu klasifikasi', true);
      const ids = JSON.parse(e.dataTransfer.getData('application/x-portal') || '[]');
      const its = ids.map(find).filter(Boolean);
      if (its.some(i => i.t === 'd' && ft.path.length >= i.path.length && key(ft.path.slice(0, i.path.length)) === key(i.path))) return toast('Folder tidak bisa dipindahkan ke dalam dirinya sendiri', true);
      return doMove(toMoveItems(its), ft.path);
    }
    if (types.includes('Files')) {
      e.preventDefault();
      const ents = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
      const out = []; for (const en of ents) await walk(en, [], out);
      const target = ft && inCat(ft.path) ? ft.path : (cwd.length ? cwd : null);
      if (target) runUpload(out, target); else pickCategory(cat => runUpload(out, [cat]));
    }
  });
}
window.addEventListener('portal:search', e => { q = String(e.detail || '').trim(); sel.clear(); render(); });
window.addEventListener('hashchange', route);
(async () => {
  if (ADMIN) { try { admin = (await (await fetch('/api/me')).json()).admin; } catch {} }
  route(); load();
})();
})();
