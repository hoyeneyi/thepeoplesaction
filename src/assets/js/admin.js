// Staff portal: events, page text + banner, team, inbox, admins.
// Uses Firebase Auth (email/password) + Firestore. Access is enforced by
// firebase/firestore.rules — this UI only hides what rules would refuse anyway.
import { FIREBASE_CONFIG, FIREBASE_SDK, STORAGE_ENABLED } from './config.js';
import { firebase, normalizeEvent } from './data.js';
import { CATEGORIES, CHAPTERS, categoryLabel } from './categories.js';
import { url } from './base.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const views = ['setup', 'login', 'denied', 'app'];
const show = (v) => views.forEach((x) => { $(`[data-view="${x}"]`).hidden = x !== v; });

function toast(msg) {
  const t = $('[data-toast]');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.hidden = true; }, 3500);
}

function confirmDialog(text, okLabel = 'Delete') {
  const d = $('#confirm');
  $('[data-confirm-text]', d).textContent = text;
  $('[data-confirm-ok]', d).textContent = okLabel;
  return new Promise((resolve) => {
    const done = (v) => { d.close(); resolve(v); };
    $('[data-confirm-ok]', d).onclick = () => done(true);
    $('[data-confirm-cancel]', d).onclick = () => done(false);
    d.onclose = () => resolve(false);
    d.showModal();
  });
}

const pad = (n) => String(n).padStart(2, '0');
const dateVal = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');
const timeVal = (d) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '');
const fmtWhen = (e) =>
  e.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
  (e.allDay ? ' · All day' : ' · ' + e.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));

let F, fs, auth, authMod, db;

// ---------------- Boot ----------------
async function boot() {
  if (!FIREBASE_CONFIG) return show('setup');
  F = await firebase();
  fs = F.fs; db = F.db;
  authMod = await import(`${FIREBASE_SDK}/firebase-auth.js`);
  auth = authMod.getAuth(F.app);
  authMod.onAuthStateChanged(auth, async (user) => {
    $('[data-user]').hidden = !user;
    if (!user) return show('login');
    $('[data-user-email]').textContent = user.email;
    const isAdmin = await fs.getDoc(fs.doc(db, 'admins', user.uid)).then((s) => s.exists()).catch(() => false);
    if (!isAdmin) { $('[data-uid]').textContent = user.uid; return show('denied'); }
    show('app');
    startApp();
  });
}

$('[data-login-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const st = $('[data-login-status]');
  try {
    await authMod.signInWithEmailAndPassword(auth, f.email.value.trim(), f.password.value);
    st.hidden = true;
  } catch (err) {
    st.className = 'form-status is-err';
    st.textContent = 'Sign-in failed. Check your email and password.';
    st.hidden = false;
  }
});
$('[data-reset]').addEventListener('click', async () => {
  const email = $('#lg-email').value.trim();
  const st = $('[data-login-status]');
  st.hidden = false;
  if (!email) { st.className = 'form-status is-err'; st.textContent = 'Enter your email above first.'; return; }
  try { await authMod.sendPasswordResetEmail(auth, email); } catch { /* don't reveal whether the account exists */ }
  st.className = 'form-status is-ok';
  st.textContent = 'If that email has a staff account, a reset link is on its way.';
});
$('[data-signout]').addEventListener('click', () => authMod.signOut(auth));

// ---------------- Tabs (ARIA tabs pattern) ----------------
function initTabs() {
  const tabs = $$('[role="tab"]');
  const select = (t) => {
    tabs.forEach((x) => {
      const on = x === t;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
    t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length]);
      if (e.key === 'ArrowLeft') select(tabs[(i - 1 + tabs.length) % tabs.length]);
    });
  });
}

let started = false;
function startApp() {
  if (started) return;
  started = true;
  initTabs();
  initEvents();
  initContent();
  initTeam();
  initInbox();
  initAdmins();
}

