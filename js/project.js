/* Project detail page */
const PLATFORM_LABEL = { android: 'Android', ios: 'iOS', windows: 'Windows', mac: 'macOS', linux: 'Linux', webgl: 'WebGL', web: 'Web' };
let CURRENT = null;

function mediaItems(p) {
  const items = [];
  if (p.webgl && p.webgl.entry) items.push({ kind: 'game', src: asset(p.webgl.entry), thumb: asset(p.cover || (p.gallery || [])[0] || '') });
  const yt = youtubeId(p.youtubeUrl);
  if (yt) items.push({ kind: 'yt', id: yt, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` });
  if (p.videoFile) items.push({ kind: 'video', src: asset(p.videoFile), thumb: asset(p.cover || (p.gallery || [])[0] || '') });
  if (p.cover) items.push({ kind: 'img', src: asset(p.cover) });
  (p.gallery || []).forEach(src => items.push({ kind: 'img', src: asset(src) }));
  return items;
}

function renderMain(item, autoplay = false) {
  const box = $('#mediaMain');
  if (!item) { box.style.display = 'none'; return; }
  box.classList.toggle('is-game', item.kind === 'game');
  if (item.kind === 'game') {
    if (autoplay) {
      box.innerHTML = `<iframe src="${esc(item.src)}" title="Play ${esc(CURRENT.title)}" allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope" allowfullscreen></iframe>
        <div class="game-bar"><span>${ICONS.gamepad} Playing in browser</span>
        <span><button type="button" class="gb-btn" id="gameFull">${ICONS.expand} Fullscreen</button><a class="gb-btn" href="${esc(item.src)}" target="_blank" rel="noopener">${ICONS.ext} New tab</a></span></div>`;
      $('#gameFull').onclick = () => { const f = $('#mediaMain iframe'); (f.requestFullscreen || f.webkitRequestFullscreen || (() => {})).call(f); };
      track('play/' + CURRENT.slug, 'Play ' + CURRENT.title);
    } else {
      box.innerHTML = `<button type="button" class="game-poster" id="startGame" aria-label="Play ${esc(CURRENT.title)} in your browser">
        ${item.thumb ? `<img src="${esc(item.thumb)}" alt="">` : ''}
        <span class="gp-play">${ICONS.play}</span><span class="gp-label">Play in browser</span>
        <span class="gp-note">Best on desktop · loads the game (${esc(fmtSize(CURRENT.webgl.size || 0))})</span></button>`;
      $('#startGame').onclick = () => renderMain(item, true);
    }
    return;
  }
  if (item.kind === 'yt') box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${item.id}?rel=0" title="Video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  else if (item.kind === 'video') box.innerHTML = `<video src="${esc(item.src)}" controls playsinline preload="metadata"${item.thumb ? ` poster="${esc(item.thumb)}"` : ''}></video>`;
  else box.innerHTML = `<img class="zoomable" src="${esc(item.src)}" alt="">`;
}

function openLightbox(images, index) {
  const lb = $('#lightbox'), img = $('img', lb);
  let i = index;
  const show = () => (img.src = images[i]);
  show(); lb.classList.add('open'); document.body.style.overflow = 'hidden';
  const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  const prev = () => { i = (i - 1 + images.length) % images.length; show(); };
  const next = () => { i = (i + 1) % images.length; show(); };
  const onKey = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next(); };
  $('.lb-close', lb).onclick = close; $('.lb-prev', lb).onclick = prev; $('.lb-next', lb).onclick = next;
  lb.onclick = e => { if (e.target === lb) close(); };
  $('.lb-prev', lb).style.display = $('.lb-next', lb).style.display = images.length > 1 ? '' : 'none';
  document.addEventListener('keydown', onKey);
}

function changelogHtml(list) {
  return `<div class="changelog">${list.map((c, i) => `
    <div class="cl-item${i === 0 ? ' latest' : ''}">
      <div class="cl-head"><b>v${esc(String(c.version || '').replace(/^v/i, ''))}</b>${i === 0 ? '<span class="now">LATEST</span>' : ''}<span class="cl-date">${esc(c.date || '')}</span></div>
      <div class="prose sm">${miniMd(c.notes)}</div>
    </div>`).join('')}</div>`;
}

async function init() {
  initNav();
  const lb = $('#lightbox');
  $('.lb-close', lb).innerHTML = ICONS.close; $('.lb-prev', lb).innerHTML = ICONS.left; $('.lb-next', lb).innerHTML = ICONS.right;

  const slug = new URLSearchParams(location.search).get('slug') || '';
  const app = $('#app');
  let p, data, all;
  try {
    data = await loadData();
    all = data.projects;
    p = all.find(x => x.slug === slug);
    if (!p) throw new Error('Not found');
  } catch (e) {
    if (data) setBrand(data.site, data.profile);
    app.innerHTML = `<div class="notfound container"><h1>404</h1><p style="color:var(--muted)">This project doesn't exist or was removed.</p><a class="btn btn-primary" href="index.html#work">See all projects</a></div>`;
    return;
  }
  CURRENT = p;
  setBrand(data.site, data.profile);
  document.title = `${p.title} — ${data.site.brand || data.profile.name}`;

  const items = mediaItems(p);
  const images = items.filter(i => i.kind === 'img').map(i => i.src);
  const color = TYPE_COLOR[p.type];

  // Action buttons
  let actions = '';
  if (p.type === 'website' && p.otherUrl) actions += `<a class="btn btn-play btn-block" href="${esc(p.otherUrl)}" target="_blank" rel="noopener" data-track="visit/${esc(p.slug)}" data-track-title="Visit ${esc(p.title)}">${ICONS.ext} Visit live website</a>`;
  if (p.webgl) actions += `<button type="button" class="btn btn-play btn-block" id="playBtn"${p.type === 'website' && p.otherUrl ? ' style="margin-top:10px"' : ''}>${ICONS.play} Play in browser</button>`;
  const dl = downloadInfo(p);
  if (dl) {
    const label = dl.name === 'APK' ? 'Download APK' : `Download ${dl.name}`;
    actions += `<a class="btn btn-primary"${p.webgl ? ' style="margin-top:10px"' : ''} ${downloadAttrs(dl)} data-track="download/${esc(p.slug)}" data-track-title="Download ${esc(p.title)}">${ICONS.download} ${esc(label)}</a>`;
    if (dl.size) actions += `<div class="dl-meta"><span>${esc(fmtSize(dl.size))}</span><span>${esc(dl.name)}</span></div>`;
  }
  if (p.playStoreUrl) actions += `<a class="play-badge" href="${esc(p.playStoreUrl)}" target="_blank" rel="noopener" style="margin-top:12px" data-track="playstore/${esc(p.slug)}">${ICONS.googleplay}<span><small>Get it on</small><b>Google Play</b></span></a>`;
  if (p.assetStoreUrl) actions += `<a class="btn" href="${esc(p.assetStoreUrl)}" target="_blank" rel="noopener" style="margin-top:10px" data-track="assetstore/${esc(p.slug)}">${ICONS.unity} Unity Asset Store</a>`;
  if (p.githubUrl) actions += `<a class="btn" href="${esc(p.githubUrl)}" target="_blank" rel="noopener" style="margin-top:10px">${ICONS.github} GitHub</a>`;
  if (p.otherUrl && p.type !== 'website') actions += `<a class="btn" href="${esc(p.otherUrl)}" target="_blank" rel="noopener" style="margin-top:10px">${ICONS.ext} Visit link</a>`;
  if (!actions) actions = `<a class="btn btn-primary" href="contact.html?about=${encodeURIComponent(p.title)}">Ask about this project</a>`;

  // QR code so desktop visitors can install the APK on their phone
  let qr = '';
  if (dl && window.PVQR) {
    try {
      const abs = new URL(dl.href, location.href).href;
      qr = `<div class="side-card qr-card"><div class="qr">${PVQR.svg(abs, { margin: 2 })}</div>
        <div><b>Scan to install</b><small>Point your phone camera here to download ${esc(dl.name === 'APK' ? 'the APK' : 'the file')} directly on your phone.</small></div></div>`;
    } catch (_) {}
  }

  const latest = (p.changelog || [])[0];
  const specs = [
    ['Type', TYPE_LABEL[p.type]],
    ['Version', p.version || (latest && latest.version)],
    ['Price', p.price],
    ['Platforms', (p.platforms || []).map(x => PLATFORM_LABEL[x.toLowerCase()] || x).join(', ')],
    ['Unity', p.unityVersion],
    ['Updated', fmtDate(p.updatedAt || p.createdAt)]
  ].filter(([, v]) => v).map(([k, v]) => `<li><span>${k}</span><b>${esc(v)}</b></li>`).join('');

  const tabs = [['overview', 'Overview', miniMd(p.description) || '<p style="color:var(--dim)">No description yet.</p>']];
  if ((p.docs || '').trim()) tabs.push(['docs', 'Documentation', miniMd(p.docs)]);
  if ((p.changelog || []).length) tabs.push(['changelog', `Changelog <span class="count">${p.changelog.length}</span>`, changelogHtml(p.changelog)]);

  const related = all.filter(x => x.slug !== p.slug).sort((a, b) => (b.type === p.type) - (a.type === p.type)).slice(0, 3);

  app.innerHTML = `
    <section class="p-hero">
      <div class="p-hero-bg">${p.cover ? `<img src="${esc(asset(p.cover))}" alt="">` : ''}</div>
      <div class="container">
        <a class="back" href="index.html#work">${ICONS.back} All projects</a>
        <div class="p-head">
          ${p.icon ? `<img class="p-icon" src="${esc(asset(p.icon))}" alt="">` : ''}
          <div>
            <span class="badge" style="--c:${color}">${esc(TYPE_LABEL[p.type])}</span>${p.webgl ? ' <span class="badge" style="--c:#fff">Playable in browser</span>' : ''}
            <h1>${esc(p.title)}</h1>
            ${p.shortDescription ? `<p class="lead">${esc(p.shortDescription)}</p>` : ''}
          </div>
        </div>
      </div>
    </section>
    <div class="container p-layout">
      <div>
        ${items.length ? `<div class="media-main" id="mediaMain"></div>` : ''}
        ${items.length > 1 ? `<div class="thumbs" id="thumbs">${items.map((it, i) => `
          <button class="thumb${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="${it.kind === 'game' ? 'Play game' : 'Media ' + (i + 1)}">
            ${it.thumb || it.src ? `<img src="${esc(it.kind === 'game' ? it.thumb : (it.thumb || it.src))}" alt="" loading="lazy">` : ''}
            ${it.kind !== 'img' ? `<span class="play">${it.kind === 'game' ? ICONS.gamepad : ICONS.play}</span>` : ''}
          </button>`).join('')}</div>` : ''}
        ${tabs.length > 1 ? `<div class="p-tabs" role="tablist">${tabs.map(([k, label], i) => `<button type="button" role="tab" class="p-tab${i === 0 ? ' active' : ''}" data-tab="${k}">${label}</button>`).join('')}</div>` : ''}
        ${tabs.map(([k, , html], i) => `<div class="prose tab-pane" data-pane="${k}"${i ? ' hidden' : ''}>${html}</div>`).join('')}
        ${(p.tags || []).length ? `<div class="tags" style="margin-top:24px">${p.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <aside class="side">
        <div class="side-card">${actions}</div>
        ${qr}
        ${specs ? `<div class="side-card"><p class="side-title">Details</p><ul class="specs">${specs}</ul></div>` : ''}
      </aside>
    </div>
    ${related.length ? `
    <section class="container" style="padding-bottom:60px">
      <div class="section-head"><div><span class="eyebrow">More work</span><h2 class="section-title" style="font-size:34px">You might also like</h2></div></div>
      <div class="grid">${related.map(projectCard).join('')}</div>
    </section>` : ''}
  `;

  if (items.length) {
    renderMain(items[0]);
    $$('.thumb').forEach(t => t.addEventListener('click', () => {
      $$('.thumb').forEach(x => x.classList.toggle('active', x === t));
      renderMain(items[+t.dataset.i]);
    }));
    $('#mediaMain').addEventListener('click', e => {
      if (e.target.matches('img.zoomable')) openLightbox(images, Math.max(0, images.indexOf(e.target.getAttribute('src'))));
    });
  }
  const pb = $('#playBtn');
  if (pb) pb.onclick = () => {
    const gi = items.findIndex(i => i.kind === 'game');
    $$('.thumb').forEach((x, i) => x.classList.toggle('active', i === gi));
    renderMain(items[gi], true);
    $('#mediaMain').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  $$('.p-tab').forEach(t => t.addEventListener('click', () => {
    $$('.p-tab').forEach(x => x.classList.toggle('active', x === t));
    $$('.tab-pane').forEach(pn => (pn.hidden = pn.dataset.pane !== t.dataset.tab));
  }));
}
init();
