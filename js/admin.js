/* =========================================================
   Dev HQ — admin panel that runs on GitHub Pages.
   Database = the GitHub repo (data.json + uploads/), edited via the GitHub API.
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtSize = b => { if (!b) return '0 B'; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return b.toFixed(i > 1 ? 1 : 0) + ' ' + u[i]; };
const fmtDate = d => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60) || 'item';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const youtubeId = url => { const m = (url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m ? m[1] : null; };
const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const safeUrl = s => { s = String(s || '').trim(); return !s || /^https?:\/\//i.test(s) ? s : 'https://' + s; };

const TYPES = ['game', 'app', 'website', 'asset'];
const TYPE_LABEL = { game: 'Game', app: 'Application', website: 'Website', asset: 'Unity Asset' };
const typeOf = p => (p.type === 'plugin' ? 'asset' : TYPE_LABEL[p.type] ? p.type : 'game'); // old "plugin" items count as Unity Assets
const PLATFORMS = ['Android', 'iOS', 'Windows', 'Mac', 'Linux', 'WebGL', 'Web'];
const MAX_FILE = 95 * 1024 * 1024; // GitHub's limit is 100 MB per file
const RULES = {
  image: { dir: 'images', ext: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
  video: { dir: 'videos', ext: ['mp4', 'webm', 'mov'] },
  file: { dir: 'files', ext: ['apk', 'aab', 'zip', 'unitypackage', 'rar', '7z'] },
  resume: { dir: 'resume', ext: ['pdf', 'doc', 'docx'] }
};

const I = {
  dash: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  ext: '<path d="M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  upload: '<path d="M12 16V4m0 0-5 5m5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  game: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6l-.7 6.3A3 3 0 0 0 5 18c1 0 2-.5 2.5-1.4L9 14h6l1.5 2.6A3 3 0 0 0 19 18a3 3 0 0 0 3-3.1l-.7-6.3a4 4 0 0 0-4-3.6z"/>',
  plugin: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z"/>',
  app: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  website: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M6 6.5h.01M9 6.5h.01"/>',
  asset: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 19 5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  git: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v8M18 10c0 4-6 3-10 6"/>'
};
const ico = (n, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n] || ''}</svg>`;

/* ---------- Config: which repo is the "database" ---------- */
function detectRepo() {
  const host = location.hostname;
  const m = host.match(/^([\w-]+)\.github\.io$/i);
  if (m) {
    const seg = location.pathname.split('/').filter(Boolean)[0];
    // /admin, /admin.html, /index … are pages of the main site, not a separate project repo
    const isPage = seg && !/\.html?$/i.test(seg) && !/^(admin|index|profile|project|contact|404)$/i.test(seg);
    return { owner: m[1], repo: isPage ? seg : `${m[1]}.github.io` };
  }
  return { owner: 'denishmakadiya-unity', repo: 'denishmakadiya-unity.github.io' };
}
const store = {
  get(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k); } catch (_) { return null; } },
  set(k, v, persist = true) { try { (persist ? localStorage : sessionStorage).setItem(k, v); } catch (_) {} },
  del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (_) {} }
};
let CFG = { ...detectRepo(), branch: '', dir: '', api: 'https://api.github.com' };
try { Object.assign(CFG, JSON.parse(store.get('pv_cfg') || '{}')); } catch (_) {}
// On GitHub Pages the address already tells us the right repo — an old saved Config must not override it
if (/\.github\.io$/i.test(location.hostname)) Object.assign(CFG, detectRepo());
let GH = null;
let DATA = null;

/* ---------- UI helpers ---------- */
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), type === 'err' ? 7000 : 4000);
}
function loading(on, title = 'Saving', frac = 0, meta = '') {
  $('#loading').hidden = !on;
  if (!on) return;
  $('#loadTitle').textContent = title;
  $('#loadBar').style.width = Math.round(frac * 100) + '%';
  $('#loadMeta').textContent = meta;
}
const media = path => (path ? (isExternalUrl(path) ? path : GH.rawUrl(path)) : '');
function isExternalUrl(u) { return /^https?:\/\//i.test(u || ''); }
function header(kicker, title, sub, right = '') {
  return `<div class="topbar"><div><div class="kicker">${kicker}</div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${right}</div></div>`;
}

/* ---------- Image optimizer: resize + WebP before upload ---------- */
async function prepImage(file, maxDim = 1920) {
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 150 * 1024) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.86));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    const out = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
    out.optimizedFrom = file.size;
    return out;
  } catch (_) { return file; }
}
async function prepImages(files, maxDim) { return Promise.all(files.map(f => prepImage(f, maxDim))); }
const optNote = f => (f && f.optimizedFrom ? ` · optimized ${fmtSize(f.optimizedFrom)} → ${fmtSize(f.size)}` : '');

/* ---------- Deploy watcher: tells you when GitHub Pages shows the new version ---------- */
let deployTimer = null;
function watchDeploy(updatedAt) {
  clearInterval(deployTimer);
  let chip = $('#deploy');
  if (!chip) { chip = document.createElement('div'); chip.id = 'deploy'; chip.className = 'deploy'; document.body.appendChild(chip); }
  chip.className = 'deploy';
  chip.innerHTML = '<i></i><span>Deploying to GitHub Pages…</span>';
  const started = Date.now();
  const check = async () => {
    try {
      const r = await fetch('data.json?v=' + Date.now(), { cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      if (d && d.updatedAt >= updatedAt) {
        clearInterval(deployTimer);
        chip.className = 'deploy live';
        chip.innerHTML = '<i></i><span>Live ✓ <a href="index.html" target="_blank">open site</a></span>';
        setTimeout(() => chip.remove(), 15000);
        return;
      }
    } catch (_) {}
    if (Date.now() - started > 6 * 60 * 1000) {
      clearInterval(deployTimer);
      chip.innerHTML = '<i></i><span>Still deploying — check the repo\'s Actions tab</span>';
      setTimeout(() => chip.remove(), 20000);
    }
  };
  deployTimer = setInterval(check, 8000);
  setTimeout(check, 4000);
}

/* ---------- Saving: one commit per save ---------- */
function newPath(kind, file) {
  const rule = RULES[kind];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!rule.ext.includes(ext)) throw new Error(`"${file.name}" is not allowed here. Allowed: ${rule.ext.map(e => '.' + e).join(' ')}`);
  if (file.size > MAX_FILE) throw new Error(`"${file.name}" is ${fmtSize(file.size)} — GitHub allows max 100 MB per file. Upload it to GitHub Releases and use "External download link".`);
  const base = slugify(file.name.replace(/\.[^.]+$/, '')).slice(0, 40);
  return `uploads/${rule.dir}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${base}.${ext}`;
}

/**
 * Load the latest data.json from GitHub, apply `mutate`, upload files, commit everything at once.
 * uploads: [{ path, file }] · removes: [path]
 */
async function save(message, mutate, uploads = [], removes = []) {
  loading(true, 'Saving', 0, 'Loading latest data…');
  try {
    const latest = await GH.readJson('data.json');
    mutate(latest);
    latest.updatedAt = new Date().toISOString();
    const files = [];
    for (const u of uploads) {
      loading(true, 'Preparing', files.length / (uploads.length + 1), u.file ? u.file.name : u.path.split('/').pop());
      files.push({ path: u.path, base64: u.file ? await fileToBase64(u.file) : bytesToBase64(u.bytes) });
    }
    files.push({ path: 'data.json', base64: textToBase64(JSON.stringify(latest, null, 2) + '\n') });
    const totalBytes = uploads.reduce((s, u) => s + (u.file ? u.file.size : u.bytes.length), 0);
    await GH.commit(message, files, removes.filter(p => p && !isExternalUrl(p)), (step, frac, label) => {
      if (step === 'upload') loading(true, 'Uploading', frac, `${label.split('/').pop()} · ${fmtSize(totalBytes * frac)} / ${fmtSize(totalBytes)}`);
      else loading(true, 'Saving', 1, label);
    });
    DATA = latest;
    refreshChrome();
    loading(false);
    toast('Saved ✓ to GitHub');
    watchDeploy(latest.updatedAt);
    return latest;
  } catch (err) {
    loading(false);
    toast(err.message, 'err');
    throw err;
  }
}

/* ---------- Auth: username + password (GitHub key is kept encrypted in admin-auth.json) ---------- */
let SESSION = null;   // unlocked keys for this browser
let VAULT = null;     // admin-auth.json (encrypted)

async function showLogin(msg, mode) {
  $('#appView').hidden = true; $('#loginView').hidden = false;
  $('#loginForm').hidden = $('#setupForm').hidden = true; $('#loginWait').hidden = false;
  $('#repoName').textContent = CFG.repo;
  try { VAULT = await vaultFetch(CFG); } catch (_) { VAULT = null; }
  setLoginMode(mode || (VAULT ? 'login' : 'setup'), msg);
}
function setLoginMode(mode, msg = '') {
  $('#loginWait').hidden = true;
  $('#loginForm').hidden = mode !== 'login';
  $('#setupForm').hidden = mode !== 'setup';
  $('#toLogin').hidden = !VAULT;
  $('#loginError').textContent = mode === 'login' ? msg : '';
  $('#setupError').textContent = mode === 'setup' ? msg : '';
  $('#setupTitle').textContent = VAULT ? 'Reset login' : 'First-time setup';
  $('#setupIntro').innerHTML = VAULT
    ? 'Forgot your password? Paste a GitHub access key for this repo to prove it is you, then choose a new username and password. <i>A saved Job Radar key will need to be pasted again.</i>'
    : 'Create your admin username and password. You need a GitHub access key <b>once</b> — it is locked with your password and you won\'t have to paste it again.';
  $('#makeKey').href = keyUrl('Portfolio admin', { contents: 'write', target_name: CFG.owner }, `Saves the portfolio website ${CFG.owner}/${CFG.repo} from the admin panel`);
  $('#repoHint').textContent = `${CFG.owner}/${CFG.repo}`;
  const legacy = store.get('pv_token'); // people who logged in with a key before
  if (mode === 'setup' && legacy && !$('#sToken').value) $('#sToken').value = legacy;
  setTimeout(() => (mode === 'login' ? $('#lUser') : ($('#sToken').value ? $('#sUser') : $('#sToken'))).focus(), 50);
}
$('#toSetup').onclick = () => setLoginMode('setup');
$('#toLogin').onclick = () => setLoginMode('login');

async function connect(token) {
  GH = new GitHubRepo({ ...CFG, token, branch: CFG.branch || 'main' });
  const repo = await GH.getRepo();
  if (!CFG.branch) GH.branch = repo.default_branch || 'main';
  DATA = await GH.readJson('data.json').catch(e => {
    if (e.status === 404) throw new Error(`data.json not found in ${CFG.owner}/${CFG.repo} (branch ${GH.branch}${CFG.dir ? ', folder ' + CFG.dir : ''}). Push the website files first, or fix Config.`);
    throw e;
  });
}
const expiredMsg = 'The GitHub key saved in your login has expired or was deleted. Click "Forgot password? Set up login again" and paste a new key.';
async function writeVault(file, message) {
  await GH.commit(message, [{ path: VAULT_PATH, base64: textToBase64(JSON.stringify(file, null, 2) + '\n') }]);
  VAULT = file;
}
/** Change the keys stored in the login (e.g. Job Radar key) without asking for the password again */
async function updateSecrets(mutate, message) {
  const next = { ...SESSION, secrets: { ...SESSION.secrets } };
  mutate(next.secrets);
  const file = await vaultReseal(next);
  await writeVault(file, message);
  SESSION = next; Session.set(SESSION, Session.keep());
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  $('#loginError').textContent = '';
  btn.disabled = true; btn.textContent = 'Unlocking…';
  try {
    const s = await vaultOpen(VAULT, $('#lUser').value, $('#lPass').value);
    try { await connect(s.secrets.admin); }
    catch (err) { throw err.status === 401 ? new Error(expiredMsg) : err; }
    SESSION = s; Session.set(s, $('#remember').checked);
    store.del('pv_token'); store.del('pv_radar_token');
    $('#lPass').value = '';
    startApp();
  } catch (err) { $('#loginError').textContent = err.message; $('#lPass').select(); }
  btn.disabled = false; btn.textContent = '▶ Press start';
});

