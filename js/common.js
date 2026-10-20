/* Shared helpers for the public pages.
   All content comes from data.json in the repo (edited through admin.html). */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPES = ['game', 'app', 'website', 'asset'];
const TYPE_LABEL = { game: 'Game', app: 'Application', website: 'Website', asset: 'Unity Asset' };
const TYPE_PLURAL = { game: 'Games', app: 'Applications', website: 'Websites', asset: 'Unity Assets' };
const TYPE_COLOR = { game: 'var(--c-game)', app: 'var(--c-app)', website: 'var(--c-web)', asset: 'var(--c-asset)' };

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

/* Tiny safe markdown: escapes first, then ``` code blocks, # headings, - / 1. lists, **bold**, *italic*, `code`, [text](url) */
function miniMd(src) {
  const inline = t => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out = []; let list = null; let para = []; let code = null;
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const openList = t => { if (list !== t) { closeList(); out.push(`<${t}>`); list = t; } };
  String(src || '').split(/\r?\n/).forEach(line => {
    if (code !== null) {
      if (/^\s*```/.test(line)) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; }
      else code.push(line);
      return;
    }
    if (/^\s*```/.test(line)) { flushPara(); closeList(); code = []; return; }
    const l = line.trim();
    if (!l) { flushPara(); closeList(); return; }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { flushPara(); closeList(); const h = m[1].length === 1 ? 'h2' : 'h3'; out.push(`<${h}>${inline(m[2])}</${h}>`); return; }
    if ((m = l.match(/^[-*•]\s+(.*)/))) { flushPara(); openList('ul'); out.push('<li>' + inline(m[1]) + '</li>'); return; }
    if ((m = l.match(/^\d+[.)]\s+(.*)/))) { flushPara(); openList('ol'); out.push('<li>' + inline(m[1]) + '</li>'); return; }
    closeList(); para.push(l);
  });
  if (code !== null) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flushPara(); closeList();
  return out.join('');
}

/* ---------- Analytics (GoatCounter, optional) ---------- */
function initAnalytics(site) {
  const code = (site && site.goatcounter || '').replace(/[^\w-]/g, '');
  if (!code || window.__gcInit) return;
  window.__gcInit = true;
  const sc = document.createElement('script');
  sc.async = true; sc.src = 'https://gc.zgo.at/count.js';
  sc.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
  sc.onload = countUniqueVisitor;
  document.head.appendChild(sc);
}
/* Unique visitors: each browser is counted ONCE, ever (a returning visitor is not counted again) */
function countUniqueVisitor() {
  let seen = true;
  try { seen = !!localStorage.getItem('pv_visitor'); } catch (_) { return; } // storage blocked → don't risk double counting
  if (seen) return;
  const send = (tries = 0) => {
    if (window.goatcounter && window.goatcounter.count) {
      try { window.goatcounter.count({ path: 'unique-visitor', title: 'New unique visitor', event: true }); localStorage.setItem('pv_visitor', new Date().toISOString()); } catch (_) {}
    } else if (tries < 20) setTimeout(() => send(tries + 1), 300);
  };
  send();
}
function track(name, title) {
  try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name, title: title || name, event: true }); } catch (_) {}
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-track]');
  if (a) track(a.dataset.track, a.dataset.trackTitle);
});

/* ---------- Data ---------- */
let DATA = null;
async function loadData() {
  if (DATA) return DATA;
  const r = await fetch('data.json?v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('Could not load data.json');
  DATA = await r.json();
  DATA.site = DATA.site || {};
  initAnalytics(DATA.site);
  DATA.profile = DATA.profile || {};
  DATA.projects = (DATA.projects || [])
    .map(p => (p.type === 'plugin' || !TYPE_LABEL[p.type] ? { ...p, type: p.type === 'plugin' ? 'asset' : 'game' } : p)) // old "plugin" items show as Unity Assets
    .filter(p => p.published !== false)
    .sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0) || (!!b.featured - !!a.featured) || String(b.createdAt).localeCompare(String(a.createdAt))); // Sort priority first (higher = first)
  return DATA;
}

