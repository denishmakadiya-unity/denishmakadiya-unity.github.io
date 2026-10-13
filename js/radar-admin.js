/* =========================================================
   Job Radar — admin section.
   Data lives in a PRIVATE repo (default "job-radar"):
     config.json  search profile + Telegram settings
     jobs.json    results written by the GitHub Action (radar.mjs)
     status.json  your saved / applied / hidden jobs
   ========================================================= */
const RADAR_REPO_DEFAULT = 'job-radar';
const RADAR_VERSION = 2; // 2 = can send application e-mails
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Netherlands', 'Singapore', 'United Arab Emirates', 'France',
  'Poland', 'Spain', 'Italy', 'Switzerland', 'New Zealand', 'Austria', 'Belgium', 'Ireland', 'Sweden', 'Japan', 'Saudi Arabia', 'Qatar', 'Brazil', 'Mexico', 'South Africa'];
const ADZUNA_COUNTRIES = new Set(['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Netherlands', 'Singapore', 'France', 'Poland',
  'Spain', 'Italy', 'Switzerland', 'New Zealand', 'Austria', 'Belgium', 'Brazil', 'Mexico', 'South Africa']);
const INDEED = { India: 'in.indeed.com', 'United States': 'www.indeed.com', 'United Kingdom': 'uk.indeed.com', Canada: 'ca.indeed.com', Australia: 'au.indeed.com',
  Germany: 'de.indeed.com', Netherlands: 'nl.indeed.com', Singapore: 'sg.indeed.com', 'United Arab Emirates': 'ae.indeed.com', France: 'fr.indeed.com',
  Ireland: 'ie.indeed.com', Poland: 'pl.indeed.com', Spain: 'es.indeed.com', Italy: 'it.indeed.com', 'New Zealand': 'nz.indeed.com', Japan: 'jp.indeed.com' };

let RADAR = null;
const RS = { cfg: null, jobs: null, status: null, exists: { config: false, script: false }, error: '' };

/* Job Radar can use its own access key (only for the private repo), or fall back to the admin key */
const hasRadarKey = () => !!(SESSION && SESSION.secrets && SESSION.secrets.radar);
const radarToken = () => (hasRadarKey() ? SESSION.secrets.radar : GH.token);
async function radarClient() {
  const name = CFG.radarRepo || RADAR_REPO_DEFAULT, token = radarToken();
  if (RADAR && RADAR.repo === name && RADAR.token === token) return RADAR;
  const c = new GitHubRepo({ owner: CFG.owner, repo: name, token, api: CFG.api, branch: 'main' });
  const info = await c.getRepo();
  c.branch = info.default_branch || 'main';
  c.isPrivate = !!info.private;
  RADAR = c;
  return c;
}
async function readOr(path, fallback) {
  try { return await RADAR.readJson(path); } catch (e) { if (e.status === 404) return fallback; throw e; }
}
function defaultRadarConfig() {
  const p = DATA.profile || {};
  const role = (p.role || 'Unity Developer').replace(/^(sr\.?|senior)\s+/i, '');
  return {
    keywords: [...new Set(['Unity Developer', role, 'Unity Game Developer', 'Game Developer'])].slice(0, 4),
    skills: (p.skills || ['Unity', 'C#']).filter(s => s.length < 30).slice(0, 14).concat(['Unity']).filter((v, i, a) => a.indexOf(v) === i),
    exclude: ['intern', 'internship', 'trainee', 'fresher'],
    locations: [{ city: (p.location || 'Ahmedabad').split(',')[0].trim(), country: 'India' }],
    types: ['fulltime', 'remote', 'contract'],
    maxDays: 14, minScore: 35,
    adzuna: { appId: '', appKey: '' },
    telegram: { enabled: false, botToken: '', chatId: '', minScore: 55, maxPerRun: 8, adminUrl: '' },
    email: { host: 'smtp.zoho.in', port: 465, user: p.email || '', pass: '', fromName: p.name || '', copyToSelf: true,
      subject: 'Application for {title} – ' + (p.name || ''), signature: defaultSignature() }
  };
}
async function loadRadar() {
  RS.error = '';
  await flushStatus();
  await radarClient();
  const [cfg, jobs, status] = await Promise.all([readOr('config.json', null), readOr('jobs.json', null), readOr('status.json', null)]);
  RS.exists.config = !!cfg;
  const script = await RADAR.readText('radar.mjs').catch(() => '');
  RS.exists.script = !!script;
  RS.exists.email = /sendOutbox/.test(script); // radar version that can send e-mails
  RS.cfg = { ...defaultRadarConfig(), ...(cfg || {}) };
  RS.cfg.telegram = { ...defaultRadarConfig().telegram, ...((cfg && cfg.telegram) || {}) };
  RS.cfg.adzuna = { ...defaultRadarConfig().adzuna, ...((cfg && cfg.adzuna) || {}) };
  RS.cfg.email = { ...defaultRadarConfig().email, ...((cfg && cfg.email) || {}) };
  RS.jobs = jobs || { jobs: [], lastRun: null };
  RS.status = { saved: [], applied: {}, hidden: [], apps: [], ...(status || {}) };
  if (!Array.isArray(RS.status.apps)) RS.status.apps = [];
  // jobs marked "Applied" before the tracker existed → create tracker entries
  Object.entries(RS.status.applied || {}).forEach(([jobId, when]) => {
    if (RS.status.apps.some(a => a.jobId === jobId)) return;
    const j = (RS.jobs.jobs || []).find(x => x.id === jobId);
    RS.status.apps.push(appFromJob(j || { id: jobId, title: 'Job', company: '' }, when));
  });
}

/* ---------- writing to the private repo ---------- */
async function radarCommit(message, files, quiet = false) {
  if (!quiet) loading(true, 'Saving', 1, 'job-radar');
  try {
    await RADAR.commit(message, files.map(f => ({ path: f.path, base64: textToBase64(typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2) + '\n') })));
    if (!quiet) { loading(false); toast('Saved ✓'); }
  } catch (err) { loading(false); toast(err.message, 'err'); throw err; }
}
let statusTimer = null, statusSaving = null;
function saveStatusSoon() {
  clearTimeout(statusTimer);
  statusTimer = setTimeout(flushStatus, 1500);
}
/* Save a waiting status change now (before re-reading the repo, so nothing is lost) */
function flushStatus() {
  if (statusTimer) { clearTimeout(statusTimer); statusTimer = null;
    statusSaving = radarCommit('Job radar: update my job list', [{ path: 'status.json', content: RS.status }], true)
      .catch(() => {}).finally(() => { statusSaving = null; });
  }
  return statusSaving || Promise.resolve();
}
window.addEventListener('beforeunload', e => { if (statusTimer || statusSaving) { flushStatus(); e.preventDefault(); e.returnValue = ''; } });
async function dispatchRadar(mode = 'search', id = '') {
  await RADAR.req('POST', '/actions/workflows/radar.yml/dispatches', { ref: RADAR.branch, inputs: id ? { mode, id } : { mode } });
}
async function latestRun() {
  const d = await RADAR.req('GET', `/actions/workflows/radar.yml/runs?per_page=1&t=${Date.now()}`);
  return d && d.workflow_runs && d.workflow_runs[0];
}
async function waitForRun(startedAt, onTick) {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 6000));
    const run = await latestRun().catch(() => null);
    if (run && new Date(run.created_at).getTime() >= startedAt - 15000) {
      onTick && onTick(run);
      if (run.status === 'completed') return run;
    }
  }
  return null;
}

