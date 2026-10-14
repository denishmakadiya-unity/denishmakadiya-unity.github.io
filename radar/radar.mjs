/**
 * Job Radar — runs inside GitHub Actions in your PRIVATE "job-radar" repo.
 * Finds jobs that match your profile, scores them, saves jobs.json and
 * sends new matches to Telegram.
 *
 * Sources: Adzuna (19 countries, incl. India, with city filter), Remotive,
 * Remote OK, Himalayas and Arbeitnow (remote / international).
 * Each source's terms ask for attribution: every job keeps its source name
 * and links back to the original listing.
 *
 * MODE=email sends one job application e-mail (with your resume attached)
 * through your own mailbox (SMTP), prepared in the admin panel as outbox/<id>.json.
 *
 * Node 20+, no dependencies. Installed and updated by the portfolio admin panel.
 */
import fs from 'node:fs/promises';
import tls from 'node:tls';
import net from 'node:net';
import crypto from 'node:crypto';

const VERSION = 2;
const MODE = process.env.MODE || 'search';
const FIXTURES = process.env.RADAR_FIXTURES || ''; // for local testing only
const UA = 'Mozilla/5.0 (compatible; JobRadar/1.0; personal job alerts)';

/* ---------------- config ---------------- */
const readJson = async (file, fallback) => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) { return fallback; } };
const cfg = await readJson('config.json', {});
const keywords = (cfg.keywords || ['Unity Developer']).map(s => s.trim()).filter(Boolean);
const skills = (cfg.skills || []).map(s => s.trim()).filter(Boolean);
const exclude = (cfg.exclude || []).map(s => s.trim().toLowerCase()).filter(Boolean);
const locations = (cfg.locations || []).filter(l => l && (l.country || l.city));
const types = cfg.types || ['fulltime', 'remote', 'contract'];
const wantRemote = types.includes('remote');
const maxDays = Number(cfg.maxDays) || 14;
const minScore = Number(cfg.minScore) || 35;
const tg = cfg.telegram || {};
const notifyMin = Number(tg.minScore) || Math.max(minScore, 50);
const notifyMax = Number(tg.maxPerRun) || 8;

const ADZUNA = {
  'austria': 'at', 'australia': 'au', 'belgium': 'be', 'brazil': 'br', 'canada': 'ca', 'switzerland': 'ch', 'germany': 'de',
  'spain': 'es', 'france': 'fr', 'united kingdom': 'gb', 'uk': 'gb', 'india': 'in', 'italy': 'it', 'mexico': 'mx',
  'netherlands': 'nl', 'new zealand': 'nz', 'poland': 'pl', 'singapore': 'sg', 'united states': 'us', 'usa': 'us', 'south africa': 'za'
};

