/**
 * Username + password login for the admin panel.
 *
 * GitHub only accepts an access key (token) for saving, so the key is still used behind the scenes —
 * but it is stored ENCRYPTED in admin-auth.json in the repo. Your username + password unlock it:
 *   password → PBKDF2-SHA256 (600,000 rounds) → AES-256-GCM key → decrypts { admin, radar } keys.
 * Without the right username and password the file is useless. Use a strong password.
 */
const VAULT_PATH = 'admin-auth.json';
const VAULT_ITER = 600000;
const VAULT_SESSION = 'pv_session';

const b64 = buf => bytesToBase64(new Uint8Array(buf));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const normUser = u => String(u || '').trim().toLowerCase();

async function vaultDeriveKey(user, pass, salt, iter = VAULT_ITER) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normUser(user) + '\n' + pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function vaultEncrypt(key, salt, iter, user, secrets) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(secrets)));
  return {
    v: 1, note: 'Encrypted admin login. Safe to keep in a public repo only with a strong password.',
    hint: normUser(user).slice(0, 1) + '•••', kdf: { name: 'PBKDF2', hash: 'SHA-256', iter, salt: b64(salt) },
    iv: b64(iv), data: b64(data), updatedAt: new Date().toISOString()
  };
}
/** Create a brand-new vault for this username/password */
async function vaultCreate(user, pass, secrets) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await vaultDeriveKey(user, pass, salt);
  const file = await vaultEncrypt(key, salt, VAULT_ITER, user, secrets);
  return { file, session: { key: b64(await crypto.subtle.exportKey('raw', key)), salt: b64(salt), iter: VAULT_ITER, user: normUser(user), secrets } };
}
/** Open the vault — throws "Wrong username or password" */
async function vaultOpen(file, user, pass) {
  const salt = unb64(file.kdf.salt), iter = file.kdf.iter || VAULT_ITER;
  const key = await vaultDeriveKey(user, pass, salt, iter);
  let plain;
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.iv) }, key, unb64(file.data)); }
  catch (_) { throw new Error('Wrong username or password.'); }
  const secrets = JSON.parse(new TextDecoder().decode(plain));
  return { key: b64(await crypto.subtle.exportKey('raw', key)), salt: file.kdf.salt, iter, user: normUser(user), secrets };
}
/** Re-encrypt with the key of the current session (used when the stored keys change) */
async function vaultReseal(session) {
  const key = await crypto.subtle.importKey('raw', unb64(session.key), 'AES-GCM', true, ['encrypt', 'decrypt']);
  return vaultEncrypt(key, unb64(session.salt), session.iter, session.user, session.secrets);
}

/** Read admin-auth.json without logging in (public repo) */
async function vaultFetch(cfg) {
  const path = (cfg.dir ? cfg.dir.replace(/^\/+|\/+$/g, '') + '/' : '') + VAULT_PATH;
  const tries = [];
  if (/api\.github\.com/.test(cfg.api)) tries.push(`${cfg.api}/repos/${cfg.owner}/${cfg.repo}/contents/${path}${cfg.branch ? '?ref=' + encodeURIComponent(cfg.branch) : ''}`);
  tries.push(VAULT_PATH + '?t=' + Date.now()); // same site (works on GitHub Pages, ~1 min behind)
  for (const url of tries) {
    try {
      const r = await fetch(url, { cache: 'no-store', headers: url.startsWith('http') ? { Accept: 'application/vnd.github.raw+json' } : {} });
      if (r.status === 404) continue;
      if (!r.ok) continue;
      const j = await r.json();
      if (j && j.kdf && j.data) return j;
    } catch (_) {}
  }
  return null;
}

/* Session (unlocked keys) — kept for this browser tab, or on this device if "keep me logged in" */
const Session = {
  get() { try { return JSON.parse(store.get(VAULT_SESSION) || 'null'); } catch (_) { return null; } },
  set(s, persist) { store.del(VAULT_SESSION); store.set(VAULT_SESSION, JSON.stringify(s), persist); },
  keep() { try { return !!localStorage.getItem(VAULT_SESSION); } catch (_) { return false; } },
  clear() { store.del(VAULT_SESSION); store.del('pv_token'); store.del('pv_radar_token'); }
};

function passwordProblem(p) {
  if (p.length < 10) return 'Password must be at least 10 characters.';
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return 'Use letters and numbers in the password.';
  return '';
}
