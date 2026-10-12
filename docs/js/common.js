/* Shared helpers for public pages */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPE_LABEL = { game: 'Game', plugin: 'Plugin', asset: 'Unity Asset' };

function fmtSize(b) {
  if (!b) return '';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return b.toFixed(i > 1 ? 1 : 0) + ' ' + u[i];
}
function fmtNum(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n || 0); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }); } catch (_) { return ''; } }

function youtubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

/* Tiny safe markdown: escapes first, then **bold**, *italic*, `code`, [text](url), # headings, - lists */
function miniMd(src) {
  const inline = t => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out = []; let listOpen = false; let para = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false; } };
  String(src || '').split(/\r?\n/).forEach(line => {
    const l = line.trim();
    if (!l) { flushPara(); closeList(); return; }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { flushPara(); closeList(); const h = m[1].length === 1 ? 'h2' : 'h3'; out.push(`<${h}>${inline(m[2])}</${h}>`); return; }
    if ((m = l.match(/^[-*•]\s+(.*)/))) { flushPara(); if (!listOpen) { out.push('<ul>'); listOpen = true; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
    closeList(); para.push(l);
  });
  flushPara(); closeList();
  return out.join('');
}

/* ------------------------------------------------------------------
   Two modes:
   - Server mode (node server.js): data comes from /api/...
   - Static mode (GitHub Pages export): window.PV_STATIC = true and all
     data is read from data.json that the export generated.
   ------------------------------------------------------------------ */
const STATIC = !!window.PV_STATIC;
let STATIC_DATA = null;

async function staticApi(url) {
  if (!STATIC_DATA) {
    const r = await fetch('data.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('Could not load data.json');
    STATIC_DATA = await r.json();
  }
  const d = STATIC_DATA;
  const u = new URL(url, location.href);
  const parts = u.pathname.split('/api/')[1].split('/');
  if (parts[0] === 'profile') return d.profile;
  if (parts[0] === 'stats') return d.stats;
  if (parts[0] === 'projects' && parts[1]) {
    const p = d.projects.find(x => x.slug === decodeURIComponent(parts[1]));
    if (!p) throw new Error('Not found');
    return p;
  }
  if (parts[0] === 'projects') {
    const t = u.searchParams.get('type');
    return t ? d.projects.filter(p => p.type === t) : d.projects;
  }
  throw new Error('Not found');
}

async function api(url) {
  if (STATIC) return staticApi(url);
  const r = await fetch(url.replace(/^\//, ''));
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}

/* Turn stored "/uploads/..." paths into relative ones so the site also works in a sub-folder */
const asset = u => (typeof u === 'string' && u.startsWith('/uploads/') ? u.slice(1) : u || '');
const projectHref = slug => 'project.html?slug=' + encodeURIComponent(slug);
const isExternal = u => /^https?:\/\//i.test(u || '');
function downloadHref(p) {
  if (STATIC) return p.downloadHref || '';
  return 'download/' + encodeURIComponent(p.slug);
}
function downloadAttrs(p) {
  const href = downloadHref(p);
  return isExternal(href) ? `href="${esc(href)}" target="_blank" rel="noopener"` : `href="${esc(href)}" download`;
}

const ICONS = {
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m6 6-6-6 6-6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  googleplay: '<svg viewBox="0 0 24 24"><path fill="#34A853" d="M3.6 1.8 13.8 12 3.6 22.2a1.6 1.6 0 0 1-.6-1.3V3.1c0-.5.2-1 .6-1.3z"/><path fill="#FBBC04" d="m17.2 15.4-3.4-3.4 3.4-3.4 3.9 2.2c1.1.6 1.1 1.8 0 2.4z"/><path fill="#4285F4" d="M17.2 15.4 13.8 12 3.6 22.2c.4.4 1.1.5 1.8.1z"/><path fill="#EA4335" d="M17.2 8.6 5.4 1.7c-.7-.4-1.4-.3-1.8.1L13.8 12z"/></svg>',
  unity: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 1.5 9.2 5.3v10.4L12 22.5l-9.2-5.3V6.8L12 1.5zm0 2.3L5.4 7.6 12 11.4l6.6-3.8L12 3.8zM4.8 9.3v7.2l6.2 3.6v-7.2L4.8 9.3zm14.4 0L13 12.9v7.2l6.2-3.6V9.3z"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.1 2.1 2.1 0 0 1 0 4.1zM7.1 20.5H3.6V9h3.5v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2.2h3.4l-7.4 8.5 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.8 2.2h7l4.8 6.4 5.6-6.4zm-1.2 18h1.9L7 4.1H5L17 20.2z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  itch: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.1 1.9C2 2.5.2 4.6.2 5.1v1c0 1.2 1.2 2.3 2.2 2.3 1.3 0 2.3-1 2.3-2.2 0 1.2 1 2.2 2.2 2.2s2.2-1 2.2-2.2c0 1.2 1 2.2 2.3 2.2h.1c1.2 0 2.3-1 2.3-2.2 0 1.2 1 2.2 2.2 2.2s2.2-1 2.2-2.2c0 1.2 1 2.2 2.3 2.2 1 0 2.2-1.1 2.2-2.3v-1c0-.5-1.8-2.6-2.9-3.2C17.6 1.8 6.4 1.8 3.1 1.9zm7.1 7.3a2.6 2.6 0 0 1-4.4.4 2.6 2.6 0 0 1-2.1 1c-.5 0-1-.1-1.4-.4-.1 1.4-.2 2.7-.2 4.2 0 1.1.9 7.5 9.9 7.5s9.9-6.4 9.9-7.5c0-1.5-.1-2.8-.2-4.2-.4.3-.9.4-1.4.4a2.6 2.6 0 0 1-2.1-1 2.6 2.6 0 0 1-4.4-.4 2.6 2.6 0 0 1-1.8.8 2.6 2.6 0 0 1-1.8-.8zm-1.6 3.4c.9 0 1.7 0 2.7 1.1.8-.1 1.6-.1 2.4 0 1-1.1 1.8-1.1 2.7-1.1.4 0 2.2 0 3.4 3.5l1.3 4.8c1 3.5-.3 3.6-1.9 3.6-2.4-.1-3.7-1.8-3.7-3.5-1.3.2-3.4.3-5.5 0 0 1.7-1.3 3.4-3.7 3.5-1.6 0-2.9-.1-1.9-3.6l1.3-4.8c1-3.5 2.9-3.5 3.3-3.5zm3.4 2.7s-2 1.9-2.4 2.6l1.5-.1v1.3h1.8v-1.3l1.5.1c-.3-.7-2.4-2.6-2.4-2.6z"/></svg>',
  game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6l-.7 6.3A3 3 0 0 0 5 18c1 0 2-.5 2.5-1.4L9 14h6l1.5 2.6A3 3 0 0 0 19 18a3 3 0 0 0 3-3.1l-.7-6.3a4 4 0 0 0-4-3.6z"/></svg>',
  plugin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z"/></svg>',
  asset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>'
};

function setBrand(profile) {
  $$('[data-brand]').forEach(el => (el.textContent = profile.brand || 'PranVeda'));
  $$('[data-brand-initial]').forEach(el => (el.textContent = (profile.brand || 'P').charAt(0).toUpperCase()));
  $$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));
}

function initNav() {
  const nav = $('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const toggle = $('.nav-toggle'), links = $('.nav-links');
  if (toggle) {
    toggle.innerHTML = ICONS.menu;
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    $$('a', links).forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }
}

function initReveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  $$('.reveal').forEach(el => io.observe(el));
}

/* Project card used on home + related */
function projectCard(p, i = 0) {
  const cover = p.cover ? `<img src="${esc(asset(p.cover))}" alt="" loading="lazy">` : `<div class="ph">${esc((p.title || '?').charAt(0))}</div>`;
  const video = p.youtubeUrl || p.videoFile ? `<span class="has-video" title="Has video">${ICONS.play}</span>` : '';
  const icon = p.icon ? `<img class="card-icon" src="${esc(asset(p.icon))}" alt="" loading="lazy">` : '';
  const tags = (p.tags || []).slice(0, 4).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const meta = [p.version && 'v' + p.version, (p.platforms || []).join(' · ')].filter(Boolean).join('  /  ');
  let actions = '';
  if (p.hasDownload) actions += `<a class="btn btn-dl" ${downloadAttrs(p)}>${ICONS.download} ${esc(p.downloadName || 'Download')}</a>`;
  if (p.playStoreUrl) actions += `<a class="btn" href="${esc(p.playStoreUrl)}" target="_blank" rel="noopener">${ICONS.googleplay} Play Store</a>`;
  else if (p.assetStoreUrl) actions += `<a class="btn" href="${esc(p.assetStoreUrl)}" target="_blank" rel="noopener">${ICONS.unity} Asset Store</a>`;
  if (!actions) actions = `<span class="btn btn-ghost">View details ${ICONS.arrow}</span>`;
  return `
  <article class="card" data-type="${esc(p.type)}" style="animation-delay:${Math.min(i, 8) * 60}ms">
    <a class="card-link" href="${projectHref(p.slug)}" aria-label="${esc(p.title)}"></a>
    <div class="card-media">${cover}<span class="badge">${esc(TYPE_LABEL[p.type] || p.type)}</span>${video}</div>
    <div class="card-body">
      <div class="card-title">${icon}<div><h3>${esc(p.title)}</h3>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</div></div>
      ${p.shortDescription ? `<p>${esc(p.shortDescription)}</p>` : ''}
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      <div class="card-actions">${actions}</div>
    </div>
  </article>`;
}
