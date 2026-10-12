/* PranVeda admin panel */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtSize = b => { if (!b) return '0 B'; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return b.toFixed(i > 1 ? 1 : 0) + ' ' + u[i]; };
const fmtDate = d => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const TYPE_LABEL = { game: 'Game', plugin: 'Plugin', asset: 'Unity Asset' };
const PLATFORMS = ['Android', 'iOS', 'Windows', 'Mac', 'Linux', 'WebGL'];
const youtubeId = url => { const m = (url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m ? m[1] : null; };

const I = {
  dash: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gh: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3.1-.4 6.4-1.5 6.4-7A5.4 5.4 0 0 0 20 4.8 5 5 0 0 0 19.9 1S18.7.6 16 2.5a13.4 13.4 0 0 0-7 0C6.3.6 5.1 1 5.1 1A5 5 0 0 0 5 4.8a5.4 5.4 0 0 0-1.5 3.7c0 5.5 3.3 6.6 6.4 7a3.4 3.4 0 0 0-.9 2.6V22"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
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
  game: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6l-.7 6.3A3 3 0 0 0 5 18c1 0 2-.5 2.5-1.4L9 14h6l1.5 2.6A3 3 0 0 0 19 18a3 3 0 0 0 3-3.1l-.7-6.3a4 4 0 0 0-4-3.6z"/>',
  plugin: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z"/>',
  asset: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'
};
const ico = (n, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;

/* ---------- API ---------- */
async function req(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(url, opts);
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.includes('/login')) { showLogin(); throw new Error('Session expired, please log in again'); }
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
function uploadForm(method, url, formData, title = 'Saving…') {
  return new Promise((resolve, reject) => {
    const ov = $('#progress'); ov.hidden = false;
    $('#progTitle').textContent = title; $('#progBar').style.width = '0%'; $('#progText').textContent = '0%'; $('#progSize').textContent = '';
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      $('#progBar').style.width = pct + '%';
      $('#progText').textContent = pct < 100 ? pct + '%' : 'Processing…';
      $('#progSize').textContent = `${fmtSize(e.loaded)} / ${fmtSize(e.total)}`;
    };
    xhr.onload = () => {
      ov.hidden = true;
      let d = {}; try { d = JSON.parse(xhr.responseText); } catch (_) {}
      if (xhr.status === 401) { showLogin(); return reject(new Error('Session expired')); }
      xhr.status < 300 ? resolve(d) : reject(new Error(d.error || 'Upload failed (' + xhr.status + ')'));
    };
    xhr.onerror = () => { ov.hidden = true; reject(new Error('Network error during upload')); };
    xhr.send(formData);
  });
}
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

/* ---------- Auth ---------- */
let ME = null;
function showLogin() { $('#appView').hidden = true; $('#loginView').hidden = false; setTimeout(() => $('#lUser').focus(), 50); }
async function boot() {
  try { ME = await req('GET', '/api/me'); startApp(); } catch (_) { showLogin(); }
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginError').textContent = '';
  try {
    await req('POST', '/api/login', Object.fromEntries(new FormData(e.target)));
    ME = await req('GET', '/api/me');
    e.target.reset();
    startApp();
  } catch (err) { $('#loginError').textContent = err.message; }
});
$('#logoutBtn').addEventListener('click', async () => { await req('POST', '/api/logout').catch(() => {}); showLogin(); });

function startApp() {
  $('#loginView').hidden = true; $('#appView').hidden = false;
  route();
  refreshUnread();
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

function route() {
  const [view, arg] = (location.hash.slice(1) || 'dashboard').split('/');
  dirty = false;
  $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view || (view === 'edit' && b.dataset.view === 'projects')));
  const main = $('#main');
  main.innerHTML = '';
  window.scrollTo(0, 0);
  const views = { publish: viewPublish, dashboard: viewDashboard, projects: viewProjects, new: () => viewEditor(null, arg), edit: () => viewEditor(arg), messages: viewMessages, profile: viewProfile, account: viewAccount };
  (views[view] || viewDashboard)(main);
}

function header(title, sub, right = '') {
  const banner = ME && ME.mustChangePassword
    ? `<div class="banner"><span>⚠ You are using the default password. Please change it now.</span><a class="btn btn-sm" href="#account">Change password</a></div>` : '';
  return `${banner}<div class="topbar"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${right}</div></div>`;
}

async function refreshUnread() {
  try {
    const s = await req('GET', '/api/admin/stats');
    $('#unreadPill').hidden = !s.unread; $('#unreadPill').textContent = s.unread;
  } catch (_) {}
}