/* ---------- helpers ---------- */
const ago = iso => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(s)) return '';
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
};
const enc = encodeURIComponent;
const slugPart = s => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function quickLinks(cfg) {
  const kw = cfg.keywords[0] || 'Unity Developer';
  const out = [];
  (cfg.locations.length ? cfg.locations : [{ city: '', country: 'India' }]).forEach(l => {
    const place = [l.city, l.country].filter(Boolean).join(', ');
    const label = l.city || l.country;
    const links = [
      ['LinkedIn', `https://www.linkedin.com/jobs/search/?keywords=${enc(kw)}&location=${enc(place)}&f_TPR=r604800`],
      INDEED[l.country] && ['Indeed', `https://${INDEED[l.country]}/jobs?q=${enc(kw)}&l=${enc(l.city || '')}&fromage=14`],
      l.country === 'India' && ['Naukri', `https://www.naukri.com/${slugPart(kw)}-jobs${l.city ? '-in-' + slugPart(l.city) : ''}`],
      l.country === 'India' && ['Foundit', `https://www.foundit.in/srp/results?query=${enc(kw)}&locations=${enc(l.city || '')}`],
      l.country === 'India' && ['Instahyre', `https://www.instahyre.com/search-jobs/?q=${enc(kw)}`],
      ['Glassdoor', `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${enc(kw + ' ' + label)}`]
    ].filter(Boolean);
    out.push({ title: `📍 ${place}`, links });
  });
  if (cfg.types.includes('remote')) out.push({ title: '🌍 Remote', links: [
    ['LinkedIn Remote', `https://www.linkedin.com/jobs/search/?keywords=${enc(kw)}&f_WT=2&f_TPR=r604800`],
    ['Remote OK', `https://remoteok.com/remote-${slugPart(kw.split(' ')[0])}-jobs`],
    ['Wellfound', `https://wellfound.com/jobs?q=${enc(kw)}`],
    ['Hitmarker (games)', `https://hitmarker.net/jobs?keywords=${enc(kw)}`]
  ] });
  if (cfg.types.includes('contract')) out.push({ title: '💼 Freelance', links: [
    ['Upwork', `https://www.upwork.com/nx/search/jobs/?q=${enc(kw)}`],
    ['Freelancer', `https://www.freelancer.com/jobs/?keyword=${enc(kw)}`],
    ['Fiverr (buyers)', `https://www.fiverr.com/search/gigs?query=${enc('unity game')}`]
  ] });
  return out;
}

/* ---------- Application tracker helpers ---------- */
const APP_STATUSES = [
  ['saved', 'Saved', 'draft'], ['applied', 'Applied', 'app'], ['interview', 'Interview', 'star'],
  ['offer', 'Offer', 'game'], ['rejected', 'Rejected', 'danger'], ['withdrawn', 'Withdrawn', 'draft']
];
const statusLabel = k => (APP_STATUSES.find(x => x[0] === k) || APP_STATUSES[1])[1];
const statusChip = k => (APP_STATUSES.find(x => x[0] === k) || APP_STATUSES[1])[2];
const todayIso = () => new Date().toISOString().slice(0, 10);
function appFromJob(j, when) {
  return {
    id: 'app_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    jobId: j.id || '', title: j.title || '', company: j.company || '', location: j.location || '', source: j.source || '',
    url: j.url || '', appliedOn: (when ? new Date(when) : new Date()).toISOString().slice(0, 10),
    status: 'applied', nextStep: '', nextDate: '', notes: '', letter: '', updatedAt: new Date().toISOString()
  };
}
const findApp = jobId => RS.status.apps.find(a => a.jobId && a.jobId === jobId);
function portfolioUrl() { return location.href.replace(/admin\.html.*$/, '').replace(/#.*$/, ''); }
function defaultSignature() {
  const p = (typeof DATA !== 'undefined' && DATA && DATA.profile) || {};
  const site = location.origin + location.pathname.replace(/admin(\.html)?$/, '');
  return ['Best regards,', p.name || 'Denish Makadiya', 'Senior Unity Developer | Unity Tools Engineer',
    p.phone ? '📞 ' + p.phone : '📞 +91 97234 28591', '✉️ ' + (p.email || 'denish.makadiya@zohomail.com'),
    (p.socials || {}).linkedin ? '🔗 LinkedIn: ' + p.socials.linkedin : '', '🌐 Portfolio: ' + site].filter(Boolean).join('\n');
}
const signature = () => ((RS.cfg && RS.cfg.email && RS.cfg.email.signature) || defaultSignature()).trim();
/** Public link to the resume uploaded in Player profile (GitHub Actions downloads it from here) */
function resumeInfo() {
  const r = DATA && DATA.profile && DATA.profile.resume;
  const path = r && (typeof r === 'string' ? r : r.path || r.url);
  if (!path) return null;
  const ext = (path.match(/\.(pdf|docx?|rtf)(\?|$)/i) || [, 'pdf'])[1].toLowerCase();
  const name = ((DATA.profile.name || 'Resume').replace(/[^\w]+/g, '_') + '_Resume.' + ext);
  const url = /^https?:/i.test(path) ? path : `https://raw.githubusercontent.com/${CFG.owner}/${CFG.repo}/${GH.branch}/${CFG.dir ? CFG.dir.replace(/^\/+|\/+$/g, '') + '/' : ''}${path.replace(/^\/+/, '')}`;
  return { url, name };
}
const companySite = co => `https://duckduckgo.com/?q=${encodeURIComponent('!ducky ' + co + ' official website')}`;
const EMAIL_RE = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;
const emailsIn = s => String(s || '').split(/[,;\s]+/).filter(Boolean);
function coverLetter(app, job) {
  const p = DATA.profile || {};
  const current = (p.experience || []).find(e => e.current);
  const skills = (job && job.matched && job.matched.length ? job.matched : (p.skills || []).slice(0, 4)).slice(0, 5);
  const skillText = skills.length > 1 ? skills.slice(0, -1).join(', ') + ' and ' + skills[skills.length - 1] : (skills[0] || 'Unity and C#');
  const studios = new Set((p.experience || []).map(e => (e.company || '').toLowerCase()).filter(Boolean)).size;
  const contact = [p.email, p.phone, (p.socials || {}).linkedin].filter(Boolean).join(' · ');
  return `Dear Hiring Team${app.company ? ' at ' + app.company : ''},

I'm writing to apply for the ${app.title || 'open'} position. I'm a ${p.role || 'Unity Developer'} with ${p.experienceYears || 0}+ years of experience building mobile games and applications with Unity${current ? `, currently at ${current.company}` : ''}.

Your role is a strong match for my work with ${skillText}. Over my career I have worked with ${studios || 'several'} studios, taking games and apps from first prototype to store release — gameplay systems, UI, performance on low-end devices, and SDK integrations.

You can see my games, apps and Unity assets here: ${portfolioUrl()}
My resume is attached.

I would be glad to talk about how I can help ${app.company || 'your team'}.

${signature()}`;
}

/* Small modal used for the cover letter and the add/edit form */
function openModal(title, html, onReady) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'modal-wrap'; m.id = 'modal';
  m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="btn btn-sm icon-btn" id="modalX" aria-label="Close">${ico('x', 15)}</button></div>
    <div class="modal-body">${html}</div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) closeModal(); });
  $('#modalX').onclick = closeModal;
  document.addEventListener('keydown', modalKey);
  onReady && onReady(m);
}
function modalKey(e) { if (e.key === 'Escape') closeModal(); }
function closeModal() { const m = $('#modal'); if (m) m.remove(); document.removeEventListener('keydown', modalKey); }

function showLetter(app, job, onSave) {
  const text = app.letter || coverLetter(app, job);
  openModal(`Cover letter — ${app.company || app.title}`, `
    <p class="hint" style="margin:0 0 10px">Made from your profile. Edit it, then copy it into the application form or email.</p>
    <textarea id="letterText" rows="16" class="mono-area" style="font-family:var(--font-body);font-size:14px">${esc(text)}</textarea>
    <div class="modal-acts">
      <button type="button" class="btn" id="letterReset">↺ Regenerate</button>
      ${onSave ? '<button type="button" class="btn" id="letterSave">Save with application</button>' : ''}
      <button type="button" class="btn btn-primary" id="letterCopy">Copy</button>
    </div>`, () => {
    $('#letterCopy').onclick = async () => {
      const t = $('#letterText');
      try { await navigator.clipboard.writeText(t.value); toast('Cover letter copied'); }
      catch (_) { t.select(); toast('Press Ctrl+C to copy'); }
    };
    $('#letterReset').onclick = () => { $('#letterText').value = coverLetter(app, job); };
    if (onSave) $('#letterSave').onclick = () => { onSave($('#letterText').value); closeModal(); };
  });
}

