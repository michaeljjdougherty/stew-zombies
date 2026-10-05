// =============================================================================
// PINs: each username is a Firebase account (email + password sign-in, over
// plain REST). The "email" is made from the username and never used for mail;
// the password is made from the 4-digit PIN. Firebase checks the PIN and slows
// down anyone guessing, and the database rules only let a username's own
// account change its career (see the rules in the README / chat).
// =============================================================================
const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts:';
const TOKEN = 'https://securetoken.googleapis.com/v1/token';

export const pinOk = (pin) => /^\d{4}$/.test(String(pin || ''));
const emailFor = (key) => `${key}@players.stewzombies.example`;
// Firebase wants 6+ characters; the username keeps two players' PINs apart
const passwordFor = (key, pin) => `sz-${pin}-${key}`;

// Turn Firebase's error codes into ours.
function codeOf(msg) {
  const m = String(msg || '');
  if (m.startsWith('EMAIL_EXISTS')) return 'taken';
  if (m.startsWith('INVALID_PASSWORD') || m.startsWith('INVALID_LOGIN_CREDENTIALS') || m.startsWith('EMAIL_NOT_FOUND')) return 'badpin';
  if (m.startsWith('TOO_MANY_ATTEMPTS')) return 'locked';
  if (m.startsWith('OPERATION_NOT_ALLOWED') || m.startsWith('CONFIGURATION_NOT_FOUND') || m.startsWith('API key not valid')) return 'setup';
  return 'error';
}

export class PinAuth {
  constructor(apiKey, fetchFn, timeout = 8) {
    this.key = apiKey;
    this.fetch = fetchFn;
    this.timeout = timeout;
    this.session = null;   // { uid, idToken, refreshToken, expires }
  }

  async post(url, body, form = false) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), this.timeout * 1000);
    let r;
    try {
      r = await this.fetch(`${url}?key=${encodeURIComponent(this.key)}`, {
        method: 'POST',
        headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
        body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
        signal: ctl ? ctl.signal : undefined,
      });
    } catch (e) {
      const err = new Error('offline'); err.code = 'offline'; throw err;
    } finally { if (t) clearTimeout(t); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(j.error && j.error.message); err.code = codeOf(j.error && j.error.message); throw err; }
    return j;
  }

  keep(j) {
    this.session = {
      uid: j.localId || j.user_id,
      idToken: j.idToken || j.id_token,
      refreshToken: j.refreshToken || j.refresh_token,
      expires: Date.now() + (Number(j.expiresIn || j.expires_in) || 3600) * 1000 - 60000,
    };
    return this.session;
  }

  // a new username: make its account
  async create(key, pin) { return this.keep(await this.post(AUTH + 'signUp', { email: emailFor(key), password: passwordFor(key, pin), returnSecureToken: true })); }
  // a username that has one: check the PIN
  async signIn(key, pin) { return this.keep(await this.post(AUTH + 'signInWithPassword', { email: emailFor(key), password: passwordFor(key, pin), returnSecureToken: true })); }
  signOut() { this.session = null; }

  // A fresh token for the database (they last an hour).
  async token() {
    const s = this.session;
    if (!s) return null;
    if (Date.now() < s.expires) return s.idToken;
    try { this.keep(await this.post(TOKEN, { grant_type: 'refresh_token', refresh_token: s.refreshToken }, true)); } catch { return null; }
    return this.session.idToken;
  }
}

// What this browser remembers to let you in while offline: a hash, not the PIN.
export async function pinHash(key, pin) {
  const data = new TextEncoder().encode(`stew-zombies:${key}:${pin}`);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