/* ---------- Dashboard ---------- */
async function viewDashboard(main) {
  main.innerHTML = header('Dashboard', 'Overview of your portfolio', `<a class="btn btn-primary" href="#new">${ico('plus')} Add new</a>`);
  const s = await req('GET', '/api/admin/stats');
  main.insertAdjacentHTML('beforeend', `
    <div class="stats">
      <div class="stat" style="--c:var(--c-game)"><span>Games</span><b>${s.games}</b></div>
      <div class="stat" style="--c:var(--c-plugin)"><span>Plugins</span><b>${s.plugins}</b></div>
      <div class="stat" style="--c:var(--c-asset)"><span>Unity Assets</span><b>${s.assets}</b></div>
      <div class="stat" style="--c:var(--violet)"><span>Total downloads</span><b>${s.downloads}</b></div>
      <div class="stat" style="--c:var(--red)"><span>Unread messages</span><b>${s.unread}</b></div>
    </div>
    <div class="panel">
      <h2>Quick add</h2>
      <div class="quick">
        <button data-new="game" style="--c:var(--c-game)">${ico('game')}<b>New Game</b><small>APK, Play Store link, video</small></button>
        <button data-new="plugin" style="--c:var(--c-plugin)">${ico('plugin')}<b>New Plugin</b><small>Package, docs, GitHub</small></button>
        <button data-new="asset" style="--c:var(--c-asset)">${ico('asset')}<b>New Unity Asset</b><small>Asset Store link, .unitypackage</small></button>
      </div>
    </div>
    <div class="panel">
      <h2>Most downloaded</h2>
      ${s.top.length ? `<ul class="top-list">${s.top.map(t => `<li><span><span class="chip ${t.type}">${TYPE_LABEL[t.type]}</span>&nbsp; ${esc(t.title)}</span><b>${t.downloads}</b></li>`).join('')}</ul>`
      : `<div class="empty"><b>No projects yet</b>Add your first game, plugin or asset to get started.</div>`}
    </div>`);
  $$('[data-new]').forEach(b => b.addEventListener('click', () => (location.hash = 'new/' + b.dataset.new)));
}

/* ---------- Projects list ---------- */
async function viewProjects(main) {
  main.innerHTML = header('All Projects', 'Edit, hide, feature or delete your work', `<a class="btn btn-primary" href="#new">${ico('plus')} Add new</a>`) +
    `<div class="toolbar">
      <div class="seg" id="seg"><button class="active" data-t="all">All</button><button data-t="game">Games</button><button data-t="plugin">Plugins</button><button data-t="asset">Assets</button></div>
      <input type="text" id="q" placeholder="Search…">
    </div><div class="rows" id="rows"></div>`;
  let items = await req('GET', '/api/admin/projects');
  let type = 'all', q = '';
  const render = () => {
    const list = items.filter(p => (type === 'all' || p.type === type) && (!q || p.title.toLowerCase().includes(q)));
    $('#rows').innerHTML = list.length ? list.map(p => `
      <div class="row" data-id="${p.id}">
        <div class="thumb">${p.cover ? `<img src="${esc(p.cover)}" alt="">` : esc(p.title.charAt(0))}</div>
        <div style="min-width:0">
          <h3>${esc(p.title)} <span class="chip ${p.type}">${TYPE_LABEL[p.type]}</span>${p.published ? '' : '<span class="chip draft">Hidden</span>'}${p.featured ? '<span class="chip star">★ Featured</span>' : ''}</h3>
          <div class="sub">
            ${p.version ? `<span>v${esc(p.version)}</span>` : ''}
            ${p.downloadFile ? `<span>${esc(p.downloadFile.ext.slice(1).toUpperCase())} · ${fmtSize(p.downloadFile.size)}</span>` : ''}
            <span>${p.downloads || 0} downloads</span>
            ${p.playStoreUrl ? '<span>Play Store ✓</span>' : ''}
          </div>
        </div>
        <div class="acts">
          <button class="btn btn-sm icon-btn" data-act="feature" title="${p.featured ? 'Unfeature' : 'Feature on home page'}" style="${p.featured ? 'color:var(--violet)' : ''}">${ico('star', 16)}</button>
          <button class="btn btn-sm icon-btn" data-act="publish" title="${p.published ? 'Hide from website' : 'Show on website'}">${ico(p.published ? 'eye' : 'eyeOff', 16)}</button>
          ${p.published ? `<a class="btn btn-sm icon-btn" href="/project.html?slug=${encodeURIComponent(p.slug)}" target="_blank" title="Open on website">${ico('ext', 16)}</a>` : ''}
          <a class="btn btn-sm" href="#edit/${p.id}">${ico('edit', 15)} Edit</a>
          <button class="btn btn-sm btn-danger icon-btn" data-act="delete" title="Delete">${ico('trash', 16)}</button>
        </div>
      </div>`).join('')
      : `<div class="empty"><b>Nothing here yet</b><a class="btn btn-primary" href="#new" style="margin-top:12px">${ico('plus')} Add your first project</a></div>`;
  };
  render();
  $('#seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; type = b.dataset.t; $$('#seg button').forEach(x => x.classList.toggle('active', x === b)); render(); });
  $('#q').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
  $('#rows').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.row').dataset.id; const p = items.find(x => x.id === id);
    try {
      if (b.dataset.act === 'delete') {
        if (!confirm(`Delete "${p.title}"? All its images, video and download file will be removed permanently.`)) return;
        await req('DELETE', '/api/admin/projects/' + id);
        items = items.filter(x => x.id !== id); toast('Deleted');
      } else if (b.dataset.act === 'publish') {
        Object.assign(p, await req('PATCH', '/api/admin/projects/' + id, { published: !p.published }));
        toast(p.published ? 'Now visible on website' : 'Hidden from website');
      } else if (b.dataset.act === 'feature') {
        Object.assign(p, await req('PATCH', '/api/admin/projects/' + id, { featured: !p.featured }));
        toast(p.featured ? 'Featured on home page' : 'Removed from featured');
      }
      render();
    } catch (err) { toast(err.message, 'err'); }
  });
}