/* ---------- E-mail composer (sends through GitHub Actions + your own mailbox) ---------- */
function showEmail(job, appIn, onDone) {
  const st = RS.status, ec = RS.cfg.email || {};
  const app = appIn || (job && findApp(job.id)) || appFromJob(job || {});
  const resume = resumeInfo();
  const ready = ec.host && ec.user && ec.pass;
  const subject = (ec.subject || 'Application for {title}').replace(/\{title\}/g, app.title || 'the open position').replace(/\{company\}/g, app.company || '');
  const to = app.contactEmail || (job && job.email) || '';
  openModal(`E-mail — ${app.company || app.title || 'application'}`, `
    ${!RS.exists.email ? `<div class="banner">Your radar needs a quick update before it can send e-mails. <a href="#jobs/setup" style="color:var(--cyan)">Setup → Update radar</a></div>` : ''}
    ${!ready ? `<div class="banner">Set up sending once (2 min): <a href="#jobs/email" style="color:var(--cyan)">Job Radar → E-mail</a>. Until then you can copy the text or open your mail app.</div>` : ''}
    <div class="grid-2">
      <div class="field"><label for="emTo">To (HR / recruiter e-mail) *</label><input type="text" id="emTo" value="${esc(to)}" placeholder="hr@company.com" autocomplete="off">
        <small>${to ? (job && job.email && to === job.email ? 'Found in the job post ✓' : '') : `Not in the job post — find it on the <a href="${esc(companySite(app.company || ''))}" target="_blank" rel="noopener" style="color:var(--cyan)">company website ↗</a> (Careers / Contact page) or on LinkedIn.`}</small></div>
      <div class="field"><label for="emCc">Cc (optional)</label><input type="text" id="emCc" placeholder="another@company.com" autocomplete="off"></div>
    </div>
    <div class="field"><label for="emSubject">Subject</label><input type="text" id="emSubject" value="${esc(subject)}"></div>
    <div class="field"><label for="emBody">Message</label><textarea id="emBody" rows="14" class="mono-area" style="font-family:var(--font-body);font-size:14px">${esc(app.letter || coverLetter(app, job))}</textarea></div>
    <label class="toggle" style="padding-top:0"><span><b>Attach my resume</b><small>${resume ? esc(resume.name) + ' — from Player profile' : 'No resume uploaded yet — add it in <a href="#profile" style="color:var(--cyan)">Player profile</a>'}</small></span>
      <span class="switch"><input type="checkbox" id="emAttach" ${resume ? 'checked' : 'disabled'}><span></span></span></label>
    <div class="error" id="emErr"></div>
    <div class="modal-acts">
      <button type="button" class="btn" id="emReset">↺ Regenerate</button>
      <button type="button" class="btn" id="emCopy">Copy text</button>
      <a class="btn" id="emMailto" href="#" title="Opens your mail app (attach the resume yourself)">Open in mail app</a>
      <button type="button" class="btn btn-primary" id="emSend" ${ready && RS.exists.email ? '' : 'disabled'}>✈ Send now</button>
    </div>`, () => {
    const val = id => $('#' + id).value.trim();
    const mailto = () => `mailto:${encodeURIComponent(val('emTo'))}?subject=${encodeURIComponent(val('emSubject'))}&body=${encodeURIComponent($('#emBody').value)}${val('emCc') ? '&cc=' + encodeURIComponent(val('emCc')) : ''}`;
    $('#emMailto').onclick = e => { e.currentTarget.href = mailto(); };
    $('#emReset').onclick = () => { $('#emBody').value = coverLetter(app, job); };
    $('#emCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(`Subject: ${val('emSubject')}\n\n${$('#emBody').value}`); toast('Copied'); }
      catch (_) { $('#emBody').select(); toast('Press Ctrl+C to copy'); }
    };
    $('#emSend').onclick = async () => {
      const toList = emailsIn(val('emTo')), ccList = emailsIn(val('emCc'));
      const bad = [...toList, ...ccList].find(x => !EMAIL_RE.test(x));
      $('#emErr').textContent = '';
      if (!toList.length) return ($('#emErr').textContent = 'Add the e-mail address of the company / recruiter.');
      if (bad) return ($('#emErr').textContent = `"${bad}" is not a valid e-mail address.`);
      if (!val('emSubject')) return ($('#emErr').textContent = 'Add a subject.');
      const btn = $('#emSend'); btn.disabled = true; btn.textContent = 'Sending…';
      const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const attach = $('#emAttach').checked && resume;
      const mail = { to: toList.join(', '), cc: ccList.join(', '), subject: val('emSubject'), body: $('#emBody').value,
        attachResume: !!attach, resumeUrl: attach ? resume.url : '', resumeName: attach ? resume.name : '',
        jobId: app.jobId || '', company: app.company || '', title: app.title || '', createdAt: new Date().toISOString() };
      try {
        await radarCommit(`Job radar: e-mail to ${app.company || toList[0]}`, [{ path: `outbox/${id}.json`, content: mail }], true);
        const started = Date.now();
        await dispatchRadar('email', id);
        btn.textContent = 'Sending… (about 1 min)';
        const run = await waitForRun(started);
        const res = await RADAR.readJson(`outbox/${id}.json`).catch(() => ({}));
        if (res.status === 'sent' || (run && run.conclusion === 'success' && res.status !== 'failed')) {
          // record it in My applications
          if (!st.apps.includes(app)) st.apps.unshift(app);
          if (app.jobId) st.applied[app.jobId] = st.applied[app.jobId] || new Date().toISOString();
          if (app.status === 'saved') app.status = 'applied';
          app.contactEmail = toList[0]; app.letter = mail.body;
          app.emails = [...(app.emails || []), { to: mail.to, subject: mail.subject, sentAt: res.sentAt || new Date().toISOString(), resume: !!attach }];
          app.notes = [app.notes, `E-mailed ${mail.to} on ${new Date().toLocaleDateString()}${attach ? ' (resume attached)' : ''}`].filter(Boolean).join('\n');
          app.updatedAt = new Date().toISOString();
          saveStatusSoon(); closeModal(); toast(`E-mail sent to ${mail.to} ✓`); onDone && onDone();
        } else {
          const why = res.error || (run ? 'see job-radar repo → Actions for details' : 'GitHub did not finish in time — check job-radar repo → Actions');
          $('#emErr').innerHTML = `Not sent: ${esc(why)}${/535|auth|login/i.test(why) ? '<br>Check the e-mail settings: for Zoho use an <b>app-specific password</b> and the right server (smtp.zoho.in for India accounts).' : ''}`;
          btn.disabled = false; btn.textContent = '✈ Try again';
        }
      } catch (err) {
        $('#emErr').textContent = err.status === 422 ? 'Your radar needs an update first: Setup → Update radar.' : err.message;
        btn.disabled = false; btn.textContent = '✈ Send now';
      }
    };
  });
}

/* =========================================================
   View
   ========================================================= */
async function viewJobs(main, tab = 'list') {
  const myId = ROUTE_ID;
  main.innerHTML = header('// Quest board', 'Job Radar', 'Finds jobs that match your profile every 6 hours and pings you on Telegram',
    `<a class="btn" href="#jobs/settings">${ico('gear')} Search profile</a>`) +
    `<div class="seg radar-tabs" id="rtabs">
      <button data-t="list">${ico('radar', 14)} Jobs</button><button data-t="apps">My applications</button><button data-t="settings">Search profile</button>
      <button data-t="email">E-mail</button><button data-t="telegram">Telegram</button><button data-t="setup">Setup</button></div>
    <div id="rbody"><div class="panel"><div class="hint">Loading radar…</div></div></div>`;
  $$('#rtabs button').forEach(b => { b.classList.toggle('active', b.dataset.t === tab); b.onclick = () => (location.hash = 'jobs/' + b.dataset.t); });
  const body = $('#rbody');
  const fresh = RS.loadedAt && Date.now() - RS.loadedAt < 2 * 60 * 1000 && !RS.error;
  try { if (!fresh) { await loadRadar(); RS.loadedAt = Date.now(); } if (myId !== ROUTE_ID) return; }
  catch (err) {
    if (myId !== ROUTE_ID) return; // user already moved to another page
    RS.error = err.status === 404
      ? `Private repo "${CFG.owner}/${CFG.radarRepo || RADAR_REPO_DEFAULT}" not found, or ${hasRadarKey() ? 'your Job Radar key' : 'your access key'} can't see it yet. ${hasRadarKey() ? '' : 'Paste your Job Radar key below (step 2).'}`
      : err.message;
    markTab('setup'); return radarSetup(body);
  }
  if (!RS.exists.script && tab === 'list') { markTab('setup'); return radarSetup(body); }
  ({ list: radarList, apps: radarApps, settings: radarSettings, telegram: radarTelegram, email: radarEmail, setup: radarSetup }[tab] || radarList)(body);
}

function markTab(t) { $$('#rtabs button').forEach(b => b.classList.toggle('active', b.dataset.t === t)); }