$('#setupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const token = $('#sToken').value.trim(), user = $('#sUser').value.trim(), pass = $('#sPass').value;
  const err = t => { $('#setupError').textContent = t; };
  err('');
  if (normUser(user).length < 3) return err('Username must be at least 3 characters.');
  const pp = passwordProblem(pass); if (pp) return err(pp);
  if (pass !== $('#sPass2').value) return err('The two passwords are not the same.');
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await connect(token);
    const { file, session } = await vaultCreate(user, pass, { admin: token, radar: '' });
    await writeVault(file, VAULT ? 'Admin: reset login' : 'Admin: set up username & password login');
    SESSION = session; Session.set(session, false);
    store.del('pv_token'); store.del('pv_radar_token');
    ['sToken', 'sPass', 'sPass2'].forEach(id => ($('#' + id).value = ''));
    toast('Login saved ✓ — next time just use your username and password');
    startApp();
  } catch (e2) {
    let m = e2.status === 401 ? 'This GitHub key is wrong or expired.' : e2.message;
    if (e2.status === 404 || e2.status === 403) {
      const who = await GH.getUser().then(u => u.login, () => '');
      m = who && who.toLowerCase() !== CFG.owner.toLowerCase()
        ? `This key was made in the GitHub account "${who}", but your website is in "${CFG.owner}". Log in to GitHub as ${CFG.owner} and make the key again.`
        : `This key can't open the repo "${CFG.owner}/${CFG.repo}". Make the key again and under Repository access choose "Only select repositories" → ${CFG.repo}.`;
    }
    err(m);
  }
  btn.disabled = false; btn.textContent = 'Save login & start';
});

$('#logoutBtn').addEventListener('click', () => { Session.clear(); SESSION = null; GH = null; DATA = null; showLogin(); });

async function boot() {
  const s = Session.get();
  if (!s || !s.secrets) return showLogin();
  loading(true, 'Loading', .5, `${CFG.owner}/${CFG.repo}`);
  try { await connect(s.secrets.admin); SESSION = s; VAULT = await vaultFetch(CFG); loading(false); startApp(); }
  catch (err) { loading(false); Session.clear(); showLogin(err.status === 401 ? expiredMsg : err.message); }
}

function startApp() {
  $('#loginView').hidden = true; $('#appView').hidden = false;
  refreshChrome();
  route();
  migrateCategories();
  radarPeek();
}

/* One-time update: "Plugin" category was replaced by Application + Website */
const OLD_WORK_TITLE = 'Games, plugins & Unity assets';
const OLD_CONTACT = "Freelance projects, plugin requests or collaboration — send a message and I'll get back to you.";
const OLD_ABOUT = 'and I also build plugins and Unity assets that help other developers ship faster.';
const NEW_SERVICES = [
  { icon: 'app', title: 'Mobile Applications', text: 'Android & iOS apps built with Unity — clean UI, smooth performance and store-ready builds.' },
  { icon: 'website', title: 'Websites', text: 'Fast, modern websites and web apps — from landing pages to complete web platforms.' }
];
function needsMigration(d) {
  return (d.site && d.site.workTitle === OLD_WORK_TITLE) ||
    ((d.site && d.site.services) || []).some(x => x.icon === 'plugin' && x.title === 'Plugins & Tools') ||
    (d.projects || []).some(p => p.type === 'plugin') ||
    (d.site && d.site.contactText === OLD_CONTACT) || ((d.profile && d.profile.about) || '').includes(OLD_ABOUT);
}
async function migrateCategories() {
  if (!DATA || !needsMigration(DATA)) return;
  try {
    await save('Update categories: Game, Application, Website, Unity Asset', d => {
      d.site = d.site || {};
      if (d.site.workTitle === OLD_WORK_TITLE) d.site.workTitle = 'Games, apps, websites & Unity assets';
      if (d.site.workSub === "Play the games, download the APKs, or grab the tools I've built for other Unity developers.")
        d.site.workSub = 'Play the games, install the apps, visit the websites, or grab the Unity assets I have built.';
      const sv = d.site.services || [];
      const i = sv.findIndex(x => x.icon === 'plugin' && x.title === 'Plugins & Tools');
      if (i >= 0) sv.splice(i, 1, ...NEW_SERVICES);
      (d.projects || []).forEach(p => { if (p.type === 'plugin') p.type = 'asset'; });
      if (d.site.contactText === OLD_CONTACT) d.site.contactText = "Games, apps, websites or collaboration — send a message and I'll get back to you.";
      if (d.profile && (d.profile.about || '').includes(OLD_ABOUT)) d.profile.about = d.profile.about.replace(OLD_ABOUT, 'and I also build apps, websites and Unity assets for clients and other developers.');
    });
    if (!dirty) route();
  } catch (_) {}
}
function refreshChrome() {
  if (!DATA) return;
  const p = DATA.profile || {}, s = DATA.site || {};
  const initials = s.initials || (p.name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  $$('[data-initials]').forEach(el => (el.textContent = initials));
  $('#loginMark').textContent = initials;
  $('#playerMini').innerHTML = `${p.avatar ? `<img src="${esc(media(p.avatar))}" alt="">` : `<span class="av">${esc(initials)}</span>`}
    <span><b>${esc(p.name || 'Player')}</b><small>LVL ${Number(p.experienceYears) || 0} · ${esc(p.role || '')}</small></span>`;
}

/* ---------- Router ---------- */
$$('.nav-item[data-ico]').forEach(b => b.insertAdjacentHTML('afterbegin', ico(b.dataset.ico)));
$('#menuBtn').innerHTML = ico('menu');
$('#menuBtn').addEventListener('click', e => { e.stopPropagation(); $('#sidebar').classList.toggle('open'); });
document.addEventListener('click', e => { if (!e.target.closest('#sidebar')) $('#sidebar').classList.remove('open'); });
$$('.nav-item[data-view]').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.view; $('#sidebar').classList.remove('open'); }));
window.addEventListener('hashchange', () => { if (!$('#appView').hidden) route(); });
let dirty = false;
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

let lastHash = '', skipRoute = false;
let ROUTE_ID = 0; // bumps on every render, so slow (async) views can tell they are outdated
function route() {
  if (skipRoute) { skipRoute = false; return; }
  if (dirty && !confirm('You have unsaved changes. Leave without saving?')) { skipRoute = true; location.hash = lastHash; return; }
  lastHash = location.hash;
  const [view, arg] = (location.hash.slice(1) || 'dashboard').split('/');
  dirty = false;
  $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view || (view === 'edit' && b.dataset.view === 'projects')));
  if (view === 'jobs') { const pill = $('#jobsPill'); if (pill) pill.hidden = true; }
  ROUTE_ID++;
  const main = $('#main'); main.innerHTML = ''; window.scrollTo(0, 0);
  const views = { dashboard: viewDashboard, projects: viewProjects, new: () => viewEditor(null, arg), edit: () => viewEditor(arg), profile: viewProfile, career: viewCareer, jobs: () => viewJobs(main, arg), site: viewSite, config: viewConfig };
  const myId = ROUTE_ID;
  Promise.resolve((views[view] || viewDashboard)(main)).catch(err => {
    if (myId !== ROUTE_ID) return; // page changed meanwhile — ignore errors from the old view
    console.error(err);
    main.insertAdjacentHTML('beforeend', `<div class="banner">${esc(err.message)}</div>`);
  });
}

/* =========================================================
   HQ (dashboard)
   ========================================================= */