/* ---------- Editor ---------- */
async function viewEditor(id, presetType) {
  const main = $('#main');
  let p = { type: ['game', 'plugin', 'asset'].includes(presetType) ? presetType : 'game', published: true, featured: false, tags: [], platforms: [], gallery: [] };
  if (id) {
    const all = await req('GET', '/api/admin/projects');
    const found = all.find(x => x.id === id);
    if (!found) { main.innerHTML = header('Not found') + '<div class="empty"><b>This project does not exist.</b></div>'; return; }
    p = found;
  }
  // Pending changes
  const st = { cover: null, icon: null, gallery: [], removeGallery: [], videoFile: null, downloadFile: null, removeCover: false, removeIcon: false, removeVideo: false, removeDownload: false };

  main.innerHTML = header(id ? 'Edit project' : 'Add new project', id ? esc(p.title) : 'Upload a game, plugin or Unity asset',
    id && p.published ? `<a class="btn" href="/project.html?slug=${encodeURIComponent(p.slug)}" target="_blank">${ico('ext')} View live</a>` : '') + `
  <form id="editor" class="editor" novalidate>
    <div>
      <div class="panel">
        <h2>Basics</h2>
        <div class="type-pick">
          ${['game', 'plugin', 'asset'].map(t => `
          <label style="--c:var(--c-${t})"><input type="radio" name="type" value="${t}" ${p.type === t ? 'checked' : ''}>
            <span class="opt">${ico(t, 22)}<b>${TYPE_LABEL[t]}</b></span></label>`).join('')}
        </div>
        <div class="field"><label for="title">Title *</label><input type="text" id="title" name="title" maxlength="120" required value="${esc(p.title)}" placeholder="e.g. Space Runner 3D"></div>
        <div class="field"><label for="shortDescription">Short description</label><input type="text" id="shortDescription" name="shortDescription" maxlength="220" value="${esc(p.shortDescription)}" placeholder="One line shown on the card"><small><span id="sdCount">0</span>/220</small></div>
        <div class="field"><label for="description">Full details</label>
          <textarea id="description" name="description" rows="12" class="mono-area" placeholder="Describe features, controls, how to use the plugin…">${esc(p.description)}</textarea>
          <div class="md-help">Formatting: # Heading · - bullet list · **bold** · *italic* · \`code\` · [link](https://…)</div>
        </div>
        <div class="grid-3">
          <div class="field"><label for="version">Version</label><input type="text" id="version" name="version" value="${esc(p.version)}" placeholder="1.0.0"></div>
          <div class="field"><label for="unityVersion">Unity version</label><input type="text" id="unityVersion" name="unityVersion" value="${esc(p.unityVersion)}" placeholder="2022.3 LTS"></div>
          <div class="field"><label for="price">Price</label><input type="text" id="price" name="price" value="${esc(p.price)}" placeholder="Free / $9.99"></div>
        </div>
        <div class="field"><label for="tags">Tags</label><input type="text" id="tags" name="tags" value="${esc((p.tags || []).join(', '))}" placeholder="Hyper-casual, 3D, Offline"><small>Separate with commas</small></div>
        <div class="field"><span class="label">Platforms</span>
          <div class="checks">${PLATFORMS.map(pl => `<label><input type="checkbox" name="platforms" value="${pl}" ${(p.platforms || []).includes(pl) ? 'checked' : ''}> ${pl}</label>`).join('')}</div>
        </div>
      </div>

      <div class="panel">
        <h2>Images</h2>
        <div class="grid-2">
          <div class="field"><span class="label">Cover image (16:9) — shown on cards</span><div id="coverBox"></div></div>
          <div class="field"><span class="label">App icon (square, optional)</span><div id="iconBox"></div></div>
        </div>
        <div class="field" style="margin:0"><span class="label">Screenshots / gallery</span>
          <div class="drop" id="galleryDrop">${ico('upload')}<b>Drop screenshots here or click</b><small>JPG, PNG, WEBP, GIF · multiple allowed</small><input type="file" accept="image/*" multiple></div>
          <div class="gallery" id="galleryGrid"></div>
        </div>
      </div>

      <div class="panel">
        <h2>Video</h2>
        <div class="field"><label for="youtubeUrl">YouTube link (recommended)</label><input type="url" id="youtubeUrl" name="youtubeUrl" value="${esc(p.youtubeUrl)}" placeholder="https://youtube.com/watch?v=…"><div id="ytPrev"></div></div>
        <div class="or">OR UPLOAD A VIDEO FILE</div>
        <div id="videoBox"></div>
      </div>
    </div>

    <div class="editor-side">
      <div class="panel">
        <h2>Download file</h2>
        <div id="dlBox"></div>
        <small class="hint" style="display:block;margin-top:10px">APK for games · .unitypackage / .zip for plugins &amp; assets. Visitors get a Download button.</small>
        <div class="or">OR EXTERNAL LINK</div>
        <div class="field" style="margin:0"><label for="downloadUrl">External download link</label><input type="url" id="downloadUrl" name="downloadUrl" value="${esc(p.downloadUrl)}" placeholder="https://github.com/…/releases/download/…/game.apk"><small>GitHub Releases / Google Drive link. Best for files over 100 MB and for GitHub Pages.</small></div>
      </div>
      <div class="panel">
        <h2>Links</h2>
        <div class="field"><label for="playStoreUrl">Google Play Store link</label><input type="url" id="playStoreUrl" name="playStoreUrl" value="${esc(p.playStoreUrl)}" placeholder="https://play.google.com/store/apps/details?id=…"></div>
        <div class="field"><label for="assetStoreUrl">Unity Asset Store link</label><input type="url" id="assetStoreUrl" name="assetStoreUrl" value="${esc(p.assetStoreUrl)}" placeholder="https://assetstore.unity.com/…"></div>
        <div class="field"><label for="githubUrl">GitHub link</label><input type="url" id="githubUrl" name="githubUrl" value="${esc(p.githubUrl)}" placeholder="https://github.com/…"></div>
        <div class="field" style="margin:0"><label for="otherUrl">Other link (itch.io, website…)</label><input type="url" id="otherUrl" name="otherUrl" value="${esc(p.otherUrl)}" placeholder="https://…"></div>
      </div>
      <div class="panel">
        <h2>Visibility</h2>
        <label class="toggle"><span><b>Published</b><small>Show on the website</small></span><span class="switch"><input type="checkbox" name="published" ${p.published ? 'checked' : ''}><span></span></span></label>
        <label class="toggle"><span><b>Featured</b><small>Big highlight on home page</small></span><span class="switch"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}><span></span></span></label>
        <div class="field" style="margin:12px 0 0"><label for="order">Sort priority</label><input type="number" id="order" name="order" value="${Number(p.order) || 0}"><small>Higher number shows first</small></div>
      </div>
      <div class="error" id="formError"></div>
      <div style="display:flex;gap:10px">
        <a class="btn" href="#projects" style="flex:1">Cancel</a>
        <button class="btn btn-primary" type="submit" style="flex:2">${ico('check')} ${id ? 'Save changes' : 'Publish project'}</button>
      </div>
    </div>
  </form>`;

  const form = $('#editor');
  form.addEventListener('input', () => (dirty = true));
  const sd = $('#shortDescription'); const upd = () => ($('#sdCount').textContent = sd.value.length); sd.addEventListener('input', upd); upd();

  // --- generic single-file box
  function singleBox(box, { key, rmKey, accept, label, sub, current, render }) {
    const draw = () => {
      const file = st[key];
      const existing = !st[rmKey] && current();
      if (file || existing) {
        box.innerHTML = render(file, existing);
        $('.x-btn', box).addEventListener('click', e => {
          e.preventDefault();
          if (file) st[key] = null; else st[rmKey] = true;
          dirty = true; draw();
        });
      } else {
        box.innerHTML = `<div class="drop">${ico('upload')}<b>${label}</b><small>${sub}</small><input type="file" accept="${accept}"></div>`;
        bindDrop($('.drop', box), files => { st[key] = files[0]; dirty = true; draw(); });
      }
    };
    draw();
  }
  const objUrl = f => URL.createObjectURL(f);

  singleBox($('#coverBox'), {
    key: 'cover', rmKey: 'removeCover', accept: 'image/*', label: 'Upload cover', sub: '1280×720 recommended', current: () => p.cover,
    render: (f, ex) => `<div class="preview-cover"><button class="x-btn" title="Remove">${ico('x')}</button><img src="${f ? objUrl(f) : esc(ex)}" alt=""></div>`
  });
  singleBox($('#iconBox'), {
    key: 'icon', rmKey: 'removeIcon', accept: 'image/*', label: 'Upload icon', sub: '512×512', current: () => p.icon,
    render: (f, ex) => `<div class="preview-icon"><button class="x-btn" title="Remove">${ico('x')}</button><img src="${f ? objUrl(f) : esc(ex)}" alt=""></div>`
  });
  singleBox($('#videoBox'), {
    key: 'videoFile', rmKey: 'removeVideo', accept: 'video/mp4,video/webm,video/quicktime', label: 'Upload gameplay video', sub: 'MP4 / WEBM / MOV', current: () => p.videoFile,
    render: (f, ex) => `<div class="preview-cover" style="aspect-ratio:16/9"><button class="x-btn" title="Remove">${ico('x')}</button><video src="${f ? objUrl(f) : esc(ex)}" controls style="width:100%;height:100%;background:#000"></video></div>`
  });
  singleBox($('#dlBox'), {
    key: 'downloadFile', rmKey: 'removeDownload', accept: '.apk,.aab,.zip,.unitypackage,.rar,.7z', label: 'Upload APK / package', sub: '.apk .unitypackage .zip .rar .7z', current: () => p.downloadFile,
    render: (f, ex) => {
      const name = f ? f.name : ex.originalName, size = f ? f.size : ex.size, ext = (name.split('.').pop() || '').toUpperCase();
      return `<div class="file-pill" style="position:relative"><span class="ext">${esc(ext)}</span><span class="info"><b>${esc(name)}</b><small>${fmtSize(size)}${f ? ' · ready to upload' : ` · ${p.downloads || 0} downloads`}</small></span><button class="x-btn" style="position:static" title="Remove">${ico('x')}</button></div>`;
    }
  });

  // --- gallery
  const drawGallery = () => {
    const existing = (p.gallery || []).filter(u => !st.removeGallery.includes(u));
    $('#galleryGrid').innerHTML =
      existing.map(u => `<div class="g"><img src="${esc(u)}" alt=""><button class="x-btn" data-old="${esc(u)}" title="Remove">${ico('x')}</button></div>`).join('') +
      st.gallery.map((f, i) => `<div class="g new"><img src="${objUrl(f)}" alt=""><button class="x-btn" data-new="${i}" title="Remove">${ico('x')}</button></div>`).join('');
  };
  $('#galleryGrid').addEventListener('click', e => {
    const b = e.target.closest('.x-btn'); if (!b) return; e.preventDefault();
    if (b.dataset.old) st.removeGallery.push(b.dataset.old); else st.gallery.splice(+b.dataset.new, 1);
    dirty = true; drawGallery();
  });
  bindDrop($('#galleryDrop'), files => { st.gallery.push(...files.filter(f => f.type.startsWith('image/'))); dirty = true; drawGallery(); });
  drawGallery();

  // --- youtube preview
  const yt = $('#youtubeUrl');
  const ytPrev = () => { const id = youtubeId(yt.value); $('#ytPrev').innerHTML = id ? `<div class="yt-prev"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="YouTube preview"></div>` : ''; };
  yt.addEventListener('input', ytPrev); ytPrev();

  // --- submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    $('#formError').textContent = '';
    if (!$('#title').value.trim()) { $('#formError').textContent = 'Please enter a title.'; $('#title').focus(); return; }
    const bad = $$('input[type=url]', form).find(i => i.value.trim() && !/^https?:\/\/.+/i.test(i.value.trim()));
    if (bad) { $('#formError').textContent = 'Links must start with https://'; bad.focus(); return; }

    const fd = new FormData();
    const raw = new FormData(form);
    ['type', 'title', 'shortDescription', 'description', 'version', 'unityVersion', 'price', 'tags', 'youtubeUrl', 'playStoreUrl', 'assetStoreUrl', 'githubUrl', 'otherUrl', 'downloadUrl', 'order']
      .forEach(k => fd.append(k, raw.get(k) || ''));
    fd.append('platforms', JSON.stringify(raw.getAll('platforms')));
    fd.append('published', form.published.checked);
    fd.append('featured', form.featured.checked);
    fd.append('removeGallery', JSON.stringify(st.removeGallery));
    ['removeCover', 'removeIcon', 'removeVideo', 'removeDownload'].forEach(k => fd.append(k, st[k]));
    if (st.cover) fd.append('cover', st.cover);
    if (st.icon) fd.append('icon', st.icon);
    if (st.videoFile) fd.append('videoFile', st.videoFile);
    if (st.downloadFile) fd.append('downloadFile', st.downloadFile);
    st.gallery.forEach(f => fd.append('gallery', f));

    try {
      const hasFiles = st.cover || st.icon || st.videoFile || st.downloadFile || st.gallery.length;
      const saved = await uploadForm(id ? 'PUT' : 'POST', '/api/admin/projects' + (id ? '/' + id : ''), fd, hasFiles ? 'Uploading files…' : 'Saving…');
      dirty = false;
      toast(id ? 'Changes saved' : 'Project published!');
      location.hash = 'edit/' + saved.id;
      if (id) route();
    } catch (err) { $('#formError').textContent = err.message; toast(err.message, 'err'); }
  });
}