/* ---------- Jobs list ---------- */
function radarList(body) {
  const cfg = RS.cfg, data = RS.jobs, st = RS.status;
  const lastSeen = Number(store.get('pv_jobs_seen') || 0);
  store.set('pv_jobs_seen', String(Date.now()));
  const run = data.lastRun;
  const errs = run && run.errors ? Object.entries(run.errors) : [];
  const countries = [...new Set((data.jobs || []).map(j => j.country).filter(Boolean))].sort();
  const f = { q: '', view: 'all', type: 'any', country: 'any', sort: 'score' };

  body.innerHTML = `
    <div class="panel radar-status">
      <div class="rs-left">
        <span class="rs-dot ${run ? 'ok' : ''}"></span>
        <div><b>${run ? `Last scan ${ago(run.at)}` : 'No scan yet'}</b>
          <small>${run ? `${run.found} matching jobs · ${run.new} new · ${Object.entries(run.counts || {}).map(([k, v]) => `${k} ${v}`).join(' · ')}` : 'Click "Scan now" to run the first search'}</small></div>
      </div>
      <div class="rs-right">
        ${cfg.telegram.enabled ? '<span class="chip game">Telegram ON</span>' : '<a class="chip draft" href="#jobs/telegram">Telegram OFF</a>'}
        <button class="btn btn-primary" id="scanBtn">${ico('radar')} Scan now</button>
      </div>
      ${errs.length ? `<div class="rs-errs">${errs.map(([k, v]) => `<span>⚠ <b>${esc(k)}</b>: ${esc(v)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="toolbar">
      <input type="text" id="jq" placeholder="Search title, company, skill…">
      <div class="seg" id="jview">
        <button class="active" data-v="all">All</button><button data-v="new">New</button><button data-v="saved">⭐ Saved</button><button data-v="applied">✓ Applied</button><button data-v="hidden">Hidden</button>
      </div>
      <select id="jtype"><option value="any">Any type</option><option value="full-time">Full-time</option><option value="remote">Remote</option><option value="contract">Contract / freelance</option></select>
      <select id="jcountry"><option value="any">Any country</option>${countries.map(c => `<option>${esc(c)}</option>`).join('')}<option value="__remote">Remote only</option></select>
      <select id="jsort"><option value="score">Best match</option><option value="date">Newest</option></select>
    </div>
    <p class="hint btn-help"><b>Open ↗</b> apply on the company's site (upload your resume there) · <b>✓ Applied</b> adds the job to <a href="#jobs/apps" style="color:var(--cyan)">My applications</a> — nothing is sent · <b>✉ E-mail</b> sends your cover letter + resume to the company · <b>🏢 Company</b> opens the company website · <b>Hide</b> removes it from the list</p>
    <div id="jlist" class="job-list"></div>
    <div class="panel" style="margin-top:18px">
      <h2>Search on job sites</h2>
      <p class="hint" style="margin:-8px 0 14px">LinkedIn, Naukri and Indeed don't allow automatic reading — these open a ready-made search with your role and location.</p>
      ${quickLinks(cfg).map(g => `<div class="ql"><b>${esc(g.title)}</b><div>${g.links.map(([n, u]) => `<a class="btn btn-sm" href="${esc(u)}" target="_blank" rel="noopener">${esc(n)} ↗</a>`).join('')}</div></div>`).join('')}
    </div>`;

  const isNew = j => new Date(j.firstSeen || j.posted).getTime() > lastSeen && lastSeen > 0;
  const render = () => {
    const q = f.q.toLowerCase();
    let items = (data.jobs || []).filter(j => {
      const hidden = st.hidden.includes(j.id);
      if (f.view === 'hidden') return hidden;
      if (hidden) return false;
      if (f.view === 'saved' && !st.saved.includes(j.id)) return false;
      if (f.view === 'applied' && !findApp(j.id)) return false;
      if (f.view === 'new' && !isNew(j)) return false;
      if (f.type === 'remote' && !j.remote) return false;
      if (f.type === 'contract' && !['contract', 'freelance'].includes(j.type)) return false;
      if (f.type === 'full-time' && (j.type !== 'full-time' || j.remote)) return false;
      if (f.country === '__remote' && !j.remote) return false;
      if (f.country !== 'any' && f.country !== '__remote' && j.country !== f.country) return false;
      if (q && !`${j.title} ${j.company} ${j.location} ${(j.matched || []).join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    });
    items.sort(f.sort === 'date' ? (a, b) => String(b.posted).localeCompare(String(a.posted)) : (a, b) => b.score - a.score || String(b.posted).localeCompare(String(a.posted)));
    $('#jlist').innerHTML = items.length ? items.map(j => {
      const saved = st.saved.includes(j.id), app = findApp(j.id), applied = !!app;
      return `<article class="job${isNew(j) ? ' is-new' : ''}${applied ? ' is-applied' : ''}" data-id="${esc(j.id)}">
        <div class="score" style="--p:${j.score}"><b>${j.score}</b><small>% match</small></div>
        <div class="job-main">
          <div class="job-top"><h3>${esc(j.title)}</h3>${isNew(j) ? '<span class="chip star">NEW</span>' : ''}${app ? `<span class="chip ${statusChip(app.status)}">${esc(statusLabel(app.status))} · ${esc(new Date(app.appliedOn).toLocaleDateString())}</span>` : ''}</div>
          <div class="job-co"><b>${esc(j.company || 'Company')}</b> · ${esc(j.location || '')} · ${esc(ago(j.posted))}</div>
          <div class="job-tags">
            <span class="chip ${j.type === 'full-time' ? 'app' : 'asset'}">${esc(j.type)}</span>${j.remote ? '<span class="chip website">Remote</span>' : ''}
            ${j.salary ? `<span class="chip draft">💰 ${esc(j.salary)}</span>` : ''}<span class="src">via ${esc(j.source)}</span>
          </div>
          ${j.summary ? `<p class="job-sum">${esc(j.summary)}</p>` : ''}
          ${(j.matched || []).length ? `<div class="job-skills">${j.matched.map(s => `<span>✓ ${esc(s)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="job-acts">
          <a class="btn btn-primary btn-sm" href="${esc(j.url)}" target="_blank" rel="noopener" title="Open the job on ${esc(j.source)} and apply there">Open ↗</a>
          <button class="btn btn-sm" data-a="save" title="Keep this job in your Saved list">${saved ? '★ Saved' : '☆ Save'}</button>
          ${applied ? `<a class="btn btn-sm" href="#jobs/apps" title="See it in My applications">📋 Track</a>` : `<button class="btn btn-sm" data-a="applied" title="Add to My applications (does not send anything)">✓ Applied</button>`}
          <button class="btn btn-sm" data-a="email" title="Send an application e-mail with your resume">✉ E-mail${j.email ? ' <i class="dot-ok" title="E-mail found in the post"></i>' : ''}</button>
          ${j.company ? `<a class="btn btn-sm" href="${esc(companySite(j.company))}" target="_blank" rel="noopener" title="Open ${esc(j.company)}'s website">🏢 Company</a>` : ''}
          <button class="btn btn-sm btn-danger" data-a="hide" title="Remove from this list">${st.hidden.includes(j.id) ? 'Unhide' : 'Hide'}</button>
        </div>
      </article>`;
    }).join('') : `<div class="empty"><b>${(data.jobs || []).length ? 'No jobs match these filters' : 'No jobs yet'}</b>${(data.jobs || []).length ? 'Try "All" or another filter.' : 'Run a scan, or widen your search profile (more keywords, more locations, lower minimum match).'}</div>`;
  };
  render();
  $('#jq').oninput = e => { f.q = e.target.value.trim(); render(); };
  $('#jview').onclick = e => { const b = e.target.closest('button'); if (!b) return; f.view = b.dataset.v; $$('#jview button').forEach(x => x.classList.toggle('active', x === b)); render(); };
  $('#jtype').onchange = e => { f.type = e.target.value; render(); };
  $('#jcountry').onchange = e => { f.country = e.target.value; render(); };
  $('#jsort').onchange = e => { f.sort = e.target.value; render(); };
  $('#jlist').onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = b.closest('.job').dataset.id;
    if (b.dataset.a === 'save') st.saved = st.saved.includes(id) ? st.saved.filter(x => x !== id) : [...st.saved, id];
    const job = (data.jobs || []).find(x => x.id === id);
    if (b.dataset.a === 'email') return showEmail(job, findApp(id), render);
    if (b.dataset.a === 'applied') {
      st.applied[id] = new Date().toISOString();
      if (!findApp(id)) st.apps.unshift(appFromJob(job));
      toast('Added to My applications ✓');
    }
    if (b.dataset.a === 'hide') st.hidden = st.hidden.includes(id) ? st.hidden.filter(x => x !== id) : [...st.hidden, id];
    render(); saveStatusSoon();
  };
  $('#scanBtn').onclick = async e => {
    const btn = e.currentTarget; btn.disabled = true; btn.lastChild.textContent = ' Scanning…';
    const started = Date.now();
    try {
      await dispatchRadar('search');
      toast('Scan started — takes about 1 minute');
      const r = await waitForRun(started, run => (btn.lastChild.textContent = run.status === 'completed' ? ' Done' : ' Scanning…'));
      if (r && r.conclusion !== 'success') toast(`Scan ${r.conclusion || 'did not finish'} — open the job-radar repo → Actions for details`, 'err');
      else if (r) { await new Promise(res => setTimeout(res, 3000)); await loadRadar(); toast(`Scan complete — ${RS.jobs.lastRun ? RS.jobs.lastRun.new : 0} new jobs`); radarList(body); return; }
      else toast('Scan is taking long — refresh in a minute', 'err');
    } catch (err) { toast(err.status === 403 ? 'Your access key needs "Actions: Read and write" for the job-radar repo (see Setup).' : err.message, 'err'); }
    btn.disabled = false; btn.lastChild.textContent = ' Scan now';
  };
}

/* ---------- My applications (tracker) ---------- */
function radarApps(body) {
  const st = RS.status;
  const f = { status: 'all', q: '' };
  const counts = () => Object.fromEntries(APP_STATUSES.map(([k]) => [k, st.apps.filter(a => a.status === k).length]));
  body.innerHTML = `
    <div class="pipeline" id="pipe"></div>
    <div class="toolbar">
      <input type="text" id="aq" placeholder="Search company, role, notes…">
      <div class="seg" id="aseg"><button class="active" data-s="all">All</button>${APP_STATUSES.map(([k, l]) => `<button data-s="${k}">${l}</button>`).join('')}</div>
      <button class="btn btn-primary" id="addApp">${ico('plus')} Add application</button>
    </div>
    <p class="hint btn-help">Track every job you applied to — from Job Radar or anywhere else (LinkedIn, Naukri, referrals). Change the status as you hear back, and set a next step with a date so nothing slips.</p>
    <div id="alist" class="app-list"></div>`;

  const drawPipe = () => {
    const c = counts();
    $('#pipe').innerHTML = APP_STATUSES.map(([k, l, chip]) => `<button type="button" class="pipe-step ${chip}${f.status === k ? ' on' : ''}" data-s="${k}"><b>${c[k]}</b><span>${l}</span></button>`).join('');
  };
  const render = () => {
    drawPipe();
    const q = f.q.toLowerCase(), today = todayIso();
    const items = st.apps.filter(a => (f.status === 'all' || a.status === f.status) &&
      (!q || `${a.company} ${a.title} ${a.notes} ${a.nextStep} ${a.location}`.toLowerCase().includes(q)))
      .sort((a, b) => {
        const da = a.nextDate && !['rejected', 'withdrawn'].includes(a.status) ? a.nextDate : '9999', db = b.nextDate && !['rejected', 'withdrawn'].includes(b.status) ? b.nextDate : '9999';
        return da.localeCompare(db) || String(b.appliedOn).localeCompare(String(a.appliedOn));
      });
    $('#alist').innerHTML = items.length ? items.map(a => {
      const active = !['rejected', 'withdrawn'].includes(a.status);
      const due = active && a.nextDate && a.nextDate <= today;
      return `<article class="app-row ${a.status}" data-id="${esc(a.id)}">
        <div class="app-main">
          <div class="job-top"><h3>${esc(a.title || 'Untitled role')}</h3>${a.letter ? '<span class="chip draft">✉ letter saved</span>' : ''}</div>
          <div class="job-co"><b>${esc(a.company || 'Company')}</b>${a.location ? ' · ' + esc(a.location) : ''}${a.source ? ' · via ' + esc(a.source) : ''} · applied ${esc(a.appliedOn ? new Date(a.appliedOn).toLocaleDateString() : '—')}</div>
          ${a.nextStep || a.nextDate ? `<div class="app-next${due ? ' due' : ''}">${due ? '⏰ ' : '→ '}<b>${esc(a.nextStep || 'Next step')}</b>${a.nextDate ? ` · ${esc(new Date(a.nextDate).toLocaleDateString())}${due ? ' (due)' : ''}` : ''}</div>` : ''}
          ${a.notes ? `<p class="job-sum">${esc(a.notes)}</p>` : ''}
        </div>
        <div class="app-acts">
          <select class="app-status" aria-label="Status">${APP_STATUSES.map(([k, l]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <div class="app-btns">
            ${a.url ? `<a class="btn btn-sm" href="${esc(a.url)}" target="_blank" rel="noopener" title="Open job page">↗</a>` : ''}
            <button class="btn btn-sm" data-a="edit">${ico('edit', 14)} Edit</button>
            <button class="btn btn-sm" data-a="letter" title="E-mail / cover letter">✉</button>
            ${a.company ? `<a class="btn btn-sm" href="${esc(companySite(a.company))}" target="_blank" rel="noopener" title="Company website">🏢</a>` : ''}
            <button class="btn btn-sm btn-danger icon-btn" data-a="del" title="Delete">${ico('trash', 14)}</button>
          </div>
        </div>
      </article>`;
    }).join('') : `<div class="empty"><b>${st.apps.length ? 'Nothing in this status' : 'No applications yet'}</b>${st.apps.length ? 'Pick another status above.' : 'Click "✓ Applied" on a job in the Jobs tab, or add one you applied to elsewhere.'}</div>`;
  };

  const editForm = (a, isNew) => openModal(isNew ? 'Add application' : 'Edit application', `
    <form id="appForm" class="app-form">
      <div class="grid-2">
        <div class="field"><label for="afTitle">Job title *</label><input type="text" id="afTitle" name="title" value="${esc(a.title)}" required></div>
        <div class="field"><label for="afCompany">Company *</label><input type="text" id="afCompany" name="company" value="${esc(a.company)}" required></div>
        <div class="field"><label for="afLoc">Location</label><input type="text" id="afLoc" name="location" value="${esc(a.location)}" placeholder="Ahmedabad / Remote"></div>
        <div class="field"><label for="afSrc">Where you applied</label><input type="text" id="afSrc" name="source" value="${esc(a.source)}" placeholder="LinkedIn, Naukri, referral…"></div>
        <div class="field"><label for="afUrl">Job link</label><input type="url" id="afUrl" name="url" value="${esc(a.url)}" placeholder="https://…"></div>
        <div class="field"><label for="afDate">Applied on</label><input type="date" id="afDate" name="appliedOn" value="${esc(a.appliedOn)}"></div>
        <div class="field"><label for="afStatus">Status</label><select id="afStatus" name="status">${APP_STATUSES.map(([k, l]) => `<option value="${k}" ${a.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="afNextDate">Next step date</label><input type="date" id="afNextDate" name="nextDate" value="${esc(a.nextDate)}"></div>
      </div>
      <div class="field"><label for="afNext">Next step</label><input type="text" id="afNext" name="nextStep" value="${esc(a.nextStep)}" placeholder="Follow up with HR / Technical round / Send test task"></div>
      <div class="field"><label for="afNotes">Notes</label><textarea id="afNotes" name="notes" rows="4" placeholder="Salary discussed, interviewer names, questions asked…">${esc(a.notes)}</textarea></div>
      <div class="modal-acts"><button type="button" class="btn" id="afCancel">Cancel</button><button class="btn btn-primary" type="submit">${ico('save')} Save</button></div>
    </form>`, () => {
    $('#afCancel').onclick = closeModal;
    $('#appForm').onsubmit = e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      if (!d.title.trim() || !d.company.trim()) return toast('Add the job title and company', 'err');
      Object.assign(a, { title: d.title.trim(), company: d.company.trim(), location: d.location.trim(), source: d.source.trim(), url: safeUrl(d.url),
        appliedOn: d.appliedOn || todayIso(), status: d.status, nextDate: d.nextDate, nextStep: d.nextStep.trim(), notes: d.notes.trim(), updatedAt: new Date().toISOString() });
      if (isNew) st.apps.unshift(a);
      closeModal(); render(); saveStatusSoon(); toast(isNew ? 'Application added' : 'Saved');
    };
    setTimeout(() => $('#afTitle').focus(), 30);
  });

  render();
  $('#aq').oninput = e => { f.q = e.target.value.trim(); render(); };
  const setStatus = s => { f.status = s; $$('#aseg button').forEach(x => x.classList.toggle('active', x.dataset.s === s)); render(); };
  $('#aseg').onclick = e => { const b = e.target.closest('button'); if (b) setStatus(b.dataset.s); };
  $('#pipe').onclick = e => { const b = e.target.closest('[data-s]'); if (b) setStatus(f.status === b.dataset.s ? 'all' : b.dataset.s); };
  $('#addApp').onclick = () => editForm({ ...appFromJob({ source: '' }), status: 'applied' }, true);
  $('#alist').onchange = e => {
    if (!e.target.matches('.app-status')) return;
    const a = st.apps.find(x => x.id === e.target.closest('.app-row').dataset.id);
    a.status = e.target.value; a.updatedAt = new Date().toISOString();
    render(); saveStatusSoon(); toast(`Status: ${statusLabel(a.status)}`);
  };
  $('#alist').onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const row = b.closest('.app-row'); const a = st.apps.find(x => x.id === row.dataset.id);
    if (b.dataset.a === 'edit') editForm(a, false);
    if (b.dataset.a === 'letter') {
      const job = (RS.jobs.jobs || []).find(x => x.id === a.jobId);
      showEmail(job, a, render);
    }
    if (b.dataset.a === 'del') {
      if (row.classList.contains('confirm')) {
        st.apps = st.apps.filter(x => x.id !== a.id);
        if (a.jobId) delete st.applied[a.jobId];
        render(); saveStatusSoon(); toast('Deleted');
      } else {
        row.classList.add('confirm'); b.innerHTML = 'Delete?'; b.classList.remove('icon-btn');
        setTimeout(() => { if (document.body.contains(row)) render(); }, 3500);
      }
    }
  };
}

/* ---------- Search profile ---------- */
function radarSettings(body) {
  const c = JSON.parse(JSON.stringify(RS.cfg));
  const locs = c.locations;
  body.innerHTML = `
  <form id="rsf">
    <div class="panel">
      <h2>What job</h2>
      <div class="field"><label>Job titles / keywords</label><input type="text" name="keywords" value="${esc(c.keywords.join(', '))}"><small>Comma separated. The first one is used for quick links. Example: Unity Developer, Game Developer, Unity 3D Developer</small></div>
      <div class="field"><label>Your skills (used to calculate the match %)</label><input type="text" name="skills" value="${esc(c.skills.join(', '))}"></div>
      <div class="field"><label>Skip jobs with these words in the title</label><input type="text" name="exclude" value="${esc(c.exclude.join(', '))}"><small>Example: intern, trainee, fresher, junior</small></div>
      <div class="field" style="margin:0"><span class="label">Job type</span>
        <div class="checks">
          <label><input type="checkbox" name="types" value="fulltime" ${c.types.includes('fulltime') ? 'checked' : ''}> Full-time (office / hybrid)</label>
          <label><input type="checkbox" name="types" value="remote" ${c.types.includes('remote') ? 'checked' : ''}> Remote</label>
          <label><input type="checkbox" name="types" value="contract" ${c.types.includes('contract') ? 'checked' : ''}> Freelance / contract</label>
        </div></div>
    </div>
    <div class="panel">
      <h2>Where <button type="button" class="btn btn-sm" id="addLoc">${ico('plus', 14)} Add city / country</button></h2>
      <p class="hint" style="margin:-8px 0 14px">Leave city empty to search the whole country. Automatic search covers Adzuna countries (India, US, UK, Canada, Australia, Germany, Singapore and more); others get quick-search links.</p>
      <div class="rep-list" id="locList"></div>
    </div>
    <div class="panel">
      <h2>Filters</h2>
      <div class="grid-2">
        <div class="field"><label>Only jobs posted in the last</label><select name="maxDays">${[3, 7, 14, 30].map(d => `<option value="${d}" ${Number(c.maxDays) === d ? 'selected' : ''}>${d} days</option>`).join('')}</select></div>
        <div class="field"><label>Minimum match: <b id="msv">${c.minScore}%</b></label><input type="range" name="minScore" min="10" max="90" step="5" value="${c.minScore}" oninput="document.getElementById('msv').textContent=this.value+'%'"></div>
      </div>
    </div>
    <div class="panel">
      <h2>Adzuna (India + 18 countries, by city)</h2>
      <p class="hint" style="margin:-8px 0 14px">Free key: <a href="https://developer.adzuna.com/signup" target="_blank" rel="noopener" style="color:var(--cyan)">developer.adzuna.com/signup</a> → after login open <b>Dashboard → API Access Details</b> and copy both values. Remote job sources (Remotive, Remote OK, Himalayas, Arbeitnow) work without a key.</p>
      <div class="grid-2">
        <div class="field"><label>App ID</label><input type="text" name="appId" value="${esc(c.adzuna.appId)}" autocomplete="off"></div>
        <div class="field"><label>App Key</label><input type="password" name="appKey" value="${esc(c.adzuna.appKey)}" autocomplete="off"></div>
      </div>
    </div>
    <div class="save-bar"><button class="btn btn-primary" type="submit">${ico('save')} Save search profile</button></div>
  </form>`;
  const addLoc = repeater($('#locList'), locs, [
    { k: 'city', label: 'City (optional)', ph: 'Ahmedabad' },
    { k: 'country', label: 'Country', type: 'select', options: COUNTRIES.map(x => [x, x + (ADZUNA_COUNTRIES.has(x) ? '' : ' (links only)')]) }
  ], { city: '', country: 'India' }, () => (dirty = true));
  $('#addLoc').onclick = () => addLoc();
  $('#rsf').addEventListener('input', () => (dirty = true));
  $('#rsf').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const next = {
      ...RS.cfg,
      keywords: list(fd.get('keywords')), skills: list(fd.get('skills')), exclude: list(fd.get('exclude')).map(x => x.toLowerCase()),
      types: fd.getAll('types'), locations: locs.filter(l => l.country).map(l => ({ city: (l.city || '').trim(), country: l.country })),
      maxDays: Number(fd.get('maxDays')) || 14, minScore: Number(fd.get('minScore')) || 35,
      adzuna: { appId: String(fd.get('appId') || '').trim(), appKey: String(fd.get('appKey') || '').trim() }, version: RADAR_VERSION
    };
    if (!next.keywords.length) return toast('Add at least one job title / keyword', 'err');
    if (!next.types.length) return toast('Choose at least one job type', 'err');
    try { await radarCommit('Job radar: update search profile', [{ path: 'config.json', content: next }]); RS.cfg = next; dirty = false; toast('Next scan will use these settings — or click Scan now'); } catch (_) {}
  });
}

/* ---------- Telegram ---------- */
function radarTelegram(body) {
  const t = RS.cfg.telegram;
  body.innerHTML = `
  <form id="tgf">
    <div class="panel">
      <h2>Get new jobs on your phone</h2>
      <ol class="steps">
        <li>Open <a href="https://t.me/BotFather" target="_blank" rel="noopener" style="color:var(--cyan)"><b>@BotFather</b></a> in Telegram → send <code>/newbot</code> → give it a name (e.g. <i>Denish Job Radar</i>) and a username ending in <code>bot</code>.</li>
        <li>BotFather replies with a <b>token</b> like <code>123456:ABC-…</code>. Paste it below.</li>
        <li>Open your new bot in Telegram and press <b>Start</b> (send any message).</li>
        <li>Click <b>Find my chat ID</b>, then <b>Save</b>, then <b>Send test message</b>.</li>
      </ol>
    </div>
    <div class="panel">
      <h2>Settings</h2>
      <label class="toggle"><span><b>Send Telegram notifications</b><small>Only for new jobs above the minimum match</small></span><span class="switch"><input type="checkbox" name="enabled" ${t.enabled ? 'checked' : ''}><span></span></span></label>
      <div class="grid-2" style="margin-top:10px">
        <div class="field"><label>Bot token</label><input type="password" name="botToken" value="${esc(t.botToken)}" autocomplete="off" placeholder="123456789:AA…"></div>
        <div class="field"><label>Chat ID</label><div style="display:flex;gap:8px"><input type="text" name="chatId" value="${esc(t.chatId)}" placeholder="e.g. 987654321"><button type="button" class="btn btn-sm" id="findChat">Find my chat ID</button></div>
          <small id="chatHint"></small></div>
        <div class="field"><label>Notify when match is at least: <b id="nmv">${t.minScore}%</b></label><input type="range" name="minScore" min="20" max="95" step="5" value="${t.minScore}" oninput="document.getElementById('nmv').textContent=this.value+'%'"></div>
        <div class="field"><label>Max jobs per message</label><select name="maxPerRun">${[3, 5, 8, 12, 20].map(n => `<option ${Number(t.maxPerRun) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      <p class="hint">The bot token is stored only in your <b>private</b> job-radar repo.</p>
    </div>
    <div class="save-bar"><button type="button" class="btn" id="tgTest">Send test message</button><button class="btn btn-primary" type="submit">${ico('save')} Save</button></div>
  </form>`;
  const form = $('#tgf');
  const collect = () => {
    const fd = new FormData(form);
    return { ...RS.cfg.telegram, enabled: form.enabled.checked, botToken: String(fd.get('botToken') || '').trim(), chatId: String(fd.get('chatId') || '').trim(),
      minScore: Number(fd.get('minScore')) || 55, maxPerRun: Number(fd.get('maxPerRun')) || 8, adminUrl: location.origin + location.pathname + '#jobs' };
  };
  const persist = async () => { const next = { ...RS.cfg, telegram: collect() }; await radarCommit('Job radar: update Telegram settings', [{ path: 'config.json', content: next }]); RS.cfg = next; dirty = false; };
  form.addEventListener('input', () => (dirty = true));
  form.addEventListener('submit', async e => { e.preventDefault(); try { await persist(); } catch (_) {} });
  $('#findChat').onclick = async () => {
    const token = form.botToken.value.trim();
    if (!token) return toast('Paste the bot token first', 'err');
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    try {
      const d = await (await fetch(url)).json();
      const ids = (d.result || []).map(u => (u.message || u.my_chat_member || u.channel_post || {}).chat).filter(Boolean);
      if (!d.ok) throw new Error(d.description || 'Invalid token');
      if (!ids.length) { $('#chatHint').textContent = 'No messages yet — open your bot in Telegram, press Start, then try again.'; return; }
      form.chatId.value = ids[ids.length - 1].id; dirty = true;
      $('#chatHint').textContent = `Found chat: ${ids[ids.length - 1].first_name || ids[ids.length - 1].title || ''} ✓`;
    } catch (err) {
      if (err instanceof TypeError) { // browser blocked the request — show the page instead
        window.open(url, '_blank', 'noopener');
        $('#chatHint').innerHTML = 'A new tab opened. Find <code>"chat":{"id":<b>123456789</b></code> and paste that number here.';
      } else toast(err.message, 'err');
    }
  };
  $('#tgTest').onclick = async () => {
    const t2 = collect();
    if (!t2.botToken || !t2.chatId) return toast('Fill bot token and chat ID first', 'err');
    try {
      await persist();
      const started = Date.now();
      await dispatchRadar('telegram-test');
      toast('Sending test message via GitHub — check Telegram in about 1 minute');
      const r = await waitForRun(started);
      if (r && r.conclusion === 'success') toast('Test message sent ✓ — check Telegram');
      else if (r) toast('Test failed — check the bot token / chat ID (details: job-radar repo → Actions)', 'err');
    } catch (err) { toast(err.status === 403 ? 'Your access key needs "Actions: Read and write" for the job-radar repo.' : err.message, 'err'); }
  };
}

/* ---------- E-mail sending settings ---------- */
function radarEmail(body) {
  const e = RS.cfg.email; let dirty = false;
  const resume = resumeInfo();
  body.innerHTML = `
    ${!RS.exists.email ? `<div class="banner">Your radar is an older version. Click <b>Update radar</b> once so it can send e-mails. <button class="btn btn-sm" id="updRadar" style="margin-left:8px">Update radar</button></div>` : ''}
    <form id="emf">
    <div class="panel">
      <h2>Send applications from your own e-mail</h2>
      <ol class="steps">
        <li>On a job click <b>✉ E-mail</b>. Subject, message (cover letter + your signature) and your resume are filled in automatically.</li>
        <li>Add the company's e-mail if the job post doesn't have one, check the text, and click <b>Send now</b>.</li>
        <li>GitHub (your private job-radar repo) sends it from <b>your</b> mailbox, so replies come straight to you. The job moves to <b>My applications</b>.</li>
      </ol>
      <p class="hint">Resume to attach: ${resume ? `<b>${esc(resume.name)}</b> ✓ (from Player profile)` : '<b style="color:var(--amber)">none yet</b> — upload it in <a href="#profile" style="color:var(--cyan)">Player profile</a>'}</p>
    </div>
    <div class="panel">
      <h2>Mailbox (SMTP)</h2>
      <details class="help" style="margin:0 0 14px"><summary>Zoho Mail: how to get the password (2 min)</summary><ol>
        <li>Open <a href="https://accounts.zoho.in/home#security/app_password" target="_blank" rel="noopener">Zoho Accounts → Security → App Passwords</a> (zoho.com accounts: accounts.zoho.com).</li>
        <li>Click <b>Generate New Password</b>, name it <code>Job Radar</code>, copy the password and paste it below.</li>
        <li>In Zoho Mail → Settings → <b>Mail Accounts → IMAP/POP/SMTP</b>, make sure SMTP access is on.</li>
        <li>Server: <code>smtp.zoho.in</code> for India accounts (mail.zoho.in), <code>smtp.zoho.com</code> otherwise. Port <b>465</b>.</li>
      </ol></details>
      <div class="grid-2">
        <div class="field"><label>SMTP server</label><input type="text" name="host" value="${esc(e.host)}" placeholder="smtp.zoho.in"></div>
        <div class="field"><label>Port</label><select name="port">${[465, 587].map(n => `<option value="${n}" ${Number(e.port) === n ? 'selected' : ''}>${n}${n === 465 ? ' (SSL)' : ' (STARTTLS)'}</option>`).join('')}</select></div>
        <div class="field"><label>Your e-mail (login)</label><input type="email" name="user" value="${esc(e.user)}" autocomplete="off"></div>
        <div class="field"><label>App password</label><input type="password" name="pass" value="${esc(e.pass)}" autocomplete="new-password" placeholder="App-specific password"></div>
        <div class="field"><label>Sender name</label><input type="text" name="fromName" value="${esc(e.fromName)}"></div>
        <div class="field"><label>Subject</label><input type="text" name="subject" value="${esc(e.subject)}"><small><code>{title}</code> = job title, <code>{company}</code> = company</small></div>
      </div>
      <label class="toggle"><span><b>Send me a copy (BCC)</b><small>So every application is also in your inbox</small></span><span class="switch"><input type="checkbox" name="copyToSelf" ${e.copyToSelf ? 'checked' : ''}><span></span></span></label>
      <p class="hint">The password is stored only in your <b>private</b> job-radar repo, like the Telegram token.</p>
    </div>
    <div class="panel">
      <h2>Signature</h2>
      <div class="field" style="margin:0"><textarea name="signature" rows="8" style="font-family:var(--font-body)">${esc(e.signature || defaultSignature())}</textarea><small>Added at the end of every e-mail.</small></div>
    </div>
    <div class="save-bar"><button type="button" class="btn" id="emTest">Send test to myself</button><button class="btn btn-primary" type="submit">${ico('save')} Save</button></div>
    </form>`;
  const form = $('#emf');
  const collect = () => {
    const fd = new FormData(form);
    const g = k => String(fd.get(k) || '').trim();
    return { ...RS.cfg.email, host: g('host'), port: Number(g('port')) || 465, user: g('user'), pass: String(fd.get('pass') || ''), fromName: g('fromName'),
      subject: g('subject'), signature: String(fd.get('signature') || '').trim(), copyToSelf: form.copyToSelf.checked,
      resumeUrl: resume ? resume.url : '', resumeName: resume ? resume.name : '' };
  };
  const persist = async () => { const next = { ...RS.cfg, email: collect() }; await radarCommit('Job radar: update e-mail settings', [{ path: 'config.json', content: next }]); RS.cfg = next; dirty = false; };
  form.addEventListener('input', () => (dirty = true));
  form.addEventListener('submit', async ev => { ev.preventDefault(); try { await persist(); } catch (_) {} });
  if ($('#updRadar')) $('#updRadar').onclick = () => { location.hash = 'jobs/setup'; setTimeout(() => $('#installBtn') && $('#installBtn').click(), 1200); };
  $('#emTest').onclick = async () => {
    const c = collect();
    if (!c.host || !c.user || !c.pass) return toast('Fill server, e-mail and app password first', 'err');
    if (!RS.exists.email) return toast('Update the radar first (button at the top)', 'err');
    const btn = $('#emTest'); btn.disabled = true; btn.textContent = 'Sending test…';
    try {
      await persist();
      const started = Date.now();
      await dispatchRadar('email-test');
      toast(`Sending a test to ${c.user} — about 1 minute`);
      const r = await waitForRun(started);
      if (r && r.conclusion === 'success') toast('Test e-mail sent ✓ — check your inbox');
      else if (r) toast('Test failed — usually a wrong app password or server. Details: job-radar repo → Actions', 'err');
    } catch (err) { toast(err.status === 403 ? 'The Job Radar key needs "Actions: Read and write".' : err.message, 'err'); }
    btn.disabled = false; btn.textContent = 'Send test to myself';
  };
}

/* ---------- Setup / install ---------- */
function radarSetup(body) {
  const repoName = CFG.radarRepo || RADAR_REPO_DEFAULT;
  const ok = !RS.error && RADAR;
  body.innerHTML = `
    ${RS.error ? `<div class="banner">${esc(RS.error)}</div>` : ''}
    ${ok && !RADAR.isPrivate ? `<div class="banner">⚠ "${esc(repoName)}" is PUBLIC — anyone could see your job search. Make it private: repo → Settings → Danger zone → Change visibility.</div>` : ''}
    <div class="panel">
      <h2>One-time setup (5 minutes)</h2>
      <ol class="steps">
        <li><b>Create a private repo</b> named <code>${esc(repoName)}</code>: <a href="https://github.com/new?name=${enc(repoName)}&visibility=private&description=${enc('My private job radar')}" target="_blank" rel="noopener" style="color:var(--cyan)">open GitHub → New repository</a>.
          Choose <b>Private</b> and tick <b>Add a README file</b>, then <b>Create repository</b>. ${ok ? '<span class="chip game">Found ✓</span>' : ''}</li>
        <li><b>Make a Job Radar access key</b> (separate from your admin key): <a href="${keyUrl('Job Radar', { contents: 'write', workflows: 'write', actions: 'write', target_name: CFG.owner }, 'Private job radar repo')}" target="_blank" rel="noopener" style="color:var(--cyan)"><b>open GitHub (everything pre-filled) ↗</b></a>.
          Only choose <b>Only select repositories</b> → <code>${esc(repoName)}</code>, click <b>Generate token</b>, and paste it in <b>Job Radar access key</b> below — once.
          ${hasRadarKey() ? '<span class="chip game">Key saved ✓</span>' : ''}</li>
        <li><b>Install the radar</b> with the button below. ${RS.exists.script ? '<span class="chip game">Installed ✓</span>' : ''}</li>
        <li>Fill <a href="#jobs/settings" style="color:var(--cyan)">Search profile</a> (add the free Adzuna key for India/city search) and <a href="#jobs/telegram" style="color:var(--cyan)">Telegram</a>, then click <b>Scan now</b>.</li>
      </ol>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <button class="btn btn-primary" id="installBtn" ${ok ? '' : 'disabled'}>${ico('upload')} ${RS.exists.script ? 'Update radar' : 'Install radar'}</button>
        <button class="btn" id="recheck">↻ Check again</button>
      </div>
    </div>
    <div class="panel">
      <h2>Job Radar access key</h2>
      <p class="hint" style="margin-top:0">Used only for the private <code>${esc(repoName)}</code> repo. Paste it once — it is locked inside your username/password login (like the admin key), so it works on any device after you log in.
        ${hasRadarKey() ? '<b style="color:var(--lime)">A separate key is saved.</b>' : 'No separate key yet — the admin key is used.'}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="margin:0;flex:1;min-width:240px"><label for="rtoken">Access key (github_pat_…)</label><input type="password" id="rtoken" autocomplete="off" spellcheck="false" placeholder="${hasRadarKey() ? '•••••••• saved — paste a new one to replace' : 'github_pat_…'}"></div>
        <button class="btn btn-primary" id="saveRToken">Save key</button>
        ${hasRadarKey() ? '<button class="btn btn-danger" id="delRToken">Remove</button>' : ''}
      </div>
    </div>
    <div class="panel">
      <h2>Private repo name</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="margin:0;flex:1;min-width:200px"><label>Repository</label><input type="text" id="rrepo" value="${esc(repoName)}"></div>
        <button class="btn" id="saveRepo">Use this repo</button>
      </div>
    </div>
    <div class="panel">
      <h2>How it works</h2>
      <ul class="steps">
        <li>GitHub Actions in your private repo runs the radar <b>every 6 hours</b> (free: private repos get 2,000 minutes/month; this uses about 120).</li>
        <li>It searches Adzuna (by city & country) and Remotive, Remote OK, Himalayas, Arbeitnow (remote/international), scores every job against your skills, and saves <code>jobs.json</code>.</li>
        <li>New jobs above your minimum match are sent to Telegram. Your saved / applied / hidden list is stored in <code>status.json</code>.</li>
        <li>LinkedIn, Naukri and Indeed can't be read automatically (they don't allow it) — the Jobs tab gives you one-click searches for them.</li>
      </ul>
    </div>`;
  $('#recheck').onclick = () => { RS.loadedAt = 0; viewJobs($('#main'), 'setup'); };
  $('#saveRToken').onclick = async () => {
    const t = $('#rtoken').value.trim();
    if (!/^(github_pat_|ghp_)\w{20,}/.test(t)) return toast('Paste the full key — it starts with github_pat_', 'err');
    try {
      loading(true, 'Checking key', .5, repoName);
      await new GitHubRepo({ owner: CFG.owner, repo: repoName, token: t, api: CFG.api, branch: 'main' }).getRepo();
      loading(true, 'Saving key', .8, 'Locked in your login');
      await updateSecrets(x => { x.radar = t; }, 'Admin: save Job Radar key (encrypted)');
      RADAR = null; RS.loadedAt = 0; loading(false);
      toast('Job Radar key saved ✓'); viewJobs($('#main'), 'setup');
    } catch (err) {
      loading(false);
      toast(err.status === 404 || err.status === 403 ? `This key can't see "${repoName}". Edit the token → Repository access → select ${repoName}.` : err.message, 'err');
    }
  };
  if ($('#delRToken')) $('#delRToken').onclick = async () => {
    try { loading(true, 'Removing key', .6, ''); await updateSecrets(x => { x.radar = ''; }, 'Admin: remove Job Radar key'); loading(false); }
    catch (err) { loading(false); return toast(err.message, 'err'); }
    RADAR = null; RS.loadedAt = 0; toast('Removed — the admin key is used again'); viewJobs($('#main'), 'setup');
  };
  $('#saveRepo').onclick = () => { CFG.radarRepo = $('#rrepo').value.trim() || RADAR_REPO_DEFAULT; store.set('pv_cfg', JSON.stringify(CFG)); RADAR = null; RS.loadedAt = 0; viewJobs($('#main'), 'setup'); };
  $('#installBtn').onclick = async () => {
    try {
      loading(true, 'Installing', .3, 'Downloading radar files');
      const [script, wf] = await Promise.all(['radar/radar.mjs', 'radar/radar.yml'].map(p => fetch(p + '?v=' + Date.now(), { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('Could not load ' + p); return r.text(); })));
      const files = [
        { path: 'radar.mjs', content: script },
        { path: '.github/workflows/radar.yml', content: wf },
        { path: 'README.md', content: `# Job Radar (private)\n\nManaged from the portfolio admin panel (Job Radar).\n\n- \`config.json\` – search profile & Telegram settings\n- \`jobs.json\` – results (updated every 6 hours by GitHub Actions)\n- \`status.json\` – saved / applied / hidden jobs\n\nKeep this repository **private**.\n` }
      ];
      if (!RS.exists.config) files.push({ path: 'config.json', content: { ...RS.cfg, version: RADAR_VERSION } });
      files.push({ path: 'status.json', content: RS.status });
      await radarCommit(RS.exists.script ? 'Job radar: update' : 'Job radar: install', files);
      RS.exists.script = RS.exists.config = RS.exists.email = true;
      toast('Radar installed ✓ — now fill Search profile and Telegram');
      location.hash = 'jobs/settings';
    } catch (err) {
      loading(false);
      toast(/workflow/i.test(err.raw || err.message) || err.status === 404
        ? 'GitHub refused to add the workflow file — give your access key "Workflows: Read and write" for the job-radar repo (step 2).'
        : err.message, 'err');
    }
  };
}

/* Sidebar badge with the number of new jobs (quiet, ignores errors) */
async function radarPeek() {
  try {
    await radarClient();
    const jobs = await readOr('jobs.json', null);
    const status = await readOr('status.json', { hidden: [] });
    const seen = Number(store.get('pv_jobs_seen') || 0);
    const n = jobs && seen ? jobs.jobs.filter(j => new Date(j.firstSeen || j.posted).getTime() > seen && !(status.hidden || []).includes(j.id)).length : 0;
    const pill = $('#jobsPill'); if (pill) { pill.hidden = !n; pill.textContent = n; }
  } catch (_) {}
}
