/**
 * Streaming multipart/form-data parser (zero dependencies).
 * Files are streamed straight to disk, so large APKs / videos never sit in memory.
 */
const fs = require('fs');

const CRLF2 = Buffer.from('\r\n\r\n');

function parseHeaders(raw) {
  const h = {};
  raw.split('\r\n').forEach(line => {
    const i = line.indexOf(':');
    if (i > 0) h[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  });
  return h;
}
function dispositionParam(disp, key) {
  // supports name="x" and filename*=UTF-8''x
  const star = disp.match(new RegExp(`${key}\\*=([^']*)'[^']*'([^;]+)`, 'i'));
  if (star) { try { return decodeURIComponent(star[2]); } catch (_) { return star[2]; } }
  const m = disp.match(new RegExp(`(?:^|;)\\s*${key}="((?:[^"\\\\]|\\\\.)*)"`, 'i')) || disp.match(new RegExp(`(?:^|;)\\s*${key}=([^;]+)`, 'i'));
  return m ? m[1].replace(/\\"/g, '"') : null;
}

/**
 * @param req            http.IncomingMessage
 * @param opts.fileRule  (fieldname, filename) => { path } | throws Error
 * @param opts.maxFileSize bytes per file
 * @param opts.maxFiles  number of files
 * @param opts.maxFieldSize bytes per text field
 * @returns Promise<{ fields: {name: string|string[]}, files: {name: [{fieldname, originalname, path, size}]}}>
 */
function parseMultipart(req, opts) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const bm = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!/^multipart\/form-data/i.test(ct) || !bm) return reject(Object.assign(new Error('Expected multipart/form-data'), { status: 400 }));
    const delim = Buffer.from('\r\n--' + (bm[1] || bm[2]).trim());

    const fields = {}, files = {}, written = [];
    let buf = Buffer.from('\r\n'); // so the first boundary also matches "\r\n--boundary"
    let state = 'preamble';
    let part = null;
    let fileCount = 0;
    let done = false, failed = false;
    const pending = [];

    const addField = (name, val) => {
      if (name in fields) fields[name] = [].concat(fields[name], val); else fields[name] = val;
    };
    const fail = err => {
      if (failed || done) return;
      failed = true;
      if (part && part.ws) part.ws.destroy();
      written.forEach(p => fs.unlink(p, () => {}));
      req.unpipe && req.unpipe();
      req.resume(); // drain the rest
      reject(err);
    };

    // Resume the request when the current file stream drains OR finishes
    // (a stream that is ended never emits 'drain', which would stall the upload).
    const resume = () => { if (!failed) req.resume(); };

    const writePart = chunk => {
      if (!chunk.length || !part) return;
      if (part.ws) {
        part.size += chunk.length;
        if (part.size > opts.maxFileSize) throw Object.assign(new Error(`File too large (max ${Math.round(opts.maxFileSize / 1048576)} MB)`), { status: 413 });
        if (!part.ws.write(chunk)) {
          req.pause();
          part.ws.once('drain', resume);
        }
      } else {
        part.chunks.push(chunk);
        part.size += chunk.length;
        if (part.size > opts.maxFieldSize) throw Object.assign(new Error('Field too large'), { status: 413 });
      }
    };
    const endPart = () => {
      if (!part) return;
      const p = part; part = null;
      if (p.ws) {
        pending.push(new Promise((res, rej) => { p.ws.on('error', rej); p.ws.end(() => { resume(); res(); }); }));
        (files[p.name] = files[p.name] || []).push({ fieldname: p.name, originalname: p.filename, path: p.path, size: p.size });
      } else if (p.filename === null) {
        addField(p.name, Buffer.concat(p.chunks).toString('utf8'));
      }
    };

    const process = () => {
      for (;;) {
        if (state === 'preamble') {
          const i = buf.indexOf(delim);
          if (i < 0) { buf = buf.subarray(Math.max(0, buf.length - delim.length)); return; }
          buf = buf.subarray(i + delim.length); state = 'afterDelim';
        } else if (state === 'afterDelim') {
          if (buf.length < 2) return;
          if (buf[0] === 45 && buf[1] === 45) { state = 'end'; return; } // "--"
          // skip transport padding + CRLF
          const nl = buf.indexOf('\r\n');
          if (nl < 0) return;
          buf = buf.subarray(nl + 2); state = 'headers';
        } else if (state === 'headers') {
          const i = buf.indexOf(CRLF2);
          if (i < 0) { if (buf.length > 16384) throw Object.assign(new Error('Malformed multipart headers'), { status: 400 }); return; }
          const h = parseHeaders(buf.subarray(0, i).toString('utf8'));
          buf = buf.subarray(i + 4);
          const disp = h['content-disposition'] || '';
          const name = dispositionParam(disp, 'name') || '';
          const filename = dispositionParam(disp, 'filename');
          part = { name, filename, size: 0, chunks: [] };
          if (filename !== null && filename !== '') {
            if (++fileCount > opts.maxFiles) throw Object.assign(new Error('Too many files'), { status: 400 });
            const rule = opts.fileRule(name, filename); // may throw
            part.path = rule.path;
            part.ws = fs.createWriteStream(rule.path);
            part.ws.on('error', fail);
            written.push(rule.path);
          } else if (filename === '') {
            part.skip = true; // empty file input
          }
          state = 'body';
        } else if (state === 'body') {
          const i = buf.indexOf(delim);
          if (i >= 0) {
            if (!part.skip) writePart(buf.subarray(0, i));
            endPart();
            buf = buf.subarray(i + delim.length); state = 'afterDelim';
          } else {
            const keep = delim.length - 1;
            if (buf.length > keep) {
              if (!part.skip) writePart(buf.subarray(0, buf.length - keep));
              buf = Buffer.from(buf.subarray(buf.length - keep));
            }
            return;
          }
        } else return; // end
      }
    };

    req.on('data', chunk => {
      if (failed) return;
      buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
      try { process(); } catch (e) { fail(e); }
    });
    req.on('error', fail);
    req.on('aborted', () => fail(Object.assign(new Error('Upload aborted'), { status: 400 })));
    req.on('end', () => {
      if (failed) return;
      if (state !== 'end') return fail(Object.assign(new Error('Upload incomplete'), { status: 400 }));
      Promise.all(pending).then(() => { done = true; resolve({ fields, files }); }, fail);
    });
  });
}

module.exports = { parseMultipart };
