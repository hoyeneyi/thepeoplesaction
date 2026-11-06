// Auth stand-in for automated tests ONLY. One test account: admin@test.local / correct-horse
const KEY = '__mockauth';
const subs = new Set();
const auth = { currentUser: JSON.parse(sessionStorage.getItem(KEY) || 'null') };
const emit = () => subs.forEach((cb) => cb(auth.currentUser));
export const getAuth = () => auth;
export function onAuthStateChanged(_a, cb) { subs.add(cb); setTimeout(() => cb(auth.currentUser), 0); return () => subs.delete(cb); }
export async function signInWithEmailAndPassword(_a, email, pw) {
  if (pw !== 'correct-horse') throw new Error('auth/wrong-password');
  auth.currentUser = { uid: email === 'admin@test.local' ? 'test-admin-uid-123' : 'not-admin-uid-456', email };
  sessionStorage.setItem(KEY, JSON.stringify(auth.currentUser));
  emit();
}
export async function signOut() { auth.currentUser = null; sessionStorage.removeItem(KEY); emit(); }
export async function sendPasswordResetEmail() {}
