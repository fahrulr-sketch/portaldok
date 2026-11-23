// Navbar bersama untuk landing page dan halaman explorer.
(function () {
  const el = document.getElementById('nav');
  if (!el) return;
  const cats = window.PORTAL_CATEGORIES || [];
  const base = el.dataset.base || '/data';
  const page = el.dataset.page || 'home';
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  el.className = 'nav';
  el.innerHTML = `<div class="nv">
    <a class="brand" href="/"><img src="/logo.svg" alt=""><span>PORTAL DATA</span></a>
    <nav class="nvl" id="nvl" aria-label="Menu utama">
      <a href="/" data-k="home">Home</a>
      ${cats.map(c => `<a href="${base}#/${encodeURIComponent(c)}" data-k="${esc(c)}">${esc(c)}</a>`).join('')}
    </nav>
    <form class="srch" role="search">
      <span class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg></span>
      <input type="search" placeholder="Cari..." aria-label="Cari file atau folder" autocomplete="off">
    </form>
    <button class="nvt" type="button" aria-label="Menu" aria-expanded="false">☰</button>
  </div>`;

  const links = [...el.querySelectorAll('.nvl a')];
  const mark = () => {
    const k = page === 'home' ? 'home' : decodeURIComponent((location.hash.replace(/^#\/?/, '').split('/')[0]) || '');
    links.forEach(a => a.classList.toggle('on', a.dataset.k === k));
  };
  mark(); window.addEventListener('hashchange', mark);

  const tg = el.querySelector('.nvt');
  tg.addEventListener('click', () => { const o = el.classList.toggle('open'); tg.setAttribute('aria-expanded', o); });
  links.forEach(a => a.addEventListener('click', () => el.classList.remove('open')));

  const input = el.querySelector('.srch input');
  const send = () => window.dispatchEvent(new CustomEvent('portal:search', { detail: input.value }));
  el.querySelector('.srch').addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value.trim();
    if (page === 'home') { if (v) location.href = '/data?q=' + encodeURIComponent(v); } else send();
  });
  if (page !== 'home') input.addEventListener('input', send);
})();