/* ---------------- helpers ---------------- */
const errors = {}; const counts = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = html => String(html || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRe = t => new RegExp(`(^|[^a-z0-9+#])${reEsc(t.toLowerCase())}($|[^a-z0-9+#])`, 'i');
const has = (text, term) => termRe(term).test(text);
const daysAgo = iso => (Date.now() - new Date(iso).getTime()) / 86400000;

async function getJson(source, url, headers = {}) {
  if (FIXTURES) {
    return JSON.parse(await fs.readFile(`${FIXTURES}/${source}.json`, 'utf8'));
  }
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function safely(source, fn) {
  try { const jobs = await fn(); counts[source] = (counts[source] || 0) + jobs.length; return jobs; }
  catch (e) { errors[source] = String(e.message || e).slice(0, 200); console.log(`[${source}] ${errors[source]}`); return []; }
}
function jobType(...hints) {
  const h = hints.join(' ').toLowerCase();
  if (/freelanc/.test(h)) return 'freelance';
  if (/contract|temporary|temp\b/.test(h)) return 'contract';
  if (/part[\s_-]?time/.test(h)) return 'part-time';
  return 'full-time';
}
const CUR = { in: '₹', gb: '£', us: '$', ca: 'C$', au: 'A$', nz: 'NZ$', sg: 'S$', de: '€', fr: '€', nl: '€', es: '€', it: '€', at: '€', be: '€', ch: 'CHF ', pl: 'zł ', br: 'R$', mx: 'MX$', za: 'R' };
const money = (min, max, cur = '', cc = '') => {
  min = Math.round(Number(min) || 0); max = Math.round(Number(max) || 0);
  const f = cc === 'in'
    ? n => (n >= 100000 ? (n / 100000).toFixed(n % 100000 ? 1 : 0).replace(/\.0$/, '') + 'L' : Math.round(n / 1000) + 'k')
    : n => (n >= 1000 ? Math.round(n / 1000) + 'k' : String(n));
  if (min && max && min !== max) return `${cur}${f(min)}–${f(max)}`;
  if (min || max) return `${cur}${f(min || max)}`;
  return '';
};
const primaryTerm = () => {
  // a short term for sources with simple search (e.g. "unity")
  const words = keywords.join(' ').toLowerCase().split(/\s+/);
  return ['unity', 'unity3d', 'game'].find(w => words.includes(w)) || keywords[0];
};

/* ---------------- sources ---------------- */
async function adzuna() {
  const { appId, appKey } = cfg.adzuna || {};
  if (!appId || !appKey) { errors.adzuna = 'Not set up (add Adzuna App ID & Key in Search profile)'; return []; }
  const out = [];
  const locs = locations.filter(l => ADZUNA[(l.country || '').toLowerCase()]);
  for (const loc of locs) {
    const cc = ADZUNA[loc.country.toLowerCase()];
    for (const kw of keywords.slice(0, 4)) {
      const p = new URLSearchParams({ app_id: appId, app_key: appKey, results_per_page: '50', what: kw, max_days_old: String(maxDays), sort_by: 'date', 'content-type': 'application/json' });
      if (loc.city) p.set('where', loc.city);
      const d = await getJson('adzuna', `https://api.adzuna.com/v1/api/jobs/${cc}/search/1?${p}`);
      for (const j of d.results || []) {
        out.push({
          id: 'adzuna:' + j.id, source: 'Adzuna', title: j.title, company: j.company && j.company.display_name,
          location: j.location && j.location.display_name, country: loc.country, remote: /remote|work from home|wfh/i.test(j.title + ' ' + (j.description || '')),
          type: jobType(j.contract_type, j.contract_time, j.title), salary: j.salary_is_predicted === '1' ? '' : money(j.salary_min, j.salary_max, CUR[cc] || '', cc),
          url: j.redirect_url, posted: j.created, text: j.description || ''
        });
      }
      await sleep(400);
    }
  }
  return out;
}
async function remotive() {
  const d = await getJson('remotive', `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(primaryTerm())}&limit=100`);
  return (d.jobs || []).map(j => ({
    id: 'remotive:' + j.id, source: 'Remotive', title: j.title, company: j.company_name, location: j.candidate_required_location || 'Remote',
    country: '', remote: true, type: jobType(j.job_type), salary: j.salary || '', url: j.url, posted: j.publication_date, text: strip(j.description), tags: [j.category].filter(Boolean)
  }));
}
async function remoteok() {
  const d = await getJson('remoteok', 'https://remoteok.com/api');
  return (Array.isArray(d) ? d : []).filter(j => j && j.id && j.position).map(j => ({
    id: 'remoteok:' + j.id, source: 'Remote OK', title: j.position, company: j.company, location: j.location || 'Remote', country: '', remote: true,
    type: jobType((j.tags || []).join(' '), j.position), salary: money(j.salary_min, j.salary_max, '$'), url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
    posted: j.date, text: strip(j.description), tags: j.tags || []
  }));
}
async function himalayas() {
  const out = [];
  for (const kw of [...new Set([primaryTerm(), keywords[0]])].slice(0, 2)) {
    const d = await getJson('himalayas', `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(kw)}&page=1`);
    for (const j of d.jobs || []) {
      out.push({
        id: 'himalayas:' + (j.guid || j.applicationLink), source: 'Himalayas', title: j.title, company: j.companyName,
        location: (j.locationRestrictions || []).length ? j.locationRestrictions.join(', ') : 'Remote (worldwide)', country: '', remote: true,
        type: jobType(j.employmentType), salary: money(j.minSalary, j.maxSalary, j.currency === 'USD' ? '$' : ''), url: j.applicationLink || j.guid,
        posted: j.pubDate ? new Date(typeof j.pubDate === 'number' && j.pubDate < 1e12 ? j.pubDate * 1000 : j.pubDate).toISOString() : '', text: strip(j.excerpt || j.description)
      });
    }
    await sleep(1000);
  }
  return out;
}
async function arbeitnow() {
  const out = [];
  for (let page = 1; page <= 2; page++) {
    const d = await getJson('arbeitnow', `https://www.arbeitnow.com/api/job-board-api?page=${page}`);
    for (const j of d.data || []) {
      out.push({
        id: 'arbeitnow:' + j.slug, source: 'Arbeitnow', title: j.title, company: j.company_name, location: j.remote ? `Remote · ${j.location || ''}` : j.location,
        country: 'Germany', remote: !!j.remote, type: jobType((j.job_types || []).join(' ')), salary: '', url: j.url,
        posted: j.created_at ? new Date(j.created_at * 1000).toISOString() : '', text: strip(j.description), tags: j.tags || []
      });
    }
    if (!d.links || !d.links.next) break;
    await sleep(500);
  }
  return out;
}

/* ---------------- scoring ---------------- */
const userCountries = locations.map(l => (l.country || '').toLowerCase()).filter(Boolean);
/* Focus: only game jobs and Unity asset / tools jobs count (no plain app or web jobs) */
const focus = cfg.focus || ['game', 'asset'];
const GAME_RE = /\b(games?|gaming|gameplay|game ?dev|unity ?3d|unity|unreal|level design|esports|casual|hyper-?casual|puzzle|rpg|mmo|slots?|metaverse)\b/gi;
const ASSET_RE = /\b(unity (tools?|editor|assets?|plugins?|sdk|packages?)|editor (tools?|extensions?|scripting)|asset store|tools? (engineer|programmer|developer)|technical artist|plugin developer|custom inspectors?)\b/gi;
const NOT_GAME_TITLE = /\b(flutter|react|angular|vue|node\.?js|php|laravel|wordpress|django|\.net|asp|full ?stack|front ?end|back ?end|web developer|android app|ios app|mobile app developer|salesforce|sap|data (engineer|scientist)|devops|qa tester)\b/i;
const hits = (re, t) => (String(t).match(re) || []).length;
function category(title, text) {
  const t = String(title || ''), all = t + ' ' + String(text || '');
  const asset = focus.includes('asset') && (hits(ASSET_RE, t) > 0 || hits(ASSET_RE, all) >= 1 && /unity/i.test(t));
  const gameTitle = hits(GAME_RE, t) > 0, gameText = hits(GAME_RE, all);
  const game = focus.includes('game') && (gameTitle || (gameText >= 3 && !NOT_GAME_TITLE.test(t)));
  if (asset) return 'asset';
  if (game) return 'game';
  return '';
}
const IGNORE_SKILL = /^(mobile applications?|applications?|apps?|websites?|web|php|phpmyadmin|windows|macos|mac ?os|xcode|c)$/i;
function score(j) {
  const title = (j.title || '').toLowerCase();
  const text = `${title} ${(j.text || '').toLowerCase()} ${(j.tags || []).join(' ').toLowerCase()}`;
  if (exclude.some(x => has(title, x))) return null;
  const cat = category(j.title, j.text + ' ' + (j.tags || []).join(' '));
  if (!cat) return null;
  let s = 0;
  const fullTitle = keywords.some(k => k.toLowerCase().split(/\s+/).every(w => has(title, w)));
  const termInTitle = keywords.some(k => k.toLowerCase().split(/\s+/).some(w => w.length > 3 && has(title, w)));
  const termAnywhere = keywords.some(k => k.toLowerCase().split(/\s+/).some(w => w.length > 3 && has(text, w)));
  if (!termAnywhere && !skills.some(sk => has(title, sk))) return null;
  s += fullTitle ? 50 : termInTitle ? 32 : 12;
  const matched = skills.filter(sk => !IGNORE_SKILL.test(sk) && has(text, sk));
  s += Math.min(36, matched.length * 9);
  const age = j.posted ? daysAgo(j.posted) : 99;
  if (age <= 2) s += 10; else if (age <= 7) s += 5;
  if (j.remote && !/worldwide|anywhere|global/i.test(j.location || '') && userCountries.length &&
      /only|usa|united states|europe|uk|canada/i.test(j.location || '') && !userCountries.some(c => (j.location || '').toLowerCase().includes(c))) s -= 15;
  if (hits(GAME_RE, j.title) || hits(ASSET_RE, j.title)) s += 6;
  return { score: Math.max(0, Math.min(100, Math.round(s))), matched: matched.slice(0, 8), cat };
}
function allowedType(j) {
  if (j.type === 'contract' || j.type === 'freelance') return types.includes('contract');
  if (j.remote) return types.includes('remote') || types.includes('fulltime');
  return types.includes('fulltime');
}

/* ---------------- telegram ---------------- */
const escHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function telegram(text) {
  if (!tg.botToken || !tg.chatId) throw new Error('Telegram bot token / chat ID missing');
  if (FIXTURES) { console.log('[telegram]\n' + text); return; }
  const r = await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: tg.chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error('Telegram: ' + (d.description || r.status));
}
async function notify(newJobs, firstRun) {
  if (!tg.enabled || !newJobs.length) return 0;
  const top = newJobs.filter(j => j.score >= notifyMin).sort((a, b) => b.score - a.score).slice(0, firstRun ? 5 : notifyMax);
  if (!top.length) return 0;
  const head = firstRun ? `🛰️ <b>Job Radar is live!</b> Here are your top ${top.length} matches:` : `🎯 <b>${top.length} new job${top.length > 1 ? 's' : ''} for you</b>`;
  const lines = top.map(j => `<b>${escHtml(j.title)}</b>${j.company ? ' — ' + escHtml(j.company) : ''}\n📍 ${escHtml(j.location || '')} · ${j.remote ? 'Remote · ' : ''}${escHtml(j.type)} · <b>${j.score}%</b> match${j.salary ? ' · 💰 ' + escHtml(j.salary) : ''}\n<a href="${escHtml(j.url)}">Open on ${escHtml(j.source)}</a>`);
  let msg = head;
  for (const l of lines) {
    if ((msg + '\n\n' + l).length > 3800) { await telegram(msg); msg = ''; }
    msg += (msg ? '\n\n' : '') + l;
  }
  if (tg.adminUrl) msg += `\n\n<a href="${escHtml(tg.adminUrl)}">Open Job Radar</a>`;
  await telegram(msg);
  return top.length;
}

/* ---------------- e-mail (SMTP, no dependencies) ---------------- */
const BAD_MAIL = /^(no-?reply|donotreply|privacy|abuse|support|info@example)|@(example|sentry|wixpress|domain)\./i;
function findEmail(text) {
  const all = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return all.map(e => e.replace(/\.$/, '')).find(e => !BAD_MAIL.test(e)) || '';
}
const b64 = s => Buffer.from(s).toString('base64');
const encWord = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
const wrap76 = s => s.replace(/.{1,76}/g, '$&\r\n');
function buildMime({ from, fromName, to, cc, bcc, replyTo, subject, text, attachments }) {
  const bnd = 'b_' + crypto.randomBytes(12).toString('hex');
  const host = from.split('@')[1] || 'localhost';
  const head = [
    `From: ${encWord(fromName || from)} <${from}>`, `To: ${to.join(', ')}`, cc.length ? `Cc: ${cc.join(', ')}` : '',
    replyTo ? `Reply-To: ${replyTo}` : '', `Subject: ${encWord(subject)}`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${host}>`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${bnd}"`
  ].filter(Boolean).join('\r\n');
  let body = `--${bnd}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(text.replace(/\r?\n/g, '\r\n')))}`;
  for (const a of attachments) {
    body += `--${bnd}\r\nContent-Type: ${a.type}; name="${a.name}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${a.name}"\r\n\r\n${wrap76(a.data.toString('base64'))}`;
  }
  return `${head}\r\n\r\n${body}--${bnd}--\r\n`;
}
async function smtpSend(m) {
  const { host, port = 465, user, pass } = m.smtp;
  const secure = m.smtp.secure !== undefined ? !!m.smtp.secure : Number(port) === 465; // 465 = SSL, 587 = STARTTLS
  let sock = secure ? tls.connect({ host, port: Number(port), servername: host }) : net.connect({ host, port: Number(port) });
  let buf = '', waiters = [];
  const onData = d => { buf += d.toString('utf8'); flush(); };
  const flush = () => {
    const lines = buf.split('\r\n'); if (!waiters.length) return;
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^\d{3} /.test(lines[i])) { const resp = lines.slice(0, i + 1).join('\n'); buf = lines.slice(i + 1).join('\r\n'); waiters.shift()(resp); return flush(); }
    }
  };
  const read = () => new Promise((res, rej) => { waiters.push(res); setTimeout(() => rej(new Error('SMTP server did not answer (timeout)')), 30000); flush(); });
  const attach = s => { s.on('data', onData); s.on('error', e => waiters.length && waiters.shift()('599 ' + e.message)); };
  attach(sock);
  const cmd = async (line, ok, hide) => {
    if (line !== null) sock.write(line + '\r\n');
    const r = await read();
    if (!ok.test(r)) throw new Error(`SMTP ${hide ? 'login' : (line || 'connect').split(' ')[0]} failed: ${r.replace(/\s+/g, ' ').slice(0, 200)}`);
    return r;
  };
  await cmd(null, /^220/);
  let ehlo = await cmd('EHLO job-radar', /^250/);
  if (!secure) {
    await cmd('STARTTLS', /^220/);
    sock.removeAllListeners('data');
    sock = tls.connect({ socket: sock, servername: host }); attach(sock);
    await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
    ehlo = await cmd('EHLO job-radar', /^250/);
  }
  await cmd('AUTH LOGIN', /^334/);
  await cmd(b64(user), /^334/, true);
  await cmd(b64(pass), /^235/, true);
  await cmd(`MAIL FROM:<${m.from}>`, /^250/);
  for (const r of [...m.to, ...m.cc, ...m.bcc]) await cmd(`RCPT TO:<${r}>`, /^25[01]/);
  await cmd('DATA', /^354/);
  const mime = buildMime(m).replace(/\r\n\./g, '\r\n..');
  await cmd(mime + '\r\n.', /^250/);
  sock.write('QUIT\r\n'); sock.end();
}
const emailList = s => String(s || '').split(/[,;\s]+/).map(x => x.trim()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
async function sendOutbox(id) {
  const ec = cfg.email || {};
  if (!ec.host || !ec.user || !ec.pass) throw new Error('E-mail settings missing — fill Job Radar → E-mail in the admin panel');
  const file = `outbox/${id}.json`;
  const job = MODE === 'email-test'
    ? { to: ec.user, subject: 'Job Radar — test e-mail', body: 'This is a test from Job Radar. Your resume is attached, so you can check how employers will receive it.\n\n' + (ec.signature || ''), attachResume: true, resumeUrl: ec.resumeUrl, resumeName: ec.resumeName }
    : await readJson(file, null);
  if (!job) throw new Error('Nothing to send: ' + file + ' not found');
  const attachments = [];
  if (job.attachResume && job.resumeUrl) {
    let data;
    if (FIXTURES) data = Buffer.from('%PDF fixture'); else {
      const r = await fetch(job.resumeUrl, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error(`Could not download the resume (${r.status}) from ${job.resumeUrl}`);
      data = Buffer.from(await r.arrayBuffer());
    }
    attachments.push({ name: job.resumeName || 'Resume.pdf', type: /\.pdf$/i.test(job.resumeName || job.resumeUrl) ? 'application/pdf' : 'application/octet-stream', data });
  }
  const to = emailList(job.to); if (!to.length) throw new Error('No valid "To" e-mail address');
  const msg = {
    smtp: ec, from: ec.from || ec.user, fromName: ec.fromName || '', to, cc: emailList(job.cc), bcc: ec.copyToSelf ? [ec.from || ec.user] : [],
    replyTo: ec.replyTo || '', subject: job.subject || '', text: job.body || '', attachments
  };
  let result;
  try {
    if (FIXTURES) console.log('[email]\n' + buildMime(msg).slice(0, 600)); else await smtpSend(msg);
    result = { status: 'sent', sentAt: new Date().toISOString(), attached: attachments.map(a => a.name) };
    console.log(`E-mail sent to ${to.join(', ')}`);
  } catch (e) {
    result = { status: 'failed', error: String(e.message || e), at: new Date().toISOString() };
    console.error(result.error);
  }
  if (MODE !== 'email-test') await fs.writeFile(file, JSON.stringify({ ...job, ...result }, null, 1) + '\n');
  if (result.status !== 'sent') process.exitCode = 1;
}

/* ---------------- main ---------------- */
if (MODE === 'email' || MODE === 'email-test') {
  try { await sendOutbox(process.env.OUTBOX_ID || ''); }
  catch (e) { console.error(String(e.message || e)); process.exitCode = 1; }
  process.exit();
}
if (MODE === 'telegram-test') {
  await telegram('✅ <b>Job Radar test</b>\nTelegram notifications are working. You will get new matching jobs here.');
  console.log('Test message sent');
  process.exit(0);
}

const prev = await readJson('jobs.json', { jobs: [] });
const prevById = new Map((prev.jobs || []).map(j => [j.id, j]));
const firstRun = !(prev.jobs || []).length;

const raw = [
  ...(await safely('adzuna', adzuna)),
  ...(wantRemote || types.includes('contract') ? [
    ...(await safely('remotive', remotive)),
    ...(await safely('remoteok', remoteok)),
    ...(await safely('himalayas', himalayas)),
    ...(await safely('arbeitnow', arbeitnow))
  ] : [])
];

const seenKey = new Set();
const now = new Date().toISOString();
const found = [];
for (const j of raw) {
  if (!j.title || !j.url) continue;
  if (j.posted && daysAgo(j.posted) > maxDays) continue;
  const key = `${j.title}|${j.company}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
  if (seenKey.has(key)) continue;
  const sc = score(j); if (!sc || sc.score < minScore) continue;
  if (!allowedType(j)) continue;
  seenKey.add(key);
  const old = prevById.get(j.id);
  found.push({
    id: j.id, source: j.source, title: j.title.trim(), company: (j.company || '').trim(), location: (j.location || '').trim(), country: j.country || '',
    remote: !!j.remote, type: j.type, salary: j.salary || '', url: j.url, posted: j.posted || now,
    summary: strip(j.text).slice(0, 320), score: sc.score, matched: sc.matched, cat: sc.cat, firstSeen: old ? old.firstSeen : now,
    email: findEmail(strip(j.text)) || (old && old.email) || ''
  });
}
const newJobs = found.filter(j => !prevById.has(j.id));

// keep older jobs we found before (until they are 3× maxDays old) so saved/applied ones don't vanish
const keepOld = (prev.jobs || []).filter(j => !found.some(f => f.id === j.id) && daysAgo(j.firstSeen || j.posted) <= maxDays * 3)
  .map(j => ({ ...j, cat: category(j.title, j.summary) })).filter(j => j.cat); // older jobs must also be game / Unity asset jobs
const jobs = [...found, ...keepOld].sort((a, b) => String(b.posted).localeCompare(String(a.posted))).slice(0, 500);

let notified = 0;
try { notified = await notify(newJobs, firstRun); } catch (e) { errors.telegram = String(e.message || e); }

const out = {
  version: VERSION, updatedAt: now,
  lastRun: { at: now, found: found.length, new: newJobs.length, notified, counts, errors },
  jobs
};
await fs.writeFile('jobs.json', JSON.stringify(out, null, 1) + '\n');
console.log(`Found ${found.length} matching jobs (${newJobs.length} new), notified ${notified}. Sources:`, counts, Object.keys(errors).length ? 'Errors: ' + JSON.stringify(errors) : '');