function bindDrop(drop, onFiles) {
  const input = $('input[type=file]', drop);
  input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); });
}

/* ---------- Publish to GitHub Pages ---------- */
async function viewPublish(main) {
  main.innerHTML = header('GitHub Pages', 'Publish your portfolio for free as a static website') + `
    <div class="panel">
      <h2>1. Export the website</h2>
      <p style="color:var(--muted);margin:0 0 16px">Creates a <code>docs</code> folder in your project with the full website (pages, images, data and small APKs).
      Run this again every time you add or change a project.</p>
      <button class="btn btn-primary" id="exportBtn">${ico('upload')} Export for GitHub Pages</button>
      <span class="hint" id="lastExport" style="margin-left:12px"></span>
      <div id="exportResult" style="margin-top:16px"></div>
    </div>
    <div class="panel">
      <h2>2. Push to GitHub</h2>
      <ol class="steps">
        <li>Open <b>GitHub Desktop</b> → you'll see the changed files in <code>docs/</code>.</li>
        <li>Write a summary like <i>Update portfolio</i> → <b>Commit to main</b> → <b>Push origin</b>.</li>
      </ol>
    </div>
    <div class="panel">
      <h2>3. Set GitHub Pages to the docs folder (one time)</h2>
      <ol class="steps">
        <li>On github.com open your repo → <b>Settings</b> → <b>Pages</b>.</li>
        <li>Under <b>Branch</b> keep <code>main</code>, change <code>/ (root)</code> to <code>/docs</code> → <b>Save</b>.</li>
        <li>Wait 1–2 minutes, then open your site link.</li>
      </ol>
    </div>
    <div class="panel">
      <h2>Good to know</h2>
      <ul class="steps">
        <li>On GitHub Pages the <b>admin panel does not run</b> — you keep managing everything here on your computer and export again.</li>
        <li>GitHub blocks files over <b>100 MB</b>. For big APKs: repo → <b>Releases</b> → <b>Draft a new release</b> → attach the APK → publish, then copy the file link into the project's <b>External download link</b>.</li>
        <li>Prefer <b>YouTube links</b> for videos — they keep the repo small.</li>
        <li>The contact form on GitHub Pages opens the visitor's email app (set your email in Profile).</li>
      </ul>
    </div>`;
  const info = await req('GET', '/api/admin/export');
  const showLast = d => { $('#lastExport').textContent = d ? 'Last export: ' + fmtDate(d) : 'Not exported yet'; };
  showLast(info.lastExport);
  $('#exportBtn').addEventListener('click', async e => {
    const btn = e.currentTarget; btn.disabled = true; btn.lastChild.textContent = ' Exporting…';
    try {
      const r = await req('POST', '/api/admin/export');
      $('#exportResult').innerHTML = `
        <div class="banner" style="border-color:rgba(198,255,61,.4);background:rgba(198,255,61,.07);color:var(--lime);margin:0 0 10px">
          <span>✓ Exported ${r.projects} project${r.projects === 1 ? '' : 's'} · ${r.files} files · ${r.sizeMB} MB into the <code>docs</code> folder. Now commit &amp; push it.</span>
        </div>
        ${r.warnings.map(w => `<div class="banner" style="margin:0 0 8px"><span>⚠ ${esc(w)}</span></div>`).join('')}`;
      showLast(new Date().toISOString());
      toast('Export complete');
    } catch (err) { toast(err.message, 'err'); }
    btn.disabled = false; btn.lastChild.textContent = ' Export for GitHub Pages';
  });
}

