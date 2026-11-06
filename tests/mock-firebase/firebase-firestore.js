// In-browser Firestore stand-in for automated tests ONLY (served in place of the gstatic
// SDK by tests/qa.mjs). Persists to localStorage so the admin portal and public pages in
// the same browser context share one "database", like a real backend would.
const KEY = '__mockfs';
const listeners = new Set();
const load = () => JSON.parse(localStorage.getItem(KEY) || '{}');
const save = (db) => { localStorage.setItem(KEY, JSON.stringify(db)); notify(); };
const SERVER_TS = { __serverTs: true };

export class Timestamp {
  constructor(ms) { this.ms = ms; this.seconds = Math.floor(ms / 1000); }
  static fromDate(d) { return new Timestamp(d.getTime()); }
  static now() { return new Timestamp(Date.now()); }
  toDate() { return new Date(this.ms); }
  toJSON() { return { __ts: this.ms }; }
}
const revive = (v) => {
  if (v && typeof v === 'object') {
    if ('__ts' in v) return new Timestamp(v.__ts);
    if (Array.isArray(v)) return v.map(revive);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]));
  }
  return v;
};
const resolveServer = (data) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === SERVER_TS ? Timestamp.now() : v]));
const plain = (data) => JSON.parse(JSON.stringify(resolveServer(data)));

export const getFirestore = () => ({ __db: true });
export const serverTimestamp = () => SERVER_TS;
export const collection = (_db, path) => ({ type: 'coll', path });
export function doc(a, path, id) {
  if (a.type === 'coll') return { type: 'doc', path: a.path, id: path || Math.random().toString(36).slice(2, 12) };
  return { type: 'doc', path, id };
}
export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ kind: 'order', field, dir });
export const query = (coll, ...c) => ({ type: 'query', path: coll.path, c });

function snapshotOf(ref) {
  const db = load();
  const rows = Object.entries(db[ref.path] || {}).map(([id, d]) => ({ id, d: revive(d) }));
  let out = rows;
  for (const c of ref.c || []) {
    if (c.kind === 'where' && c.op === '==') out = out.filter((r) => r.d[c.field] === c.value);
    if (c.kind === 'order') out.sort((x, y) => {
      const a = x.d[c.field]?.ms ?? x.d[c.field], b = y.d[c.field]?.ms ?? y.d[c.field];
      return (a > b ? 1 : a < b ? -1 : 0) * (c.dir === 'desc' ? -1 : 1);
    });
  }
  return { docs: out.map((r) => ({ id: r.id, data: () => r.d, exists: () => true })), size: out.length };
}
export async function getDocs(ref) { return snapshotOf(ref); }
export async function getDoc(ref) {
  const d = (load()[ref.path] || {})[ref.id];
  return { id: ref.id, exists: () => Boolean(d), data: () => revive(d) };
}
export async function addDoc(coll, data) {
  const db = load(); const id = Math.random().toString(36).slice(2, 12);
  (db[coll.path] ||= {})[id] = plain(data); save(db); return { id };
}
export async function setDoc(ref, data) { const db = load(); (db[ref.path] ||= {})[ref.id] = plain(data); save(db); }
export async function updateDoc(ref, data) {
  const db = load(); const cur = (db[ref.path] || {})[ref.id];
  if (!cur) throw new Error('No document to update');
  db[ref.path][ref.id] = { ...cur, ...plain(data) }; save(db);
}
export async function deleteDoc(ref) { const db = load(); delete (db[ref.path] || {})[ref.id]; save(db); }
export function writeBatch() {
  const ops = [];
  return { set: (ref, data) => ops.push([ref, data]), commit: async () => { for (const [r, d] of ops) await setDoc(r, d); } };
}
function notify() { listeners.forEach((l) => l()); }
addEventListener('storage', (e) => { if (e.key === KEY) notify(); });
export function onSnapshot(ref, next) {
  const fire = () => next(snapshotOf(ref));
  listeners.add(fire);
  setTimeout(fire, 0);
  return () => listeners.delete(fire);
}
