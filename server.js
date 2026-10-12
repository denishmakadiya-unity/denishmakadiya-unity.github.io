/**
 * PranVeda — Unity Developer Portfolio + Admin Panel
 * Run:  node server.js  →  http://localhost:3000   (admin: /admin)
 * Zero dependencies — only Node.js 18+ is needed.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { parseMultipart } = require('./lib/multipart');
const { exportStatic } = require('./lib/export');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 1024);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DB_FILE = path.join(DATA_DIR, 'db.json');

['', 'images', 'videos', 'files', 'resume'].forEach(d => fs.mkdirSync(path.join(UPLOAD_DIR, d), { recursive: true }));
fs.mkdirSync(DATA_DIR, { recursive: true });

/* ------------------------------------------------------------------ */
/* Database (simple JSON file, written atomically)                     */
/* ------------------------------------------------------------------ */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function defaultDb() {
  const { salt, hash } = hashPassword('admin123');
  return {
    settings: { username: 'admin', salt, hash, mustChangePassword: true },
    profile: {
      brand: 'PranVeda',
      name: 'Denish Makadiya',
      role: 'Sr. Unity Developer',
      tagline: 'Senior Unity developer from Ahmedabad building mobile games, gameplay systems and Unity tools — from first prototype to store release.',
      about:
        'I am a Senior Unity Developer with 9+ years of experience creating mobile games and applications for Android and iOS. ' +
        'Over my career I have worked with seven studios in Ahmedabad — building gameplay, UI, integrations and complete games from idea to launch.\n\n' +
        'I enjoy solving hard problems, writing clean and reusable C# code, and turning ideas into polished, smooth-running games. ' +
        'Today I lead Unity development at Phibonacci Solution, and I also build plugins and Unity assets that help other developers ship faster.',
      avatar: '',
      resume: null, // { url, name, size }
      experienceYears: 9,
      location: 'Ahmedabad, Gujarat, India',
      email: 'denish.makadiya@zohomail.com',
      phone: '+91 97234 28591',
      showPhone: false,
      available: true,
      languages: ['English', 'Hindi', 'Gujarati'],
      skills: ['Unity 3D', 'C#', 'C', 'Mobile Game Development', 'Android', 'iOS', 'Xcode', 'macOS', 'Windows', 'Game Development', 'Mobile Applications', 'phpMyAdmin'],
      experience: [
        { role: 'Sr. Unity Developer', company: 'Phibonacci Solution', location: 'Ahmedabad', duration: 'Oct 2022 – Present', current: true },
        { role: 'Sr. Unity Developer', company: 'Khatriji Gaming', location: 'Ahmedabad', duration: '4 Months', current: false },
        { role: 'Sr. Unity Developer', company: 'AIS Technolabs', location: 'Ahmedabad', duration: '1.2 Years', current: false },
        { role: 'Sr. Unity Developer', company: 'Epistic Technologies', location: 'Ahmedabad', duration: '1.1 Years', current: false },
        { role: 'Sr. Unity Developer', company: 'TechDoodles', location: 'Ahmedabad', duration: '1.2 Years', current: false },
        { role: 'Unity Developer', company: 'Gadget App Development', location: 'Ahmedabad', duration: '5 Months', current: false },
        { role: 'Unity 3D Game Developer', company: 'iDivine Creation Technology', location: 'Ahmedabad', duration: '1.7 Years', current: false }
      ],
      education: [
        { degree: 'Master of Computer Application (MCA)', school: 'T.N. Rao College of IT, Rajkot', board: 'GTU', year: '2015' },
        { degree: 'Bachelor of Computer Application (BCA)', school: 'Geetanjali IT & Management, Rajkot', board: 'Saurashtra University', year: '2012' },
        { degree: 'Higher Secondary (HSC)', school: 'Deepak High School, Moviya', board: 'GSHEB', year: '2009' }
      ],
      socials: { github: 'https://github.com/DenishPhibonacci', linkedin: 'https://www.linkedin.com/in/denish-makadiya-a0b776ab', youtube: '', twitter: '', instagram: '', playstore: '', assetstore: '', itch: '' }
    },
    projects: [],
    messages: []
  };
}

