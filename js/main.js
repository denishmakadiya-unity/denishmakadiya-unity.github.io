/* Home page */
let ALL = [];
let state = { type: 'all', q: '' };

const SOCIAL_LABEL = { github: 'GitHub', linkedin: 'LinkedIn', youtube: 'YouTube', twitter: 'X / Twitter', instagram: 'Instagram', playstore: 'Google Play', assetstore: 'Unity Asset Store', itch: 'itch.io', discord: 'Discord' };
const SOCIAL_ICON = { github: 'github', linkedin: 'linkedin', youtube: 'youtube', twitter: 'twitter', instagram: 'instagram', playstore: 'googleplay', assetstore: 'unity', itch: 'itch', discord: 'discord' };

function setText(sel, val) { const el = $(sel); if (el && val) el.textContent = val; }

function renderSite(site, p) {
  setBrand(site, p);
  document.title = `${p.name} — ${p.role || 'Unity Developer'}`;
  setText('#heroName', p.name);
  setText('#heroRole', p.role);
  $('#heroTagline').textContent = p.tagline || '';
  $('#status').classList.toggle('off', site.available === false);
  $('#statusText').textContent = site.available === false ? 'Currently busy on projects' : (site.statusText || 'Open to new opportunities');
  setText('#workTitle', site.workTitle);
  $('#workSub').textContent = site.workSub || '';
  setText('#aboutTitle', site.aboutTitle);
  setText('#contactTitle', site.contactTitle);
  $('#contactText').textContent = site.contactText || '';

  // Avatar
  const stage = $('#avatarStage');
  const el = document.createElement(p.avatar ? 'img' : 'div');
  if (p.avatar) { el.src = asset(p.avatar); el.alt = p.name; }
  else { el.className = 'avatar-fallback'; el.textContent = (site.initials || p.name || 'U').slice(0, 2).toUpperCase(); }
  stage.appendChild(el);

  // About
  $('#aboutText').innerHTML = (p.about || '').split(/\n{2,}/).map(par => `<p>${esc(par).replace(/\n/g, '<br>')}</p>`).join('');
  const exp = p.experience || [], edu = p.education || [], langs = p.languages || [];
  const studios = new Set(exp.map(e => (e.company || '').toLowerCase()).filter(Boolean)).size;
  $('#fYears').textContent = (p.experienceYears || 0) + '+';
  $('#fCompanies').textContent = studios || '—';
  $('#fLangs').textContent = langs.length || '—';
  if (langs.length) $('#fLangsLabel').textContent = langs.join(' · ');

  // Services
  $('#services').innerHTML = (site.services || []).map(s => {
    const c = { game: 'var(--lime)', app: 'var(--cyan)', plugin: 'var(--cyan)', website: 'var(--c-web)', asset: 'var(--amber)' }[s.icon] || 'var(--violet)';
    return `<div class="service reveal">
      <div class="ico" style="background:color-mix(in srgb, ${c} 14%, transparent);color:${c}">${ICONS[s.icon] || ICONS.game}</div>
      <h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></div>`;
  }).join('');

  // Experience
  $('#experience').hidden = !exp.length && !edu.length;
  $('#expSub').textContent = exp.length ? `${p.experienceYears || 0}+ years across ${studios} studios — building games, apps and tools with Unity.` : '';
  $('#timeline').innerHTML = exp.map(e => `
    <li class="tl-item${e.current ? ' current' : ''}">
      <span class="tl-dot"></span>
      <div class="tl-card">
        <div class="tl-top"><h4>${esc(e.role)}${e.current ? '<span class="now">NOW</span>' : ''}</h4><span class="tl-dur">${esc(e.duration)}</span></div>
        <div class="tl-co"><b>${esc(e.company)}</b>${e.location ? ' · ' + esc(e.location) : ''}</div>
        ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}
      </div>
    </li>`).join('');
  $('#eduList').innerHTML = edu.map(e => `
    <div class="edu-item"><b>${esc(e.degree)}</b><span class="yr">${esc(e.year)}</span>
      <span>${esc([e.school, e.board].filter(Boolean).join(' · '))}</span></div>`).join('');
  setResumeLinks(p);

  // Skills + marquee
  const skills = p.skills || [];
  $('#skillsList').innerHTML = skills.map(s => `<span class="skill">${esc(s)}</span>`).join('');
  const strip = (skills.length ? skills : ['Unity', 'C#']).map(s => `<span>${esc(s)}</span>`).join('');
  $('#marquee').innerHTML = strip + strip + strip + strip;

  // Contact
  const contacts = [];
  if (p.email) contacts.push(`<a href="mailto:${esc(p.email)}">${ICONS.mail}${esc(p.email)}</a>`);
  if (p.phone) contacts.push(`<a href="tel:${esc(p.phone.replace(/\s/g, ''))}">${ICONS.phone}${esc(p.phone)}</a>`);
  if (p.location) contacts.push(`<div>${ICONS.pin}${esc(p.location)}</div>`);
  $('#contactList').innerHTML = contacts.join('');
  $('#socials').innerHTML = Object.entries(p.socials || {}).filter(([, url]) => url)
    .map(([k, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="${SOCIAL_LABEL[k]}" title="${SOCIAL_LABEL[k]}">${ICONS[SOCIAL_ICON[k]]}</a>`).join('');
}

function renderTestimonials(site) {
  const list = (site.testimonials || []).filter(t => t.name && t.text);
  $('#testimonials').hidden = !list.length;
  $('#testiGrid').innerHTML = list.map(t => `
    <figure class="testi reveal">
      <span class="testi-q">${ICONS.quote}</span>
      <blockquote>${esc(t.text)}</blockquote>
      <figcaption><span class="testi-av">${esc(t.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>
        <span><b>${esc(t.name)}</b>${t.role ? `<small>${esc(t.role)}</small>` : ''}</span></figcaption>
    </figure>`).join('');
}

/* Public GitHub repos, loaded live (cached for the session to stay under GitHub's rate limit) */
async function renderRepos(site, profile) {
  const fromSocial = ((profile.socials || {}).github || '').replace(/^https?:\/\/(www\.)?github\.com\//i, '').split('/')[0];
  const user = (site.githubUser || fromSocial || '').trim();
  if (site.showRepos === false || !user) return;
  const hide = (site.hideRepos || []).map(x => x.toLowerCase());
  const key = 'pv_repos_' + user;
  let repos = null;
  try { repos = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) {}
  if (!repos) {
    try {
      const r = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=updated`);
      if (!r.ok) return;
      repos = (await r.json()).map(x => ({ name: x.name, url: x.html_url, desc: x.description, lang: x.language, stars: x.stargazers_count, forks: x.forks_count, fork: x.fork, archived: x.archived, updated: x.pushed_at, home: x.homepage }));
      try { sessionStorage.setItem(key, JSON.stringify(repos)); } catch (_) {}
    } catch (_) { return; }
  }
  const show = repos.filter(r => !r.fork && !r.archived && !hide.includes(r.name.toLowerCase()))
    .sort((a, b) => (b.stars - a.stars) || String(b.updated).localeCompare(String(a.updated))).slice(0, 6);
  if (!show.length) return;
  const LANG = { 'C#': '#178600', JavaScript: '#f1e05a', TypeScript: '#3178c6', ShaderLab: '#8f9db0', HLSL: '#aace60', Python: '#3572A5', Java: '#b07219', Kotlin: '#A97BFF', 'C++': '#f34b7d', C: '#555555', HTML: '#e34c26', CSS: '#563d7c', Swift: '#F05138', Dart: '#00B4AB' };
  $('#ghProfile').href = `https://github.com/${encodeURIComponent(user)}`;
  $('#repoGrid').innerHTML = show.map(r => `
    <a class="repo reveal in" href="${esc(r.url)}" target="_blank" rel="noopener">
      <div class="repo-top">${ICONS.github}<b>${esc(r.name)}</b></div>
      <p>${esc(r.desc || 'No description')}</p>
      <div class="repo-meta">
        ${r.lang ? `<span><i style="background:${LANG[r.lang] || 'var(--muted)'}"></i>${esc(r.lang)}</span>` : ''}
        <span>${ICONS.star2}${r.stars}</span><span>${ICONS.fork}${r.forks}</span>
        <span>Updated ${esc(fmtDate(r.updated))}</span>
      </div>
    </a>`).join('');
  $('#repos').hidden = false;
}

function countUp(el, to) {
  const dur = 900, start = performance.now();
  const step = t => { const k = Math.min(1, (t - start) / dur); el.textContent = fmtNum(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function renderFeatured() {
  const f = ALL.find(p => p.featured);
  const box = $('#featured');
  if (!f) { box.innerHTML = ''; return; }
  const color = TYPE_COLOR[f.type];
  box.innerHTML = `
    <a class="featured reveal in" href="${projectHref(f.slug)}">
      <div class="featured-media">${f.cover ? `<img src="${esc(asset(f.cover))}" alt="">` : ''}</div>
      <div class="featured-body">
        <span class="featured-label">★ Featured ${esc(TYPE_LABEL[f.type])}</span>
        <h3>${esc(f.title)}</h3>
        <p>${esc(f.shortDescription || '')}</p>
        ${(f.tags || []).length ? `<div class="tags">${f.tags.slice(0, 5).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <span class="btn" style="align-self:flex-start;border-color:${color};color:${color}">View project ${ICONS.arrow}</span>
      </div>
    </a>`;
}

function renderGrid() {
  const q = state.q.toLowerCase();
  const items = ALL.filter(p =>
    (state.type === 'all' || p.type === state.type) &&
    (!q || [p.title, p.shortDescription, ...(p.tags || []), ...(p.platforms || [])].join(' ').toLowerCase().includes(q))
  );
  const grid = $('#grid');
  if (!items.length) {
    const what = state.type === 'all' ? 'projects' : TYPE_PLURAL[state.type].toLowerCase();
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>No ${esc(what)} yet</b>${q ? 'Try a different search.' : 'New work is coming soon — check back!'}</div>`;
    return;
  }
  grid.innerHTML = items.map(projectCard).join('');
}

function setCounts() {
  const c = t => ALL.filter(p => p.type === t).length;
  $('#cAll').textContent = ALL.length;
  $('#cGame').textContent = c('game');
  $('#cApp').textContent = c('app');
  $('#cWebsite').textContent = c('website');
  $('#cAsset').textContent = c('asset');
  $('#fProjects').textContent = ALL.length;
}

async function init() {
  initNav();
  $('#searchIcon').outerHTML = ICONS.search;
  $$('[data-icon]').forEach(el => (el.outerHTML = ICONS[el.dataset.icon]));

  const hashType = { '#games': 'game', '#apps': 'app', '#websites': 'website', '#assets': 'asset' }[location.hash];
  if (hashType) state.type = hashType;
  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    state.type = tab.dataset.type;
    $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
    renderGrid();
  }));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.type === state.type));
  let tm;
  $('#search').addEventListener('input', e => { clearTimeout(tm); tm = setTimeout(() => { state.q = e.target.value.trim(); renderGrid(); }, 150); });

  let PROFILE = {};
  let SITE = {};
  bindContactForm($('#contactForm'), $('#formNote'), () => ({ site: SITE, profile: PROFILE }));

  try {
    const data = await loadData();
    PROFILE = data.profile; SITE = data.site;
    renderSite(data.site, data.profile);
    renderTestimonials(data.site);
    renderRepos(data.site, data.profile);
    ALL = data.projects;
    setCounts(); renderFeatured(); renderGrid();
    const c = t => ALL.filter(p => p.type === t).length;
    countUp($('#sGames'), c('game')); countUp($('#sApps'), c('app')); countUp($('#sWebsites'), c('website'));
    countUp($('#sAssets'), c('asset')); countUp($('#sYears'), data.profile.experienceYears || 0);
  } catch (err) {
    $('#grid').innerHTML = `<div class="empty" style="grid-column:1/-1"><b>Could not load the portfolio</b>${esc(err.message)}</div>`;
  }
  initReveal();
}
init();
