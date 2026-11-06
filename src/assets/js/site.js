// Global behaviour: navigation, editable text, announcement banner, team overrides.
import { loadContent, loadTeam } from './data.js';
import { url } from './base.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function initNav() {
  const btn = $('.menu-btn');
  const nav = $('#site-nav');
  if (!btn || !nav) return;
  const mq = matchMedia('(max-width: 960px)');

  const setOpen = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    btn.lastChild.textContent = open ? 'Close' : 'Menu';
    if (open) nav.querySelector('a, button')?.focus();
  };
  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));

  // Sub-menus (disclosure pattern)
  for (const t of $$('.nav-toggle-sub')) {
    const sub = document.getElementById(t.getAttribute('aria-controls'));
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = t.getAttribute('aria-expanded') !== 'true';
      $$('.nav-toggle-sub').forEach((o) => { o.setAttribute('aria-expanded', 'false'); document.getElementById(o.getAttribute('aria-controls')).hidden = true; });
      t.setAttribute('aria-expanded', String(open));
      sub.hidden = !open;
    });
    // mark Programs current when on a program page
    if (sub && sub.querySelector(`a[href="${location.pathname}"]`)) {
      t.setAttribute('aria-current', 'page');
      sub.querySelector(`a[href="${location.pathname}"]`).setAttribute('aria-current', 'page');
    }
  }
  const closeSubs = () => $$('.nav-toggle-sub').forEach((o) => { o.setAttribute('aria-expanded', 'false'); document.getElementById(o.getAttribute('aria-controls')).hidden = true; });
  document.addEventListener('click', (e) => { if (!e.target.closest('.nav-list > li')) closeSubs(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openSub = $('.nav-toggle-sub[aria-expanded="true"]');
    if (openSub) { closeSubs(); openSub.focus(); return; }
    if (btn.getAttribute('aria-expanded') === 'true') { setOpen(false); btn.focus(); }
  });
  mq.addEventListener('change', () => { setOpen(false); closeSubs(); });
}

// Apply admin-edited text. Defaults live in the HTML (good for SEO / no-JS);
// Firestore values override them only when present and non-empty.
function applyContent(content) {
  const fields = content?.fields || {};
  for (const el of $$('[data-cms]')) {
    const v = fields[el.dataset.cms];
    if (typeof v === 'string' && v.trim()) el.textContent = v;
  }
  const a = content?.announcement;
  const bar = $('[data-announce]');
  if (bar && a?.active && a.text) {
    $('[data-announce-text]', bar).textContent = a.text;
    const link = $('[data-announce-link]', bar);
    if (a.linkUrl && /^(https?:\/\/|\/)/.test(a.linkUrl)) {
      link.href = url(a.linkUrl);
      link.textContent = a.linkText || 'Learn more';
      link.hidden = false;
    }
    bar.hidden = false;
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const safeUrl = (u) => (/^(https:\/\/|\/)/.test(u || '') ? u : '');

async function applyTeam() {
  const host = $('[data-team]');
  if (!host) return;
  const people = await loadTeam(host.dataset.team);
  if (!people) return;
  host.innerHTML = people.map((p) => `
    <article class="person">
      <figure class="photo">${safeUrl(p.photoUrl) ? `<img src="${esc(url(safeUrl(p.photoUrl)))}" alt="Portrait of ${esc(p.name)}" loading="lazy">` : ''}</figure>
      <h3>${esc(p.name)}</h3>
      <p class="role kicker muted">${esc(p.role)}</p>
      ${p.bio ? `<details><summary>Read bio</summary><p>${esc(p.bio)}</p></details>` : ''}
    </article>`).join('');
}

initNav();
loadContent().then(applyContent).catch(() => {});
applyTeam().catch(() => {});