async function viewDashboard(main) {
  const p = DATA.profile || {}, projects = DATA.projects || [];
  const count = t => projects.filter(x => typeOf(x) === t).length;
  const live = `https://${CFG.owner.toLowerCase()}.github.io/${CFG.repo.toLowerCase() === CFG.owner.toLowerCase() + '.github.io' ? '' : CFG.repo + '/'}`;
  const rank = Math.min(1, projects.length / 10);
  main.innerHTML = header('// Player HQ', `Welcome back, ${esc((p.name || 'player').split(' ')[0])}`, 'Manage your games, apps, websites and Unity assets. Every save is committed to GitHub.',
    `${DATA.site.goatcounter ? `<a class="btn" href="https://${esc(DATA.site.goatcounter)}.goatcounter.com" target="_blank">${ico('dash')} Analytics</a>` : ''}<a class="btn" href="${esc(live)}" target="_blank">${ico('ext')} Live site</a><a class="btn btn-primary" href="#new">${ico('plus')} Spawn new</a>`) + `
    <div class="panel player-card">
      <div class="avatar">${p.avatar ? `<img src="${esc(media(p.avatar))}" alt="">` : esc((DATA.site.initials || 'DM'))}</div>
      <div>
        <h3>${esc(p.name || '')}</h3>
        <div class="cls">Class: ${esc(p.role || 'Developer')} · ${esc(p.location || '')}</div>
        <div class="lvl"><b>LVL ${Number(p.experienceYears) || 0}</b><div class="xp"><i style="width:${Math.max(4, rank * 100)}%"></i></div></div>
        <div class="xp-label" style="margin-top:6px">PORTFOLIO XP · ${projects.length}/10 projects to next rank</div>
      </div>
      <div class="btns" style="display:flex;flex-direction:column;gap:8px"><a class="btn btn-sm" href="#profile">${ico('user', 15)} Edit profile</a><a class="btn btn-sm" href="#career">${ico('trophy', 15)} Career</a></div>
    </div>
    <div class="stats">
      <div class="stat" style="--c:var(--c-game)">${ico('game')}<span>Games</span><b>${count('game')}</b></div>
      <div class="stat" style="--c:var(--c-app)">${ico('app')}<span>Applications</span><b>${count('app')}</b></div>
      <div class="stat" style="--c:var(--c-web)">${ico('website')}<span>Websites</span><b>${count('website')}</b></div>
      <div class="stat" style="--c:var(--c-asset)">${ico('asset')}<span>Unity assets</span><b>${count('asset')}</b></div>
      <div class="stat" style="--c:var(--pink)">${ico('star')}<span>Featured</span><b>${projects.filter(x => x.featured).length}</b></div>
    </div>
    <div class="panel">
      <h2>Quick spawn</h2>
      <div class="quick">
        <button data-new="game" style="--c:var(--c-game)">${ico('game')}<b>New game</b><small>APK, Play Store link, video</small></button>
        <button data-new="app" style="--c:var(--c-app)">${ico('app')}<b>New application</b><small>APK, Play Store, screenshots</small></button>
        <button data-new="website" style="--c:var(--c-web)">${ico('website')}<b>New website</b><small>Live link, screenshots, tech</small></button>
        <button data-new="asset" style="--c:var(--c-asset)">${ico('asset')}<b>New Unity asset</b><small>Asset Store link, .unitypackage</small></button>
      </div>
    </div>
    <div class="panel"><h2>Save log <span class="hint" style="text-transform:none;letter-spacing:0">${esc(CFG.owner)}/${esc(CFG.repo)} · ${esc(GH.branch)}</span></h2><ul class="log" id="log"><li>Loading…</li></ul></div>`;
  $$('[data-new]').forEach(b => b.addEventListener('click', () => (location.hash = 'new/' + b.dataset.new)));
  try {
    const commits = await GH.req('GET', `/commits?sha=${encodeURIComponent(GH.branch)}&per_page=6`);
    if (!$('#log')) return;
    $('#log').innerHTML = commits.map(c => `<li><time>${fmtDate(c.commit.author.date)}</time><span><b>▸</b> ${esc(c.commit.message.split('\n')[0])}</span></li>`).join('') || '<li>No commits yet</li>';
  } catch (_) { if ($('#log')) $('#log').innerHTML = '<li>Could not load history</li>'; }
}

/* =========================================================
   Inventory (projects)
   ========================================================= */
function viewProjects(main) {
  main.innerHTML = header('// Inventory', 'All projects', 'Feature, hide, edit or delete your work', `<a class="btn btn-primary" href="#new">${ico('plus')} Spawn new</a>`) +
    `<div class="toolbar">
      <div class="seg" id="seg"><button class="active" data-t="all">All</button><button data-t="game">Games</button><button data-t="app">Apps</button><button data-t="website">Websites</button><button data-t="asset">Assets</button></div>
      <input type="text" id="q" placeholder="Search…">
    </div><div class="rows" id="rows"></div>`;
  let type = 'all', q = '';
  const render = () => {
    const items = (DATA.projects || []).filter(p => (type === 'all' || typeOf(p) === type) && (!q || p.title.toLowerCase().includes(q)))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    $('#rows').innerHTML = items.length ? items.map(p => `
      <div class="slot" data-id="${esc(p.id)}" data-type="${typeOf(p)}">
        <div class="thumb">${p.cover ? `<img src="${esc(media(p.cover))}" alt="" loading="lazy">` : esc(p.title.charAt(0))}
          <div class="chips"><span class="chip ${typeOf(p)}">${TYPE_LABEL[typeOf(p)]}</span>${p.published === false ? '<span class="chip draft">Hidden</span>' : ''}${p.featured ? '<span class="chip star">★ Featured</span>' : ''}</div></div>
        <div class="body">
          <h3>${esc(p.title)}</h3>
          <div class="sub">${p.version ? `<span>v${esc(p.version)}</span>` : ''}${p.download ? `<span>${esc(p.download.path.split('.').pop().toUpperCase())} · ${fmtSize(p.download.size)}</span>` : ''}${p.downloadUrl ? '<span>External download</span>' : ''}${p.playStoreUrl ? '<span>Play Store ✓</span>' : ''}</div>
          <div class="acts">
            <a class="btn btn-sm grow" href="#edit/${esc(p.id)}">${ico('edit', 14)} Edit</a>
            <button class="btn btn-sm icon-btn" data-act="feature" title="${p.featured ? 'Unfeature' : 'Feature on home page'}" style="${p.featured ? 'color:var(--pink)' : ''}">${ico('star', 15)}</button>
            ${p.published === false
              ? `<button class="btn btn-sm btn-primary" data-act="publish" title="This project is hidden — click to show it on the website">${ico('eye', 15)} Show</button>`
              : `<button class="btn btn-sm" data-act="publish" title="Hide this project from the website (it stays in the admin)">${ico('eyeOff', 15)} Hide</button>`}
            <button class="btn btn-sm btn-danger icon-btn" data-act="delete" title="Delete">${ico('trash', 15)}</button>
          </div>
        </div>
      </div>`).join('')
      : `<div class="empty" style="grid-column:1/-1"><b>Inventory empty</b>Spawn your first game, app, website or Unity asset.<br><a class="btn btn-primary" href="#new" style="margin-top:14px">${ico('plus')} Spawn new</a></div>`;
  };
  render();
  $('#seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; type = b.dataset.t; $$('#seg button').forEach(x => x.classList.toggle('active', x === b)); render(); });
  $('#q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
  $('#rows').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.slot').dataset.id; const p = DATA.projects.find(x => x.id === id);
    try {
      if (b.dataset.act === 'delete') {
        if (!confirm(`Delete "${p.title}"? Its images, video and download file are removed from the repo too.`)) return;
        const files = [p.cover, p.icon, p.videoFile, ...(p.gallery || []), p.download && p.download.path, ...((p.webgl && p.webgl.files) || [])];
        await save(`Delete project: ${p.title}`, d => { d.projects = (d.projects || []).filter(x => x.id !== id); }, [], files);
      } else if (b.dataset.act === 'publish') {
        await save(`${p.published === false ? 'Show' : 'Hide'} project: ${p.title}`, d => { const x = d.projects.find(y => y.id === id); if (x) x.published = x.published === false; });
      } else if (b.dataset.act === 'feature') {
        await save(`${p.featured ? 'Unfeature' : 'Feature'} project: ${p.title}`, d => { const x = d.projects.find(y => y.id === id); if (x) x.featured = !x.featured; });
      }
      render();
    } catch (_) {}
  });
}

/* =========================================================
   Project editor
   ========================================================= */
function bindDrop(drop, onFiles) {
  const input = $('input[type=file]', drop);
  input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); });
}
function checkFile(kind, file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!RULES[kind].ext.includes(ext)) { toast(`"${file.name}" is not allowed here (${RULES[kind].ext.map(e => '.' + e).join(' ')})`, 'err'); return false; }
  if (file.size > MAX_FILE) { toast(`"${file.name}" is ${fmtSize(file.size)} — max 100 MB on GitHub. Use an external link (GitHub Releases).`, 'err'); return false; }
  return true;
}
const objUrl = f => URL.createObjectURL(f);