let db;
function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    db = defaultDb();
    saveDb();
    return;
  }
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const def = defaultDb();
  db.settings = db.settings || def.settings;
  // First run with the old placeholder profile → fill in the resume details
  if (db.profile && db.profile.name === 'Your Name') {
    const keep = { avatar: db.profile.avatar, brand: db.profile.brand };
    db.profile = { ...def.profile, ...keep };
  }
  db.profile = { ...def.profile, ...(db.profile || {}) };
  db.profile.socials = { ...def.profile.socials, ...(db.profile.socials || {}) };
  db.projects = db.projects || [];
  db.messages = db.messages || [];
}
function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
loadDb();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const TYPES = ['game', 'plugin', 'asset'];
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = v => v === true || v === 'true' || v === 'on' || v === '1';
const list = (v, max = 30) => {
  if (Array.isArray(v)) return v.map(x => str(String(x), 60)).filter(Boolean).slice(0, max);
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); if (Array.isArray(p)) return list(p, max); } catch (_) {}
    return v.split(',').map(x => x.trim().slice(0, 60)).filter(Boolean).slice(0, max);
  }
  return [];
};
const safeUrl = v => {
  const s = str(v, 1000);
  if (!s) return '';
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; }
};
const slugify = s =>
  String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60) || 'project';
function uniqueSlug(title, exceptId) {
  const base = slugify(title);
  let slug = base, i = 2;
  while (db.projects.some(p => p.slug === slug && p.id !== exceptId)) slug = `${base}-${i++}`;
  return slug;
}
function removeUpload(url) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return;
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(UPLOAD_DIR + path.sep)) return;
  fs.unlink(file, () => {});
}
const fileUrl = f => '/uploads/' + path.relative(UPLOAD_DIR, f.path).split(path.sep).join('/');