// ---------------- Events ----------------
let events = [];
let evFilter = 'upcoming';
function renderEvents() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let list = events;
  if (evFilter === 'drafts') list = list.filter((e) => !e.published);
  else if (evFilter === 'past') list = list.filter((e) => e.published && (e.end || e.start) < now).sort((a, b) => b.start - a.start);
  else list = list.filter((e) => e.published && (e.end || e.start) >= now).sort((a, b) => a.start - b.start);
  $('[data-event-list]').innerHTML = list.length
    ? list.map((e) => `<article class="admin-row${e.published ? '' : ' is-draft'}">
        <div><h2>${esc(e.title)} ${e.published ? '' : '<span class="pill">Draft</span>'}</h2>
          <div class="meta"><span>${esc(fmtWhen(e))}</span><span>${esc(categoryLabel(e.category))}${e.chapter === 'houston' ? ' · Houston' : ''}</span>${e.location ? `<span>${esc(e.location)}</span>` : ''}</div></div>
        <div class="actions">
          <button class="btn btn--sm" type="button" data-edit-event="${e.id}">Edit</button>
          <button class="btn btn--sm btn--ghost" type="button" data-dup-event="${e.id}">Duplicate</button>
          <button class="btn btn--sm btn--ghost" type="button" data-del-event="${e.id}">Delete<span class="visually-hidden"> ${esc(e.title)}</span></button>
        </div></article>`).join('')
    : `<p class="muted">No ${evFilter === 'drafts' ? 'draft' : evFilter} events.</p>`;
}