/** Read a Unity WebGL build zip in the browser and return its files */
async function readWebglZip(file) {
  if (!/\.zip$/i.test(file.name)) throw new Error('Please upload the WebGL build as a .zip file.');
  if (typeof JSZip === 'undefined') throw new Error('Zip library failed to load — refresh the page.');
  loading(true, 'Unzipping', 0, file.name);
  try {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter(e => !e.dir && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/.test(e.name));
    const index = entries.filter(e => /(^|\/)index\.html?$/i.test(e.name)).sort((a, b) => a.name.split('/').length - b.name.split('/').length)[0];
    if (!index) throw new Error('No index.html found in the zip. Zip the whole WebGL build folder (it contains index.html and a Build folder).');
    const root = index.name.slice(0, index.name.length - index.name.split('/').pop().length);
    const inRoot = entries.filter(e => e.name.startsWith(root));
    if (!inRoot.some(e => /\.(loader\.js|wasm|wasm\.br|wasm\.gz|wasm\.unityweb)$/i.test(e.name))) throw new Error('This zip does not look like a Unity WebGL build (no Build/*.loader.js or .wasm file).');
    const out = []; let size = 0, i = 0;
    for (const e of inRoot) {
      const bytes = await e.async('uint8array');
      if (bytes.length > MAX_FILE) throw new Error(`"${e.name.split('/').pop()}" is ${fmtSize(bytes.length)} — GitHub allows max 100 MB per file. Reduce texture/audio quality or enable compression with Decompression Fallback.`);
      size += bytes.length;
      out.push({ rel: e.name.slice(root.length), bytes });
      loading(true, 'Unzipping', ++i / inRoot.length, e.name.split('/').pop());
    }
    const compressed = out.some(f => /\.(br|gz)$/i.test(f.rel));
    const warn = compressed ? 'This build uses Brotli/Gzip files (.br/.gz). GitHub Pages cannot serve those directly, so the game will not start. In Unity set Compression Format to Disabled, or enable "Decompression Fallback", then rebuild and upload again.' : '';
    return { name: file.name, files: out, size, count: out.length, warn };
  } finally { loading(false); }
}

