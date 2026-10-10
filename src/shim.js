/* ΕργοΛόγιο · Firebase: σύνδεση χρηστών + βάση δεδομένων (Firestore) με λειτουργία χωρίς ίντερνετ.
   Δίνει στην εφαρμογή το ίδιο window.claude.use('db' | 'user') που είχε μέσα στο Claude. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile, signOut, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, onSnapshot,
  getDoc, setDoc, deleteDoc, deleteField } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const cfg = window.FB_CONFIG, OWNER = String(window.OWNER_EMAIL || '').toLowerCase();
const app = initializeApp(cfg);
const auth = getAuth(app);
let fs;
const DBID = window.FB_DB || '(default)';
try { fs = initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }, DBID); }
catch (e) { fs = getFirestore(app, DBID); }

const code = e => String((e && e.code) || 'unknown').replace(/^firestore\//, '').replace(/-/g, '_');
const wrapErr = e => { const x = new Error((e && e.message) || 'error'); x.code = code(e); return x; };
// null μέσα σε merge = διαγραφή πεδίου (όπως στην αρχική βάση)
const withDeletes = v => { if (v === null) return deleteField(); if (v && typeof v === 'object' && !Array.isArray(v) && !('__nested' in v)) { const o = {}; for (const k in v) o[k] = withDeletes(v[k]); return o; } return v; };
// Χωρίς ίντερνετ η εγγραφή μένει στην ουρά του Firestore και φαίνεται αμέσως τοπικά· δεν περιμένουμε τον server για πάντα.
const settle = p => new Promise((res, rej) => {
  let done = false; const t = setTimeout(() => { done = true; res(); }, navigator.onLine ? 8000 : 400);
  p.then(() => { if (!done) { clearTimeout(t); res(); } }, e => { if (!done) { clearTimeout(t); rej(wrapErr(e)); } else window.toast && toast('Μια αλλαγή απορρίφθηκε από τον server (' + code(e) + ')', 'err'); });
});
// Το Firestore δεν δέχεται λίστα μέσα σε λίστα (π.χ. [[ημ/νία, έργο, χρώμα]]): τις αποθηκεύουμε ως κείμενο και τις ξαναφτιάχνουμε στην ανάγνωση.
const enc = v => { if (Array.isArray(v)) return v.some(Array.isArray) ? { __nested: JSON.stringify(v) } : v.map(enc);
  if (v && typeof v === 'object' && v.constructor === Object) { const o = {}; for (const k in v) if (v[k] !== undefined) o[k] = enc(v[k]); return o; } return v; };
const dec = v => { if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object' && v.constructor === Object) { if (typeof v.__nested === 'string' && Object.keys(v).length === 1) { try { return JSON.parse(v.__nested); } catch (e) { return []; } }
    const o = {}; for (const k in v) o[k] = dec(v[k]); return o; } return v; };
const snapDoc = s => ({ id: s.id, exists: s.exists(), data: () => { const d = s.data(); return d === undefined ? d : dec(d); } });
const db = Object.freeze({
  doc: path => {
    const ref = doc(fs, path);
    return {
      get: () => getDoc(ref).then(snapDoc, e => { throw wrapErr(e); }),
      set: body => settle(setDoc(ref, enc(body))),
      update: body => settle(setDoc(ref, withDeletes(enc(body)), { merge: true })),
      delete: () => settle(deleteDoc(ref)),
      onSnapshot: (next, err) => onSnapshot(ref, s => next(snapDoc(s)), e => err && err(wrapErr(e))),
    };
  },
  collection: path => ({
    onSnapshot: (next, err) => onSnapshot(collection(fs, path), qs => next({ docs: qs.docs.map(snapDoc), size: qs.size, empty: qs.empty }), e => err && err(wrapErr(e))),
  }),
});
let me = null;
const user = Object.freeze({
  isOwner: async () => !!me && (me.email || '').toLowerCase() === OWNER && me.emailVerified,
  canEdit: async () => !!me,            // ποιος έχει πλήρη πρόσβαση το αποφασίζει η εφαρμογή (meta/access) και οι κανόνες της βάσης
  can: async () => !!me,
  id: async () => me ? me.uid : null,
  me: async () => ({ id: me ? me.uid : null, name: me ? (me.displayName || (me.email || '').split('@')[0]) : '' }),
});
window.claude = { use: async n => n === 'db' ? db : n === 'user' ? user : null };

/* ---------- Οθόνη σύνδεσης ---------- */
const gate = document.getElementById('authGate');
const ERR = { 'auth/invalid-credential': 'Λάθος email ή κωδικός.', 'auth/wrong-password': 'Λάθος κωδικός.', 'auth/user-not-found': 'Δεν υπάρχει λογαριασμός με αυτό το email.',
  'auth/email-already-in-use': 'Υπάρχει ήδη λογαριασμός με αυτό το email· πάτα «Σύνδεση».', 'auth/weak-password': 'Ο κωδικός θέλει τουλάχιστον 6 χαρακτήρες.',
  'auth/invalid-email': 'Το email δεν είναι σωστό.', 'auth/too-many-requests': 'Πολλές προσπάθειες· δοκίμασε σε λίγο.', 'auth/network-request-failed': 'Δεν υπάρχει σύνδεση στο ίντερνετ.',
  'auth/popup-closed-by-user': 'Έκλεισες το παράθυρο σύνδεσης.', 'auth/unauthorized-domain': 'Η διεύθυνση της σελίδας δεν έχει εγκριθεί στο Firebase (Authorized domains).' };
