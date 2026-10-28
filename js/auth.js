// MelodyPay auth — registered accounts and the current session, kept in localStorage.
// NOTE: this is client-side only. Anyone with access to the browser can read or edit
// localStorage, so swap this for a real backend before handling real money.
const Auth = (function () {
  const USERS_KEY = 'melodypay:users';
  const SESSION_KEY = 'melodypay:session';

  const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  const write = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } };

  const normEmail = (email) => String(email || '').trim().toLowerCase();
  const users = () => read(USERS_KEY) || {};

  // Hash passwords so they are not stored as plain text. Falls back to a simple
  // string hash where SubtleCrypto is unavailable (e.g. some file:// contexts).
  async function hash(password, salt) {
    const input = salt + ':' + password;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381;
    for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
    return 'djb2-' + h.toString(16);
  }

  async function register({ name, email, password }) {
    const key = normEmail(email);
    const all = users();
    if (all[key]) return { ok: false, field: 'email', error: 'An account with this email already exists. Log in instead.' };
    const salt = Math.random().toString(36).slice(2, 10);
    all[key] = { name: name.trim(), email: key, phone: '', salt, passHash: await hash(password, salt), createdAt: Date.now() };
    if (!write(USERS_KEY, all)) return { ok: false, field: 'email', error: 'Could not save your account — browser storage is blocked.' };
    write(SESSION_KEY, { email: key, at: Date.now() });
    return { ok: true, user: all[key] };
  }

  async function login(email, password) {
    const key = normEmail(email);
    const u = users()[key];
    if (!u) return { ok: false, field: 'email', error: 'No account found with this email. Sign up first.' };
    if ((await hash(password, u.salt)) !== u.passHash) return { ok: false, field: 'password', error: 'Incorrect password.' };
    write(SESSION_KEY, { email: key, at: Date.now() });
    return { ok: true, user: u };
  }

  function current() {
    const s = read(SESSION_KEY);
    return (s && users()[s.email]) || null;
  }

  function update(fields) {
    const u = current();
    if (!u) return null;
    const all = users();
    all[u.email] = { ...all[u.email], ...fields, email: u.email };
    write(USERS_KEY, all);
    return all[u.email];
  }

  function logout() { try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }

  return { register, login, current, update, logout };
})();