/* ---------- Messages ---------- */
async function viewMessages(main) {
  main.innerHTML = header('Messages', 'From the contact form on your website') + '<div class="rows" id="msgs"></div>';
  let msgs = await req('GET', '/api/admin/messages');
  const render = () => {
    $('#msgs').innerHTML = msgs.length ? msgs.map(m => `
      <div class="msg ${m.read ? '' : 'unread'}" data-id="${m.id}">
        <div class="msg-head"><div><b>${esc(m.name)}</b> &nbsp;<a href="mailto:${esc(m.email)}">${esc(m.email)}</a></div><time>${fmtDate(m.createdAt)}</time></div>
        <p>${esc(m.message)}</p>
        <div class="acts">
          <a class="btn btn-sm" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: your message')}">${ico('mail', 15)} Reply</a>
          <button class="btn btn-sm" data-act="read">${m.read ? 'Mark unread' : 'Mark read'}</button>
          <button class="btn btn-sm btn-danger" data-act="del">${ico('trash', 15)}</button>
        </div>
      </div>`).join('') : '<div class="empty"><b>No messages yet</b>Messages from your contact form will show up here.</div>';
  };
  render();
  $('#msgs').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.msg').dataset.id; const m = msgs.find(x => x.id === id);
    try {
      if (b.dataset.act === 'del') { if (!confirm('Delete this message?')) return; await req('DELETE', '/api/admin/messages/' + id); msgs = msgs.filter(x => x.id !== id); }
      else { Object.assign(m, await req('PATCH', '/api/admin/messages/' + id, { read: !m.read })); }
      render(); refreshUnread();
    } catch (err) { toast(err.message, 'err'); }
  });
}

