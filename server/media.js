// Video and audio tools, all built on ffmpeg.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ff, probe, run, UserError, uniquePath, clamp, baseOf } from './util.js';
import { EQ_BANDS, TTS_VOICES } from '../shared/catalog.js';

const EVEN = 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p';
let fontFile;
async function font() {
  if (!fontFile) fontFile = (await run('fc-match', ['-f', '%{file}', 'sans:bold'])).stdout.trim();
  return fontFile;
}

const pick = (v, allowed, def) => (allowed.includes(String(v)) ? String(v) : def);
const VFMT = ['mp4', 'mkv', 'mov', 'webm'];
const AFMT = ['mp3', 'm4a', 'm4r', 'flac', 'wav', 'ogg', 'opus', 'mp2'];

function vEnc(fmt, { crf = 22, codec = 'h264', audio = true } = {}) {
  const a = audio ? null : ['-an'];
  switch (fmt) {
    case 'webm': return ['-c:v', 'libvpx-vp9', '-crf', String(Math.min(50, crf + 10)), '-b:v', '0', '-row-mt', '1', '-cpu-used', '4', ...(a || ['-c:a', 'libopus', '-b:a', '128k'])];
    case 'avi': return ['-c:v', 'mpeg4', '-q:v', String(clamp(Math.round((crf - 14) / 2), 2, 12, 4)), ...(a || ['-c:a', 'libmp3lame', '-b:a', '192k'])];
    case 'flv': return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p', ...(a || ['-c:a', 'aac', '-b:a', '160k', '-ar', '44100'])];
    case '3gp': return ['-c:v', 'libx264', '-profile:v', 'baseline', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p', ...(a || ['-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-ac', '2'])];
    case 'mpg': return ['-c:v', 'mpeg2video', '-q:v', String(clamp(Math.round((crf - 14) / 2), 2, 12, 4)), ...(a || ['-c:a', 'mp2', '-b:a', '192k'])];
    default: {
      const v = codec === 'h265'
        ? ['-c:v', 'libx265', '-preset', 'fast', '-crf', String(crf + 4), '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p']
        : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p'];
      return [...v, ...(a || ['-c:a', 'aac', '-b:a', '192k']), ...(fmt === 'mkv' ? [] : ['-movflags', '+faststart'])];
    }
  }
}

function aEnc(fmt, kbps = 192) {
  const b = `${kbps}k`;
  switch (fmt) {
    case 'm4a': return ['-c:a', 'aac', '-b:a', b];
    case 'm4r': return ['-c:a', 'aac', '-b:a', b, '-f', 'ipod'];
    case 'flac': return ['-c:a', 'flac'];
    case 'wav': return ['-c:a', 'pcm_s16le'];
    case 'ogg': return ['-c:a', 'libvorbis', '-b:a', b];
    case 'opus': return ['-c:a', 'libopus', '-b:a', `${Math.min(kbps, 256)}k`];
    case 'mp2': return ['-c:a', 'mp2', '-b:a', b];
    default: return ['-c:a', 'libmp3lame', '-b:a', b];
  }
}

const VOICE_ENHANCE = 'highpass=f=90,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=3,equalizer=f=3200:t=q:w=1.2:g=3';
const AUDIO_FX = {
  echo: 'aecho=0.8:0.85:180:0.35',
  hall: 'aecho=0.8:0.9:60|130|260:0.4|0.3|0.2',
  deep: 'rubberband=pitch=0.75',
  chipmunk: 'rubberband=pitch=1.45',
  phone: 'highpass=f=400,lowpass=f=3200,volume=1.6',
  radio: 'highpass=f=250,lowpass=f=4500,acompressor=threshold=-24dB:ratio=6:makeup=6',
  robot: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75",
};

function atempo(speed) {
  const parts = [];
  let s = speed;
  while (s > 2) { parts.push('atempo=2'); s /= 2; }
  while (s < 0.5) { parts.push('atempo=0.5'); s /= 0.5; }
  parts.push(`atempo=${s.toFixed(4)}`);
  return parts.join(',');
}

/** Normalise a {start,end} selection against the real duration. */
function section(opts, duration, key = 'range') {
  const r = opts[key] || {};
  const start = clamp(r.start, 0, Math.max(0, duration), 0);
  let end = r.end == null || r.end === '' ? duration : clamp(r.end, 0, duration || Infinity, duration);
  if (!end || end <= start) end = duration;
  return { start, end, length: Math.max(0, end - start), whole: start <= 0.01 && end >= duration - 0.01 };
}

function rect(opts, def = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }) {
  const r = { ...def, ...(opts.rect || {}) };
  const x = clamp(r.x, 0, 0.99, def.x);
  const y = clamp(r.y, 0, 0.99, def.y);
  return { x, y, w: clamp(r.w, 0.01, 1 - x, def.w), h: clamp(r.h, 0.01, 1 - y, def.h) };
}

const outFile = (ctx, file, suffix, ext) => uniquePath(ctx.out, `${file.base}${suffix}.${ext}`);

