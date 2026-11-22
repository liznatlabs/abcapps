// Interactive option widgets: media player, trim bar, on-video rectangle, equalizer, PDF page picker.
import { h, glyph, fmtTime, parseTime } from './ui.js';
import { EQ_BANDS, EQ_PRESETS } from '/shared/catalog.js';

/** A preview player with our own controls (so overlays on the video stay draggable). */
export function player(file, kind) {
  const url = URL.createObjectURL(file);
  const media = h(kind === 'video' ? 'video' : 'audio', { src: url, preload: 'metadata', playsInline: true });
  const stage = kind === 'video' ? h('div', { class: 'stage' }, media) : h('div', { class: 'audio-stage' }, media, file.name);
  const playBtn = h('button', { class: 'btn small', type: 'button', 'aria-label': 'Play or pause' }, glyph('play'), 'Play');
  const seek = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: 0, 'aria-label': 'Position' });
  const time = h('span', { class: 'time' }, '0:00.0');
  const warn = h('div', { class: 'hint', hidden: true }, 'Your browser cannot preview this format, but it can still be processed. Enter times and positions by hand.');
  const api = { el: h('div', {}, stage, h('div', { class: 'player' }, playBtn, seek, time), warn), media, stage, duration: 0, ready: false, listeners: [], limit: null,
    onReady(fn) { if (api.ready) fn(api); else api.listeners.push(fn); },
    destroy() { media.pause(); URL.revokeObjectURL(url); } };
  media.addEventListener('loadedmetadata', () => {
    api.duration = Number.isFinite(media.duration) ? media.duration : 0;
    if (kind === 'video' && media.videoWidth) {
      const ratio = media.videoWidth / media.videoHeight;
      stage.style.aspectRatio = String(ratio);
      stage.style.width = `min(100%, calc(62vh * ${ratio}))`;
      api.ratio = ratio;
    } else if (kind === 'video') { stage.hidden = true; }
    seek.max = api.duration || 1;
    api.ready = true;
    api.listeners.forEach((fn) => fn(api));
  });
  media.addEventListener('error', () => { warn.hidden = false; stage.hidden = kind === 'video'; playBtn.disabled = true; seek.disabled = true; });
  media.addEventListener('timeupdate', () => {
    if (api.limit && media.currentTime >= api.limit.end && !media.paused) { media.pause(); media.currentTime = api.limit.start; }
    seek.value = media.currentTime; time.textContent = `${fmtTime(media.currentTime)} / ${fmtTime(api.duration)}`;
  });
  media.addEventListener('play', () => { playBtn.replaceChildren(glyph('pause'), 'Pause'); });
  media.addEventListener('pause', () => { playBtn.replaceChildren(glyph('play'), 'Play'); });
  playBtn.onclick = () => (media.paused ? media.play() : media.pause());
  seek.oninput = () => { media.currentTime = Number(seek.value); };
  return api;
}

