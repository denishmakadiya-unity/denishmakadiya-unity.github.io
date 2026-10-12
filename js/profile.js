/* Profile / resume page — everything comes from data.json */
const SOCIAL = {
  github: ['GitHub', 'github'], linkedin: ['LinkedIn', 'linkedin'], youtube: ['YouTube', 'youtube'], twitter: ['X / Twitter', 'twitter'],
  instagram: ['Instagram', 'instagram'], playstore: ['Google Play', 'googleplay'], assetstore: ['Unity Asset Store', 'unity'], itch: ['itch.io', 'itch']
};

function section(title, body, cls = '') {
  return body ? `<section class="pf-block ${cls}"><h2 class="pf-h"><span>${title}</span></h2>${body}</section>` : '';
}
function shortUrl(u) { return u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); }

async function init() {
  initNav();
  const main = $('#pf');
  let data;
  try { data = await loadData(); } catch (e) {
    main.innerHTML = `<div class="empty" style="margin-top:140px"><b>Could not load profile</b>${esc(e.message)}</div>`; return;
  }
  const { site, profile: p, projects } = data;
  setBrand(site, p);
  document.title = `${p.name} — ${p.role || 'Profile'}`;

  const exp = p.experience || [], edu = p.education || [];
  const studios = new Set(exp.map(e => (e.company || '').toLowerCase()).filter(Boolean)).size;
  const initials = (site.initials || p.name || '?').slice(0, 2).toUpperCase();
  const socials = Object.entries(p.socials || {}).filter(([, u]) => u);
  const hasResume = p.resume && p.resume.path;

  const contact = [
    p.email && `<a href="mailto:${esc(p.email)}">${ICONS.mail}<span>${esc(p.email)}</span></a>`,
    p.phone && `<a href="tel:${esc(p.phone.replace(/\s/g, ''))}">${ICONS.phone}<span>${esc(p.phone)}</span></a>`,
    p.location && `<div>${ICONS.pin}<span>${esc(p.location)}</span></div>`,
    ...socials.filter(([k]) => k === 'linkedin' || k === 'github').map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${ICONS[SOCIAL[k][1]]}<span>${esc(shortUrl(u))}</span></a>`)
  ].filter(Boolean).join('');

  const timeline = exp.length ? `<ol class="timeline">${exp.map(e => `
    <li class="tl-item${e.current ? ' current' : ''}">
      <span class="tl-dot"></span>
      <div class="tl-card">
        <div class="tl-top"><h4>${esc(e.role)}${e.current ? '<span class="now">NOW</span>' : ''}</h4><span class="tl-dur">${esc(e.duration)}</span></div>
        <div class="tl-co"><b>${esc(e.company)}</b>${e.location ? ' · ' + esc(e.location) : ''}</div>
        ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}
      </div>
    </li>`).join('')}</ol>` : '';

  const education = edu.length ? `<div class="pf-edu">${edu.map(e => `
    <div class="pf-edu-item">
      <div class="pf-edu-yr">${esc(e.year)}</div>
      <div><b>${esc(e.degree)}</b><span>${esc([e.school, e.board].filter(Boolean).join(' · '))}</span></div>
    </div>`).join('')}</div>` : '';

  const kv = rows => rows && rows.length ? `<ul class="specs">${rows.filter(r => r.label || r.value).map(r => `<li><span>${esc(r.label)}</span><b>${esc(r.value)}</b></li>`).join('')}</ul>` : '';

  main.innerHTML = `
    <section class="pf-head">
      <div class="pf-avatar">${p.avatar ? `<img src="${esc(asset(p.avatar))}" alt="${esc(p.name)}">` : `<span>${esc(initials)}</span>`}</div>
      <div class="pf-id">
        <span class="eyebrow">${site.available === false ? 'Profile' : esc(site.statusText || 'Open to new opportunities')}</span>
        <h1>${esc(p.name)}</h1>
        <div class="pf-role">${esc(p.role || '')}</div>
        <div class="pf-contact">${contact}</div>
      </div>
      <div class="pf-actions no-print">
        ${hasResume ? `<a class="btn btn-primary" href="${esc(asset(p.resume.path))}" target="_blank" rel="noopener">${ICONS.file} Download Resume</a>` : ''}
        <button class="btn" id="printBtn" type="button">${ICONS.print} Print / Save PDF</button>
        <a class="btn btn-ghost" href="contact.html">${ICONS.mail} Contact me</a>
      </div>
    </section>

    <div class="pf-stats">
      <div><b>${p.experienceYears || 0}+</b><span>Years experience</span></div>
      <div><b>${studios}</b><span>Studios</span></div>
      <div><b>${projects.length}</b><span>Portfolio projects</span></div>
      <div><b>${(p.languages || []).length}</b><span>Languages</span></div>
    </div>

    <div class="pf-grid">
      <div class="pf-main">
        ${section('Summary', p.about ? `<div class="pf-text">${p.about.split(/\n{2,}/).map(x => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('')}</div>` : '')}
        ${section('Career Objective', p.objective ? `<p class="pf-quote">${esc(p.objective)}</p>` : '')}
        ${section('Work Experience', timeline)}
        ${section('Education', education)}
      </div>
      <aside class="pf-side">
        ${section('Technical Skills', kv(p.skillGroups), 'card')}
        ${section('Skills', (p.skills || []).length ? `<div class="skills sm">${p.skills.map(s => `<span class="skill">${esc(s)}</span>`).join('')}</div>` : '', 'card')}
        ${section('Personal Details', kv(p.personal), 'card')}
        ${section('Find me online', socials.length ? `<div class="pf-links">${socials.map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${ICONS[SOCIAL[k][1]]}<span>${SOCIAL[k][0]}</span></a>`).join('')}</div>` : '', 'card no-print')}
      </aside>
    </div>`;
  const pb = $('#printBtn'); if (pb) pb.addEventListener('click', () => window.print());
}
init();
