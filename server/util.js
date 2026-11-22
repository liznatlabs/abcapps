import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Job files live inside the project by default: a snap-packaged LibreOffice cannot see the system temp folder.
export const DATA_DIR = path.resolve(process.env.FILEKIT_DATA_DIR || process.env.ABC_DATA_DIR || path.join(ROOT, 'data'));
export const JOBS_DIR = path.join(DATA_DIR, 'jobs');

export class UserError extends Error {}

/** Run a program without a shell. Rejects with the tail of stderr on failure. */
export function run(cmd, args, { cwd, timeout = 60 * 60 * 1000, okCodes = [0] } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const cap = (s, d) => (s + d).slice(-200000);
    child.stdout.on('data', (d) => { stdout = cap(stdout, d); });
    child.stderr.on('data', (d) => { stderr = cap(stderr, d); });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(`${cmd} could not be started: ${e.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (okCodes.includes(code)) return resolve({ stdout, stderr });
      const tail = (stderr.trim() || stdout.trim()).split('\n').filter(Boolean).slice(-3).join(' · ').slice(-500);
      const err = new Error(tail || `${cmd} exited with code ${code}`);
      err.stderr = stderr; err.stdout = stdout;
      reject(err);
    });
  });
}

export const ff = (args, cwd) => run('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error', ...args], { cwd });

export async function probe(file) {
  let data;
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
    data = JSON.parse(stdout);
  } catch {
    throw new UserError('This file could not be read as audio or video. It may be damaged or in an unsupported format.');
  }
  const streams = data.streams || [];
  const v = streams.find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
  const a = streams.find((s) => s.codec_type === 'audio');
  let width = v?.width || 0;
  let height = v?.height || 0;
  const rot = Math.abs(Number(v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v?.tags?.rotate ?? 0));
  if (rot === 90 || rot === 270) [width, height] = [height, width];
  const duration = Number(data.format?.duration) || Number(v?.duration) || Number(a?.duration) || 0;
  return { duration, hasVideo: !!v, hasAudio: !!a, width, height, vcodec: v?.codec_name, sampleRate: Number(a?.sample_rate) || 44100 };
}

export function safeName(name) {
  const base = path.basename(String(name || 'file')).normalize('NFC')
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').replace(/^\.+/, '').trim().slice(-120);
  return base || 'file';
}

export const extOf = (name) => path.extname(name).slice(1).toLowerCase();
export const baseOf = (name) => path.basename(name, path.extname(name));

/** A file name inside `dir` that does not exist yet. */
export async function uniquePath(dir, name) {
  const ext = name.match(/(\.tar)?\.[^.]+$/)?.[0] || '';
  const stem = name.slice(0, name.length - ext.length);
  for (let i = 0; ; i++) {
    const p = path.join(dir, i ? `${stem} (${i})${ext}` : name);
    try { await fs.access(p); } catch { return p; }
  }
}

export async function walk(dir, rel = '') {
  const out = [];
  for (const e of await fs.readdir(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(dir, r)));
    else if (e.isFile()) out.push({ name: r, size: (await fs.stat(path.join(dir, r))).size });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
}

/** Remove symlinks and other non-regular entries (used after unpacking untrusted archives). */
export async function stripSpecial(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink() || !(e.isDirectory() || e.isFile())) await fs.rm(p, { force: true });
    else if (e.isDirectory()) await stripSpecial(p);
  }
}

// LibreOffice shares one profile, so conversions run one at a time.
let officeChain = Promise.resolve();
export function office(input, target, outDir, infilter) {
  const job = officeChain.then(async () => {
    const args = ['--headless', '--norestore', '--nolockcheck'];
    if (infilter) args.push(`--infilter=${infilter}`);
    args.push('--convert-to', target, '--outdir', outDir, input);
    await run(process.env.LIBREOFFICE_BIN || 'libreoffice', args, { timeout: 10 * 60 * 1000 });
    const ext = target.split(':')[0];
    const produced = path.join(outDir, `${baseOf(input)}.${ext}`);
    try { await fs.access(produced); } catch {
      throw new UserError(`This file could not be converted to ${ext.toUpperCase()}. That combination may not be supported.`);
    }
    return produced;
  });
  officeChain = job.catch(() => {});
  return job;
}

export const fmtSize = (n) => {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < 2);
  return `${n.toFixed(n < 10 ? 2 : 1)} ${u[i]}`;
};

export const clamp = (v, lo, hi, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

/** "3-5, 9" → zero-based page indexes, in the order written. Empty input → every page. */
export function parseRanges(str, total) {
  const s = String(str || '').trim();
  if (!s) return Array.from({ length: total }, (_, i) => i);
  const out = [];
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m || (!m[1] && !m[3])) throw new UserError(`"${part.trim()}" is not a valid page or range. Use something like 3-5, 9.`);
    let a = m[1] ? Number(m[1]) : 1;
    let b = m[2] ? (m[3] ? Number(m[3]) : total) : a;
    if (a > b) [a, b] = [b, a];
    if (a < 1 || b > total) throw new UserError(`Page ${a < 1 ? a : b} does not exist — this PDF has ${total} page${total === 1 ? '' : 's'}.`);
    for (let p = a; p <= b; p++) if (!out.includes(p - 1)) out.push(p - 1);
  }
  return out;
}
