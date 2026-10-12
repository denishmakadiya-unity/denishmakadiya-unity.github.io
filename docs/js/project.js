/* Project detail page */
const PLATFORM_LABEL = { android: 'Android', ios: 'iOS', windows: 'Windows', mac: 'macOS', linux: 'Linux', webgl: 'WebGL' };

function mediaItems(p) {
  const items = [];
  const yt = youtubeId(p.youtubeUrl);
  if (yt) items.push({ kind: 'yt', id: yt, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` });
  if (p.videoFile) items.push({ kind: 'video', src: asset(p.videoFile), thumb: asset(p.cover || (p.gallery || [])[0] || '') });
  if (p.cover) items.push({ kind: 'img', src: asset(p.cover) });
  (p.gallery || []).forEach(src => items.push({ kind: 'img', src: asset(src) }));
  return items;
}

function renderMain(item) {
  const box = $('#mediaMain');
  if (!item) { box.style.display = 'none'; return; }
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

async function init() {
  initNav();
  const lb = $('#lightbox');
  $('.lb-close', lb).innerHTML = ICONS.close; $('.lb-prev', lb).innerHTML = ICONS.left; $('.lb-next', lb).innerHTML = ICONS.right;

  const slug = new URLSearchParams(location.search).get('slug') || '';
  const app = $('#app');
  let p, profile, all;
  try {
    [p, profile, all] = await Promise.all([api('/api/projects/' + encodeURIComponent(slug)), api('/api/profile'), api('/api/projects')]);
  } catch (e) {
    api('/api/profile').then(setBrand).catch(() => {});
    app.innerHTML = `<div class="notfound container"><h1>404</h1><p style="color:var(--muted)">This project doesn't exist or was removed.</p><a class="btn btn-primary" href="index.html#work">See all projects</a></div>`;
    return;
  }
  setBrand(profile);
  document.title = `${p.title} — ${profile.brand}`;

  const items = mediaItems(p);
  const images = items.filter(i => i.kind === 'img').map(i => i.src);
  const color = { game: 'var(--c-game)', plugin: 'var(--c-plugin)', asset: 'var(--c-asset)' }[p.type];

  // Action buttons
  let actions = '';
  if (p.hasDownload) {
    const label = p.downloadName === 'APK' ? 'Download APK' : `Download ${p.downloadName}`;
    actions += `<a class="btn btn-primary" ${downloadAttrs(p)}>${ICONS.download} ${esc(label)}</a>`;
    const meta = [p.downloadSize ? `<span>${esc(fmtSize(p.downloadSize))}</span>` : '', !STATIC ? `<span>${fmtNum(p.downloads)} downloads</span>` : ''].join('');
    if (meta.trim()) actions += `<div class="dl-meta">${meta}</div>`;
  }
  if (p.playStoreUrl) actions += `<a class="play-badge" href="${esc(p.playStoreUrl)}" target="_blank" rel="noopener" style="margin-top:12px">${ICONS.googleplay}<span><small>Get it on</small><b>Google Play</b></span></a>`;
  if (p.assetStoreUrl) actions += `<a class="btn" href="${esc(p.assetStoreUrl)}" target="_blank" rel="noopener" style="margin-top:10px">${ICONS.unity} Unity Asset Store</a>`;
  if (p.githubUrl) actions += `<a class="btn" href="${esc(p.githubUrl)}" target="_blank" rel="noopener" style="margin-top:10px">${ICONS.github} GitHub</a>`;
  if (p.otherUrl) actions += `<a class="btn" href="${esc(p.otherUrl)}" target="_blank" rel="noopener" style="margin-top:10px">${ICONS.ext} Visit link</a>`;
  if (!actions) actions = `<a class="btn btn-primary" href="index.html#contact">Ask about this project</a>`;

  const specs = [
    ['Type', TYPE_LABEL[p.type]],
    ['Version', p.version],
    ['Price', p.price],
    ['Platforms', (p.platforms || []).map(x => PLATFORM_LABEL[x.toLowerCase()] || x).join(', ')],
    ['Unity', p.unityVersion],
    ['Updated', fmtDate(p.updatedAt || p.createdAt)]
  ].filter(([, v]) => v).map(([k, v]) => `<li><span>${k}</span><b>${esc(v)}</b></li>`).join('');

  const related = all.filter(x => x.slug !== p.slug).sort((a, b) => (b.type === p.type) - (a.type === p.type)).slice(0, 3);

  app.innerHTML = `
    <section class="p-hero">
      <div class="p-hero-bg">${p.cover ? `<img src="${esc(asset(p.cover))}" alt="">` : ''}</div>
      <div class="container">
        <a class="back" href="index.html#work">${ICONS.back} All projects</a>
        <div class="p-head">
          ${p.icon ? `<img class="p-icon" src="${esc(asset(p.icon))}" alt="">` : ''}
          <div>
            <span class="badge" style="--c:${color}">${esc(TYPE_LABEL[p.type])}</span>
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
          <button class="thumb${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Media ${i + 1}">
            ${it.thumb || it.src ? `<img src="${esc(it.thumb || it.src)}" alt="" loading="lazy">` : ''}
            ${it.kind !== 'img' ? `<span class="play">${ICONS.play}</span>` : ''}
          </button>`).join('')}</div>` : ''}
        <div class="prose">${miniMd(p.description) || '<p style="color:var(--dim)">No description yet.</p>'}</div>
        ${(p.tags || []).length ? `<div class="tags" style="margin-top:24px">${p.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <aside class="side">
        <div class="side-card">${actions}</div>
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
}
init();