/** Start/end selection. Works as plain time boxes until the duration is known, then gains a two-handle slider. */
export function trimWidget(value, pl, onChange) {
  const state = { start: value?.start ?? 0, end: value?.end ?? null };
  const a = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: 0, 'aria-label': 'Start' });
  const b = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: 1, 'aria-label': 'End' });
  const fill = h('div', { class: 'fill' });
  const dual = h('div', { class: 'dual', hidden: true }, h('div', { class: 'track' }), fill, a, b);
  const startIn = h('input', { type: 'text', value: fmtTime(state.start), 'aria-label': 'Start time', inputMode: 'decimal' });
  const endIn = h('input', { type: 'text', value: state.end == null ? '' : fmtTime(state.end), placeholder: 'end', 'aria-label': 'End time', inputMode: 'decimal' });
  const len = h('span', { class: 'len' });
  let dur = 0;
  const emit = () => {
    if (dur) {
      a.value = state.start; b.value = state.end ?? dur;
      fill.style.left = `${(state.start / dur) * 100}%`; fill.style.right = `${100 - ((state.end ?? dur) / dur) * 100}%`;
      len.textContent = `Selected: ${fmtTime((state.end ?? dur) - state.start)}`;
    }
    if (pl) pl.limit = dur ? { start: state.start, end: state.end ?? dur } : null;
    onChange({ start: state.start, end: state.end });
  };
  const set = (k, v, fromText) => {
    if (!Number.isFinite(v)) return;
    const max = dur || Infinity;
    if (k === 'start') state.start = Math.max(0, Math.min(v, (state.end ?? max) - 0.1));
    else state.end = Math.min(max, Math.max(v, state.start + 0.1));
    if (!fromText || document.activeElement !== startIn) startIn.value = fmtTime(state.start);
    if (!fromText || document.activeElement !== endIn) endIn.value = state.end == null ? '' : fmtTime(state.end);
    emit();
  };
  a.oninput = () => { set('start', Number(a.value)); if (pl) pl.media.currentTime = state.start; };
  b.oninput = () => { set('end', Number(b.value)); if (pl) pl.media.currentTime = Math.max(state.start, state.end - 0.05); };
  startIn.onchange = () => { set('start', parseTime(startIn.value)); startIn.value = fmtTime(state.start); };
  endIn.onchange = () => { if (endIn.value.trim() === '') { state.end = dur || null; emit(); } else set('end', parseTime(endIn.value)); endIn.value = state.end == null ? '' : fmtTime(state.end); };
  const el = h('div', { class: 'trim' }, dual,
    h('div', { class: 'trim-row' }, 'From', startIn,
      pl && h('button', { class: 'btn small', type: 'button', onclick: () => set('start', pl.media.currentTime) }, 'Use current'),
      'to', endIn,
      pl && h('button', { class: 'btn small', type: 'button', onclick: () => set('end', pl.media.currentTime) }, 'Use current'), len));
  const api = { el, setDuration(d) { if (!d) return; dur = d; a.max = d; b.max = d; if (state.end == null || state.end > d) state.end = d; if (state.start >= d) state.start = 0; dual.hidden = false; startIn.value = fmtTime(state.start); endIn.value = fmtTime(state.end); emit(); },
    setValue(v) { state.start = v.start ?? 0; state.end = v.end ?? (dur || null); startIn.value = fmtTime(state.start); endIn.value = state.end == null ? '' : fmtTime(state.end); emit(); } };
  pl?.onReady((p) => api.setDuration(p.duration));
  emit();
  return api;
}

