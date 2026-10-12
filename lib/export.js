/**
 * Export the portfolio as a static website into ./docs for GitHub Pages.
 *
 * GitHub Pages can't run Node.js, so the export:
 *  - copies the public pages and turns on "static mode" (data is read from data.json)
 *  - copies only the images / videos / files that published projects use
 *  - uses the external download link (e.g. GitHub Releases) when a project has one;
 *    otherwise copies the uploaded APK/package if it is under GitHub's 100 MB file limit
 */
const fs = require('fs');
const path = require('path');

const MAX_FILE = 95 * 1024 * 1024; // GitHub rejects files over 100 MB
const KEEP = new Set(['CNAME']);   // custom-domain file must survive re-exports

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return fs.statSync(dest).size;
}

function exportStatic({ root, publicDir, uploadDir, db, publicProject, publicProfile }) {
  const out = path.join(root, 'docs');
  const warnings = [];
  let files = 0, bytes = 0;
  const track = n => { files++; bytes += n; };

  // 1. Clean previous export (keep CNAME)
  fs.mkdirSync(out, { recursive: true });
  for (const name of fs.readdirSync(out)) {
    if (!KEEP.has(name)) fs.rmSync(path.join(out, name), { recursive: true, force: true });
  }

  // 2. Pages + assets, with static mode switched on
  const flag = '<script>window.PV_STATIC = true;</script>\n  <script src="js/common.js"></script>';
  for (const page of ['index.html', 'project.html']) {
    const html = fs.readFileSync(path.join(publicDir, page), 'utf8').replace('<script src="js/common.js"></script>', flag);
    fs.writeFileSync(path.join(out, page), html); track(html.length);
    if (page === 'index.html') { fs.writeFileSync(path.join(out, '404.html'), html); track(html.length); }
  }
  for (const f of ['favicon.svg', 'css/style.css', 'js/common.js', 'js/main.js', 'js/project.js']) {
    track(copy(path.join(publicDir, f), path.join(out, f)));
  }
  fs.writeFileSync(path.join(out, '.nojekyll'), ''); // tell GitHub not to run Jekyll

  // 3. Media helper: copies an "/uploads/..." file into docs/uploads/...
  const media = (url, label) => {
    if (!url || !url.startsWith('/uploads/')) return url || '';
    const src = path.normalize(path.join(root, url));
    if (!src.startsWith(uploadDir + path.sep) || !fs.existsSync(src)) { warnings.push(`${label}: file is missing, skipped.`); return ''; }
    const size = fs.statSync(src).size;
    if (size > MAX_FILE) { warnings.push(`${label}: ${(size / 1048576).toFixed(0)} MB is over GitHub's 100 MB limit, skipped. Use a YouTube link / external link instead.`); return ''; }
    track(copy(src, path.join(out, url.slice(1))));
    return url;
  };

  // 4. Projects
  const projects = db.projects
    .filter(p => p.published)
    .sort((a, b) => (b.featured - a.featured) || (b.order || 0) - (a.order || 0) || b.createdAt.localeCompare(a.createdAt))
    .map(raw => {
      const p = publicProject(raw);
      p.cover = media(p.cover, `"${p.title}" cover`);
      p.icon = media(p.icon, `"${p.title}" icon`);
      p.gallery = (p.gallery || []).map((g, i) => media(g, `"${p.title}" screenshot ${i + 1}`)).filter(Boolean);
      p.videoFile = media(p.videoFile, `"${p.title}" video`);

      // Download: external link first, then the uploaded file if small enough
      p.downloadHref = '';
      if (raw.downloadUrl) {
        p.downloadHref = raw.downloadUrl;
      } else if (raw.downloadFile) {
        const src = path.normalize(path.join(root, raw.downloadFile.url));
        if (!fs.existsSync(src)) warnings.push(`"${p.title}": download file is missing.`);
        else if (raw.downloadFile.size > MAX_FILE) {
          warnings.push(`"${p.title}": ${(raw.downloadFile.size / 1048576).toFixed(0)} MB file is too big for GitHub. Upload it to GitHub Releases and paste the link in "External download link".`);
        } else {
          const nice = `${raw.slug}${raw.version ? '-v' + raw.version.replace(/[^\w.-]/g, '') : ''}${raw.downloadFile.ext}`;
          track(copy(src, path.join(out, 'uploads', 'files', nice)));
          p.downloadHref = 'uploads/files/' + nice;
        }
      }
      p.hasDownload = !!p.downloadHref;
      delete p.downloadUrl;
      return p;
    });

  // 5. Profile + stats
  const profile = { ...publicProfile(), avatar: media(db.profile.avatar, 'Profile photo') };
  if (profile.resume) {
    const url = media(profile.resume.url, 'Resume');
    profile.resume = url ? { ...profile.resume, url } : null;
  }
  const stats = {
    games: projects.filter(p => p.type === 'game').length,
    plugins: projects.filter(p => p.type === 'plugin').length,
    assets: projects.filter(p => p.type === 'asset').length,
    downloads: projects.reduce((s, p) => s + (p.downloads || 0), 0)
  };
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), profile, projects, stats }, null, 1);
  fs.writeFileSync(path.join(out, 'data.json'), data); track(data.length);

  if (bytes > 900 * 1048576) warnings.push(`Export is ${(bytes / 1048576).toFixed(0)} MB. GitHub Pages sites should stay under 1 GB — move big APKs to GitHub Releases.`);
  if (!profile.email) warnings.push('No email in Profile — the contact form on GitHub Pages needs it (it opens the visitor\'s email app).');

  return { ok: true, folder: 'docs', projects: projects.length, files, sizeMB: +(bytes / 1048576).toFixed(1), warnings };
}

module.exports = { exportStatic };