/* ---------- Profile ---------- */
async function viewProfile(main) {
  const pr = await req('GET', '/api/profile?all=1');
  let avatarFile = null, removeAvatar = false, resumeFile = null, removeResume = false;
  const exp = JSON.parse(JSON.stringify(pr.experience || []));
  const edu = JSON.parse(JSON.stringify(pr.education || []));
  const socials = [['github', 'GitHub'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['twitter', 'X / Twitter'], ['instagram', 'Instagram'], ['playstore', 'Google Play developer page'], ['assetstore', 'Unity Asset Store publisher page'], ['itch', 'itch.io']];
  main.innerHTML = header('Profile', 'Everything shown in the hero, about and contact sections') + `
  <form id="profileForm">
    <div class="panel">
      <h2>Identity</h2>
      <div class="avatar-edit">
        <div class="av" id="avPrev"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label class="btn btn-sm" style="position:relative;overflow:hidden">${ico('upload', 15)} Upload photo<input type="file" id="avInput" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
          <button class="btn btn-sm btn-danger" type="button" id="avRemove">Remove</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Your name</label><input type="text" name="name" value="${esc(pr.name)}" maxlength="80"></div>
        <div class="field"><label>Brand / site name</label><input type="text" name="brand" value="${esc(pr.brand)}" maxlength="40"></div>
        <div class="field"><label>Role</label><input type="text" name="role" value="${esc(pr.role)}" maxlength="80"></div>
        <div class="field"><label>Years of experience</label><input type="number" name="experienceYears" min="0" max="60" value="${Number(pr.experienceYears) || 0}"></div>
      </div>
      <div class="field"><label>Tagline (hero)</label><input type="text" name="tagline" value="${esc(pr.tagline)}" maxlength="300"></div>
      <div class="field"><label>About me</label><textarea name="about" rows="7">${esc(pr.about)}</textarea><small>Leave an empty line between paragraphs</small></div>
      <div class="field"><label>Skills</label><input type="text" name="skills" value="${esc((pr.skills || []).join(', '))}"><small>Separate with commas</small></div>
      <div class="field"><label>Languages known</label><input type="text" name="languages" value="${esc((pr.languages || []).join(', '))}"><small>Separate with commas</small></div>
      <label class="toggle"><span><b>Available for work</b><small>Shows a green "Available" badge in the hero</small></span><span class="switch"><input type="checkbox" name="available" ${pr.available ? 'checked' : ''}><span></span></span></label>
    </div>
    <div class="panel">
      <h2>Contact</h2>
      <div class="grid-3">
        <div class="field"><label>Email</label><input type="email" name="email" value="${esc(pr.email)}"></div>
        <div class="field"><label>Phone / WhatsApp</label><input type="tel" name="phone" value="${esc(pr.phone)}"></div>
        <div class="field"><label>Location (city)</label><input type="text" name="location" value="${esc(pr.location)}"></div>
      </div>
      <label class="toggle"><span><b>Show phone number on website</b><small>Off = only email and the contact form are public (less spam calls)</small></span><span class="switch"><input type="checkbox" name="showPhone" ${pr.showPhone ? 'checked' : ''}><span></span></span></label>
    </div>
    <div class="panel">
      <h2>Resume / CV</h2>
      <div id="resumeBox"></div>
      <small class="hint" style="display:block;margin-top:10px">PDF recommended. A "Download Resume" button appears in the hero, menu and experience section.</small>
    </div>
    <div class="panel">
      <h2>Work experience <button type="button" class="btn btn-sm" id="addExp">${ico('plus', 15)} Add job</button></h2>
      <p class="hint" style="margin:-8px 0 14px">Newest first. Use ↑ ↓ to reorder.</p>
      <div class="rep-list" id="expList"></div>
    </div>
    <div class="panel">
      <h2>Education <button type="button" class="btn btn-sm" id="addEdu">${ico('plus', 15)} Add</button></h2>
      <div class="rep-list" id="eduList"></div>
    </div>
    <div class="panel">
      <h2>Social links</h2>
      <div class="grid-2">${socials.map(([k, l]) => `<div class="field"><label>${l}</label><input type="url" name="social_${k}" value="${esc((pr.socials || {})[k])}" placeholder="https://…"></div>`).join('')}</div>
    </div>
    <div class="sticky-save"><span class="error" id="pErr" style="margin:auto 0"></span><button class="btn btn-primary" type="submit">${ico('check')} Save profile</button></div>
  </form>`;
  const drawAv = () => {
    const src = avatarFile ? URL.createObjectURL(avatarFile) : (!removeAvatar && pr.avatar);
    $('#avPrev').innerHTML = src ? `<img src="${esc(src)}" alt="">` : esc((pr.name || 'U').charAt(0));
  };
  drawAv();

  // --- Resume
  const drawResume = () => {
    const box = $('#resumeBox');
    const cur = resumeFile ? { name: resumeFile.name, size: resumeFile.size, isNew: true } : (!removeResume && pr.resume);
    if (cur) {
      const ext = (cur.name.split('.').pop() || '').toUpperCase();
      box.innerHTML = `<div class="file-pill"><span class="ext">${esc(ext)}</span><span class="info"><b>${esc(cur.name)}</b><small>${fmtSize(cur.size)}${cur.isNew ? ' · ready to upload — click Save' : ''}</small></span>
        ${!cur.isNew ? `<a class="btn btn-sm" href="${esc(pr.resume.url)}" target="_blank">Open</a>` : ''}
        <button type="button" class="btn btn-sm btn-danger icon-btn" id="rmResume" title="Remove">${ico('x', 15)}</button></div>`;
      $('#rmResume').onclick = () => { if (resumeFile) resumeFile = null; else removeResume = true; drawResume(); };
    } else {
      box.innerHTML = `<div class="drop">${ico('upload')}<b>Upload your resume</b><small>PDF, DOC or DOCX</small><input type="file" accept=".pdf,.doc,.docx"></div>`;
      bindDrop($('.drop', box), files => { resumeFile = files[0]; removeResume = false; drawResume(); });
    }
  };
  drawResume();

  // --- Repeatable lists (experience / education)
  function repeater(listEl, items, fields, blank) {
    const draw = () => {
      listEl.innerHTML = items.length ? items.map((it, i) => `
        <div class="rep" data-i="${i}">
          <div class="rep-fields">${fields.map(f => f.type === 'check'
            ? `<div class="checks" style="align-self:end"><label><input type="checkbox" data-k="${f.k}" ${it[f.k] ? 'checked' : ''}> ${f.label}</label></div>`
            : `<div class="field" style="margin:0;${f.wide ? 'grid-column:1/-1' : ''}"><label>${f.label}</label><input type="text" data-k="${f.k}" value="${esc(it[f.k])}" placeholder="${esc(f.ph || '')}"></div>`).join('')}</div>
          <div class="rep-acts">
            <button type="button" class="btn btn-sm icon-btn" data-a="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-sm icon-btn" data-a="down" title="Move down" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-sm btn-danger icon-btn" data-a="del" title="Remove">${ico('trash', 15)}</button>
          </div>
        </div>`).join('') : '<div class="empty" style="padding:24px">Nothing added yet.</div>';
    };
    listEl.addEventListener('input', e => {
      const k = e.target.dataset.k; if (!k) return;
      const it = items[+e.target.closest('.rep').dataset.i];
      it[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    });
    listEl.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const i = +b.closest('.rep').dataset.i;
      if (b.dataset.a === 'del') items.splice(i, 1);
      if (b.dataset.a === 'up' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
      if (b.dataset.a === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
      draw();
    });
    draw();
    return () => { items.unshift({ ...blank }); draw(); listEl.querySelector('input').focus(); };
  }
  const addExp = repeater($('#expList'), exp, [
    { k: 'role', label: 'Role', ph: 'Sr. Unity Developer' },
    { k: 'company', label: 'Company', ph: 'Company name' },
    { k: 'location', label: 'City', ph: 'Ahmedabad' },
    { k: 'duration', label: 'Duration', ph: 'Jan 2020 – Mar 2021 / 1.2 Years' },
    { k: 'summary', label: 'What you did (optional)', ph: 'Built 5 hyper-casual games, owned ads & IAP integration…', wide: true },
    { k: 'current', label: 'Current job', type: 'check' }
  ], { role: '', company: '', location: '', duration: '', summary: '', current: false });
  const addEdu = repeater($('#eduList'), edu, [
    { k: 'degree', label: 'Degree', ph: 'MCA' },
    { k: 'year', label: 'Passing year', ph: '2015' },
    { k: 'school', label: 'College / School', ph: 'College name, city' },
    { k: 'board', label: 'University / Board', ph: 'GTU' }
  ], { degree: '', year: '', school: '', board: '' });
  $('#addExp').onclick = addExp; $('#addEdu').onclick = addEdu;

  $('#avInput').addEventListener('change', e => { avatarFile = e.target.files[0] || null; removeAvatar = false; drawAv(); });
  $('#avRemove').addEventListener('click', () => { avatarFile = null; removeAvatar = true; drawAv(); });
  $('#profileForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#pErr').textContent = '';
    const fd = new FormData(e.target);
    fd.delete('available'); fd.append('available', e.target.available.checked);
    fd.delete('showPhone'); fd.append('showPhone', e.target.showPhone.checked);
    fd.append('removeAvatar', removeAvatar);
    fd.append('removeResume', removeResume);
    if (resumeFile) fd.append('resume', resumeFile);
    fd.append('experience', JSON.stringify(exp));
    fd.append('education', JSON.stringify(edu));
    if (avatarFile) fd.append('avatar', avatarFile);
    try { await uploadForm('PUT', '/api/admin/profile', fd, 'Saving profile…'); toast('Profile saved'); viewProfile(main); }
    catch (err) { $('#pErr').textContent = err.message; }
  });
}