/** A draggable, resizable box over the video. Values are fractions of the frame (0–1). */
export function rectWidget(opt, value, pl, onChange, { image, plain } = {}) {
  const r = { x: 0.1, y: 0.1, w: 0.4, h: 0.3, ...(value || {}) };
  let aspect = null; // box width/height, as a fraction ratio, when locked
  const box = h('div', { class: `rect ${plain || image ? 'plain' : ''}` }, image, h('b'));
  const nums = ['x', 'y', 'w', 'h'].map((k) => h('input', { type: 'number', min: 0, max: 100, step: 1, value: Math.round(r[k] * 100), 'aria-label': { x: 'Left %', y: 'Top %', w: 'Width %', h: 'Height %' }[k],
    onchange: (e) => { r[k] = Math.min(1, Math.max(0, Number(e.target.value) / 100)); fix(); } }));
  const manual = h('div', { class: 'row hint' }, 'Left', nums[0], 'Top', nums[1], 'Width', nums[2], 'Height', nums[3], '(% of the frame)');
  manual.querySelectorAll('input').forEach((i) => { i.style.width = '76px'; });
  function fix() {
    r.w = Math.min(1, Math.max(0.02, r.w)); r.h = Math.min(1, Math.max(0.02, r.h));
    if (aspect) { r.h = r.w / aspect; if (r.h > 1) { r.h = 1; r.w = aspect; } }
    r.x = Math.min(1 - r.w, Math.max(0, r.x)); r.y = Math.min(1 - r.h, Math.max(0, r.y));
    Object.assign(box.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });
    ['x', 'y', 'w', 'h'].forEach((k, i) => { if (document.activeElement !== nums[i]) nums[i].value = Math.round(r[k] * 100); });
    onChange({ ...r });
  }
  box.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const resize = e.target.tagName === 'B';
    const bounds = pl.stage.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, ...r };
    box.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dx = (ev.clientX - start.px) / bounds.width; const dy = (ev.clientY - start.py) / bounds.height;
      if (resize) { r.w = Math.min(1 - start.x, start.w + dx); if (!aspect) r.h = Math.min(1 - start.y, start.h + dy); } else { r.x = start.x + dx; r.y = start.y + dy; }
      fix();
    };
    const up = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); };
    box.addEventListener('pointermove', move); box.addEventListener('pointerup', up);
  });
  const ratios = opt.ratios && h('div', { class: 'row' }, [['Free', null], ['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['9:16', 9 / 16], ['4:5', 4 / 5]].map(([label, val]) => h('button', { class: 'btn small', type: 'button',
    onclick: () => api.setAspect(val, true) }, label)));
  const api = { el: h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'hint' }, opt.label), ratios, manual),
    /** ratio = frame-pixel width/height of the box; converted using the video's own shape. */
    setAspect(ratio, recentre) {
      aspect = ratio ? ratio / (pl?.ratio || 16 / 9) : null;
      if (aspect && recentre) { r.w = Math.min(0.8, 0.8 * aspect); r.h = r.w / aspect; r.x = (1 - r.w) / 2; r.y = (1 - r.h) / 2; }
      fix();
    } };
  pl?.onReady((p) => { if (p.ratio) { p.stage.append(box); fix(); } });
  fix();
  return api;
}

export function eqWidget(value, onChange) {
  const gains = EQ_BANDS.map((_, i) => Number(value?.[i]) || 0);
  const preset = h('select', { 'aria-label': 'Preset' }, h('option', { value: '' }, 'Custom'), Object.keys(EQ_PRESETS).map((p) => h('option', { value: p }, p)));
  const bands = EQ_BANDS.map((f, i) => {
    const out = h('output', {}, '0');
    const input = h('input', { type: 'range', min: -12, max: 12, step: 1, value: gains[i], 'aria-label': `${f} Hz`, oninput: () => { gains[i] = Number(input.value); out.textContent = `${gains[i] > 0 ? '+' : ''}${gains[i]}`; preset.value = ''; onChange([...gains]); } });
    return { input, out, el: h('div', { class: 'eq-band' }, out, input, f >= 1000 ? `${f / 1000}k` : f) };
  });
  const apply = (arr) => { arr.forEach((g, i) => { gains[i] = g; bands[i].input.value = g; bands[i].out.textContent = `${g > 0 ? '+' : ''}${g}`; }); onChange([...gains]); };
  preset.onchange = () => { if (preset.value) apply(EQ_PRESETS[preset.value]); };
  preset.value = 'Bass boost'; apply(EQ_PRESETS['Bass boost']);
  return { el: h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Preset'), h('div', { style: { width: '200px' } }, preset),
    h('button', { class: 'btn small', type: 'button', onclick: () => { preset.value = 'Flat'; apply(EQ_PRESETS.Flat); } }, 'Reset')), h('div', { class: 'eq' }, bands.map((b) => b.el)), h('div', { class: 'hint' }, 'Gain in dB per frequency band (Hz).')) };
}

const toRanges = (nums) => {
  const s = [...nums].sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (s[j + 1] === s[j] + 1) j++; out.push(j > i ? `${s[i]}-${s[j]}` : `${s[i]}`); i = j; }
  return out.join(', ');
};
const fromRanges = (str, total) => {
  const set = new Set();
  for (const part of str.split(/[,;]/)) {
    const m = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) continue;
    for (let p = Number(m[1]); p <= Math.min(total, Number(m[2] || m[1])); p++) if (p >= 1) set.add(p);
  }
  return set;
};

