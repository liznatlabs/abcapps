import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, DATA_DIR, JOBS_DIR, UserError, run, safeName, extOf, baseOf, walk } from './util.js';
import { media } from './media.js';
import { docs, pdfPreview } from './docs.js';
import { toolById, INTERNAL, BRAND } from '../shared/catalog.js';

const PORT = Number(process.env.PORT) || 5123;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 4096;
const KEEP_HOURS = Number(process.env.KEEP_HOURS) || 2;
const MAX_PARALLEL = Number(process.env.MAX_PARALLEL) || 3;

const handlers = { ...media, ...docs };
const UPLOADS = path.join(DATA_DIR, 'uploads');
await fs.mkdir(JOBS_DIR, { recursive: true });
await fs.mkdir(UPLOADS, { recursive: true });

const upload = multer({ dest: UPLOADS, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 101, fieldSize: 2 * 1024 * 1024 } });
const fields = upload.fields([{ name: 'files', maxCount: 100 }, { name: 'extra', maxCount: 1 }]);

// Heavy jobs wait their turn so a burst of requests cannot exhaust the machine.
let active = 0;
const waiting = [];
const acquire = () => new Promise((res) => { if (active < MAX_PARALLEL) { active++; res(); } else waiting.push(res); });
const release = () => { const next = waiting.shift(); if (next) next(); else active--; };

const JOB_ID = /^[a-f0-9]{32}$/;
async function newJob() {
  const id = crypto.randomBytes(16).toString('hex');
  const dir = path.join(JOBS_DIR, id);
  for (const d of ['in', 'work', 'out']) await fs.mkdir(path.join(dir, d), { recursive: true });
  return { id, dir, in: path.join(dir, 'in'), work: path.join(dir, 'work'), out: path.join(dir, 'out') };
}

/** Move multer's temp files into the job folder under their (sanitised) original names. */
async function adopt(job, list = [], prefix = 'f') {
  const out = [];
  for (const [i, f] of list.entries()) {
    const name = safeName(Buffer.from(f.originalname, 'latin1').toString('utf8'));
    const dir = path.join(job.in, `${prefix}${i}`);
    await fs.mkdir(dir, { recursive: true });
    const p = path.join(dir, name);
    await fs.rename(f.path, p);
    out.push({ path: p, name, ext: extOf(name), base: baseOf(name) || 'file', size: f.size });
  }
  return out;
}
const discard = (req) => Promise.all(Object.values(req.files || {}).flat().map((f) => fs.rm(f.path, { force: true })));

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use(express.static(path.join(ROOT, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true, brand: BRAND, maxUploadMb: MAX_UPLOAD_MB, keepHours: KEEP_HOURS }));

const wrap = (fn) => (req, res) => fn(req, res).catch(async (err) => {
  await discard(req).catch(() => {});
  if (err instanceof UserError) return res.status(400).json({ error: err.message });
  console.error(`[${new Date().toISOString()}] ${req.path}:`, err.message);
  res.status(500).json({ error: 'Something went wrong while processing this file. It may be damaged or in a format this tool cannot read.', detail: String(err.message).slice(0, 300) });
});