/* ---------- Account ---------- */
function viewAccount(main) {
  main.innerHTML = header('Account', 'Change your admin username and password') + `
  <form class="panel" id="accForm" style="max-width:520px">
    <div class="field"><label>Username</label><input type="text" name="username" value="${esc(ME.username)}" autocomplete="username" minlength="3"></div>
    <div class="field"><label>Current password *</label><input type="password" name="currentPassword" autocomplete="current-password" required></div>
    <div class="field"><label>New password</label><input type="password" name="newPassword" autocomplete="new-password" minlength="8"><small>At least 8 characters. Leave empty to keep current password.</small></div>
    <div class="field"><label>Confirm new password</label><input type="password" name="confirm" autocomplete="new-password"></div>
    <div class="error" id="aErr"></div>
    <button class="btn btn-primary" type="submit">${ico('check')} Update account</button>
  </form>`;
  $('#accForm').addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    $('#aErr').textContent = '';
    if (d.newPassword !== d.confirm) { $('#aErr').textContent = 'New passwords do not match'; return; }
    try {
      await req('PUT', '/api/admin/account', { username: d.username, currentPassword: d.currentPassword, newPassword: d.newPassword || undefined });
      ME = await req('GET', '/api/me');
      toast('Account updated'); viewAccount(main);
    } catch (err) { $('#aErr').textContent = err.message; }
  });
}

boot();
