// Data layer shared by the public site and the admin portal.
// Firestore when configured; static JSON fallback otherwise.
import { FIREBASE_CONFIG, FIREBASE_SDK } from './config.js';
import { url } from './base.js';

let fb = null; // { app, db, fs, auth?, authMod? }

export const isLive = () => Boolean(FIREBASE_CONFIG);

export async function firebase() {
  if (!FIREBASE_CONFIG) return null;
  if (fb) return fb;
  const [{ initializeApp }, fs] = await Promise.all([
    import(`${FIREBASE_SDK}/firebase-app.js`),
    import(`${FIREBASE_SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  fb = { app, fs, db: fs.getFirestore(app) };
  return fb;
}

// ---------- Normalizers ----------
const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'object' && 'seconds' in v) return new Date(v.seconds * 1000);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function normalizeEvent(raw, id) {
  const start = toDate(raw.start);
  return {
    id: id || raw.id || '',
    title: String(raw.title || 'Untitled event'),
    description: String(raw.description || ''),
    start,
    end: toDate(raw.end),
    allDay: Boolean(raw.allDay),
    location: String(raw.location || ''),
    address: String(raw.address || ''),
    category: String(raw.category || 'community'),
    chapter: String(raw.chapter || 'detroit'),
    link: String(raw.link || ''),
    linkLabel: String(raw.linkLabel || ''),
    published: raw.published !== false,
  };
}

// QA hook: tests can inject fixtures with window.__TPA_DATA = { events: [...], content: {...} }
const override = () => (typeof window !== 'undefined' && window.__TPA_DATA) || null;

async function staticJson(path, fallback) {
  try {
    const r = await fetch(url(path), { cache: 'no-cache' });
    if (!r.ok) return fallback;
    return await r.json();
  } catch {
    return fallback;
  }
}

// ---------- Events ----------
export async function loadEvents() {
  const o = override();
  if (o?.events) return o.events.map((e) => normalizeEvent(e)).filter((e) => e.start && e.published);
  const f = await firebase();
  if (!f) {
    const list = await staticJson('/assets/data/events.json', []);
    return list.map((e) => normalizeEvent(e)).filter((e) => e.start && e.published);
  }
  const { collection, query, where, getDocs } = f.fs;
  const snap = await getDocs(query(collection(f.db, 'events'), where('published', '==', true)));
  return snap.docs.map((d) => normalizeEvent(d.data(), d.id)).filter((e) => e.start);
}

// Live updates: calls cb(events) now and whenever staff publish a change.
export async function watchEvents(cb) {
  const o = override();
  const f = !o && (await firebase());
  if (!f) {
    cb(await loadEvents());
    return () => {};
  }
  const { collection, query, where, onSnapshot } = f.fs;
  return onSnapshot(
    query(collection(f.db, 'events'), where('published', '==', true)),
    (snap) => cb(snap.docs.map((d) => normalizeEvent(d.data(), d.id)).filter((e) => e.start)),
    async () => cb(await staticJson('/assets/data/events.json', []).then((l) => l.map((e) => normalizeEvent(e))))
  );
}

// ---------- Site content (editable text + announcement) ----------
export async function loadContent() {
  const o = override();
  if (o?.content) return o.content;
  const f = await firebase();
  if (!f) return staticJson('/assets/data/content.json', { fields: {}, announcement: { active: false } });
  try {
    const { doc, getDoc } = f.fs;
    const s = await getDoc(doc(f.db, 'site', 'content'));
    return s.exists() ? s.data() : { fields: {}, announcement: { active: false } };
  } catch {
    return { fields: {}, announcement: { active: false } };
  }
}

// ---------- Team ----------
export async function loadTeam(chapter) {
  const f = await firebase();
  if (!f) return null; // pages keep their built-in team markup
  try {
    const { collection, getDocs, query, where } = f.fs;
    const snap = await getDocs(query(collection(f.db, 'team'), where('chapter', '==', chapter)));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.visible !== false);
    return list.length ? list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) : null;
  } catch {
    return null;
  }
}

// ---------- Contact / volunteer messages ----------
export async function submitMessage(data) {
  const f = await firebase();
  if (!f) return { ok: false, reason: 'offline' };
  const { collection, addDoc, serverTimestamp } = f.fs;
  await addDoc(collection(f.db, 'messages'), { ...data, status: 'new', createdAt: serverTimestamp() });
  return { ok: true };
}