/** One input video → one output, with optional video/audio filter chains. */
async function simpleVideo(ctx, suffix, { vf = [], af = [], pre = [], noAudio = false } = {}) {
  const file = ctx.files[0];
  const info = await probe(file.path);
  if (!info.hasVideo) throw new UserError('This file has no video track.');
  const fmt = pick(ctx.opts.format, VFMT, 'mp4');
  const args = [...pre, '-i', file.path, '-vf', [...vf, EVEN].join(',')];
  const audio = info.hasAudio && !noAudio;
  if (audio && af.length) args.push('-af', af.join(','));
  args.push(...vEnc(fmt, { audio }), await outFile(ctx, file, suffix, fmt));
  await ff(args, ctx.work);
}

async function simpleAudio(ctx, suffix, af = [], pre = []) {
  const file = ctx.files[0];
  const info = await probe(file.path);
  if (!info.hasAudio) throw new UserError('This file has no audio track.');
  const fmt = pick(ctx.opts.format, AFMT, 'mp3');
  const args = [...pre, '-i', file.path, '-vn'];
  if (af.length) args.push('-af', af.join(','), ...(fmt === 'opus' ? [] : ['-ar', String(info.sampleRate)]));
  args.push(...aEnc(fmt), await outFile(ctx, file, suffix, fmt));
  await ff(args, ctx.work);
}

async function drawtext(ctx, t, name = 'caption.txt') {
  const text = String(t.text || '').replace(/\r/g, '').slice(0, 2000);
  if (!text.trim()) throw new UserError('Type the text you want to add.');
  await fs.writeFile(path.join(ctx.work, name), text);
  const frac = clamp(t.size, 2, 20, 6) / 100;
  const color = /^#[0-9a-fA-F]{6}$/.test(t.color || '') ? `0x${t.color.slice(1)}` : 'white';
  const m = 'h*0.05';
  const pos = {
    top: ['(w-text_w)/2', m], bottom: ['(w-text_w)/2', `h-text_h-${m}`], center: ['(w-text_w)/2', '(h-text_h)/2'],
    'top-left': [m, m], 'top-right': [`w-text_w-${m}`, m], 'bottom-left': [m, `h-text_h-${m}`], 'bottom-right': [`w-text_w-${m}`, `h-text_h-${m}`],
  }[t.position] || ['(w-text_w)/2', `h-text_h-${m}`];
  let f = `drawtext=fontfile='${await font()}':textfile=${name}:expansion=none:fontsize=h*${frac.toFixed(4)}:fontcolor=${color}:x=${pos[0]}:y=${pos[1]}:line_spacing=6`;
  if (t.box) f += ':box=1:boxcolor=black@0.55:boxborderw=14';
  if (t.start != null && t.end != null) f += `:enable='between(t,${t.start.toFixed(3)},${t.end.toFixed(3)})'`;
  return f;
}