app.post('/api/run/:tool', fields, wrap(async (req, res) => {
  const tool = toolById[req.params.tool] || INTERNAL[req.params.tool];
  const handler = handlers[req.params.tool];
  if (!tool || !handler) throw new UserError('Unknown tool.');
  let opts = {};
  try { opts = JSON.parse(req.body.options || '{}'); } catch { throw new UserError('The options could not be read.'); }
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) opts = {};
  const uploaded = req.files?.files || [];
  const needsFile = tool.kind !== 'text';
  if (needsFile && uploaded.length < (tool.min || 1)) throw new UserError(tool.min > 1 ? `Add at least ${tool.min} files.` : 'Choose a file first.');
  if (!tool.multiple && uploaded.length > 1) throw new UserError('This tool works on one file at a time.');

  const job = await newJob();
  const files = await adopt(job, uploaded);
  const [extra] = await adopt(job, req.files?.extra, 'x');
  const notes = [];
  await acquire();
  const started = Date.now();
  try {
    await handler({ files, extra, opts, out: job.out, work: job.work, note: (m) => notes.push(m) });
  } catch (err) {
    await fs.rm(job.dir, { recursive: true, force: true });
    throw err;
  } finally { release(); }
  await fs.rm(job.in, { recursive: true, force: true });
  await fs.rm(job.work, { recursive: true, force: true });
  const results = await walk(job.out);
  if (!results.length) { await fs.rm(job.dir, { recursive: true, force: true }); throw new UserError('Nothing was produced. Check the file and your settings, then try again.'); }
  res.json({
    job: job.id, notes, seconds: Math.round((Date.now() - started) / 100) / 10,
    inputSize: files.reduce((s, f) => s + f.size, 0),
    files: results.map((r) => ({ ...r, url: `/api/dl/${job.id}/${r.name.split('/').map(encodeURIComponent).join('/')}` })),
  });
}));

app.post('/api/pdf-preview', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw new UserError('Choose a PDF first.');
  const job = await newJob();
  const [file] = await adopt(job, [req.file]);
  try {
    const { pages, thumbs } = await pdfPreview(file, job.out);
    await fs.rm(job.in, { recursive: true, force: true });
    res.json({ pages, thumbs: thumbs.map((t) => `/api/dl/${job.id}/${t}?inline=1`) });
  } catch (err) { await fs.rm(job.dir, { recursive: true, force: true }); throw err; }
}));

function jobOut(id) {
  if (!JOB_ID.test(id)) throw new UserError('Not found.');
  return path.join(JOBS_DIR, id, 'out');
}

app.get('/api/dl/:job/*', wrap(async (req, res) => {
  const root = jobOut(req.params.job);
  const target = path.resolve(root, req.params[0]);
  if (!target.startsWith(root + path.sep)) return res.status(404).end();
  try { if (!(await fs.stat(target)).isFile()) throw new Error(); } catch { return res.status(404).json({ error: 'This file has expired. Run the tool again.' }); }
  if (req.query.inline) return res.sendFile(target, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  res.download(target, path.basename(target));
}));

app.get('/api/zip/:job', wrap(async (req, res) => {
  const root = jobOut(req.params.job);
  const zip = path.join(root, '..', 'all.zip');
  try { await fs.access(root); } catch { return res.status(404).json({ error: 'These files have expired. Run the tool again.' }); }
  try { await fs.access(zip); } catch { await run('7z', ['a', '-tzip', '-mx=1', '-bd', '-y', zip, '.'], { cwd: root }); }
  res.download(zip, `${BRAND.name.toLowerCase().replace(/\s+/g, '-')}-files.zip`);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
// every other address is a page of the single-page app (e.g. /compress-pdf)
app.get('*', (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  discard(req).catch(() => {});
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `That file is too large. The limit is ${MAX_UPLOAD_MB >= 1024 ? `${MAX_UPLOAD_MB / 1024} GB` : `${MAX_UPLOAD_MB} MB`}.` });
  if (err?.code?.startsWith?.('LIMIT_')) return res.status(400).json({ error: 'Too many files were sent at once (100 at most).' });
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

// Uploaded and processed files are removed automatically.
async function sweep() {
  const cutoff = Date.now() - KEEP_HOURS * 3600 * 1000;
  for (const dir of [JOBS_DIR, UPLOADS]) {
    for (const name of await fs.readdir(dir).catch(() => [])) {
      const p = path.join(dir, name);
      const st = await fs.stat(p).catch(() => null);
      if (st && st.mtimeMs < cutoff) await fs.rm(p, { recursive: true, force: true }).catch(() => {});
    }
  }
}
sweep();
setInterval(sweep, 15 * 60 * 1000).unref();

const server = app.listen(PORT, HOST, () => console.log(`${BRAND.name} by ${BRAND.by} is running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
server.requestTimeout = 0; // long uploads and long encodes
server.headersTimeout = 0;
server.timeout = 0;