/** PDF page thumbnails: pick pages (mode "select") or turn them (mode "rotate"). */
export function pagesWidget(opt, file, onChange) {
  const grid = h('div', { class: 'pages', 'aria-busy': 'true' }, Array.from({ length: 6 }, () => h('div', { class: 'skel' })));
  const el = h('div', { class: 'stack', style: { gap: '10px' } });
  const selected = new Set();
  const turns = {};
  let total = 0;
  let cells = [];
  const text = h('input', { type: 'text', placeholder: 'Example: 3-5, 9   ·   use ; to make several files: 1-3; 4-6', 'aria-label': 'Pages' });
  const paint = () => cells.forEach((c, i) => {
    const p = i + 1;
    if (opt.mode === 'select') c.cell.classList.toggle('on', selected.has(p));
    else { c.cell.classList.toggle('on', !!turns[p]); c.img.style.transform = `rotate(${turns[p] || 0}deg)`; }
  });
  const emit = () => { paint(); onChange(opt.mode === 'select' ? text.value : Object.fromEntries(Object.entries(turns).filter(([, v]) => v))); };
  const turn = (p, d) => { turns[p] = (((turns[p] || 0) + d) % 360 + 360) % 360; };
  if (opt.mode === 'select') {
    text.oninput = () => { selected.clear(); fromRanges(text.value, total || 1e6).forEach((p) => selected.add(p)); emit(); };
    el.append(h('div', { class: 'row' }, h('div', { style: { flex: '1', minWidth: '220px' } }, text),
      h('button', { class: 'btn small', type: 'button', onclick: () => { for (let p = 1; p <= total; p++) selected.add(p); text.value = toRanges(selected); emit(); } }, 'Select all'),
      h('button', { class: 'btn small', type: 'button', onclick: () => { selected.clear(); text.value = ''; emit(); } }, 'Clear')),
    h('div', { class: 'hint' }, 'Click pages to select them, or type page numbers. Leave empty to split every page into its own file.'));
  } else {
    el.append(h('div', { class: 'row' },
      h('button', { class: 'btn small', type: 'button', onclick: () => { for (let p = 1; p <= total; p++) turn(p, -90); emit(); } }, 'Rotate all left'),
      h('button', { class: 'btn small', type: 'button', onclick: () => { for (let p = 1; p <= total; p++) turn(p, 90); emit(); } }, 'Rotate all right'),
      h('button', { class: 'btn small', type: 'button', onclick: () => { Object.keys(turns).forEach((k) => delete turns[k]); emit(); } }, 'Reset'),
      h('span', { class: 'hint' }, 'or click a single page to turn it')));
  }
  el.append(grid);
  const fd = new FormData();
  fd.append('file', file, file.name);
  fetch('/api/pdf-preview', { method: 'POST', body: fd }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Preview failed');
    total = data.pages;
    grid.textContent = '';
    grid.removeAttribute('aria-busy');
    cells = data.thumbs.map((src, i) => {
      const p = i + 1;
      const img = h('img', { src, alt: `Page ${p}`, loading: 'lazy' });
      const cell = h('div', { class: 'page', role: 'button', tabIndex: 0, 'aria-label': `Page ${p}` }, h('div', { class: 'thumb' }, img), p);
      const act = () => { if (opt.mode === 'select') { if (selected.has(p)) selected.delete(p); else selected.add(p); text.value = toRanges(selected); } else turn(p, 90); emit(); };
      cell.onclick = act;
      cell.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } };
      grid.append(cell);
      return { cell, img };
    });
    if (data.pages > data.thumbs.length) grid.append(h('div', { class: 'hint' }, `Showing the first ${data.thumbs.length} of ${data.pages} pages. Type page numbers for the rest.`));
    emit();
  }).catch((e) => { grid.textContent = ''; grid.append(h('div', { class: 'alert' }, e.message)); });
  return { el };
}