function viewEditor(id, presetType) {
  const main = $('#main');
  let p = { type: TYPES.includes(presetType) ? presetType : 'game', published: true, featured: false, tags: [], platforms: [], gallery: [] };
  if (id) {
    const found = (DATA.projects || []).find(x => x.id === id);
    if (!found) { main.innerHTML = header('// Error', 'Not found') + '<div class="empty"><b>This project does not exist.</b></div>'; return; }
    p = JSON.parse(JSON.stringify(found));
    p.type = typeOf(p);
  }
  const st = { cover: null, icon: null, gallery: [], removeGallery: [], videoFile: null, download: null, removeCover: false, removeIcon: false, removeVideo: false, removeDownload: false, webgl: null, removeWebgl: false };
  const changelog = JSON.parse(JSON.stringify(p.changelog || []));

  main.innerHTML = header(id ? '// Edit item' : '// Spawn new', id ? esc(p.title) : 'New project', 'Fill in the details — images, video and files are stored in your GitHub repo',
    id && p.published !== false ? `<a class="btn" href="project.html?slug=${encodeURIComponent(p.slug)}" target="_blank">${ico('ext')} View live</a>` : '') + `
  <form id="editor" class="editor" novalidate>
    <div>
      <div class="panel">
        <h2>Basics</h2>
        <div class="type-pick">
          ${TYPES.map(t => `
          <label style="--c:var(--c-${t})"><input type="radio" name="type" value="${t}" ${p.type === t ? 'checked' : ''}>
            <span class="opt">${ico(t, 24)}<b>${TYPE_LABEL[t]}</b></span></label>`).join('')}
        </div>
        <div class="field"><label for="title">Title *</label><input type="text" id="title" name="title" maxlength="120" required value="${esc(p.title)}" placeholder="e.g. Space Runner 3D"></div>
        <div class="field"><label for="shortDescription">Short description</label><input type="text" id="shortDescription" name="shortDescription" maxlength="220" value="${esc(p.shortDescription)}" placeholder="One line shown on the card"><small><span id="sdCount">0</span>/220</small></div>
        <div class="field"><label for="description">Full details</label>
          <textarea id="description" name="description" rows="12" class="mono-area" placeholder="Features, controls, tech stack, what you built…">${esc(p.description)}</textarea>
          <div class="md-help"># Heading · - bullet list · **bold** · *italic* · \`code\` · [link](https://…)</div>
        </div>
        <div class="grid-3">
          <div class="field"><label for="version">Version</label><input type="text" id="version" name="version" value="${esc(p.version)}" placeholder="1.0.0"></div>
          <div class="field"><label for="unityVersion">Unity version</label><input type="text" id="unityVersion" name="unityVersion" value="${esc(p.unityVersion)}" placeholder="2022.3 LTS"></div>
          <div class="field"><label for="price">Price</label><input type="text" id="price" name="price" value="${esc(p.price)}" placeholder="Free / $9.99"></div>
        </div>
        <div class="field"><label for="tags">Tags</label><input type="text" id="tags" name="tags" value="${esc((p.tags || []).join(', '))}" placeholder="Hyper-casual, 3D, Offline"><small>Separate with commas</small></div>
        <div class="field" style="margin:0"><span class="label">Platforms</span>
          <div class="checks">${PLATFORMS.map(pl => `<label><input type="checkbox" name="platforms" value="${pl}" ${(p.platforms || []).includes(pl) ? 'checked' : ''}> ${pl}</label>`).join('')}</div>
        </div>
      </div>

      <div class="panel">
        <h2>Images</h2>
        <div class="grid-2">
          <div class="field"><span class="label">Cover (16:9) — shown on cards</span><div id="coverBox"></div></div>
          <div class="field"><span class="label">App icon (square, optional)</span><div id="iconBox"></div></div>
        </div>
        <div class="field" style="margin:0"><span class="label">Screenshots</span>
          <div class="drop" id="galleryDrop">${ico('upload')}<b>Drop screenshots here or click</b><small>JPG, PNG, WEBP, GIF · multiple allowed</small><input type="file" accept="image/*" multiple></div>
          <div class="gallery" id="galleryGrid"></div>
        </div>
      </div>

      <div class="panel">
        <h2>Video</h2>
        <div class="field"><label for="youtubeUrl">YouTube link (recommended)</label><input type="url" id="youtubeUrl" name="youtubeUrl" value="${esc(p.youtubeUrl)}" placeholder="https://youtube.com/watch?v=…"><div id="ytPrev"></div></div>
        <div class="or">OR UPLOAD A VIDEO FILE (MAX 100 MB)</div>
        <div id="videoBox"></div>
      </div>

      <div class="panel">
        <h2>▶ Play in browser (Unity WebGL)</h2>
        <div id="webglBox"></div>
        <details class="help" style="margin-top:12px"><summary>How to make a WebGL build that works on GitHub Pages</summary>
          <ol>
            <li>Unity → <b>File → Build Settings → WebGL</b> → Switch Platform.</li>
            <li><b>Player Settings → Publishing Settings → Compression Format: Disabled</b> (or keep Gzip/Brotli and tick <b>Decompression Fallback</b>).</li>
            <li>Build, then right-click the build folder → <b>Send to → Compressed (zipped) folder</b>, and upload that zip here.</li>
          </ol></details>
      </div>

      <div class="panel">
        <h2>Documentation</h2>
        <div class="field" style="margin:0"><label for="docs">Docs tab on the project page (setup, API, FAQ)</label>
          <textarea id="docs" name="docs" rows="10" class="mono-area" placeholder="# Setup&#10;1. Import the package&#10;- Drag the prefab into your scene&#10;&#10;\`\`\`csharp&#10;Pool.Spawn(prefab);&#10;\`\`\`">${esc(p.docs)}</textarea>
          <div class="md-help"># Heading · - list · **bold** · \`code\` · \`\`\` code block \`\`\` · [link](https://…)</div></div>
      </div>

      <div class="panel">
        <h2>Changelog <button type="button" class="btn btn-sm" id="addLog">${ico('plus', 14)} Add version</button></h2>
        <p class="hint" style="margin:-8px 0 14px">Newest first. Shows as a "Changelog" tab on the project page.</p>
        <div class="rep-list" id="logList"></div>
      </div>
    </div>

    <div class="editor-side">
      <div class="panel">
        <h2>Download</h2>
        <div id="dlBox"></div>
        <div class="or">OR EXTERNAL LINK</div>
        <div class="field" style="margin:0"><label for="downloadUrl">External download link</label><input type="url" id="downloadUrl" name="downloadUrl" value="${esc(p.downloadUrl)}" placeholder="https://github.com/…/releases/download/…/game.apk"><small>For files over 100 MB: GitHub Releases / Google Drive link. If set, this is used instead of the uploaded file.</small></div>
      </div>
      <div class="panel">
        <h2>Links</h2>
        <div class="field"><label for="playStoreUrl">Google Play Store</label><input type="url" id="playStoreUrl" name="playStoreUrl" value="${esc(p.playStoreUrl)}" placeholder="https://play.google.com/store/apps/details?id=…"></div>
        <div class="field"><label for="assetStoreUrl">Unity Asset Store</label><input type="url" id="assetStoreUrl" name="assetStoreUrl" value="${esc(p.assetStoreUrl)}" placeholder="https://assetstore.unity.com/…"></div>
        <div class="field"><label for="githubUrl">GitHub</label><input type="url" id="githubUrl" name="githubUrl" value="${esc(p.githubUrl)}" placeholder="https://github.com/…"></div>
        <div class="field" style="margin:0"><label for="otherUrl">Live website / other link (itch.io…)</label><input type="url" id="otherUrl" name="otherUrl" value="${esc(p.otherUrl)}" placeholder="https://…"></div>
      </div>
      <div class="panel">
        <h2>Visibility</h2>
        <label class="toggle"><span><b>Published</b><small>Show on the website</small></span><span class="switch"><input type="checkbox" name="published" ${p.published !== false ? 'checked' : ''}><span></span></span></label>
        <label class="toggle"><span><b>Featured</b><small>Big highlight on home page</small></span><span class="switch"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}><span></span></span></label>
        <div class="field" style="margin:12px 0 0"><label for="order">Sort priority</label><input type="number" id="order" name="order" value="${Number(p.order) || 0}"><small>Higher number shows first</small></div>
      </div>
      <div class="error" id="formError"></div>
      <div style="display:flex;gap:10px">
        <a class="btn" href="#projects" style="flex:1">Cancel</a>
        <button class="btn btn-primary" type="submit" style="flex:2">${ico('save')} ${id ? 'Save' : 'Publish'}</button>
      </div>
    </div>
  </form>`;

  const form = $('#editor');
  form.addEventListener('input', () => (dirty = true));
  const sd = $('#shortDescription'); const upd = () => ($('#sdCount').textContent = sd.value.length); sd.addEventListener('input', upd); upd();

  function singleBox(box, { key, rmKey, kind, accept, label, sub, current, render }) {
    const draw = () => {
      const file = st[key];
      const existing = !st[rmKey] && current();
      if (file || existing) {
        box.innerHTML = render(file, existing);
        $('.x-btn', box).addEventListener('click', e => { e.preventDefault(); if (file) st[key] = null; else st[rmKey] = true; dirty = true; draw(); });
      } else {
        box.innerHTML = `<div class="drop">${ico('upload')}<b>${label}</b><small>${sub}</small><input type="file" accept="${accept}"></div>`;
        bindDrop($('.drop', box), async files => {
          let f = files[0];
          if (kind === 'image') f = await prepImage(f, key === 'icon' ? 512 : 1920);
          if (checkFile(kind, f)) { st[key] = f; dirty = true; draw(); }
        });
      }
    };
    draw();
  }
  singleBox($('#coverBox'), { key: 'cover', rmKey: 'removeCover', kind: 'image', accept: 'image/*', label: 'Upload cover', sub: '1280×720 recommended', current: () => p.cover,
    render: (f, ex) => `<div class="preview-cover"><button class="x-btn" title="Remove">${ico('x')}</button><img src="${f ? objUrl(f) : esc(media(ex))}" alt=""></div>${f && f.optimizedFrom ? `<div class="hint-opt">✓${optNote(f)}</div>` : ''}` });
  singleBox($('#iconBox'), { key: 'icon', rmKey: 'removeIcon', kind: 'image', accept: 'image/*', label: 'Upload icon', sub: '512×512', current: () => p.icon,
    render: (f, ex) => `<div class="preview-icon"><button class="x-btn" title="Remove">${ico('x')}</button><img src="${f ? objUrl(f) : esc(media(ex))}" alt=""></div>` });
  singleBox($('#videoBox'), { key: 'videoFile', rmKey: 'removeVideo', kind: 'video', accept: 'video/mp4,video/webm,video/quicktime', label: 'Upload gameplay video', sub: 'MP4 / WEBM / MOV · max 100 MB', current: () => p.videoFile,
    render: (f, ex) => `<div class="preview-cover"><button class="x-btn" title="Remove">${ico('x')}</button><video src="${f ? objUrl(f) : esc(media(ex))}" controls style="width:100%;height:100%;background:#000"></video></div>` });
  singleBox($('#dlBox'), { key: 'download', rmKey: 'removeDownload', kind: 'file', accept: '.apk,.aab,.zip,.unitypackage,.rar,.7z', label: 'Upload APK / package', sub: '.apk .unitypackage .zip · max 100 MB', current: () => p.download,
    render: (f, ex) => {
      const name = f ? f.name : (ex.name || ex.path.split('/').pop()), size = f ? f.size : ex.size, ext = (name.split('.').pop() || '').toUpperCase();
      return `<div class="file-pill"><span class="ext">${esc(ext)}</span><span class="info"><b>${esc(name)}</b><small>${fmtSize(size)}${f ? ' · will upload on save' : ''}</small></span><button class="x-btn" style="position:static" title="Remove">${ico('x')}</button></div>`;
    } });

  // --- WebGL build (zip → unzipped in the browser → committed to games/<name>/)
  const drawWebgl = () => {
    const box = $('#webglBox');
    const cur = st.webgl || (!st.removeWebgl && p.webgl);
    if (cur) {
      const isNew = !!st.webgl;
      box.innerHTML = `<div class="file-pill"><span class="ext">WEBGL</span><span class="info"><b>${isNew ? esc(st.webgl.name) : 'Playable build online'}</b>
        <small>${cur.count} files · ${fmtSize(cur.size)}${isNew ? ' · will upload on save' : ''}</small></span>
        ${!isNew && p.webgl ? `<a class="btn btn-sm" href="${esc(p.webgl.entry)}" target="_blank">Test</a>` : ''}
        <button type="button" class="x-btn" style="position:static" title="Remove">${ico('x')}</button></div>
        ${isNew && st.webgl.warn ? `<div class="banner" style="margin:10px 0 0">${esc(st.webgl.warn)}</div>` : ''}`;
      $('.x-btn', box).onclick = e => { e.preventDefault(); if (st.webgl) st.webgl = null; else st.removeWebgl = true; dirty = true; drawWebgl(); };
    } else {
      box.innerHTML = `<div class="drop">${ico('upload')}<b>Upload WebGL build (.zip)</b><small>The zipped Unity WebGL build folder · each file max 100 MB</small><input type="file" accept=".zip"></div>`;
      bindDrop($('.drop', box), async files => {
        try { st.webgl = await readWebglZip(files[0]); st.removeWebgl = false; dirty = true; drawWebgl(); }
        catch (err) { toast(err.message, 'err'); }
      });
    }
  };
  drawWebgl();

  const addLog = repeater($('#logList'), changelog, [
    { k: 'version', label: 'Version', ph: '1.2.0' }, { k: 'date', label: 'Date', ph: 'Oct 2026' },
    { k: 'notes', label: 'What changed', ph: '- New levels\n- Fixed crash on Android 14', type: 'area' }
  ], { version: '', date: '', notes: '' }, () => (dirty = true));
  $('#addLog').onclick = () => addLog(true);

  const drawGallery = () => {
    const existing = (p.gallery || []).filter(u => !st.removeGallery.includes(u));
    $('#galleryGrid').innerHTML =
      existing.map(u => `<div class="g"><img src="${esc(media(u))}" alt=""><button class="x-btn" data-old="${esc(u)}" title="Remove">${ico('x')}</button></div>`).join('') +
      st.gallery.map((f, i) => `<div class="g new"><img src="${objUrl(f)}" alt=""><button class="x-btn" data-new="${i}" title="Remove">${ico('x')}</button></div>`).join('');
  };
  $('#galleryGrid').addEventListener('click', e => {
    const b = e.target.closest('.x-btn'); if (!b) return; e.preventDefault();
    if (b.dataset.old) st.removeGallery.push(b.dataset.old); else st.gallery.splice(+b.dataset.new, 1);
    dirty = true; drawGallery();
  });
  bindDrop($('#galleryDrop'), async files => {
    const imgs = await prepImages(files, 1920);
    st.gallery.push(...imgs.filter(f => checkFile('image', f))); dirty = true; drawGallery();
    const saved = imgs.reduce((s, f) => s + (f.optimizedFrom ? f.optimizedFrom - f.size : 0), 0);
    if (saved > 0) toast(`Screenshots optimized — saved ${fmtSize(saved)}`);
  });
  drawGallery();

  const yt = $('#youtubeUrl');
  const ytPrev = () => { const v = youtubeId(yt.value); $('#ytPrev').innerHTML = v ? `<div class="yt-prev"><img src="https://i.ytimg.com/vi/${v}/hqdefault.jpg" alt="YouTube preview"></div>` : ''; };
  yt.addEventListener('input', ytPrev); ytPrev();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    $('#formError').textContent = '';
    const f = new FormData(form);
    const title = String(f.get('title') || '').trim();
    if (!title) { $('#formError').textContent = 'Please enter a title.'; $('#title').focus(); return; }

    const uploads = [], removes = [];
    const next = { ...p };
    try {
      const put = (kind, file) => { const path = newPath(kind, file); uploads.push({ path, file }); return path; };
      if (st.removeCover || st.cover) { removes.push(p.cover); next.cover = ''; }
      if (st.cover) next.cover = put('image', st.cover);
      if (st.removeIcon || st.icon) { removes.push(p.icon); next.icon = ''; }
      if (st.icon) next.icon = put('image', st.icon);
      if (st.removeVideo || st.videoFile) { removes.push(p.videoFile); next.videoFile = ''; }
      if (st.videoFile) next.videoFile = put('video', st.videoFile);
      if (st.removeDownload || st.download) { if (p.download) removes.push(p.download.path); next.download = null; }
      if (st.download) next.download = { path: put('file', st.download), name: st.download.name, size: st.download.size };
      removes.push(...st.removeGallery);
      if ((st.removeWebgl || st.webgl) && p.webgl) { removes.push(...p.webgl.files); next.webgl = null; }
      if (st.webgl) {
        const base = `games/${slugify(title).slice(0, 40)}-${Date.now().toString(36)}/`;
        const paths = st.webgl.files.map(f => { const path = base + f.rel; uploads.push({ path, bytes: f.bytes }); return path; });
        next.webgl = { entry: base + 'index.html', files: paths, size: st.webgl.size, count: st.webgl.count };
      }
      next.gallery = [...(p.gallery || []).filter(u => !st.removeGallery.includes(u)), ...st.gallery.map(file => put('image', file))];
    } catch (err) { $('#formError').textContent = err.message; return; }

    Object.assign(next, {
      id: p.id || uid(),
      type: f.get('type') || 'game',
      title,
      shortDescription: String(f.get('shortDescription') || '').trim(),
      description: String(f.get('description') || ''),
      docs: String(f.get('docs') || ''),
      changelog: changelog.filter(c => c.version || c.notes),
      version: String(f.get('version') || '').trim(),
      unityVersion: String(f.get('unityVersion') || '').trim(),
      price: String(f.get('price') || '').trim(),
      tags: list(f.get('tags')),
      platforms: f.getAll('platforms'),
      youtubeUrl: safeUrl(f.get('youtubeUrl')),
      downloadUrl: safeUrl(f.get('downloadUrl')),
      playStoreUrl: safeUrl(f.get('playStoreUrl')),
      assetStoreUrl: safeUrl(f.get('assetStoreUrl')),
      githubUrl: safeUrl(f.get('githubUrl')),
      otherUrl: safeUrl(f.get('otherUrl')),
      published: form.published.checked,
      featured: form.featured.checked,
      order: Number(f.get('order')) || 0,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    try {
      await save(`${id ? 'Update' : 'Add'} ${TYPE_LABEL[next.type].toLowerCase()}: ${next.title}`, d => {
        d.projects = d.projects || [];
        const others = d.projects.filter(x => x.id !== next.id);
        if (!next.slug || (p.title !== next.title)) {
          const base = slugify(next.title); let slug = base, i = 2;
          while (others.some(x => x.slug === slug)) slug = `${base}-${i++}`;
          next.slug = slug;
        }
        const idx = d.projects.findIndex(x => x.id === next.id);
        if (idx >= 0) d.projects[idx] = next; else d.projects.push(next);
      }, uploads, removes);
      dirty = false;
      if (!id) location.hash = 'edit/' + next.id; else route();
    } catch (_) {}
  });
}

