/**
 * Minimal GitHub API client used by the admin panel.
 * The repo itself is the database: data.json + uploaded files are committed
 * in ONE commit per save using the Git Data API (blobs → tree → commit → ref).
 */
class GitHubRepo {
  constructor({ owner, repo, branch, token, dir = '', api = 'https://api.github.com' }) {
    Object.assign(this, { owner, repo, branch, token, dir: dir.replace(/^\/+|\/+$/g, ''), api: api.replace(/\/+$/, '') });
  }
  get base() { return `${this.api}/repos/${this.owner}/${this.repo}`; }
  full(path) { return (this.dir ? this.dir + '/' : '') + path.replace(/^\/+/, ''); }

  /** Public URL that shows a file immediately (before GitHub Pages finishes deploying) */
  rawUrl(path) {
    if (this.api === 'https://api.github.com') return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${this.full(path)}`;
    return `${this.api}/raw/${this.owner}/${this.repo}/${this.branch}/${this.full(path)}`;
  }

  async req(method, url, body, accept = 'application/vnd.github+json') {
    const headers = { Accept: accept, Authorization: `Bearer ${this.token}`, 'X-GitHub-Api-Version': '2022-11-28' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let r;
    try {
      r = await fetch(url.startsWith('http') ? url : this.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    } catch (e) { throw new Error('Network error — check your internet connection.'); }
    if (!r.ok) {
      let msg = r.statusText;
      try { const d = await r.json(); msg = d.message || msg; } catch (_) {}
      const err = new Error(GitHubRepo.explain(r.status, msg, this.repo));
      err.status = r.status; err.raw = msg;
      throw err;
    }
    if (accept.includes('raw')) return r.text();
    return r.status === 204 ? null : r.json();
  }

  static explain(status, msg, repo = '') {
    const r = repo ? `"${repo}"` : 'this repo';
    if (status === 401) return 'Access key is wrong or expired. Create a new one and log in again.';
    if (status === 403 && /not accessible|permission/i.test(msg)) return `Your access key cannot write to ${r}. On GitHub edit the key → Repository access must include ${r} → Permissions → Contents: Read and write${repo && repo !== 'PranVeda' ? ' (and Workflows + Actions: Read and write)' : ''}.`;
    if (status === 403 && /rate limit/i.test(msg)) return 'GitHub rate limit reached — wait a few minutes and try again.';
    if (status === 404) return 'Repository or file not found. Check owner / repo / branch in Config, and that the key has access to this repo.';
    if (status === 409) return 'This repository has no commits yet (it is empty). Reload the page and try again — the admin will set it up automatically.';
    if (status === 422 && /too large|size/i.test(msg)) return 'File is too large for GitHub (max 100 MB). Use an external link instead.';
    return `GitHub error ${status}: ${msg}`;
  }

  async getRepo() { return this.req('GET', ''); }
  async getUser() { return this.req('GET', `${this.api}/user`); }

  async readText(path) {
    return this.req('GET', `/contents/${encodeURI(this.full(path))}?ref=${encodeURIComponent(this.branch)}&t=${Date.now()}`, undefined, 'application/vnd.github.raw+json');
  }
  async readJson(path) { return JSON.parse(await this.readText(path)); }

  async lastCommit() {
    const list = await this.req('GET', `/commits?sha=${encodeURIComponent(this.branch)}&per_page=1`);
    return list && list[0];
  }

  /** POST a blob with upload progress (XHR so we get progress events) */
  createBlob(base64, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.base}/git/blobs`);
      xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      xhr.setRequestHeader('Accept', 'application/vnd.github+json');
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (onProgress) xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => {
        let d = {}; try { d = JSON.parse(xhr.responseText); } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300) return resolve(d.sha);
        reject(Object.assign(new Error(GitHubRepo.explain(xhr.status, d.message || xhr.statusText, this.repo)), { status: xhr.status }));
      };
      xhr.onerror = () => reject(new Error('Network error while uploading.'));
      xhr.send(JSON.stringify({ content: base64, encoding: 'base64' }));
    });
  }

  /**
   * Commit several changes at once.
   * files: [{ path, base64 }]  — added/updated files
   * remove: [path]             — files to delete
   * progress(step, fraction, label)
   */
  /**
   * A brand-new repo created without "Add a README" has no commits, and the Git Data API
   * (blobs/trees) refuses to work on it (HTTP 409). The Contents API can create the very
   * first commit, so we use it once to "start" the repo.
   */
  async ensureInitialized() {
    if (this._ready) return;
    try {
      await this.req('GET', `/git/ref/heads/${encodeURIComponent(this.branch)}`);
    } catch (e) {
      if (e.status !== 409 && e.status !== 404) throw e;
      if (e.status === 404) {
        // branch missing: only safe to initialise if the repo really has no commits
        const empty = await this.req('GET', '/commits?per_page=1').then(l => !l || !l.length, err => err.status === 409);
        if (!empty) throw e;
      }
      await this.req('PUT', '/contents/README.md', {
        message: 'Initial commit',
        content: textToBase64(`# ${this.repo}\n`),
        branch: this.branch
      });
    }
    this._ready = true;
  }

  async commit(message, files, remove = [], progress = () => {}) {
    await this.ensureInitialized();
    const blobs = [];
    const total = files.reduce((s, f) => s + f.base64.length, 0) || 1;
    let done = 0;
    for (const f of files) {
      const sha = await this.createBlob(f.base64, frac => progress('upload', (done + frac * f.base64.length) / total, f.path));
      done += f.base64.length;
      blobs.push({ path: this.full(f.path), mode: '100644', type: 'blob', sha });
    }
    progress('commit', 1, 'Saving to GitHub…');

    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = await this.req('GET', `/git/ref/heads/${encodeURIComponent(this.branch)}`);
      const parent = await this.req('GET', `/git/commits/${ref.object.sha}`);
      const dels = remove.map(p => ({ path: this.full(p), mode: '100644', type: 'blob', sha: null }));
      let tree;
      try {
        tree = await this.req('POST', '/git/trees', { base_tree: parent.tree.sha, tree: [...blobs, ...dels] });
      } catch (e) {
        if (e.status === 422 && dels.length) { remove = []; attempt--; continue; } // a file to delete was already gone
        throw e;
      }
      const c = await this.req('POST', '/git/commits', { message, tree: tree.sha, parents: [ref.object.sha] });
      try {
        await this.req('PATCH', `/git/refs/heads/${encodeURIComponent(this.branch)}`, { sha: c.sha });
        return c;
      } catch (e) {
        if (e.status === 422 && attempt < 2) continue; // branch moved meanwhile → retry on top of it
        throw e;
      }
    }
  }
}

/* ---- helpers ---- */
function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}
const textToBase64 = str => bytesToBase64(new TextEncoder().encode(str));
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read ' + file.name));
    r.readAsDataURL(file);
  });
}