const msg = (t, ok) => { const el = document.getElementById('agMsg'); el.textContent = t || ''; el.className = 'text-sm min-h-[1.25rem] ' + (ok ? 'text-emerald-700' : 'text-rose-600'); };
const fail = e => msg(ERR[e && e.code] || ('Σφάλμα: ' + ((e && e.code) || e)));
let signup = false;
function setMode(s) {
  signup = s;
  document.getElementById('agNameRow').hidden = !s;
  document.getElementById('agSubmit').textContent = s ? 'Δημιουργία λογαριασμού' : 'Σύνδεση';
  document.getElementById('agToggle').innerHTML = s ? 'Έχεις ήδη λογαριασμό; <b>Σύνδεση</b>' : 'Πρώτη φορά εδώ; <b>Δημιουργία λογαριασμού</b>';
  document.getElementById('agPass').autocomplete = s ? 'new-password' : 'current-password';
  msg('');
}
document.getElementById('agToggle').onclick = () => setMode(!signup);
document.getElementById('agGoogle').onclick = async () => {
  msg(''); const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, p); }
  catch (e) { if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) { try { await signInWithRedirect(auth, p); } catch (e2) { fail(e2); } } else fail(e); }
};
document.getElementById('agForm').onsubmit = async ev => {
  ev.preventDefault(); msg('');
  const email = document.getElementById('agEmail').value.trim(), pass = document.getElementById('agPass').value, name = document.getElementById('agName').value.trim();
  const btn = document.getElementById('agSubmit'); btn.disabled = true;
  try {
    if (signup) {
      if (!name) { msg('Γράψε το ονοματεπώνυμό σου'); btn.disabled = false; return; }
      const c = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(c.user, { displayName: name });
      location.reload();
    } else await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    if (signup && e && e.code === 'auth/email-already-in-use') { setMode(false); msg('Υπάρχει ήδη λογαριασμός με αυτό το email. Βάλε τον κωδικό του και πάτα «Σύνδεση», ή πάτα «Ξέχασα τον κωδικό».'); }
    else fail(e);
  }
  btn.disabled = false;
};
document.getElementById('agReset').onclick = async () => {
  const email = document.getElementById('agEmail').value.trim();
  if (!email) return msg('Γράψε πρώτα το email σου και ξαναπάτα «Ξέχασα τον κωδικό».');
  try { await sendPasswordResetEmail(auth, email); msg('Σου στείλαμε email για νέο κωδικό.', true); } catch (e) { fail(e); }
};
window.fbSignOut = () => signOut(auth).then(() => location.reload());

setPersistence(auth, browserLocalPersistence).catch(() => {});
let started = false;
onAuthStateChanged(auth, u => {
  if (!u) { if (started) return location.reload(); gate.hidden = false; document.getElementById('agSpin').hidden = true; document.getElementById('agBox').hidden = false; return; }
  me = u; window.__fbEmail = u.email || ''; gate.hidden = true;
  if (started) return; started = true;
  const who = document.getElementById('whoAmI');
  if (who) { who.innerHTML = `<span class="truncate">${(u.displayName || u.email || '').replace(/[<>&"]/g, '')}</span><button class="ml-auto shrink-0 underline hover:text-white" onclick="fbSignOut()">Αποσύνδεση</button>`; who.hidden = false; }
  window.__fbResolve();
});
const syncNet = () => { try { setSync(); } catch (e) {} };
addEventListener('online', syncNet); addEventListener('offline', syncNet);

/* ---------- Διάγνωση: αν η σελίδα κολλήσει στη «Φόρτωση», γράφει την αιτία στην οθόνη ---------- */
const diag = [];
const showDiag = why => {
  const m = document.getElementById('main'); if (!m || window.booted === true) return;
  if (!/Φόρτωση δεδομένων/.test(m.textContent) && !document.getElementById('fbDiag')) return;
  m.innerHTML = `<div id="fbDiag" class="card p-6 max-w-xl border-rose-200"><h2 class="text-lg font-extrabold text-rose-700">Η φόρτωση δεν ολοκληρώθηκε</h2>
    <p class="text-sm text-slate-600 mt-2">${why}</p>
    <pre class="mt-3 text-xs bg-slate-50 rounded-lg p-3 whitespace-pre-wrap break-all text-slate-700">${diag.slice(-8).join('\n').replace(/[<>&]/g, '') || '(κανένα μήνυμα)'}</pre>
    <p class="text-xs text-slate-500 mt-3">Στείλε στιγμιότυπο αυτής της οθόνης. Λογαριασμός: ${(me && me.email) || '—'}</p>
    <div class="flex gap-2 mt-4"><button class="btn btn-primary" onclick="location.reload()">Ξαναδοκίμασε</button><button class="btn btn-ghost" onclick="fbSignOut()">Αποσύνδεση</button></div></div>`;
};
addEventListener('error', e => { diag.push('error: ' + (e.message || e.error)); showDiag('Παρουσιάστηκε σφάλμα στη σελίδα.'); });
addEventListener('unhandledrejection', e => { const r = e.reason; diag.push('rejection: ' + ((r && (r.code || '')) + ' ' + ((r && r.message) || r))); showDiag('Παρουσιάστηκε σφάλμα στη σελίδα.'); });
window.__diag = diag;
setTimeout(() => showDiag(navigator.onLine ? 'Πέρασαν 25 δευτερόλεπτα χωρίς να έρθουν τα δεδομένα.' : 'Δεν υπάρχει σύνδεση στο ίντερνετ.'), 25000);