/** Build a concat graph: every clip trimmed, scaled to one frame size, with silent audio where a clip has none. */
async function concatGraph(clips, { size, fit }) {
  const infos = await Promise.all(clips.map((c) => probe(c.path)));
  infos.forEach((i, n) => { if (!i.hasVideo) throw new UserError(`"${clips[n].name}" has no video track.`); });
  let [W, H] = /^\d+x\d+$/.test(size || '') ? size.split('x').map(Number) : [infos[0].width, infos[0].height];
  W -= W % 2; H -= H % 2;
  const scale = fit === 'fill'
    ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`
    : `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`;
  const inputs = [];
  const graph = [];
  let total = 0;
  clips.forEach((c, i) => {
    const d = infos[i].duration;
    const s = clamp(c.start, 0, d, 0);
    const e = c.end == null ? d : clamp(c.end, s, d, d);
    const len = Math.max(0.05, (e > s ? e : d) - s);
    total += len;
    inputs.push('-i', c.path);
    graph.push(`[${i}:v]trim=start=${s}:duration=${len},setpts=PTS-STARTPTS,${scale},setsar=1,fps=30,format=yuv420p[v${i}]`);
    graph.push(infos[i].hasAudio && !c.mute
      ? `[${i}:a]atrim=start=${s}:duration=${len},asetpts=PTS-STARTPTS,aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`
      : `anullsrc=r=44100:cl=stereo,atrim=duration=${len},aformat=sample_fmts=fltp[a${i}]`);
  });
  graph.push(`${clips.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${clips.length}:v=1:a=1[v][a]`);
  return { inputs, graph, total };
}

export const media = {
  // ───────── video ─────────
  async 'trim-video'(ctx) {
    const file = ctx.files[0];
    const info = await probe(file.path);
    const sec = section(ctx.opts, info.duration);
    const fmt = pick(ctx.opts.format, VFMT, 'mp4');
    const out = await outFile(ctx, file, '-trimmed', fmt);
    if (ctx.opts.mode !== 'remove') {
      return ff(['-ss', String(sec.start), '-t', String(sec.length), '-i', file.path, '-vf', EVEN, ...vEnc(fmt, { audio: info.hasAudio }), out], ctx.work);
    }
    if (sec.whole) throw new UserError('The selection covers the whole video — nothing would be left.');
    const parts = [];
    if (sec.start > 0.01) parts.push([0, sec.start]);
    if (sec.end < info.duration - 0.01) parts.push([sec.end, info.duration]);
    const g = [];
    parts.forEach(([s, e], i) => {
      g.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
      if (info.hasAudio) g.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
    });
    g.push(`${parts.map((_, i) => `[v${i}]`).join('')}concat=n=${parts.length}:v=1:a=0,${EVEN}[v]`);
    const maps = ['-map', '[v]'];
    if (info.hasAudio) { g.push(`${parts.map((_, i) => `[a${i}]`).join('')}concat=n=${parts.length}:v=0:a=1[a]`); maps.push('-map', '[a]'); }
    return ff(['-i', file.path, '-filter_complex', g.join(';'), ...maps, ...vEnc(fmt, { audio: info.hasAudio }), out], ctx.work);
  },

  async 'merge-videos'(ctx) {
    const fmt = pick(ctx.opts.format, VFMT, 'mp4');
    const { inputs, graph } = await concatGraph(ctx.files, { size: ctx.opts.size, fit: ctx.opts.fit });
    await ff([...inputs, '-filter_complex', graph.join(';'), '-map', '[v]', '-map', '[a]', ...vEnc(fmt), await uniquePath(ctx.out, `merged.${fmt}`)], ctx.work);
  },

  /** Renders a timeline project: layered clips, images and (pre-rendered) text over a canvas, plus a mixed soundtrack. */
  async 'video-editor'(ctx) {
    const p = ctx.opts.project;
    if (!p || !Array.isArray(p.items) || !p.items.length) throw new UserError('Add at least one clip to the timeline.');
    const fmt = pick(ctx.opts.format, VFMT, 'mp4');
    const crf = Number(pick(ctx.opts.quality, ['18', '22', '27'], '22'));
    const side = Number(pick(ctx.opts.height, ['360', '480', '720', '1080', '1440', '2160'], '720'));
    const ar = clamp(p.canvas?.w, 16, 7680, 1920) / clamp(p.canvas?.h, 16, 7680, 1080);
    // the preset names the shorter side, so a vertical 720p project is 720×1280
    const even = (n) => Math.max(2, Math.round(n / 2) * 2);
    const [W, H] = ar >= 1 ? [even(side * ar), even(side)] : [even(side), even(side / ar)];
    const bg = /^#[0-9a-fA-F]{6}$/.test(p.canvas?.bg || '') ? `0x${p.canvas.bg.slice(1)}` : 'black';
    const items = p.items.slice(0, 300).map((it) => ({
      type: pick(it.type, ['video', 'image', 'audio', 'text'], 'video'), file: Number(it.file), track: Number(it.track) || 0,
      start: clamp(it.start, 0, 6 * 3600, 0), dur: clamp(it.dur, 0.03, 6 * 3600, 1), in: clamp(it.in, 0, 24 * 3600, 0), speed: clamp(it.speed, 0.25, 4, 1),
      x: clamp(it.x, -2, 3, 0.5), y: clamp(it.y, -2, 3, 0.5), w: clamp(it.w, 0.005, 10, 1), h: clamp(it.h, 0.005, 10, 1), rot: clamp(it.rot, -360, 360, 0),
      flipH: !!it.flipH, flipV: !!it.flipV, opacity: clamp(it.opacity, 0, 100, 100) / 100, muted: !!it.muted, volume: clamp(it.volume, 0, 400, 100) / 100,
      fadeIn: clamp(it.fadeIn, 0, 60, 0), fadeOut: clamp(it.fadeOut, 0, 60, 0),
      crop: { x: clamp(it.crop?.x, 0, 0.98, 0), y: clamp(it.crop?.y, 0, 0.98, 0), w: clamp(it.crop?.w, 0.02, 1, 1), h: clamp(it.crop?.h, 0.02, 1, 1) },
      // looks: a 3×4 colour matrix worked out by the editor, blur, mask picture, colour key
      cm: Array.isArray(it.cm) && it.cm.length === 12 ? it.cm.map((v) => clamp(v, -8, 8, 0)) : null,
      blur: clamp(it.blur, 0, 60, 0), mask: Number.isInteger(it.maskFile) ? it.maskFile : null,
      key: pick(it.key, ['green', 'blue'], ''), keyStrength: clamp(it.keyStrength, 5, 80, 30),
      vFadeIn: clamp(it.fx?.fadeIn, 0, 30, 0), vFadeOut: clamp(it.fx?.fadeOut, 0, 30, 0), zoom: pick(it.fx?.zoom, ['in', 'out'], ''), vignette: !!it.fx?.vignette,
      enhance: !!it.enhance, afx: pick(it.afx, Object.keys(AUDIO_FX), ''),
    })).sort((a, b) => a.track - b.track);
    const total = Math.max(...items.map((i) => i.start + i.dur));
    const probes = new Map();
    const info = async (f) => { if (!probes.has(f.path)) probes.set(f.path, await probe(f.path)); return probes.get(f.path); };
    const n3 = (v) => Number(v.toFixed(4));
    const inputs = [];
    const g = [`color=c=${bg}:s=${W}x${H}:r=30:d=${n3(total)}[b0]`];
    const sounds = [];
    let base = 0;
    let k = 0; // next input index
    for (const it of items) {
      const f = ctx.files[it.file];
      if (!f) throw new UserError('The project refers to a file that was not uploaded.');
      const visual = it.type !== 'audio';
      const still = it.type === 'image' || it.type === 'text';
      const src = n3(it.dur * it.speed);
      const end = n3(it.start + it.dur);
      const me = k++;
      let meta = null;
      if (still) inputs.push(...(f.ext === 'gif' ? ['-ignore_loop', '0'] : ['-loop', '1', '-framerate', '30']), '-t', String(n3(it.dur)), '-i', f.path);
      else {
        meta = await info(f);
        if (visual && !meta.hasVideo) throw new UserError(`"${f.name}" has no video track.`);
        inputs.push('-ss', String(n3(it.in)), '-t', String(src), '-i', f.path); // seek on input: fast even with many cuts of one long file
      }
      if (visual) {
        const c = it.crop;
        const pw = Math.max(2, Math.round(it.w * W)); const ph = Math.max(2, Math.round(it.h * H));
        const chain = [still ? `setpts=PTS-STARTPTS+${n3(it.start)}/TB` : `setpts=(PTS-STARTPTS)/${it.speed}+${n3(it.start)}/TB`];
        if (c.w < 0.999 || c.h < 0.999) chain.push(`crop=iw*${n3(Math.min(c.w, 1 - c.x))}:ih*${n3(Math.min(c.h, 1 - c.y))}:iw*${n3(c.x)}:ih*${n3(c.y)}`);
        if (it.flipH) chain.push('hflip');
        if (it.flipV) chain.push('vflip');
        chain.push(`scale=${pw}:${ph}`);
        if (it.vignette) chain.push('format=yuv444p', 'vignette=angle=PI/4.5');
        if (it.key) chain.push(`chromakey=${it.key === 'green' ? '0x00ff00' : '0x0000ff'}:${n3(0.08 + it.keyStrength / 250)}:0.08`);
        chain.push('format=rgba');
        if (it.cm) { const m = it.cm.map(n3); chain.push(`colorchannelmixer=rr=${m[0]}:rg=${m[1]}:rb=${m[2]}:ra=${m[3]}:gr=${m[4]}:gg=${m[5]}:gb=${m[6]}:ga=${m[7]}:br=${m[8]}:bg=${m[9]}:bb=${m[10]}:ba=${m[11]}`); }
        if (it.blur > 0.05) chain.push(`gblur=sigma=${n3((it.blur * H) / 1080)}:planes=7`);
        let label = `[${me}:v]${chain.join(',')}`;
        const mf = it.mask != null ? ctx.files[it.mask] : null;
        if (mf) { // a white-on-black picture of the mask shape becomes the clip's transparency
          const mi = k++;
          inputs.push('-i', mf.path);
          g.push(`[${mi}:v]scale=${pw}:${ph},format=gray[mk${me}]`);
          if (it.key) { g.push(`${label},split[c${me}][d${me}]`, `[d${me}]alphaextract[ka${me}]`, `[ka${me}][mk${me}]blend=all_mode=multiply[am${me}]`); label = `[c${me}][am${me}]alphamerge`; } else { g.push(`${label}[c${me}]`); label = `[c${me}][mk${me}]alphamerge`; }
        }
        const tail = [];
        const fi = Math.min(it.vFadeIn, it.dur / 2); const fo = Math.min(it.vFadeOut, it.dur / 2);
        if (fi > 0) tail.push(`fade=t=in:st=${n3(it.start)}:d=${n3(fi)}:alpha=1`);
        if (fo > 0) tail.push(`fade=t=out:st=${n3(end - fo)}:d=${n3(fo)}:alpha=1`);
        if (it.zoom) { // slow zoom about the clip's centre, growing by 20% over its length
          const prog = `(t-${n3(it.start)})/${n3(it.dur)}`;
          const z = it.zoom === 'in' ? `(1+0.2*${prog})` : `(1.2-0.2*${prog})`;
          tail.push(`scale=w='2*trunc(${pw}*${z}/2)':h='2*trunc(${ph}*${z}/2)':eval=frame`);
        }
        if (Math.abs(it.rot % 360) > 0.01) { const a = n3((it.rot * Math.PI) / 180); tail.push(`rotate=${a}:c=none:ow=rotw(${a}):oh=roth(${a})`); }
        if (it.opacity < 0.999) tail.push(`colorchannelmixer=aa=${n3(it.opacity)}`);
        g.push(`${label}${tail.length ? `,${tail.join(',')}` : mf ? '' : ''}[v${me}]`);
        g.push(`[b${base}][v${me}]overlay=x=${n3(it.x * W)}-w/2:y=${n3(it.y * H)}-h/2:enable='between(t,${n3(it.start)},${end})':eof_action=pass[b${base + 1}]`);
        base++;
      }
      if (!still && meta.hasAudio && !it.muted && it.volume > 0) {
        const chain = ['asetpts=PTS-STARTPTS'];
        if (it.speed !== 1) chain.push(atempo(it.speed));
        chain.push('aresample=44100', 'aformat=sample_fmts=fltp:channel_layouts=stereo');
        if (it.enhance) chain.push(VOICE_ENHANCE);
        if (it.afx) chain.push(AUDIO_FX[it.afx], 'aresample=44100', 'aformat=sample_fmts=fltp:channel_layouts=stereo');
        chain.push(`volume=${n3(it.volume)}`);
        const fi = Math.min(it.fadeIn, it.dur / 2); const fo = Math.min(it.fadeOut, it.dur / 2);
        if (fi > 0) chain.push(`afade=t=in:st=0:d=${n3(fi)}`);
        if (fo > 0) chain.push(`afade=t=out:st=${n3(it.dur - fo)}:d=${n3(fo)}`);
        chain.push(`atrim=duration=${n3(it.dur)}`, `adelay=${Math.round(it.start * 1000)}:all=1`);
        g.push(`[${me}:a]${chain.join(',')}[a${me}]`);
        sounds.push(`[a${me}]`);
      } else if (it.type === 'audio' && !meta.hasAudio) throw new UserError(`"${f.name}" has no audio track.`);
    }
    g.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${n3(total)}[sil]`);
    g.push(`[sil]${sounds.join('')}amix=inputs=${sounds.length + 1}:duration=first:normalize=0,alimiter=limit=0.97[a]`);
    await fs.writeFile(path.join(ctx.work, 'graph.txt'), g.join(';\n'));
    const name = String(p.name || 'project').replace(/[^\w .-]+/g, '_').trim().slice(0, 80) || 'project';
    await ff([...inputs, '-filter_complex_script', 'graph.txt', '-map', `[b${base}]`, '-map', '[a]', '-t', String(n3(total)), ...vEnc(fmt, { crf }), await uniquePath(ctx.out, `${name}.${fmt}`)], ctx.work);
  },

  /** Editor helper: one stretch of a clip, played backwards. */
  async 'clip-reverse'(ctx) {
    const file = ctx.files[0];
    const meta = await probe(file.path);
    const start = clamp(ctx.opts.start, 0, Math.max(0, meta.duration - 0.05), 0);
    const dur = clamp(ctx.opts.dur, 0.1, meta.duration - start, meta.duration - start);
    if (dur > 180) throw new UserError('Reverse works on clips up to 3 minutes long. Split the clip into shorter pieces first.');
    if (!meta.hasVideo) return ff(['-ss', String(start), '-t', String(dur), '-i', file.path, '-vn', '-af', 'areverse', ...aEnc('m4a'), path.join(ctx.out, 'reversed.m4a')], ctx.work);
    await ff(['-ss', String(start), '-t', String(dur), '-i', file.path, '-vf', `reverse,${EVEN}`, ...(meta.hasAudio ? ['-af', 'areverse'] : []),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', ...(meta.hasAudio ? ['-c:a', 'aac', '-b:a', '192k'] : ['-an']), '-movflags', '+faststart', path.join(ctx.out, 'reversed.mp4')], ctx.work);
  },

  /** Editor helper: where a stretch of a clip is silent. Writes silences.json as [[from, to], …] in seconds from the stretch start. */
  async 'clip-silence'(ctx) {
    const file = ctx.files[0];
    const meta = await probe(file.path);
    if (!meta.hasAudio) throw new UserError('This clip has no sound, so there are no silences to cut.');
    const start = clamp(ctx.opts.start, 0, Math.max(0, meta.duration - 0.05), 0);
    const dur = clamp(ctx.opts.dur, 0.1, meta.duration - start, meta.duration - start);
    const noise = clamp(ctx.opts.noise, -70, -15, -35);
    const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostdin', '-ss', String(start), '-t', String(dur), '-i', file.path, '-vn', '-af', `silencedetect=noise=${noise}dB:d=0.4`, '-f', 'null', '-']);
    const list = [];
    let open = null;
    for (const m of stderr.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
      if (m[1] === 'start') open = Math.max(0, Number(m[2])); else if (open != null) { list.push([open, Math.min(dur, Number(m[2]))]); open = null; }
    }
    if (open != null) list.push([open, dur]);
    await fs.writeFile(path.join(ctx.out, 'silences.json'), JSON.stringify({ duration: dur, silences: list }));
  },

  async 'add-audio'(ctx) {
    const file = ctx.files[0];
    if (!ctx.extra) throw new UserError('Choose the audio track to add.');
    const [vi, ai] = await Promise.all([probe(file.path), probe(ctx.extra.path)]);
    if (!vi.hasVideo) throw new UserError('The first file has no video track.');
    if (!ai.hasAudio) throw new UserError('The audio file has no audio track.');
    const o = ctx.opts;
    const fmt = pick(o.format, VFMT, 'mp4');
    const av = clamp(o.audioVolume, 0, 200, 100) / 100;
    const vv = clamp(o.videoVolume, 0, 200, 100) / 100;
    const inputs = ['-i', file.path, ...(o.loop ? ['-stream_loop', '-1'] : []), '-i', ctx.extra.path];
    const norm = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
    const g = [`[1:a]${norm},volume=${av},apad[new]`];
    let amap = '[new]';
    if (o.mode !== 'replace' && vi.hasAudio) {
      g.push(`[0:a]${norm},volume=${vv}[orig];[orig][new]amix=inputs=2:duration=first:normalize=0[mix]`);
      amap = '[mix]';
    }
    const copy = vi.vcodec === 'h264' && fmt !== 'webm';
    const enc = copy ? ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', ...(fmt === 'mkv' ? [] : ['-movflags', '+faststart'])] : vEnc(fmt);
    await ff([...inputs, '-filter_complex', g.join(';'), '-map', '0:v:0', '-map', amap, '-t', String(vi.duration), ...enc, await outFile(ctx, file, '-with-audio', fmt)], ctx.work);
  },

  async 'add-image'(ctx) {
    const file = ctx.files[0];
    if (!ctx.extra) throw new UserError('Choose the image to add.');
    const info = await probe(file.path);
    if (!info.hasVideo) throw new UserError('This file has no video track.');
    const fmt = pick(ctx.opts.format, VFMT, 'mp4');
    const r = rect(ctx.opts, { x: 0.05, y: 0.05, w: 0.25, h: 0.25 });
    const sec = section(ctx.opts, info.duration);
    const w = Math.max(2, Math.round(info.width * r.w));
    const op = clamp(ctx.opts.opacity, 10, 100, 100) / 100;
    const g = `[1:v]scale=${w}:-1,format=rgba,colorchannelmixer=aa=${op}[img];[0:v][img]overlay=${Math.round(info.width * r.x)}:${Math.round(info.height * r.y)}:enable='between(t,${sec.start},${sec.end})',${EVEN}[v]`;
    await ff(['-i', file.path, '-i', ctx.extra.path, '-filter_complex', g, '-map', '[v]', ...(info.hasAudio ? ['-map', '0:a:0'] : []),
      ...vEnc(fmt, { audio: info.hasAudio }), await outFile(ctx, file, '-with-image', fmt)], ctx.work);
  },

  async 'add-text'(ctx) {
    const info = await probe(ctx.files[0].path);
    const sec = section(ctx.opts, info.duration);
    const o = ctx.opts;
    const dt = await drawtext(ctx, { text: o.text, size: o.size, color: o.color, position: o.position, box: o.box, ...(sec.whole ? {} : { start: sec.start, end: sec.end }) });
    await simpleVideo(ctx, '-with-text', { vf: [dt] });
  },

  async 'remove-logo'(ctx) {
    const file = ctx.files[0];
    const info = await probe(file.path);
    if (!info.hasVideo) throw new UserError('This file has no video track.');
    const fmt = pick(ctx.opts.format, VFMT, 'mp4');
    const r = rect(ctx.opts);
    const W = info.width; const H = info.height;
    let x = Math.max(1, Math.round(W * r.x)); let y = Math.max(1, Math.round(H * r.y));
    let w = Math.max(4, Math.round(W * r.w)); let h = Math.max(4, Math.round(H * r.h));
    w = Math.min(w, W - x - 1); h = Math.min(h, H - y - 1);
    if (w < 2 || h < 2) throw new UserError('The selected area is too small.');
    const out = await outFile(ctx, file, '-clean', fmt);
    const enc = vEnc(fmt, { audio: info.hasAudio });
    if (ctx.opts.mode === 'blur') {
      const rad = Math.max(1, Math.floor(Math.min(w, h) / 8));
      const g = `[0:v]split[a][b];[b]crop=${w}:${h}:${x}:${y},boxblur=${rad}:3[bl];[a][bl]overlay=${x}:${y},${EVEN}[v]`;
      return ff(['-i', file.path, '-filter_complex', g, '-map', '[v]', ...(info.hasAudio ? ['-map', '0:a:0'] : []), ...enc, out], ctx.work);
    }
    return ff(['-i', file.path, '-vf', `delogo=x=${x}:y=${y}:w=${w}:h=${h},${EVEN}`, ...enc, out], ctx.work);
  },

  'crop-video'(ctx) {
    const r = rect(ctx.opts, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    return simpleVideo(ctx, '-cropped', { vf: [`crop=floor(iw*${r.w}/2)*2:floor(ih*${r.h}/2)*2:floor(iw*${r.x}):floor(ih*${r.y})`] });
  },
  'rotate-video'(ctx) {
    const f = { 90: 'transpose=1', 180: 'hflip,vflip', 270: 'transpose=2' }[pick(ctx.opts.angle, ['90', '180', '270'], '90')];
    return simpleVideo(ctx, '-rotated', { vf: [f] });
  },
  'flip-video'(ctx) {
    const f = { h: 'hflip', v: 'vflip', both: 'hflip,vflip' }[pick(ctx.opts.direction, ['h', 'v', 'both'], 'h')];
    return simpleVideo(ctx, '-flipped', { vf: [f] });
  },
  'resize-video'(ctx) {
    const o = ctx.opts;
    const f = o.preset === 'custom'
      ? `scale=${clamp(o.width, 16, 7680, 1280)}:${clamp(o.height, 16, 4320, 720)},setsar=1`
      : `scale=-2:${pick(o.preset, ['2160', '1440', '1080', '720', '480', '360', '240'], '720')}`;
    return simpleVideo(ctx, '-resized', { vf: [f] });
  },
  'video-volume'(ctx) {
    return simpleVideo(ctx, '-volume', { af: [`volume=${(clamp(ctx.opts.volume, 0, 400, 100) / 100).toFixed(2)}`, 'alimiter=limit=0.97'] });
  },
  'video-speed'(ctx) {
    const s = clamp(ctx.opts.speed, 0.25, 4, 1);
    return simpleVideo(ctx, `-${s}x`, { vf: [`setpts=PTS/${s}`], af: [atempo(s)], noAudio: !!ctx.opts.mute });
  },

  async 'loop-video'(ctx) {
    const file = ctx.files[0];
    const info = await probe(file.path);
    const sec = section(ctx.opts, info.duration);
    const times = Math.round(clamp(ctx.opts.times, 2, 16, 3));
    const fmt = pick(ctx.opts.format, VFMT, 'mp4');
    let src = file.path;
    if (!sec.whole) {
      src = path.join(ctx.work, 'segment.mkv');
      await ff(['-ss', String(sec.start), '-t', String(sec.length), '-i', file.path, '-vf', EVEN, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14',
        ...(info.hasAudio ? ['-c:a', 'flac'] : ['-an']), src], ctx.work);
    }
    await ff(['-stream_loop', String(times - 1), '-i', src, '-vf', EVEN, ...vEnc(fmt, { audio: info.hasAudio }), await outFile(ctx, file, `-loop-${times}x`, fmt)], ctx.work);
  },

  async 'stabilize-video'(ctx) {
    const file = ctx.files[0];
    const smoothing = Math.round(clamp(ctx.opts.strength, 5, 40, 15));
    await ff(['-i', file.path, '-vf', 'vidstabdetect=shakiness=8:accuracy=15:result=transforms.trf', '-an', '-f', 'null', '-'], ctx.work);
    await simpleVideo(ctx, '-stabilized', { vf: [`vidstabtransform=input=transforms.trf:smoothing=${smoothing}:optzoom=1:interpol=bicubic`, 'unsharp=5:5:0.8:3:3:0.4'] });
  },

  async 'video-converter'(ctx) {
    const o = ctx.opts;
    const fmt = pick(o.format, ['mp4', 'mkv', 'mov', 'webm', 'avi', 'flv', '3gp', 'mpg', 'gif'], 'mp4');
    const crf = Number(pick(o.quality, ['17', '20', '23', '28', '34'], '23'));
    const res = pick(o.resolution, ['2160', '1440', '1080', '720', '480', '360', '240'], '');
    for (const file of ctx.files) {
      const info = await probe(file.path);
      if (!info.hasVideo) throw new UserError(`"${file.name}" has no video track. Use the Audio Converter for sound files.`);
      const out = await outFile(ctx, file, '', fmt);
      if (fmt === 'gif') {
        const h = res ? Math.min(Number(res), 720) : Math.min(info.height, 480);
        await ff(['-i', file.path, '-filter_complex', `[0:v]fps=12,scale=-2:${h}:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, '-loop', '0', out], ctx.work);
        continue;
      }
      const vf = [...(res ? [`scale=-2:${res}`] : []), ...(fmt === 'mpg' ? ['fps=25'] : []), EVEN];
      const audio = info.hasAudio && !o.noAudio;
      await ff(['-i', file.path, '-vf', vf.join(','), ...vEnc(fmt, { crf, codec: o.vcodec === 'h265' ? 'h265' : 'h264', audio }), out], ctx.work);
    }
  },

  async 'text-to-speech'(ctx) {
    const o = ctx.opts;
    const text = String(o.text || '').replace(/\r/g, '').slice(0, 30000);
    if (!text.trim()) throw new UserError('Type or paste some text first.');
    await fs.writeFile(path.join(ctx.work, 'speech.txt'), text);
    const voice = pick(o.voice, TTS_VOICES.map((v) => v[0]), 'slt');
    const fmt = pick(o.format, ['mp3', 'wav', 'ogg', 'm4a', 'flac'], 'mp3');
    const speed = clamp(o.speed, 0.5, 2, 1);
    await ff(['-f', 'lavfi', '-i', `flite=textfile=speech.txt:voice=${voice}`, '-af', `${atempo(speed)},aresample=44100`, ...aEnc(fmt, 128),
      await uniquePath(ctx.out, `speech.${fmt}`)], ctx.work);
  },

  // ───────── audio ─────────
  async 'trim-audio'(ctx) {
    const file = ctx.files[0];
    const info = await probe(file.path);
    if (!info.hasAudio) throw new UserError('This file has no audio track.');
    const o = ctx.opts;
    const sec = section(o, info.duration);
    const fmt = pick(o.format, AFMT, 'mp3');
    const remove = o.mode === 'remove';
    if (remove && sec.whole) throw new UserError('The selection covers the whole file — nothing would be left.');
    const finalLen = remove ? info.duration - sec.length : sec.length;
    const fi = clamp(o.fadeIn, 0, finalLen / 2, 0);
    const fo = clamp(o.fadeOut, 0, finalLen / 2, 0);
    const fades = [...(fi ? [`afade=t=in:st=0:d=${fi}`] : []), ...(fo ? [`afade=t=out:st=${(finalLen - fo).toFixed(3)}:d=${fo}`] : [])];
    let g;
    if (!remove) g = `[0:a]atrim=start=${sec.start}:end=${sec.end},asetpts=PTS-STARTPTS${fades.map((f) => `,${f}`).join('')}[a]`;
    else {
      const parts = [];
      if (sec.start > 0.01) parts.push([0, sec.start]);
      if (sec.end < info.duration - 0.01) parts.push([sec.end, info.duration]);
      g = parts.map(([s, e], i) => `[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[p${i}]`).join(';');
      g += `;${parts.map((_, i) => `[p${i}]`).join('')}concat=n=${parts.length}:v=0:a=1${fades.map((f) => `,${f}`).join('')}[a]`;
    }
    await ff(['-i', file.path, '-filter_complex', g, '-map', '[a]', ...aEnc(fmt), await outFile(ctx, file, '-trimmed', fmt)], ctx.work);
  },
  'audio-volume'(ctx) {
    const v = (clamp(ctx.opts.volume, 0, 400, 100) / 100).toFixed(2);
    return simpleAudio(ctx, '-volume', [...(ctx.opts.normalize ? ['loudnorm=I=-16:TP=-1.5:LRA=11'] : []), `volume=${v}`, 'alimiter=limit=0.97']);
  },
  'audio-speed'(ctx) {
    const s = clamp(ctx.opts.speed, 0.25, 4, 1);
    return simpleAudio(ctx, `-${s}x`, [atempo(s)]);
  },
  'audio-pitch'(ctx) {
    const st = clamp(ctx.opts.semitones, -12, 12, 0);
    return simpleAudio(ctx, `-pitch${st >= 0 ? '+' : ''}${st}`, [`rubberband=pitch=${(2 ** (st / 12)).toFixed(5)}`]);
  },
  equalizer(ctx) {
    const gains = Array.isArray(ctx.opts.gains) ? ctx.opts.gains : [];
    const af = EQ_BANDS.map((f, i) => [f, clamp(gains[i], -12, 12, 0)]).filter(([, g]) => g !== 0).map(([f, g]) => `equalizer=f=${f}:t=o:w=1:g=${g}`);
    return simpleAudio(ctx, '-eq', [...af, 'alimiter=limit=0.97']);
  },
  'reverse-audio'(ctx) { return simpleAudio(ctx, '-reversed', ['areverse']); },

  async 'audio-joiner'(ctx) {
    const o = ctx.opts;
    const fmt = pick(o.format, AFMT, 'mp3');
    const infos = await Promise.all(ctx.files.map((f) => probe(f.path)));
    infos.forEach((i, n) => { if (!i.hasAudio) throw new UserError(`"${ctx.files[n].name}" has no audio track.`); });
    const n = ctx.files.length;
    const shortest = Math.min(...infos.map((i) => i.duration));
    const cf = clamp(o.crossfade, 0, Math.max(0, shortest / 2 - 0.05), 0);
    const total = infos.reduce((s, i) => s + i.duration, 0) - cf * (n - 1);
    const g = ctx.files.map((_, i) => `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
    let last;
    if (cf > 0) {
      last = '[a0]';
      for (let i = 1; i < n; i++) { g.push(`${last}[a${i}]acrossfade=d=${cf}:c1=tri:c2=tri[x${i}]`); last = `[x${i}]`; }
    } else {
      g.push(`${ctx.files.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=0:a=1[cat]`); last = '[cat]';
    }
    const fi = clamp(o.fadeIn, 0, total / 2, 0);
    const fo = clamp(o.fadeOut, 0, total / 2, 0);
    g.push(`${last}${[`afade=t=in:st=0:d=${fi || 0.001}`, ...(fo ? [`afade=t=out:st=${(total - fo).toFixed(3)}:d=${fo}`] : [])].join(',')}[out]`);
    await ff([...ctx.files.flatMap((f) => ['-i', f.path]), '-filter_complex', g.join(';'), '-map', '[out]', ...aEnc(fmt), await uniquePath(ctx.out, `joined.${fmt}`)], ctx.work);
  },

  async 'audio-converter'(ctx) {
    const o = ctx.opts;
    const fmt = pick(o.format, AFMT, 'mp3');
    const kbps = Number(pick(o.bitrate, ['64', '128', '192', '256', '320'], '192'));
    for (const file of ctx.files) {
      const info = await probe(file.path);
      if (!info.hasAudio) throw new UserError(`"${file.name}" has no audio track.`);
      const sil = 'silenceremove=start_periods=1:start_threshold=-50dB:detection=peak';
      const af = [];
      if (o.trimSilence) af.push(sil, 'areverse', sil, 'areverse');
      if (o.reverse) af.push('areverse');
      const fade = Math.min(3, info.duration / 3);
      if (o.fadeIn && fade > 0) af.push(`afade=t=in:st=0:d=${fade.toFixed(2)}`);
      if (o.fadeOut && fade > 0) af.push('areverse', `afade=t=in:st=0:d=${fade.toFixed(2)}`, 'areverse');
      const args = ['-i', file.path, '-vn'];
      if (af.length) args.push('-af', af.join(','));
      const enc = aEnc(fmt, kbps);
      {
        const sr = pick(o.sampleRate, ['22050', '44100', '48000', '96000'], '');
        if (sr && !(fmt === 'opus')) args.push('-ar', sr);
        const ch = pick(o.channels, ['1', '2'], '');
        if (ch) args.push('-ac', ch);
      }
      for (const [k, tag] of [['title', 'title'], ['artist', 'artist'], ['album', 'album'], ['year', 'date'], ['genre', 'genre']]) {
        const v = String(o[k] || '').replace(/[\r\n]/g, ' ').trim().slice(0, 200);
        if (v) args.push('-metadata', `${tag}=${v}`);
      }
      args.push(...enc, await outFile(ctx, file, baseOf(file.name) && file.ext === fmt ? '-converted' : '', fmt));
      await ff(args, ctx.work);
    }
  },
};