/* =========================================================
   Repeater (lists like experience, education, skill groups)
   ========================================================= */
function repeater(listEl, items, fields, blank, onChange = () => {}) {
  const draw = () => {
    listEl.innerHTML = items.length ? items.map((it, i) => `
      <div class="rep" data-i="${i}">
        <div class="rep-fields${fields.length === 1 ? ' one' : ''}">${fields.map(f => {
          if (f.type === 'check') return `<div class="checks" style="align-self:end"><label><input type="checkbox" data-k="${f.k}" ${it[f.k] ? 'checked' : ''}> ${f.label}</label></div>`;
          if (f.type === 'select') return `<div class="field" style="margin:0"><label>${f.label}</label><select data-k="${f.k}">${f.options.map(([v, l]) => `<option value="${v}" ${it[f.k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
          if (f.type === 'area') return `<div class="field" style="margin:0;grid-column:1/-1"><label>${f.label}</label><textarea data-k="${f.k}" rows="2" placeholder="${esc(f.ph || '')}">${esc(it[f.k])}</textarea></div>`;
          return `<div class="field" style="margin:0;${f.wide ? 'grid-column:1/-1' : ''}"><label>${f.label}</label><input type="text" data-k="${f.k}" value="${esc(it[f.k])}" placeholder="${esc(f.ph || '')}"></div>`;
        }).join('')}</div>
        <div class="rep-acts">
          <button type="button" class="btn btn-sm icon-btn" data-a="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn btn-sm icon-btn" data-a="down" title="Move down" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="btn btn-sm btn-danger icon-btn" data-a="del" title="Remove">${ico('trash', 15)}</button>
        </div>
      </div>`).join('') : '<div class="empty" style="padding:22px">Nothing added yet.</div>';
  };
  const onEdit = e => {
    const k = e.target.dataset.k; if (!k) return;
    items[+e.target.closest('.rep').dataset.i][k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    onChange();
  };
  listEl.addEventListener('input', onEdit);
  listEl.addEventListener('change', onEdit);
  listEl.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const i = +b.closest('.rep').dataset.i;
    if (b.dataset.a === 'del') items.splice(i, 1);
    if (b.dataset.a === 'up' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
    if (b.dataset.a === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
    onChange(); draw();
  });
  draw();
  const add = (atTop = false) => { atTop ? items.unshift({ ...blank }) : items.push({ ...blank }); onChange(); draw(); const inputs = $$('input,textarea', listEl); (atTop ? inputs[0] : inputs[inputs.length - fields.filter(f => f.type !== 'check' && f.type !== 'select').length])?.focus(); };
  add.redraw = draw;
  return add;
}

/* =========================================================
   Player profile
   ========================================================= */
function viewProfile(main) {
  const pr = JSON.parse(JSON.stringify(DATA.profile || {}));
  pr.socials = pr.socials || {};
  const groups = pr.skillGroups || [], personal = pr.personal || [];
  let avatarFile = null, removeAvatar = false, resumeFile = null, removeResume = false;
  const socials = [['github', 'GitHub'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['twitter', 'X / Twitter'], ['instagram', 'Instagram'], ['playstore', 'Google Play developer page'], ['assetstore', 'Unity Asset Store publisher page'], ['itch', 'itch.io'], ['discord', 'Discord']];

  main.innerHTML = header('// Character', 'Player profile', 'Shown on the home page and the profile page') + `
  <form id="pf">
    <div class="panel">
      <h2>Identity</h2>
      <div class="avatar-edit">
        <div class="av" id="avPrev"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label class="btn btn-sm" style="position:relative;overflow:hidden">${ico('upload', 15)} Upload photo<input type="file" id="avInput" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
          <button class="btn btn-sm btn-danger" type="button" id="avRemove">Remove</button>
        </div>
      </div>
      <div class="grid-3">
        <div class="field"><label>Full name</label><input type="text" name="name" value="${esc(pr.name)}" maxlength="80"></div>
        <div class="field"><label>Role / title</label><input type="text" name="role" value="${esc(pr.role)}" maxlength="80"></div>
        <div class="field"><label>Years of experience</label><input type="number" name="experienceYears" min="0" max="60" value="${Number(pr.experienceYears) || 0}"></div>
      </div>
      <div class="field"><label>Tagline (hero)</label><input type="text" name="tagline" value="${esc(pr.tagline)}" maxlength="300"></div>
      <div class="field"><label>About me / summary</label><textarea name="about" rows="7">${esc(pr.about)}</textarea><small>Leave an empty line between paragraphs</small></div>
      <div class="field" style="margin:0"><label>Career objective (profile page)</label><textarea name="objective" rows="3">${esc(pr.objective)}</textarea></div>
    </div>

    <div class="panel">
      <h2>Resume / CV</h2>
      <div id="resumeBox"></div>
      <small class="hint" style="display:block;margin-top:10px">PDF recommended. Shows "Download Resume" buttons on the website.</small>
    </div>

    <div class="panel">
      <h2>Contact</h2>
      <div class="grid-3">
        <div class="field"><label>Email</label><input type="email" name="email" value="${esc(pr.email)}"></div>
        <div class="field"><label>Phone (public — leave empty to hide)</label><input type="tel" name="phone" value="${esc(pr.phone)}"></div>
        <div class="field"><label>Location</label><input type="text" name="location" value="${esc(pr.location)}"></div>
      </div>
      <div class="field" style="margin:0"><label>Languages known</label><input type="text" name="languages" value="${esc((pr.languages || []).join(', '))}"><small>Separate with commas</small></div>
    </div>

    <div class="panel">
      <h2>Skills</h2>
      <div class="field"><label>Skill tags</label><input type="text" name="skills" value="${esc((pr.skills || []).join(', '))}"><small>Shown as chips and in the scrolling strip. Separate with commas.</small></div>
      <h2 style="margin-top:20px">Technical skills table <button type="button" class="btn btn-sm" id="addGroup">${ico('plus', 14)} Add row</button></h2>
      <div class="rep-list" id="groupList"></div>
    </div>

    <div class="panel">
      <h2>Personal details (profile page) <button type="button" class="btn btn-sm" id="addPersonal">${ico('plus', 14)} Add row</button></h2>
      <p class="hint" style="margin:-8px 0 14px">Everything here is public. Avoid home address or date of birth.</p>
      <div class="rep-list" id="personalList"></div>
    </div>

    <div class="panel">
      <h2>Social links</h2>
      <div class="grid-2">${socials.map(([k, l]) => `<div class="field"><label>${l}</label><input type="url" name="social_${k}" value="${esc(pr.socials[k])}" placeholder="https://…"></div>`).join('')}</div>
    </div>
    <div class="save-bar"><span class="error" id="pErr"></span><button class="btn btn-primary" type="submit">${ico('save')} Save profile</button></div>
  </form>`;

  const form = $('#pf');
  form.addEventListener('input', () => (dirty = true));
  const drawAv = () => {
    const src = avatarFile ? objUrl(avatarFile) : (!removeAvatar && pr.avatar ? media(pr.avatar) : '');
    $('#avPrev').innerHTML = src ? `<img src="${esc(src)}" alt="">` : esc((pr.name || 'U').charAt(0));
  };
  drawAv();
  $('#avInput').addEventListener('change', async e => { let f = e.target.files[0]; if (!f) return; f = await prepImage(f, 800); if (checkFile('image', f)) { avatarFile = f; removeAvatar = false; dirty = true; drawAv(); } });
  $('#avRemove').addEventListener('click', () => { avatarFile = null; removeAvatar = true; dirty = true; drawAv(); });

  const drawResume = () => {
    const box = $('#resumeBox');
    const cur = resumeFile ? { name: resumeFile.name, size: resumeFile.size, isNew: true } : (!removeResume && pr.resume);
    if (cur) {
      const name = cur.name || cur.path.split('/').pop();
      box.innerHTML = `<div class="file-pill"><span class="ext">${esc((name.split('.').pop() || '').toUpperCase())}</span><span class="info"><b>${esc(name)}</b><small>${fmtSize(cur.size)}${cur.isNew ? ' · will upload on save' : ''}</small></span>
        ${!cur.isNew ? `<a class="btn btn-sm" href="${esc(media(pr.resume.path))}" target="_blank">Open</a>` : ''}
        <button type="button" class="btn btn-sm btn-danger icon-btn" id="rmResume" title="Remove">${ico('x', 15)}</button></div>`;
      $('#rmResume').onclick = () => { if (resumeFile) resumeFile = null; else removeResume = true; dirty = true; drawResume(); };
    } else {
      box.innerHTML = `<div class="drop">${ico('upload')}<b>Upload your resume</b><small>PDF, DOC or DOCX</small><input type="file" accept=".pdf,.doc,.docx"></div>`;
      bindDrop($('.drop', box), files => { if (checkFile('resume', files[0])) { resumeFile = files[0]; removeResume = false; dirty = true; drawResume(); } });
    }
  };
  drawResume();

  const mark = () => (dirty = true);
  const addGroup = repeater($('#groupList'), groups, [{ k: 'label', label: 'Label', ph: 'Programming Languages' }, { k: 'value', label: 'Value', ph: 'C, C#' }], { label: '', value: '' }, mark);
  const addPersonal = repeater($('#personalList'), personal, [{ k: 'label', label: 'Label', ph: 'Nationality' }, { k: 'value', label: 'Value', ph: 'Indian' }], { label: '', value: '' }, mark);
  $('#addGroup').onclick = () => addGroup(); $('#addPersonal').onclick = () => addPersonal();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(form);
    const uploads = [], removes = [];
    let avatar = pr.avatar || '', resume = pr.resume || null;
    try {
      if (removeAvatar || avatarFile) { removes.push(pr.avatar); avatar = ''; }
      if (avatarFile) { avatar = newPath('image', avatarFile); uploads.push({ path: avatar, file: avatarFile }); }
      if (removeResume || resumeFile) { if (pr.resume) removes.push(pr.resume.path); resume = null; }
      if (resumeFile) { const path = newPath('resume', resumeFile); uploads.push({ path, file: resumeFile }); resume = { path, name: resumeFile.name, size: resumeFile.size }; }
    } catch (err) { $('#pErr').textContent = err.message; return; }
    const s = {}; socials.forEach(([k]) => (s[k] = safeUrl(f.get('social_' + k))));
    const next = {
      name: String(f.get('name') || '').trim(), role: String(f.get('role') || '').trim(),
      experienceYears: Number(f.get('experienceYears')) || 0,
      tagline: String(f.get('tagline') || '').trim(), about: String(f.get('about') || ''), objective: String(f.get('objective') || '').trim(),
      email: String(f.get('email') || '').trim(), phone: String(f.get('phone') || '').trim(), location: String(f.get('location') || '').trim(),
      languages: list(f.get('languages')), skills: list(f.get('skills')),
      skillGroups: groups.filter(g => g.label || g.value), personal: personal.filter(g => g.label || g.value),
      socials: s, avatar, resume
    };
    try {
      await save('Update profile', d => { d.profile = { ...(d.profile || {}), ...next }; }, uploads, removes);
      dirty = false; viewProfile(main);
    } catch (_) {}
  });
}

/* =========================================================
   Career (experience + education)
   ========================================================= */
function viewCareer(main) {
  const exp = JSON.parse(JSON.stringify(DATA.profile.experience || []));
  const edu = JSON.parse(JSON.stringify(DATA.profile.education || []));
  main.innerHTML = header('// Character', 'Career', 'Your quest log — shown on the home page and profile page') + `
    <div class="panel">
      <h2>Work experience <button type="button" class="btn btn-sm" id="addExp">${ico('plus', 14)} Add job</button></h2>
      <p class="hint" style="margin:-8px 0 14px">Newest first. Use ↑ ↓ to reorder. New jobs are added at the top.</p>
      <div class="rep-list" id="expList"></div>
    </div>
    <div class="panel">
      <h2>Education <button type="button" class="btn btn-sm" id="addEdu">${ico('plus', 14)} Add</button></h2>
      <div class="rep-list" id="eduList"></div>
    </div>
    <div class="save-bar"><button class="btn btn-primary" id="saveCareer">${ico('save')} Save career</button></div>`;
  const mark = () => (dirty = true);
  const addExp = repeater($('#expList'), exp, [
    { k: 'role', label: 'Role', ph: 'Sr. Unity Developer' },
    { k: 'company', label: 'Company', ph: 'Company name' },
    { k: 'location', label: 'City', ph: 'Ahmedabad' },
    { k: 'duration', label: 'Duration', ph: 'Jan 2020 – Mar 2021 / 1.2 Years' },
    { k: 'summary', label: 'What you did (optional)', ph: 'Built 5 hyper-casual games, owned ads & IAP integration…', type: 'area' },
    { k: 'current', label: 'Current job', type: 'check' }
  ], { role: '', company: '', location: '', duration: '', summary: '', current: false }, mark);
  const addEdu = repeater($('#eduList'), edu, [
    { k: 'degree', label: 'Degree', ph: 'MCA' }, { k: 'year', label: 'Passing year', ph: '2015' },
    { k: 'school', label: 'College / School', ph: 'College name, city' }, { k: 'board', label: 'University / Board', ph: 'GTU' }
  ], { degree: '', year: '', school: '', board: '' }, mark);
  $('#addExp').onclick = () => addExp(true); $('#addEdu').onclick = () => addEdu();
  $('#saveCareer').onclick = async () => {
    try {
      await save('Update career', d => {
        d.profile = d.profile || {};
        d.profile.experience = exp.filter(x => x.role || x.company);
        d.profile.education = edu.filter(x => x.degree || x.school);
      });
      dirty = false; viewCareer(main);
    } catch (_) {}
  };
}

/* =========================================================
   World settings (site texts)
   ========================================================= */
function viewSite(main) {
  const s = JSON.parse(JSON.stringify(DATA.site || {}));
  const services = s.services || [];
  const testimonials = s.testimonials || [];
  const faq = s.faq || [];
  const ghFromSocial = ((DATA.profile.socials || {}).github || '').replace(/^https?:\/\/(www\.)?github\.com\//i, '').split('/')[0];
  main.innerHTML = header('// World', 'World settings', 'Site name, logo letters and the texts on the home page') + `
  <form id="sf">
    <div class="panel">
      <h2>Brand</h2>
      <div class="grid-3">
        <div class="field"><label>Site name (top left)</label><input type="text" name="brand" value="${esc(s.brand)}" maxlength="40"></div>
        <div class="field"><label>Logo letters</label><input type="text" name="initials" value="${esc(s.initials)}" maxlength="3"></div>
        <div class="field"><label>Footer text</label><input type="text" name="footerText" value="${esc(s.footerText)}"></div>
      </div>
      <label class="toggle"><span><b>Available for work</b><small>Green status badge in the hero</small></span><span class="switch"><input type="checkbox" name="available" ${s.available !== false ? 'checked' : ''}><span></span></span></label>
      <div class="field" style="margin:8px 0 0"><label>Status text</label><input type="text" name="statusText" value="${esc(s.statusText)}"></div>
    </div>
    <div class="panel">
      <h2>Section texts</h2>
      <div class="grid-2">
        <div class="field"><label>Work section title</label><input type="text" name="workTitle" value="${esc(s.workTitle)}"></div>
        <div class="field"><label>About section title</label><input type="text" name="aboutTitle" value="${esc(s.aboutTitle)}"></div>
      </div>
      <div class="field"><label>Work section subtitle</label><input type="text" name="workSub" value="${esc(s.workSub)}"></div>
      <div class="field"><label>Contact title</label><input type="text" name="contactTitle" value="${esc(s.contactTitle)}"></div>
      <div class="field" style="margin:0"><label>Contact text</label><textarea name="contactText" rows="2">${esc(s.contactText)}</textarea></div>
    </div>
    <div class="panel">
      <h2>Services (3 cards under About) <button type="button" class="btn btn-sm" id="addSvc">${ico('plus', 14)} Add</button></h2>
      <div class="rep-list" id="svcList"></div>
    </div>
    <div class="panel">
      <h2>Contact page</h2>
      <div class="grid-2">
        <div class="field"><label>Reply time note</label><input type="text" name="replyTime" value="${esc(s.replyTime || 'Usually replies within 24 hours')}"></div>
        <div class="field"><label>Your time zone</label><input type="text" name="timezone" value="${esc(s.timezone || 'Asia/Kolkata')}" placeholder="Asia/Kolkata"><small>Shows your live local time on the contact page</small></div>
      </div>
      <h2 style="margin-top:12px">FAQ <span style="display:flex;gap:6px"><button type="button" class="btn btn-sm" id="faqSuggest">Add suggested</button><button type="button" class="btn btn-sm" id="addFaq">${ico('plus', 14)} Add</button></span></h2>
      <div class="rep-list" id="faqList"></div>
    </div>
    <div class="panel">
      <h2>Testimonials <button type="button" class="btn btn-sm" id="addTesti">${ico('plus', 14)} Add</button></h2>
      <p class="hint" style="margin:-8px 0 14px">Only add real feedback from real people (with their permission). Section is hidden when empty.</p>
      <div class="rep-list" id="testiList"></div>
    </div>
    <div class="panel">
      <h2>Open-source repos (GitHub)</h2>
      <label class="toggle"><span><b>Show my public GitHub repos</b><small>Loaded live from GitHub on the home page</small></span><span class="switch"><input type="checkbox" name="showRepos" ${s.showRepos !== false ? 'checked' : ''}><span></span></span></label>
      <div class="grid-2" style="margin-top:8px">
        <div class="field"><label>GitHub username</label><input type="text" name="githubUser" value="${esc(s.githubUser || ghFromSocial)}" placeholder="DenishPhibonacci"></div>
        <div class="field"><label>Hide these repos</label><input type="text" name="hideRepos" value="${esc((s.hideRepos || []).join(', '))}" placeholder="PranVeda, old-test"><small>Separate with commas</small></div>
      </div>
    </div>
    <div class="panel">
      <h2>Integrations (free)</h2>
      <div class="field"><label>Contact form → email (Web3Forms access key)</label><input type="text" name="web3formsKey" value="${esc(s.web3formsKey)}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
        <small>Get a free key at <a href="https://web3forms.com" target="_blank" rel="noopener" style="color:var(--cyan)">web3forms.com</a> → enter your email → copy the Access Key. Messages then arrive in your inbox. Empty = form opens the visitor's email app.</small></div>
      <div class="field" style="margin:0"><label>Visitor analytics (GoatCounter code)</label><input type="text" name="goatcounter" value="${esc(s.goatcounter)}" placeholder="denishmakadiya">
        <small>Create a free account at <a href="https://www.goatcounter.com" target="_blank" rel="noopener" style="color:var(--cyan)">goatcounter.com</a>. If your dashboard is <code>denishmakadiya.goatcounter.com</code>, enter <code>denishmakadiya</code>. Counts visits, APK downloads and "Play" clicks.</small></div>
    </div>
    <div class="save-bar"><button class="btn btn-primary" type="submit">${ico('save')} Save world</button></div>
  </form>`;
  const form = $('#sf');
  form.addEventListener('input', () => (dirty = true));
  const addSvc = repeater($('#svcList'), services, [
    { k: 'icon', label: 'Icon', type: 'select', options: [['game', 'Game controller'], ['app', 'Mobile app'], ['website', 'Website'], ['asset', 'Asset box'], ['plugin', 'Plugin']] },
    { k: 'title', label: 'Title', ph: 'Game Development' },
    { k: 'text', label: 'Text', ph: 'Short description', type: 'area' }
  ], { icon: 'game', title: '', text: '' }, () => (dirty = true));
  $('#addSvc').onclick = () => addSvc();
  const addTesti = repeater($('#testiList'), testimonials, [
    { k: 'name', label: 'Name', ph: 'Rahul Shah' }, { k: 'role', label: 'Role & company', ph: 'Product Manager, AIS Technolabs' },
    { k: 'text', label: 'What they said', ph: 'Denish delivered…', type: 'area' }
  ], { name: '', role: '', text: '' }, () => (dirty = true));
  $('#addTesti').onclick = () => addTesti();
  const addFaq = repeater($('#faqList'), faq, [
    { k: 'q', label: 'Question', ph: 'Do you take freelance projects?', wide: true },
    { k: 'a', label: 'Answer', ph: 'Yes — …', type: 'area' }
  ], { q: '', a: '' }, () => (dirty = true));
  $('#addFaq').onclick = () => addFaq();
  $('#faqSuggest').onclick = () => {
    const sug = [
      { q: 'Do you take freelance projects?', a: 'Yes — games, mobile apps, websites and Unity tools. Share your idea with the form and I will reply with questions and an estimate.' },
      { q: 'Which platforms do you build for?', a: 'Android, iOS, PC and WebGL with Unity, plus websites and web apps.' },
      { q: 'How do you charge?', a: 'Fixed price for well-defined projects, or hourly / monthly for ongoing work. You get a clear estimate before we start.' },
      { q: 'Are you open to full-time roles?', a: 'I am open to the right opportunity — choose "Job offer" in the form and tell me about the role.' }
    ].filter(x => !faq.some(f => f.q === x.q));
    if (!sug.length) return toast('Suggested questions are already added');
    faq.push(...sug); dirty = true; addFaq.redraw();
  };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const next = { ...f, available: form.available.checked, initials: (f.initials || '').toUpperCase(), services: services.filter(x => x.title),
      faq: faq.filter(x => x.q && x.a), replyTime: (f.replyTime || '').trim(), timezone: (f.timezone || 'Asia/Kolkata').trim(),
      testimonials: testimonials.filter(x => x.name && x.text), showRepos: form.showRepos.checked,
      githubUser: (f.githubUser || '').trim().replace(/^@/, ''), hideRepos: list(f.hideRepos),
      web3formsKey: (f.web3formsKey || '').trim(), goatcounter: (f.goatcounter || '').trim().replace(/^https?:\/\//, '').replace(/\.goatcounter\.com.*$/, '') };
    try { await save('Update site settings', d => { d.site = { ...(d.site || {}), ...next }; }); dirty = false; viewSite(main); } catch (_) {}
  });
}

/* =========================================================
   Config
   ========================================================= */
function viewConfig(main) {
  main.innerHTML = header('// System', 'Config', 'Login, password and the GitHub repository of your website') + `
  <form class="panel" id="cf" style="max-width:640px">
    <h2>Repository</h2>
    <div class="grid-2">
      <div class="field"><label>Owner (GitHub username)</label><input type="text" name="owner" value="${esc(CFG.owner)}"></div>
      <div class="field"><label>Repository</label><input type="text" name="repo" value="${esc(CFG.repo)}"></div>
      <div class="field"><label>Branch</label><input type="text" name="branch" value="${esc(CFG.branch || GH.branch)}"></div>
      <div class="field"><label>Site folder in repo</label><input type="text" name="dir" value="${esc(CFG.dir)}" placeholder="(empty = repo root)"><small>Use <code>docs</code> if Pages serves the /docs folder</small></div>
    </div>
    <details class="help" style="margin-bottom:14px"><summary>Advanced</summary>
      <div class="field" style="margin-top:10px"><label>API URL</label><input type="text" name="api" value="${esc(CFG.api)}"></div></details>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" type="submit">${ico('check')} Save &amp; reconnect</button><button class="btn" type="button" id="resetCfg">Reset to auto-detect</button></div>
  </form>
  <form class="panel" id="pwForm" style="max-width:640px" autocomplete="on">
    <h2>Login &amp; password</h2>
    <p class="hint" style="margin:0 0 14px">You log in as <b>${esc(SESSION.user)}</b>. Change your username or password here.</p>
    <input type="text" name="username" autocomplete="username" value="${esc(SESSION.user)}" hidden>
    <div class="field"><label for="pwOld">Current password</label><input type="password" id="pwOld" autocomplete="current-password" required></div>
    <div class="grid-2">
      <div class="field"><label for="pwUser">Username</label><input type="text" id="pwUser" value="${esc(SESSION.user)}" autocapitalize="off" spellcheck="false" required></div>
      <div class="field"><label for="pwNew">New password</label><input type="password" id="pwNew" autocomplete="new-password" required minlength="10"><small>At least 10 characters, letters and numbers</small></div>
      <div class="field"><label for="pwNew2">Repeat new password</label><input type="password" id="pwNew2" autocomplete="new-password" required></div>
    </div>
    <button class="btn btn-primary" type="submit">${ico('save')} Change password</button>
  </form>
  <form class="panel" id="keyForm" style="max-width:640px">
    <h2>GitHub access key</h2>
    <p class="hint" style="margin:0 0 14px">Saving uses a GitHub key that is locked inside your login — you don't type it any more.
      Only when it <b>expires</b> (GitHub → Settings → Developer settings → Fine-grained tokens shows the date), make a new one with <b>Contents: Read and write</b> for <code>${esc(CFG.repo)}</code> and paste it here.</p>
    <div class="grid-2">
      <div class="field"><label for="kNew">New GitHub key</label><input type="password" id="kNew" autocomplete="off" spellcheck="false" placeholder="github_pat_…" required></div>
      <div class="field"><label for="kPass">Your password</label><input type="password" id="kPass" autocomplete="current-password" required></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit">${ico('check')} Replace key</button>
      <button class="btn btn-danger" type="button" id="forget">${ico('logout')} Log out on this device</button></div>
  </form>
  <div class="panel" style="max-width:640px">
    <h2>Backup &amp; restore</h2>
    <p class="hint" style="margin:0 0 12px">Downloads all your texts, profile, career and project details as one file. Images and APKs stay safe in the repo (and in its history).</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-primary" id="backupBtn">${ico('save')} Download backup</button>
      <label class="btn" style="position:relative;overflow:hidden">${ico('upload')} Restore from backup<input type="file" id="restoreInput" accept=".json,application/json" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
    </div>
  </div>`;
  $('#cf').addEventListener('submit', async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    CFG = { owner: f.owner.trim(), repo: f.repo.trim(), branch: f.branch.trim(), dir: f.dir.trim(), api: (f.api || 'https://api.github.com').trim() };
    store.set('pv_cfg', JSON.stringify(CFG));
    loading(true, 'Connecting', .5, `${CFG.owner}/${CFG.repo}`);
    try { await connect(SESSION.secrets.admin); loading(false); toast('Connected ✓'); refreshChrome(); }
    catch (err) { loading(false); toast(err.message, 'err'); }
  });
  $('#resetCfg').onclick = () => { store.del('pv_cfg'); location.reload(); };
  $('#forget').onclick = () => { Session.clear(); location.reload(); };
  const checkPassword = async pass => {
    const file = await GH.readJson(VAULT_PATH).catch(() => VAULT);
    return vaultOpen(file, SESSION.user, pass);
  };
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const user = $('#pwUser').value.trim(), pass = $('#pwNew').value;
    if (normUser(user).length < 3) return toast('Username must be at least 3 characters.', 'err');
    const pp = passwordProblem(pass); if (pp) return toast(pp, 'err');
    if (pass !== $('#pwNew2').value) return toast('The two new passwords are not the same.', 'err');
    loading(true, 'Saving', .5, 'New password');
    try {
      const cur = await checkPassword($('#pwOld').value);
      const { file, session } = await vaultCreate(user, pass, cur.secrets);
      await writeVault(file, 'Admin: change password');
      SESSION = session; Session.set(session, Session.keep());
      loading(false); toast('Password changed ✓ — use it next time you log in');
      viewConfig(main);
    } catch (err) { loading(false); toast(err.message === 'Wrong username or password.' ? 'Current password is wrong.' : err.message, 'err'); }
  });
  $('#keyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const token = $('#kNew').value.trim();
    loading(true, 'Checking key', .4, `${CFG.owner}/${CFG.repo}`);
    try {
      await checkPassword($('#kPass').value).catch(() => { throw new Error('Password is wrong.'); });
      await connect(token);
      await updateSecrets(s => { s.admin = token; }, 'Admin: replace GitHub key');
      loading(false); toast('GitHub key replaced ✓'); viewConfig(main);
    } catch (err) { loading(false); toast(err.status === 401 ? 'This GitHub key is wrong or expired.' : err.message, 'err'); }
  });
  $('#backupBtn').onclick = async () => {
    try {
      const d = await GH.readJson('data.json');
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Backup downloaded');
    } catch (err) { toast(err.message, 'err'); }
  };
  $('#restoreInput').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let d;
    try { d = JSON.parse(await f.text()); } catch (_) { return toast('That file is not a valid backup (.json).', 'err'); }
    if (!d || typeof d !== 'object' || !d.profile || !Array.isArray(d.projects)) return toast('This does not look like a portfolio backup.', 'err');
    if (!confirm(`Restore this backup? It replaces your current profile, career, texts and ${d.projects.length} project(s).`)) return;
    try { await save('Restore from backup', cur => { Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, d); }); route(); } catch (_) {}
  };
}

boot();