function eventForm(e = {}) {
  const ev = e.start ? e : { published: true, category: 'adopt-the-block', chapter: 'detroit' };
  return `<header><h2 id="editor-title">${e.id ? 'Edit event' : 'New event'}</h2><button class="close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.6"/></svg></button></header>
  <div class="body"><form class="form" data-event-form novalidate>
    <div class="field"><label for="ev-title">Title *</label><input class="input" id="ev-title" name="title" required maxlength="140" value="${esc(ev.title)}"></div>
    <div class="form-row">
      <div class="field"><label for="ev-cat">Program</label><select class="select" id="ev-cat" name="category">${CATEGORIES.map((c) => `<option value="${c.id}"${c.id === ev.category ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="ev-chapter">Chapter</label><select class="select" id="ev-chapter" name="chapter">${CHAPTERS.map((c) => `<option value="${c.id}"${c.id === ev.chapter ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
    </div>
    <label class="check"><input type="checkbox" name="allDay"${ev.allDay ? ' checked' : ''}> All-day event</label>
    <div class="form-row">
      <div class="field"><label for="ev-date">Date *</label><input class="input" id="ev-date" name="date" type="date" required value="${dateVal(ev.start)}"></div>
      <div class="field"><label for="ev-end-date">End date <span class="muted">(multi-day only)</span></label><input class="input" id="ev-end-date" name="endDate" type="date" value="${ev.end && dateVal(ev.end) !== dateVal(ev.start) ? dateVal(ev.end) : ''}"></div>
    </div>
    <div class="form-row" data-times>
      <div class="field"><label for="ev-start">Start time *</label><input class="input" id="ev-start" name="startTime" type="time" value="${timeVal(ev.start) || '10:00'}"></div>
      <div class="field"><label for="ev-end">End time</label><input class="input" id="ev-end" name="endTime" type="time" value="${timeVal(ev.end)}"></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="ev-loc">Location name</label><input class="input" id="ev-loc" name="location" maxlength="140" value="${esc(ev.location)}" placeholder="e.g. Community center"></div>
      <div class="field"><label for="ev-addr">Street address</label><input class="input" id="ev-addr" name="address" maxlength="200" value="${esc(ev.address)}"></div>
    </div>
    <div class="field"><label for="ev-desc">Description</label><textarea class="textarea" id="ev-desc" name="description" maxlength="4000">${esc(ev.description)}</textarea><p class="hint">Leave a blank line between paragraphs.</p></div>
    <div class="form-row">
      <div class="field"><label for="ev-link">Registration / info link</label><input class="input" id="ev-link" name="link" type="url" maxlength="400" value="${esc(ev.link)}" placeholder="https://…"></div>
      <div class="field"><label for="ev-linklabel">Button label</label><input class="input" id="ev-linklabel" name="linkLabel" maxlength="40" value="${esc(ev.linkLabel)}" placeholder="Register"></div>
    </div>
    <label class="check"><input type="checkbox" name="published"${ev.published ? ' checked' : ''}> Published (visible on the website)</label>
    <div class="form-status" data-ev-status role="alert" hidden></div>
    <div class="btn-row"><button class="btn btn--gold" type="submit">Save event</button><button class="btn btn--ghost" type="button" data-close>Cancel</button></div>
  </form></div>`;
}

function openEditor(html, onSubmit) {
  const d = $('#editor');
  const opener = document.activeElement;
  d.innerHTML = html;
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
  d.addEventListener('close', () => opener?.focus?.(), { once: true });
  const form = $('form', d);
  form.addEventListener('submit', async (e) => { e.preventDefault(); await onSubmit(form, d); });
  d.showModal();
  form.querySelector('input, select, textarea')?.focus();
  return { d, form };
}

function readEventForm(f) {
  const allDay = f.allDay.checked;
  const st = $('[data-ev-status]', f);
  const fail = (m, el) => { st.textContent = m; st.className = 'form-status is-err'; st.hidden = false; el?.focus(); return null; };
  if (!f.title.value.trim()) return fail('Add a title.', f.title);
  if (!f.date.value) return fail('Choose a date.', f.date);
  if (!allDay && !f.startTime.value) return fail('Add a start time (or tick “All-day event”).', f.startTime);
  const start = new Date(`${f.date.value}T${allDay ? '00:00' : f.startTime.value}`);
  let end = null;
  const endDate = f.endDate.value || f.date.value;
  if (allDay) end = f.endDate.value ? new Date(`${f.endDate.value}T23:59`) : null;
  else if (f.endTime.value) end = new Date(`${endDate}T${f.endTime.value}`);
  if (end && end < start) return fail('The end is before the start.', f.endTime);
  const link = f.link.value.trim();
  if (link && !/^https:\/\//.test(link)) return fail('Links must start with https://', f.link);
  return {
    title: f.title.value.trim(), category: f.category.value, chapter: f.chapter.value,
    allDay, start: fs.Timestamp.fromDate(start), end: end ? fs.Timestamp.fromDate(end) : null,
    location: f.location.value.trim(), address: f.address.value.trim(), description: f.description.value.trim(),
    link, linkLabel: f.linkLabel.value.trim(), published: f.published.checked,
    updatedAt: fs.serverTimestamp(),
  };
}

function editEvent(existing) {
  const { form } = openEditor(eventForm(existing || {}), async (f, d) => {
    const data = readEventForm(f);
    if (!data) return;
    try {
      if (existing?.id) await fs.updateDoc(fs.doc(db, 'events', existing.id), data);
      else await fs.addDoc(fs.collection(db, 'events'), { ...data, createdAt: fs.serverTimestamp() });
      d.close();
      toast(data.published ? 'Saved — it’s live on the calendar.' : 'Saved as a draft.');
    } catch (err) {
      const st = $('[data-ev-status]', f); st.textContent = 'Could not save: ' + err.message; st.className = 'form-status is-err'; st.hidden = false;
    }
  });
  const toggleTimes = () => { $('[data-times]', form).hidden = form.allDay.checked; };
  form.allDay.addEventListener('change', toggleTimes);
  toggleTimes();
}

function initEvents() {
  fs.onSnapshot(fs.collection(db, 'events'), (snap) => {
    events = snap.docs.map((d) => normalizeEvent(d.data(), d.id)).filter((e) => e.start);
    renderEvents();
  }, (err) => { $('[data-event-list]').innerHTML = `<p class="form-status is-err">Couldn’t load events: ${esc(err.message)}</p>`; });
  $('[data-new-event]').addEventListener('click', () => editEvent(null));
  $$('[data-ev-filter]').forEach((b) => b.addEventListener('click', () => {
    evFilter = b.dataset.evFilter;
    $$('[data-ev-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderEvents();
  }));
  $('[data-event-list]').addEventListener('click', async (e) => {
    const id = e.target.closest('[data-edit-event],[data-dup-event],[data-del-event]');
    if (!id) return;
    const ev = events.find((x) => x.id === (id.dataset.editEvent || id.dataset.dupEvent || id.dataset.delEvent));
    if (!ev) return;
    if (id.dataset.editEvent) editEvent(ev);
    if (id.dataset.dupEvent) editEvent({ ...ev, id: undefined, title: ev.title + ' (copy)', published: false });
    if (id.dataset.delEvent && (await confirmDialog(`Delete “${ev.title}”? This can’t be undone.`))) {
      await fs.deleteDoc(fs.doc(db, 'events', ev.id));
      toast('Event deleted.');
    }
  });
}

// ---------------- Page text + banner ----------------
async function initContent() {
  const form = $('[data-content-form]');
  const [registry, snap] = await Promise.all([
    fetch(url('/assets/data/cms-fields.json')).then((r) => r.json()).catch(() => []),
    fs.getDoc(fs.doc(db, 'site', 'content')),
  ]);
  const data = snap.exists() ? snap.data() : {};
  const fields = data.fields || {};
  const a = data.announcement || {};
  form.active.checked = Boolean(a.active);
  form.text.value = a.text || '';
  form.linkText.value = a.linkText || '';
  form.linkUrl.value = a.linkUrl || '';

  const groups = {};
  registry.forEach((f) => { (groups[f.page] ||= []).push(f); });
  const pageName = (p) => ({ '/': 'Home page' }[p] || p.replace(/\//g, ' ').trim().replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ' page');
  $('[data-cms-fields]').innerHTML = Object.entries(groups).map(([page, list]) => `
    <fieldset class="admin-fieldset cms-group"><legend>${esc(pageName(page))}</legend>
      ${list.map((f) => {
        const id = 'cms-' + f.key.replace(/\W/g, '-');
        const long = f.default.length > 70;
        return `<div class="field"><label for="${id}">${esc(f.key.split('.').slice(1).join(' › '))}</label>
          ${long ? `<textarea class="textarea" id="${id}" data-key="${esc(f.key)}" rows="3" placeholder="${esc(f.default)}">${esc(fields[f.key] || '')}</textarea>`
                 : `<input class="input" id="${id}" data-key="${esc(f.key)}" placeholder="${esc(f.default)}" value="${esc(fields[f.key] || '')}">`}
          <p class="hint">Original: “${esc(f.default)}”</p></div>`;
      }).join('')}
    </fieldset>`).join('');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const st = $('[data-content-status]');
    const url = form.linkUrl.value.trim();
    if (url && !/^(https:\/\/|\/)/.test(url)) { st.textContent = 'Banner link must start with https:// or /'; form.linkUrl.focus(); return; }
    const newFields = {};
    $$('[data-key]', form).forEach((el) => { if (el.value.trim()) newFields[el.dataset.key] = el.value.trim(); });
    try {
      await fs.setDoc(fs.doc(db, 'site', 'content'), {
        fields: newFields,
        announcement: { active: form.active.checked, text: form.text.value.trim(), linkText: form.linkText.value.trim(), linkUrl: url },
        updatedAt: fs.serverTimestamp(),
      });
      st.textContent = 'Saved. Changes are live.';
      toast('Page text saved.');
    } catch (err) { st.textContent = 'Could not save: ' + err.message; }
  });
}

// ---------------- Team ----------------
let team = [];
const SEED_TEAM = [
  { name: 'Negus Vu', role: 'President', chapter: 'detroit', order: 1, photoUrl: '/assets/img/team-negus-vu-800.jpg', bio: 'Negus Vu, founder and president of Detroit Peoples Community, was once a high-school dropout. In his early twenties he suffered from the lack of job opportunities and exposure that led him down a narrow path. He now combats the same cultural deviance that plagued his development for years through community organizing centered on direct services and personal transformational leadership. Vu has a background in Biology from Wayne State University and owns and operates several small businesses.' },
  { name: 'Jacqueline Robinson', role: 'Chief Operation Officer', chapter: 'detroit', order: 2, photoUrl: '/assets/img/team-jacqueline-robinson-800.jpg', bio: 'Jacqueline Robinson is the vice president of Detroit Peoples Community and holds a bachelor’s degree in Social Work. She was previously employed with the State of Michigan and has a background in case management, specifically with children and families. She also owns a home health agency and has used her experience to help fellow entrepreneurs develop their own business plans. Jackie’s passion is helping underserved Detroiters by directing them to resources that can resolve their problems.' },
  { name: 'Sam Miller', role: 'Community Activist', chapter: 'detroit', order: 3, photoUrl: '/assets/img/team-sam-miller-800.jpg', bio: 'Sam Miller, activist and rap artist, grew up on the east side of Detroit in what is known as the “Redzone.” At an early age Sam experienced the hardship of growing up around gang culture and violence, and he works to inspire directly impacted people to be self-determined and positive. He holds an Associate’s degree in General Studies and a Bachelor’s in Aviation Management Technology from Eastern Michigan University, and became a pilot while attending Davis Aerospace Technical High School. Once a member of New Era Detroit in 2015, Sam now serves as a galvanizer for The Peoples Action.' },
  { name: 'Aayanna Divign', role: 'Co-founder', chapter: 'houston', order: 1, photoUrl: '/assets/img/team-aayanna-divign-800.jpg', bio: '' },
  { name: 'Joi', role: 'TPA Houston', chapter: 'houston', order: 2, photoUrl: '/assets/img/team-joi-800.jpg', bio: '' },
];

function renderTeam() {
  const by = (c) => team.filter((p) => p.chapter === c).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  $('[data-team-list]').innerHTML = team.length
    ? CHAPTERS.map((c) => `<h2 class="kicker" style="margin-top:1rem">${esc(c.label)}</h2>` + (by(c.id).map((p) => `
      <article class="admin-row${p.visible === false ? ' is-draft' : ''}">
        <div class="row-with-thumb">${p.photoUrl ? `<img class="thumb" src="${esc(url(p.photoUrl))}" alt="">` : '<span class="thumb" aria-hidden="true"></span>'}
          <div><h3>${esc(p.name)} ${p.visible === false ? '<span class="pill">Hidden</span>' : ''}</h3><div class="meta"><span>${esc(p.role)}</span><span>Order ${esc(p.order ?? '–')}</span></div></div></div>
        <div class="actions"><button class="btn btn--sm" type="button" data-edit-person="${p.id}">Edit</button><button class="btn btn--sm btn--ghost" type="button" data-del-person="${p.id}">Remove<span class="visually-hidden"> ${esc(p.name)}</span></button></div>
      </article>`).join('') || '<p class="muted">Nobody listed — the site shows the original listing for this chapter.</p>')).join('')
    : '<p class="muted">No team members in the database yet. Use “Import current team” to start from the people already on the site.</p>';
}

function personForm(p = {}) {
  return `<header><h2 id="editor-title">${p.id ? 'Edit person' : 'Add person'}</h2><button class="close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.6"/></svg></button></header>
  <div class="body"><form class="form" novalidate>
    <div class="form-row">
      <div class="field"><label for="tm-name">Name *</label><input class="input" id="tm-name" name="name" required maxlength="80" value="${esc(p.name)}"></div>
      <div class="field"><label for="tm-role">Role / title</label><input class="input" id="tm-role" name="role" maxlength="80" value="${esc(p.role)}"></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="tm-chapter">Chapter</label><select class="select" id="tm-chapter" name="chapter">${CHAPTERS.map((c) => `<option value="${c.id}"${c.id === (p.chapter || 'detroit') ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="tm-order">Display order</label><input class="input" id="tm-order" name="order" type="number" min="1" max="99" value="${esc(p.order ?? '')}"></div>
    </div>
    <div class="field"><label for="tm-photo">Photo link</label><input class="input" id="tm-photo" name="photoUrl" maxlength="500" value="${esc(p.photoUrl)}" placeholder="https://… or /assets/img/…">
      ${STORAGE_ENABLED ? '<label class="check" style="margin-top:.4rem">Or upload: <input type="file" name="upload" accept="image/jpeg,image/png,image/webp"></label>' : '<p class="hint">Paste a link to a square or portrait photo.</p>'}</div>
    <div class="field"><label for="tm-bio">Bio</label><textarea class="textarea" id="tm-bio" name="bio" maxlength="3000">${esc(p.bio)}</textarea></div>
    <label class="check"><input type="checkbox" name="visible"${p.visible === false ? '' : ' checked'}> Show on the website</label>
    <div class="form-status" data-tm-status role="alert" hidden></div>
    <div class="btn-row"><button class="btn btn--gold" type="submit">Save</button><button class="btn btn--ghost" type="button" data-close>Cancel</button></div>
  </form></div>`;
}

async function uploadPhoto(file) {
  const st = await import(`${FIREBASE_SDK}/firebase-storage.js`);
  const storage = st.getStorage(F.app);
  if (file.size > 5 * 1024 * 1024) throw new Error('Photo must be under 5 MB.');
  const ref = st.ref(storage, `team/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`);
  await st.uploadBytes(ref, file, { contentType: file.type });
  return st.getDownloadURL(ref);
}

function editPerson(p) {
  openEditor(personForm(p || {}), async (f, d) => {
    const status = $('[data-tm-status]', f);
    const fail = (m) => { status.textContent = m; status.className = 'form-status is-err'; status.hidden = false; };
    if (!f.name.value.trim()) return fail('Add a name.');
    let photoUrl = f.photoUrl.value.trim();
    try {
      if (STORAGE_ENABLED && f.upload?.files[0]) photoUrl = await uploadPhoto(f.upload.files[0]);
      if (photoUrl && !/^(https:\/\/|\/)/.test(photoUrl)) return fail('Photo link must start with https:// or /');
      const data = { name: f.name.value.trim(), role: f.role.value.trim(), chapter: f.chapter.value, order: Number(f.order.value) || 99, photoUrl, bio: f.bio.value.trim(), visible: f.visible.checked, updatedAt: fs.serverTimestamp() };
      if (p?.id) await fs.updateDoc(fs.doc(db, 'team', p.id), data);
      else await fs.addDoc(fs.collection(db, 'team'), data);
      d.close();
      toast('Team updated.');
    } catch (err) { fail('Could not save: ' + err.message); }
  });
}

function initTeam() {
  fs.onSnapshot(fs.collection(db, 'team'), (snap) => { team = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderTeam(); });
  $('[data-new-person]').addEventListener('click', () => editPerson(null));
  $('[data-import-team]').addEventListener('click', async () => {
    if (team.length && !(await confirmDialog('People are already in the database. Import the original team anyway (may create duplicates)?', 'Import'))) return;
    const batch = fs.writeBatch(db);
    SEED_TEAM.forEach((p) => batch.set(fs.doc(fs.collection(db, 'team')), { ...p, visible: true, updatedAt: fs.serverTimestamp() }));
    await batch.commit();
    toast('Original team imported.');
  });
  $('[data-team-list]').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-edit-person],[data-del-person]');
    if (!b) return;
    const p = team.find((x) => x.id === (b.dataset.editPerson || b.dataset.delPerson));
    if (b.dataset.editPerson) editPerson(p);
    if (b.dataset.delPerson && (await confirmDialog(`Remove ${p.name} from the website?`, 'Remove'))) {
      await fs.deleteDoc(fs.doc(db, 'team', p.id));
      toast('Removed.');
    }
  });
}

// ---------------- Inbox ----------------
let messages = [];
let msgFilter = 'new';
const TOPICS = { general: 'General', volunteer: 'Volunteer', 'block-club': 'Block club', 'property-tax': 'Property tax help', entrepreneur: 'Entrepreneur workshop', resources: 'Resources', army: 'Peoples Army', politics: 'Peoples Politics', houston: 'Houston', donation: 'Donations', media: 'Media / partnership' };
function renderInbox() {
  const list = messages.filter((m) => msgFilter === 'all' || (m.status || 'new') === msgFilter);
  const unread = messages.filter((m) => (m.status || 'new') === 'new').length;
  const badge = $('[data-inbox-count]');
  badge.textContent = unread; badge.hidden = !unread;
  $('[data-msg-list]').innerHTML = list.length
    ? list.map((m) => {
        const when = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
        const subject = encodeURIComponent('Re: your message to The Peoples Action');
        return `<article class="admin-row">
          <div><h3>${esc(m.name)} <span class="pill pill--gold">${esc(TOPICS[m.topic] || m.topic)}</span></h3>
            <div class="meta"><a href="mailto:${esc(m.email)}?subject=${subject}">${esc(m.email)}</a>${m.phone ? `<a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : ''}<span>${esc(when)}</span></div></div>
          <div class="actions">
            ${(m.status || 'new') === 'new' ? `<button class="btn btn--sm" type="button" data-handle="${m.id}">Mark handled</button>` : `<button class="btn btn--sm btn--ghost" type="button" data-unhandle="${m.id}">Mark new</button>`}
            <button class="btn btn--sm btn--ghost" type="button" data-del-msg="${m.id}">Delete<span class="visually-hidden"> message from ${esc(m.name)}</span></button>
          </div>
          <p class="msg">${esc(m.message)}</p>
        </article>`;
      }).join('')
    : `<p class="muted">No ${msgFilter === 'all' ? '' : msgFilter + ' '}messages.</p>`;
}
function initInbox() {
  fs.onSnapshot(fs.query(fs.collection(db, 'messages'), fs.orderBy('createdAt', 'desc')), (snap) => {
    messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderInbox();
  });
  $$('[data-msg-filter]').forEach((b) => b.addEventListener('click', () => {
    msgFilter = b.dataset.msgFilter;
    $$('[data-msg-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderInbox();
  }));
  $('[data-msg-list]').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-handle],[data-unhandle],[data-del-msg]');
    if (!b) return;
    if (b.dataset.handle) await fs.updateDoc(fs.doc(db, 'messages', b.dataset.handle), { status: 'handled' });
    if (b.dataset.unhandle) await fs.updateDoc(fs.doc(db, 'messages', b.dataset.unhandle), { status: 'new' });
    if (b.dataset.delMsg && (await confirmDialog('Delete this message permanently?'))) await fs.deleteDoc(fs.doc(db, 'messages', b.dataset.delMsg));
  });
  $('[data-export]').addEventListener('click', () => {
    const cols = ['createdAt', 'name', 'email', 'phone', 'topic', 'status', 'message'];
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = messages.map((m) => cols.map((c) => cell(c === 'createdAt' && m.createdAt?.toDate ? m.createdAt.toDate().toISOString() : m[c])).join(','));
    const url = URL.createObjectURL(new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `tpa-messages-${dateVal(new Date())}.csv` }).click();
  });
}

// ---------------- Admins ----------------
function initAdmins() {
  fs.onSnapshot(fs.collection(db, 'admins'), (snap) => {
    $('[data-admin-list]').innerHTML = snap.docs.map((d) => `<article class="admin-row"><div><h3>${esc(d.data().email || '(no email noted)')}</h3><div class="meta"><span>UID ${esc(d.id)}</span></div></div>
      <div class="actions">${d.id === auth.currentUser.uid ? '<span class="pill">You</span>' : `<button class="btn btn--sm btn--ghost" type="button" data-del-admin="${esc(d.id)}">Remove</button>`}</div></article>`).join('');
  });
  $('[data-admin-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const uid = f.uid.value.trim();
    if (!/^[\w-]{10,128}$/.test(uid)) { toast('That doesn’t look like a Firebase user UID.'); f.uid.focus(); return; }
    await fs.setDoc(fs.doc(db, 'admins', uid), { email: f.email.value.trim(), addedBy: auth.currentUser.email, addedAt: fs.serverTimestamp() });
    f.reset();
    toast('Admin added.');
  });
  $('[data-admin-list]').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del-admin]');
    if (b && (await confirmDialog('Remove this person’s admin access?', 'Remove'))) await fs.deleteDoc(fs.doc(db, 'admins', b.dataset.delAdmin));
  });
}

boot().catch((err) => {
  show('login');
  const st = $('[data-login-status]');
  st.className = 'form-status is-err';
  st.textContent = 'The staff portal could not connect: ' + err.message;
  st.hidden = false;
});