const asset = u => (typeof u === 'string' ? u.replace(/^\/+/, '') : '');
const isExternal = u => /^https?:\/\//i.test(u || '');
const projectHref = slug => 'project.html?slug=' + encodeURIComponent(slug);
function downloadInfo(p) {
  if (p.downloadUrl) {
    const m = p.downloadUrl.toLowerCase().match(/\.(apk|aab|zip|unitypackage|rar|7z)(?:$|[?#])/);
    return { href: p.downloadUrl, name: m ? m[1].toUpperCase() : 'Download', size: 0, external: true };
  }
  if (p.download && p.download.path) {
    const ext = (p.download.path.split('.').pop() || '').toLowerCase();
    const fileName = `${p.slug || 'download'}${p.version ? '-v' + String(p.version).replace(/[^\w.-]/g, '') : ''}.${ext}`;
    return { href: asset(p.download.path), name: ext.toUpperCase(), size: p.download.size || 0, external: false, fileName };
  }
  return null;
}
function downloadAttrs(d) {
  return d.external ? `href="${esc(d.href)}" target="_blank" rel="noopener"` : `href="${esc(d.href)}" download="${esc(d.fileName)}"`;
}

const ICONS = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>',
  website: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M6 6.5h.01M9 6.5h.01"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6l-.7 6.3A3 3 0 0 0 5 18c1 0 2-.5 2.5-1.4L9 14h6l1.5 2.6A3 3 0 0 0 19 18a3 3 0 0 0 3-3.1l-.7-6.3a4 4 0 0 0-4-3.6z"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  star2: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
  fork: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="M6 7v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7M12 12v5"/></svg>',
  quote: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 6C6 7.3 4 10 4 13.6V18h6v-6H7c0-2.4 1.3-4 3.4-4.8zM19.5 6C16 7.3 14 10 14 13.6V18h6v-6h-3c0-2.4 1.3-4 3.4-4.8z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6m0 6-3-3m3 3 3-3"/></svg>',
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
  discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.61 1.25a18.3 18.3 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .09-.03c.46-.63.87-1.3 1.22-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.77 1.36 1.22 1.99a.08.08 0 0 0 .09.03 19.8 19.8 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z"/></svg>',
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

function setBrand(site, profile) {
  const brand = site.brand || profile.name || 'Portfolio';
  const initials = site.initials || brand.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  $$('[data-brand]').forEach(el => (el.textContent = brand));
  $$('[data-brand-initial]').forEach(el => { el.textContent = initials; el.classList.toggle('two', initials.length > 1); });
  $$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));
  $$('[data-footer]').forEach(el => (el.textContent = site.footerText || ''));
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

/* Contact form: Web3Forms (message goes straight to the inbox) or fallback to the visitor's email app */
function bindContactForm(form, note, getData) {
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { site = {}, profile = {} } = getData() || {};
    const btn = form.querySelector('button[type=submit]');
    const f = Object.fromEntries(new FormData(form));
    if (f.botcheck) return; // spam bot
    const topic = f.topic ? ` — ${f.topic}` : '';
    const subject = `Portfolio enquiry from ${f.name}${topic}`;
    const extra = [f.topic && `Topic: ${f.topic}`, f.budget && `Budget / timeline: ${f.budget}`, f.company && `Company: ${f.company}`].filter(Boolean).join('\n');
    if (site.web3formsKey) {
      btn.disabled = true; note.className = 'form-note'; note.textContent = 'Sending…';
      try {
        const r = await fetch('https://api.web3forms.com/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ access_key: site.web3formsKey, subject, from_name: 'Portfolio website', name: f.name, email: f.email, company: f.company || undefined, topic: f.topic || undefined, budget: f.budget || undefined, message: f.message })
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.success === false) throw new Error(d.message || 'Could not send');
        note.className = 'form-note ok'; note.textContent = "Thanks! Your message has been sent — I'll reply soon.";
        track('contact/sent', 'Contact form sent');
        form.reset();
      } catch (err) {
        note.className = 'form-note err';
        note.innerHTML = `Couldn't send right now. Please email me at <a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>.`;
      }
      btn.disabled = false;
      return;
    }
    if (!profile.email) { note.className = 'form-note err'; note.textContent = 'Contact email is not set yet.'; return; }
    const body = `${extra ? extra + '\n\n' : ''}${f.message}\n\n— ${f.name} (${f.email})`;
    location.href = `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    note.className = 'form-note ok'; note.textContent = 'Your email app has opened — just press Send.';
  });
}

function setResumeLinks(profile) {
  $$('[data-resume]').forEach(a => {
    a.hidden = !(profile.resume && profile.resume.path);
    if (!a.hidden) { a.href = asset(profile.resume.path); a.target = '_blank'; a.rel = 'noopener'; }
  });
}

/* ---------- Contact form sending (shared by home + contact page) ----------
   Web3Forms key set in admin → message goes straight to the inbox; otherwise opens the visitor's email app. */
async function sendContact(fields, site, profile) {
  if (fields.botcheck) return { ok: true }; // spam bot
  const subject = `${fields.topic ? fields.topic + ' enquiry' : 'Portfolio enquiry'} from ${fields.name}`;
  if (site.web3formsKey) {
    const payload = { access_key: site.web3formsKey, subject, from_name: 'Portfolio website', replyto: fields.email };
    Object.entries(fields).forEach(([k, v]) => { if (k !== 'botcheck' && v) payload[k] = v; });
    const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || 'Could not send');
    track('contact/sent', 'Contact form sent');
    return { ok: true, sent: true };
  }
  if (!profile.email) throw new Error('Contact email is not set yet.');
  const extra = ['company', 'topic', 'budget', 'timeline'].filter(k => fields[k]).map(k => `${k[0].toUpperCase() + k.slice(1)}: ${fields[k]}`).join('\n');
  const body = `${fields.message}\n\n${extra ? extra + '\n' : ''}— ${fields.name} (${fields.email})`;
  location.href = `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { ok: true, mailto: true };
}

/* Project card used on home + related */
function projectCard(p, i = 0) {
  const cover = p.cover ? `<img src="${esc(asset(p.cover))}" alt="" loading="lazy">` : `<div class="ph">${esc((p.title || '?').charAt(0))}</div>`;
  const video = p.youtubeUrl || p.videoFile ? `<span class="has-video" title="Has video">${ICONS.play}</span>` : '';
  const icon = p.icon ? `<img class="card-icon" src="${esc(asset(p.icon))}" alt="" loading="lazy">` : '';
  const tags = [...(p.type === 'game' ? (p.genres || []).map(g => ['genre', g]) : []), ...(p.tags || []).map(t => ['', t])].slice(0, 5).map(([c, t]) => `<span class="tag${c ? ' ' + c : ''}">${esc(t)}</span>`).join('');
  const meta = [p.version && 'v' + p.version, (p.platforms || []).join(' · ')].filter(Boolean).join('  /  ');
  const dl = downloadInfo(p);
  let actions = '';
  if (dl) actions += `<a class="btn btn-dl" ${downloadAttrs(dl)} data-track="download/${esc(p.slug)}" data-track-title="Download ${esc(p.title)}">${ICONS.download} ${esc(dl.name)}</a>`;
  if (p.type === 'website' && p.otherUrl) actions += `<a class="btn" href="${esc(p.otherUrl)}" target="_blank" rel="noopener" data-track="visit/${esc(p.slug)}">${ICONS.ext} Visit site</a>`;
  else if (p.playStoreUrl) actions += `<a class="btn" href="${esc(p.playStoreUrl)}" target="_blank" rel="noopener">${ICONS.googleplay} Play Store</a>`;
  else if (p.assetStoreUrl) actions += `<a class="btn" href="${esc(p.assetStoreUrl)}" target="_blank" rel="noopener">${ICONS.unity} Asset Store</a>`;
  if (!actions) actions = `<a class="btn btn-ghost" href="${projectHref(p.slug)}">View details ${ICONS.arrow}</a>`;
  return `
  <article class="card" data-type="${esc(p.type)}" style="animation-delay:${Math.min(i, 8) * 60}ms">
    <a class="card-link" href="${projectHref(p.slug)}" aria-label="${esc(p.title)}"></a>
    <div class="card-media">${cover}<div class="badges"><span class="badge">${esc(TYPE_LABEL[p.type] || p.type)}</span>${p.type === 'game' ? (p.genres || []).slice(0, 2).map(g => `<span class="badge genre">${esc(g)}</span>`).join('') + ((p.genres || []).length > 2 ? `<span class="badge genre more">+${p.genres.length - 2}</span>` : '') : ''}</div>${video}${p.webgl ? '<span class="playable">▶ PLAYABLE</span>' : ''}</div>
    <div class="card-body">
      <div class="card-title">${icon}<div><h3>${esc(p.title)}</h3>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</div></div>
      ${p.shortDescription ? `<p>${esc(p.shortDescription)}</p>` : ''}
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      <div class="card-actions">${actions}</div>
    </div>
  </article>`;
}