function downloadLabel(p) {
  if (p.downloadFile) return p.downloadFile.ext.toUpperCase().replace('.', '');
  const m = (p.downloadUrl || '').toLowerCase().match(/\.(apk|aab|zip|unitypackage|rar|7z)(?:$|[?#])/);
  return m ? m[1].toUpperCase() : 'Download';
}
function publicProject(p) {
  const { downloadFile, ...rest } = p;
  return {
    ...rest,
    hasDownload: !!((downloadFile && downloadFile.url) || p.downloadUrl),
    downloadName: downloadLabel(p),
    downloadSize: downloadFile ? downloadFile.size : 0
  };
}

/* ------------------------------------------------------------------ */
/* Auth (cookie session)                                               */
/* ------------------------------------------------------------------ */
const sessions = new Map(); // token -> expiry
const SESSION_MS = 1000 * 60 * 60 * 12;
const loginAttempts = new Map(); // ip -> {count, until}

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const m = raw.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function isAuthed(req) {
  const t = getCookie(req, 'pv_session');
  if (!t || !sessions.has(t)) return false;
  if (sessions.get(t) < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function verifyPassword(password) {
  const s = db.settings;
  if (typeof password !== 'string') return false;
  return crypto.timingSafeEqual(Buffer.from(hashPassword(password, s.salt).hash, 'hex'), Buffer.from(s.hash, 'hex'));
}

/* ------------------------------------------------------------------ */
/* Uploads                                                             */
/* ------------------------------------------------------------------ */
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov'];
const FILE_EXT = ['.apk', '.aab', '.zip', '.unitypackage', '.rar', '.7z'];
const FIELD_RULES = {
  cover: { dir: 'images', ext: IMAGE_EXT, max: 1 },
  icon: { dir: 'images', ext: IMAGE_EXT, max: 1 },
  gallery: { dir: 'images', ext: IMAGE_EXT, max: 20 },
  avatar: { dir: 'images', ext: IMAGE_EXT, max: 1 },
  videoFile: { dir: 'videos', ext: VIDEO_EXT, max: 1 },
  downloadFile: { dir: 'files', ext: FILE_EXT, max: 1 },
  resume: { dir: 'resume', ext: ['.pdf', '.doc', '.docx'], max: 1 }
};

async function readUpload(req, allowedFields) {
  const counts = {};
  const { fields, files } = await parseMultipart(req, {
    maxFileSize: MAX_UPLOAD_MB * 1024 * 1024,
    maxFieldSize: 64 * 1024,
    maxFiles: 30,
    fileRule: (field, filename) => {
      const rule = FIELD_RULES[field];
      if (!rule || !allowedFields.includes(field)) throw Object.assign(new Error('Unexpected file field: ' + field), { status: 400 });
      counts[field] = (counts[field] || 0) + 1;
      if (counts[field] > rule.max) throw Object.assign(new Error(`Too many files for ${field}`), { status: 400 });
      const ext = path.extname(filename).toLowerCase();
      if (!rule.ext.includes(ext)) throw Object.assign(new Error(`"${filename}" is not allowed here. Allowed: ${rule.ext.join(', ')}`), { status: 400 });
      const base = slugify(path.basename(filename, ext)).slice(0, 40);
      return { path: path.join(UPLOAD_DIR, rule.dir, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}${ext}`) };
    }
  });
  // Flatten single text fields (arrays only when repeated)
  return { body: fields, files };
}

/* ------------------------------------------------------------------ */
/* Tiny HTTP framework                                                 */
/* ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.apk': 'application/vnd.android.package-archive', '.zip': 'application/zip',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN'
};

function send(res, status, body, headers = {}) {
  if (res.headersSent) return;
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}
function json(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
}
function readJson(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Body too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      const ct = req.headers['content-type'] || '';
      try {
        if (ct.includes('application/x-www-form-urlencoded')) return resolve(Object.fromEntries(new URLSearchParams(raw)));
        resolve(JSON.parse(raw));
      } catch (_) { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

/** Serve a file with Range support (needed for video seeking) */
function serveFile(req, res, file, extraHeaders = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(req, res);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Last-Modified': st.mtime.toUTCString(), ...extraHeaders };
    if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) {
      return send(res, 304, null, headers);
    }
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range && (range[1] || range[2])) {
      let start = range[1] ? parseInt(range[1], 10) : st.size - parseInt(range[2], 10);
      let end = range[1] && range[2] ? parseInt(range[2], 10) : st.size - 1;
      start = Math.max(0, start); end = Math.min(end, st.size - 1);
      if (start > end) return send(res, 416, null, { 'Content-Range': `bytes */${st.size}` });
      res.writeHead(206, { ...SECURITY_HEADERS, ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...SECURITY_HEADERS, ...headers, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}
function serveStatic(req, res, baseDir, relPath, extraHeaders) {
  let rel;
  try { rel = decodeURIComponent(relPath); } catch (_) { return notFound(req, res); }
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir + path.sep)) return notFound(req, res);
  serveFile(req, res, file, extraHeaders);
}
function sendPage(req, res, name, status = 200) {
  fs.readFile(path.join(PUBLIC_DIR, name), (err, data) => {
    if (err) return send(res, 500, 'Server error');
    send(res, status, data, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
  });
}
function notFound(req, res) {
  if (req.url.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
  sendPage(req, res, 'index.html', 404);
}

const routes = [];
const route = (method, pattern, ...handlers) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, handlers });
};
const auth = (req, res) => { if (!isAuthed(req)) { json(res, 401, { error: 'Not logged in' }); return false; } return true; };
const clientIp = req => (process.env.TRUST_PROXY && (req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */
function publicProfile() {
  const p = { ...db.profile };
  if (!p.showPhone) p.phone = '';
  return p;
}
route('GET', '/api/profile', (req, res) => json(res, 200, isAuthed(req) && req.query.get('all') ? db.profile : publicProfile()));

route('GET', '/api/projects', (req, res) => {
  const type = req.query.get('type');
  let items = db.projects.filter(p => p.published);
  if (TYPES.includes(type)) items = items.filter(p => p.type === type);
  items.sort((a, b) => (b.featured - a.featured) || (b.order || 0) - (a.order || 0) || b.createdAt.localeCompare(a.createdAt));
  json(res, 200, items.map(publicProject));
});

route('GET', '/api/projects/:slug', (req, res) => {
  const p = db.projects.find(x => x.slug === req.params.slug && x.published);
  if (!p) return json(res, 404, { error: 'Not found' });
  json(res, 200, publicProject(p));
});

route('GET', '/api/stats', (req, res) => {
  const pub = db.projects.filter(p => p.published);
  json(res, 200, {
    games: pub.filter(p => p.type === 'game').length,
    plugins: pub.filter(p => p.type === 'plugin').length,
    assets: pub.filter(p => p.type === 'asset').length,
    downloads: pub.reduce((s, p) => s + (p.downloads || 0), 0)
  });
});

route('GET', '/download/:slug', (req, res) => {
  const p = db.projects.find(x => x.slug === req.params.slug && x.published);
  if (!p || (!p.downloadFile && !p.downloadUrl)) return send(res, 404, 'File not found', { 'Content-Type': 'text/plain' });
  if (!p.downloadFile) { // external link (GitHub Releases, Google Drive…)
    p.downloads = (p.downloads || 0) + 1; saveDb();
    return send(res, 302, null, { Location: p.downloadUrl });
  }
  const file = path.normalize(path.join(ROOT, p.downloadFile.url));
  if (!file.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(file)) return send(res, 404, 'File not found', { 'Content-Type': 'text/plain' });
  if (!req.headers.range) { p.downloads = (p.downloads || 0) + 1; saveDb(); }
  const niceName = `${p.slug}${p.version ? '-v' + p.version.replace(/[^\w.-]/g, '') : ''}${p.downloadFile.ext}`;
  serveFile(req, res, file, { 'Content-Disposition': `attachment; filename="${niceName}"`, 'Cache-Control': 'no-cache' });
});

const contactLimiter = new Map();
route('POST', '/api/contact', async (req, res) => {
  const ip = clientIp(req);
  if (Date.now() - (contactLimiter.get(ip) || 0) < 30000) return json(res, 429, { error: 'Please wait a little before sending another message.' });
  const b = await readJson(req, 20000);
  const name = str(b.name, 100), email = str(b.email, 150), message = str(b.message, 4000);
  if (!name || !message || !/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: 'Please fill name, a valid email and message.' });
  contactLimiter.set(ip, Date.now());
  db.messages.unshift({ id: crypto.randomUUID(), name, email, message, read: false, createdAt: new Date().toISOString() });
  db.messages = db.messages.slice(0, 1000);
  saveDb();
  json(res, 200, { ok: true });
});

/* ------------------------------------------------------------------ */
/* Auth routes                                                         */
/* ------------------------------------------------------------------ */
route('POST', '/api/login', async (req, res) => {
  const ip = clientIp(req);
  const att = loginAttempts.get(ip) || { count: 0, until: 0 };
  if (att.until > Date.now()) return json(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
  const { username, password } = await readJson(req, 10000);
  const ok = typeof username === 'string' && username === db.settings.username && verifyPassword(password);
  if (!ok) {
    att.count++;
    if (att.count >= 5) { att.until = Date.now() + 5 * 60 * 1000; att.count = 0; }
    loginAttempts.set(ip, att);
    return json(res, 401, { error: 'Wrong username or password' });
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  json(res, 200, { ok: true, mustChangePassword: !!db.settings.mustChangePassword },
    { 'Set-Cookie': `pv_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_MS / 1000}` });
});

route('POST', '/api/logout', (req, res) => {
  const t = getCookie(req, 'pv_session');
  if (t) sessions.delete(t);
  json(res, 200, { ok: true }, { 'Set-Cookie': 'pv_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0' });
});

route('GET', '/api/me', (req, res) => {
  if (!isAuthed(req)) return json(res, 401, { error: 'Not logged in' });
  json(res, 200, { username: db.settings.username, mustChangePassword: !!db.settings.mustChangePassword });
});

/* ------------------------------------------------------------------ */
/* Admin API                                                           */
/* ------------------------------------------------------------------ */
route('GET', '/api/admin/projects', auth, (req, res) => {
  json(res, 200, [...db.projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

function applyProjectFields(p, body, files) {
  const one = v => (Array.isArray(v) ? v[v.length - 1] : v);
  const b = {};
  Object.keys(body).forEach(k => (b[k] = k === 'gallery' ? body[k] : one(body[k])));
  p.title = str(b.title, 120) || p.title || 'Untitled';
  p.type = TYPES.includes(b.type) ? b.type : p.type || 'game';
  p.shortDescription = str(b.shortDescription, 220);
  p.description = str(b.description, 20000);
  p.tags = list(b.tags);
  p.platforms = list(b.platforms, 10);
  p.unityVersion = str(b.unityVersion, 40);
  p.version = str(b.version, 30);
  p.price = str(b.price, 30);
  p.playStoreUrl = safeUrl(b.playStoreUrl);
  p.assetStoreUrl = safeUrl(b.assetStoreUrl);
  p.githubUrl = safeUrl(b.githubUrl);
  p.otherUrl = safeUrl(b.otherUrl);
  p.downloadUrl = safeUrl(b.downloadUrl);
  p.youtubeUrl = safeUrl(b.youtubeUrl);
  p.featured = bool(b.featured);
  p.published = b.published === undefined ? true : bool(b.published);
  p.order = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;

  const removeGallery = list(b.removeGallery, 50);
  if (removeGallery.length) {
    p.gallery = (p.gallery || []).filter(u => {
      if (removeGallery.includes(u)) { removeUpload(u); return false; }
      return true;
    });
  }
  if (bool(b.removeVideo) && p.videoFile) { removeUpload(p.videoFile); p.videoFile = ''; }
  if (bool(b.removeDownload) && p.downloadFile) { removeUpload(p.downloadFile.url); p.downloadFile = null; }
  if (bool(b.removeCover) && p.cover) { removeUpload(p.cover); p.cover = ''; }
  if (bool(b.removeIcon) && p.icon) { removeUpload(p.icon); p.icon = ''; }

  files = files || {};
  if (files.cover) { removeUpload(p.cover); p.cover = fileUrl(files.cover[0]); }
  if (files.icon) { removeUpload(p.icon); p.icon = fileUrl(files.icon[0]); }
  if (files.gallery) p.gallery = [...(p.gallery || []), ...files.gallery.map(fileUrl)].slice(0, 30);
  if (files.videoFile) { removeUpload(p.videoFile); p.videoFile = fileUrl(files.videoFile[0]); }
  if (files.downloadFile) {
    const f = files.downloadFile[0];
    if (p.downloadFile) removeUpload(p.downloadFile.url);
    p.downloadFile = { url: fileUrl(f), originalName: f.originalname, size: f.size, ext: path.extname(f.originalname).toLowerCase() };
  }
  p.updatedAt = new Date().toISOString();
}
const PROJECT_FILES = ['cover', 'icon', 'gallery', 'videoFile', 'downloadFile'];

route('POST', '/api/admin/projects', auth, async (req, res) => {
  const { body, files } = await readUpload(req, PROJECT_FILES);
  const p = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), downloads: 0, gallery: [], cover: '', icon: '', videoFile: '', downloadFile: null };
  applyProjectFields(p, body, files);
  p.slug = uniqueSlug(p.title, p.id);
  db.projects.push(p);
  saveDb();
  json(res, 200, p);
});

route('PUT', '/api/admin/projects/:id', auth, async (req, res) => {
  const p = db.projects.find(x => x.id === req.params.id);
  if (!p) { req.resume(); return json(res, 404, { error: 'Not found' }); }
  const { body, files } = await readUpload(req, PROJECT_FILES);
  const oldTitle = p.title;
  applyProjectFields(p, body, files);
  if (p.title !== oldTitle) p.slug = uniqueSlug(p.title, p.id);
  saveDb();
  json(res, 200, p);
});

route('PATCH', '/api/admin/projects/:id', auth, async (req, res) => {
  const p = db.projects.find(x => x.id === req.params.id);
  if (!p) return json(res, 404, { error: 'Not found' });
  const b = await readJson(req);
  if ('published' in b) p.published = bool(b.published);
  if ('featured' in b) p.featured = bool(b.featured);
  saveDb();
  json(res, 200, p);
});

route('DELETE', '/api/admin/projects/:id', auth, (req, res) => {
  const i = db.projects.findIndex(x => x.id === req.params.id);
  if (i < 0) return json(res, 404, { error: 'Not found' });
  const [p] = db.projects.splice(i, 1);
  [p.cover, p.icon, p.videoFile, ...(p.gallery || []), p.downloadFile && p.downloadFile.url].forEach(removeUpload);
  saveDb();
  json(res, 200, { ok: true });
});

route('PUT', '/api/admin/profile', auth, async (req, res) => {
  const { body, files } = await readUpload(req, ['avatar', 'resume']);
  const b = {}; Object.keys(body).forEach(k => (b[k] = Array.isArray(body[k]) ? body[k][body[k].length - 1] : body[k]));
  const pr = db.profile;
  pr.brand = str(b.brand, 40) || pr.brand;
  pr.name = str(b.name, 80) || pr.name;
  pr.role = str(b.role, 80);
  pr.tagline = str(b.tagline, 300);
  pr.about = str(b.about, 5000);
  pr.location = str(b.location, 80);
  pr.email = str(b.email, 150);
  pr.phone = str(b.phone, 40);
  pr.experienceYears = Math.max(0, Math.min(60, Number(b.experienceYears) || 0));
  pr.available = bool(b.available);
  pr.skills = list(b.skills, 40);
  pr.languages = list(b.languages, 10);
  pr.showPhone = bool(b.showPhone);
  const jsonList = (v, max) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a.slice(0, max) : []; } catch (_) { return []; } };
  if (b.experience !== undefined) {
    pr.experience = jsonList(b.experience, 30).map(e => ({
      role: str(e.role, 80), company: str(e.company, 100), location: str(e.location, 80),
      duration: str(e.duration, 60), current: bool(e.current), summary: str(e.summary, 600)
    })).filter(e => e.role || e.company);
  }
  if (b.education !== undefined) {
    pr.education = jsonList(b.education, 15).map(e => ({
      degree: str(e.degree, 120), school: str(e.school, 120), board: str(e.board, 80), year: str(e.year, 20)
    })).filter(e => e.degree || e.school);
  }
  if (bool(b.removeResume) && pr.resume) { removeUpload(pr.resume.url); pr.resume = null; }
  if (files.resume) {
    const f = files.resume[0];
    if (pr.resume) removeUpload(pr.resume.url);
    pr.resume = { url: fileUrl(f), name: f.originalname, size: f.size };
  }
  Object.keys(pr.socials).forEach(k => { pr.socials[k] = safeUrl(b['social_' + k]); });
  if (bool(b.removeAvatar) && pr.avatar) { removeUpload(pr.avatar); pr.avatar = ''; }
  if (files.avatar) { removeUpload(pr.avatar); pr.avatar = fileUrl(files.avatar[0]); }
  saveDb();
  json(res, 200, pr);
});

route('PUT', '/api/admin/account', auth, async (req, res) => {
  const { currentPassword, newPassword, username } = await readJson(req, 10000);
  const s = db.settings;
  if (!verifyPassword(currentPassword)) return json(res, 400, { error: 'Current password is wrong' });
  if (username !== undefined) {
    const u = str(username, 40);
    if (u.length < 3) return json(res, 400, { error: 'Username must be at least 3 characters' });
    s.username = u;
  }
  if (newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 8) return json(res, 400, { error: 'New password must be at least 8 characters' });
    Object.assign(s, hashPassword(newPassword));
    s.mustChangePassword = false;
  }
  saveDb();
  json(res, 200, { ok: true });
});

route('GET', '/api/admin/messages', auth, (req, res) => json(res, 200, db.messages));
route('PATCH', '/api/admin/messages/:id', auth, async (req, res) => {
  const m = db.messages.find(x => x.id === req.params.id);
  if (!m) return json(res, 404, { error: 'Not found' });
  m.read = bool((await readJson(req)).read);
  saveDb();
  json(res, 200, m);
});
route('DELETE', '/api/admin/messages/:id', auth, (req, res) => {
  db.messages = db.messages.filter(x => x.id !== req.params.id);
  saveDb();
  json(res, 200, { ok: true });
});

/* ---------- Export static site for GitHub Pages ---------- */
route('GET', '/api/admin/export', auth, (req, res) => {
  const info = { folder: 'docs', lastExport: db.settings.lastExport || null, exists: fs.existsSync(path.join(ROOT, 'docs', 'index.html')) };
  json(res, 200, info);
});
route('POST', '/api/admin/export', auth, (req, res) => {
  const report = exportStatic({ root: ROOT, publicDir: PUBLIC_DIR, uploadDir: UPLOAD_DIR, db, publicProject, publicProfile });
  db.settings.lastExport = new Date().toISOString();
  saveDb();
  json(res, 200, report);
});

route('GET', '/api/admin/stats', auth, (req, res) => {
  json(res, 200, {
    total: db.projects.length,
    published: db.projects.filter(p => p.published).length,
    games: db.projects.filter(p => p.type === 'game').length,
    plugins: db.projects.filter(p => p.type === 'plugin').length,
    assets: db.projects.filter(p => p.type === 'asset').length,
    downloads: db.projects.reduce((s, p) => s + (p.downloads || 0), 0),
    unread: db.messages.filter(m => !m.read).length,
    top: [...db.projects].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 5)
      .map(p => ({ title: p.title, type: p.type, downloads: p.downloads || 0, slug: p.slug }))
  });
});

/* ---------- Pages ---------- */
route('GET', '/', (req, res) => sendPage(req, res, 'index.html'));
route('GET', '/admin', (req, res) => sendPage(req, res, 'admin.html'));
// Old-style links /project/<slug> → project.html?slug=<slug>
route('GET', '/project/:slug', (req, res) => send(res, 302, null, { Location: '/project.html?slug=' + encodeURIComponent(req.params.slug) }));

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  req.query = url.searchParams;
  const pathname = url.pathname;
  const method = req.method === 'HEAD' ? 'GET' : req.method;

  try {
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(pathname);
      if (!m) continue;
      req.params = {};
      r.keys.forEach((k, i) => { try { req.params[k] = decodeURIComponent(m[i + 1]); } catch (_) { req.params[k] = m[i + 1]; } });
      for (const h of r.handlers) {
        const result = await h(req, res);
        if (result === false) return;
      }
      return;
    }
    if (method === 'GET') {
      if (pathname.startsWith('/uploads/')) {
        const isFile = pathname.startsWith('/uploads/files/');
        return serveStatic(req, res, UPLOAD_DIR, pathname.slice('/uploads/'.length), {
          'Cache-Control': 'public, max-age=604800',
          ...(isFile ? { 'Content-Disposition': 'attachment' } : {})
        });
      }
      if (pathname.startsWith('/api/')) return notFound(req, res);
      return serveStatic(req, res, PUBLIC_DIR, pathname.slice(1) || 'index.html', { 'Cache-Control': 'no-cache' });
    }
    notFound(req, res);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) json(res, status, { error: status === 500 ? 'Server error' : err.message }, status === 413 ? { Connection: 'close' } : {});
  }
});
server.requestTimeout = 0; // allow slow, large uploads
server.headersTimeout = 60000;

server.listen(PORT, () => {
  console.log(`\n  PranVeda portfolio running →  http://localhost:${PORT}`);
  console.log(`  Admin panel               →  http://localhost:${PORT}/admin`);
  if (db.settings.mustChangePassword) console.log('  Default login: admin / admin123  (change it after first login!)\n');
});
