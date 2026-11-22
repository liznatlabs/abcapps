// Timeline video editor: files → tracks → canvas preview → export.
import { h, fmtTime, fmtSize, runTool, resultsView, progressView } from './ui.js';
import { TTS_VOICES } from '/shared/catalog.js';
import { colorMatrix, keyAlpha, FILTERS, filterSwatch, MASKS, maskPng, AUDIO_FX, STICKERS, SOUNDS, synth, ADJUST0 } from './editor-fx.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const FONTS = { sans: 'Geist, system-ui, "Segoe UI", Roboto, "Noto Sans", sans-serif', serif: 'Georgia, "Noto Serif", serif', mono: 'ui-monospace, "Noto Sans Mono", monospace', display: 'Impact, "Arial Black", sans-serif', emoji: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif' };
const ROW = 52; // timeline row height
const PAD = 14; // left padding of the timeline
const REF = 1080; // reference canvas height used to size text
const CANVASES = [['16:9', 1920, 1080], ['9:16', 1080, 1920], ['1:1', 1080, 1080], ['4:5', 1080, 1350], ['4:3', 1440, 1080], ['21:9', 2520, 1080]];
const I = { // small inline icons
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6"/>', sound: '<path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>', pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor"/>',
  prev: '<path d="M19 5v14l-9-7zM6 5v14"/>', next: '<path d="M5 5v14l9-7zM18 5v14"/>',
  files: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  canvas: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 9v11"/>', record: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  speech: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 9v3M12 8v5M15 9v3"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  back: '<path d="m14 6-6 6 6 6"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
  media: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9.5 5 2.5-5 2.5z"/>', note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  speed: '<path d="M5 18a9 9 0 1 1 14 0"/><path d="m12 13 4-5"/>', sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
  adjust: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 9.5h4M10.5 7.5v4M11.5 15.5h4"/>', filters: '<circle cx="12" cy="8.5" r="4.5"/><circle cx="8" cy="15" r="4.5"/><circle cx="16" cy="15" r="4.5"/>',
  crop: '<path d="M7 3v14h14M3 7h14v14"/>', move: '<path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>',
  mask: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="4.5"/>', drop: '<path d="M12 3.5c3.5 4 6 7 6 10.5a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-10.5z"/><path d="M12 20v-9"/>',
  key: '<rect x="3" y="4" width="18" height="16" rx="2" stroke-dasharray="3 3"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 18a4.5 4.5 0 0 1 9 0"/>',
  trim: '<path d="M8 4v16M16 4v16M3 8h5M16 8h5M3 16h5M16 16h5"/>', fadea: '<path d="M4 8v8M8 6v12M12 9v6M16 10.5v3M20 11.5v1"/>',
  afx: '<path d="M10 5 5.5 9H3v6h2.5l4.5 4z"/><path d="M17 5l.9 2.6L20.5 8.5l-2.6.9L17 12l-.9-2.6-2.6-.9 2.6-.9z"/>', enhance: '<rect x="8" y="3" width="6" height="10" rx="3"/><path d="M4.5 11a6.5 6.5 0 0 0 13 0M11 17.5V21M19 3l.6 1.7 1.7.6-1.7.6L19 7.6l-.6-1.7-1.7-.6 1.7-.6z"/>',
  replace: '<path d="M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3"/>', paste: '<path d="M9 4h6v3H9zM9 5.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6.5 20.5h11A1.5 1.5 0 0 0 19 19V7a1.5 1.5 0 0 0-1.5-1.5H15"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2" stroke-dasharray="3 2.5"/><rect x="4" y="4" width="12" height="12" rx="2"/>',
  extract: '<path d="M8 17V6l8-2v5"/><circle cx="5.5" cy="17" r="2.5"/><path d="M15 16h6m0 0-2.5-2.5M21 16l-2.5 2.5"/>', freeze: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 9v6M14 9v6"/>',
  reverse: '<path d="m11 6-7 6 7 6zM20 6l-7 6 7 6z"/>', silence: '<path d="M3 12h2M7 9v6M10 6v12M13 10v4M21 5 15 19M19 12h2"/>',
  front: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" stroke-dasharray="3 2.5"/>', backward: '<rect x="4" y="4" width="11" height="11" rx="2"/><path d="M15 9h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-3" stroke-dasharray="3 2.5"/>',
  sticker: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0M9 10h.01M15 10h.01"/>', doodle: '<path d="M3 17c3-8 5-8 6-3s3 5 5-2 4-6 7-2"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10.5 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3"/>', sfx: '<path d="m12 3 2.2 5.6L20 9.3l-4.4 3.9 1.3 5.8L12 16l-4.9 3 1.3-5.8L4 9.3l5.8-.7z"/>',
  fit: '<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="8" y="5" width="8" height="14"/>', fill: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10v6H7z" fill="currentColor"/>',
  rot: '<path d="M4 9a8 8 0 1 1 2 8"/><path d="M4 4v5h5"/>', fliph: '<path d="M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z"/>', flipv: '<path d="M3 12h18M7 8l5-5 5 5zM7 16l5 5 5-5z"/>',
  zin: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6M11 8v6"/>', zout: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>', zfit: '<path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4M4 5v14M20 5v14"/>',
};
const ic = (name) => { const s = h('span', { class: 'ed-ic' }); s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`; return s; };
const iconBtn = (name, label, onclick, cls = '') => h('button', { class: `ed-btn ${cls}`, type: 'button', title: label, 'aria-label': label, onclick }, ic(name));

/** Draw a text item to a canvas whose height corresponds to a project canvas `H` pixels tall. */
function renderText(it, H) {
  const fs = Math.max(4, it.size * H);
  const font = `${it.italic ? 'italic ' : ''}${it.bold ? '700' : '400'} ${fs}px ${FONTS[it.font] || FONTS.sans}`;
  const c = document.createElement('canvas');
  let g = c.getContext('2d');
  g.font = font;
  const lines = (it.text || ' ').split('\n');
  const lh = fs * 1.25;
  const pad = fs * 0.35;
  const tw = Math.max(fs * 0.5, ...lines.map((l) => g.measureText(l).width));
  c.width = Math.ceil(tw + pad * 2);
  c.height = Math.ceil(lines.length * lh + pad * 2);
  g = c.getContext('2d');
  g.font = font;
  if (it.bg) { g.fillStyle = it.bg; g.beginPath(); g.roundRect(0, 0, c.width, c.height, fs * 0.2); g.fill(); } else { g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = fs * 0.12; g.shadowOffsetY = fs * 0.04; }
  g.fillStyle = it.color;
  g.textBaseline = 'middle';
  g.textAlign = it.align;
  const x = it.align === 'left' ? pad : it.align === 'right' ? c.width - pad : c.width / 2;
  lines.forEach((l, i) => g.fillText(l, x, pad + lh * (i + 0.5)));
  return c;
}

// one autosaved project, kept in the browser
const db = () => new Promise((res, rej) => { const r = indexedDB.open('abc-editor', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const dbSet = async (k, v) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
const dbGet = async (k) => { const d = await db(); return new Promise((res, rej) => { const r = d.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };

export function editorPage(tool, root) {
  const files = new Map(); // id → { id, name, file, kind, url, duration, w, h, thumbs }
  let project = { name: 'Untitled project', canvas: { w: 1920, h: 1080, bg: '#000000', auto: true }, items: [] };
  let sel = null;
  let time = 0;
  let playing = false;
  let pps = 90; // timeline pixels per second
  let panel = 'files';
  let raf = 0;
  let last = 0;
  let saveTimer = 0;
  let filesDirty = false;
  let recState = null;
  let dead = false;
  let clipboard = null; // a copied clip
  let editTab = null; // the clip tool whose settings are open
  let doodle = null; // drawing session: { c, g, strokes }
  const pen = { color: '#ffd400', width: 14 };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const undo = [];
  const redo = [];
  const nodes = new Map(); // item id → { wrap, clip, media }
  const audioHost = h('div', { hidden: true });

  // ───────── skeleton ─────────
  const nameIn = h('input', { class: 'ed-name', value: project.name, 'aria-label': 'Project name', oninput: () => { project.name = nameIn.value; scheduleSave(); } });
  const undoBtn = iconBtn('undo', 'Undo (Ctrl+Z)', () => doUndo());
  const redoBtn = iconBtn('redo', 'Redo (Ctrl+Shift+Z)', () => doRedo());
  const fileInput = h('input', { type: 'file', multiple: true, hidden: true, accept: 'video/*,audio/*,image/*,.mkv,.mov,.webm,.mp3,.wav,.m4a,.flac,.ogg', onchange: () => { addFiles([...fileInput.files]); fileInput.value = ''; } });
  const tools = h('nav', { class: 'ed-tools', 'aria-label': 'Tools' });
  const side = h('section', { class: 'ed-side', 'aria-label': 'Tool settings' });
  const canvasEl = h('div', { class: 'ed-canvas' });
  // The selection box lives outside the clipped canvas, so its handles stay reachable when a clip is larger than the frame.
  const selBox = h('div', { class: 'ed-selbox', hidden: true }, ['nw', 'ne', 'sw', 'se'].map((c) => h('b', { class: `ed-h ${c}`, 'data-h': c })), h('b', { class: 'ed-h rot', 'data-h': 'rot', title: 'Rotate' }));
  selBox.addEventListener('pointerdown', (e) => {
    if (!sel) return;
    if (!e.target.dataset.h) { // a click on something lying on top of the selected clip selects that instead
      const top = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.classList?.contains('ed-item'));
      const id = top && [...nodes].find(([, n]) => n.wrap === top)?.[0];
      if (id && id !== sel) return stagePointer(e, id);
    }
    stagePointer(e, sel);
  });
  const canvasWrap = h('div', { class: 'ed-canvas-wrap' }, canvasEl, selBox);
  const stageArea = h('div', { class: 'ed-stage' }, canvasWrap);
  const timeNow = h('span', { class: 'ed-time' }, '0:00.00');
  const timeAll = h('span', { class: 'ed-time dim' }, '0:00.00');
  const playBtn = iconBtn('play', 'Play or pause (Space)', () => (playing ? pause() : play()), 'big');
  const zoom = h('input', { type: 'range', min: 4, max: 400, step: 1, value: pps, 'aria-label': 'Timeline zoom', style: { width: '120px' }, oninput: () => { pps = Number(zoom.value); drawTimeline(); } });
  const tlInner = h('div', { class: 'ed-tl-inner' });
  const tlScroll = h('div', { class: 'ed-tl' }, tlInner);
  const toast = h('div', { class: 'ed-toast', role: 'status', hidden: true });
  // colour filters for the live preview live here, one per clip
  const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgDefs.setAttribute('width', '0'); svgDefs.setAttribute('height', '0'); svgDefs.setAttribute('aria-hidden', 'true'); svgDefs.style.position = 'absolute';
  const replaceInput = h('input', { type: 'file', hidden: true, accept: 'video/*,image/*,audio/*', onchange: () => { if (replaceInput.files[0]) replaceWith(replaceInput.files[0]); replaceInput.value = ''; } });
  const el = h('div', { class: 'ed' },
    h('div', { class: 'ed-top' }, h('h1', { class: 'sr-only' }, tool.name), nameIn, h('span', { class: 'ed-saved', id: 'ed-saved' }),
      h('div', { class: 'ed-grow' }), undoBtn, redoBtn,
      h('button', { class: 'btn small', type: 'button', onclick: newProject }, 'New project'),
      h('button', { class: 'btn primary', type: 'button', onclick: openExport }, 'Export')),
    h('div', { class: 'ed-main' }, stageArea,
      h('div', { class: 'ed-bar' },
        h('div', { class: 'row', style: { gap: '4px' } }, iconBtn('cut', 'Split at playhead (S)', split), iconBtn('copy', 'Duplicate (Ctrl+D)', duplicate), iconBtn('trash', 'Delete (Del)', remove), iconBtn('mute', 'Mute or unmute clip (M)', toggleMute)),
        h('div', { class: 'row', style: { gap: '6px' } }, timeNow, iconBtn('prev', 'Back to start', () => seek(0)), playBtn, iconBtn('next', 'Jump to end', () => seek(total())), timeAll),
        h('div', { class: 'row', style: { gap: '4px' } }, iconBtn('zout', 'Zoom out', () => setZoom(pps / 1.4)), zoom, iconBtn('zin', 'Zoom in', () => setZoom(pps * 1.4)), iconBtn('zfit', 'Fit timeline to window', fitZoom))),
      tlScroll),
    side, tools,
    fileInput, replaceInput, audioHost, svgDefs, toast);
  root.append(el);
  const say = (msg) => { toast.textContent = msg; toast.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => { toast.hidden = true; }, 5000); };

  // ───────── model helpers ─────────
  const item = (id) => project.items.find((i) => i.id === id);
  const selected = () => item(sel);
  const total = () => project.items.reduce((m, i) => Math.max(m, i.start + i.dur), 0);
  const visual = (i) => i.type !== 'audio';
  const timed = (i) => i.type === 'video' || i.type === 'audio'; // has its own duration
  const canvasAr = () => project.canvas.w / project.canvas.h;
  const srcAr = (i) => { const f = files.get(i.file); return f ? (f.w * i.crop.w) / (f.h * i.crop.h) : 1; };
  /** Keep an item's box in the shape of its (cropped) source; text boxes follow their text. */
  function fixAspect(i) {
    if (i.type === 'text') { const c = renderText(i, REF); i.w = c.width / (REF * canvasAr()); i.h = c.height / REF; } else if (visual(i)) i.h = (i.w * canvasAr()) / srcAr(i);
  }
  /** Size and centre an item so it fits inside the canvas, or covers it. */
  function fitItem(i, cover) {
    const rotated = Math.round(i.rot / 90) % 2 !== 0;
    const ar = srcAr(i);
    const boxAr = rotated ? 1 / ar : ar; // shape of the item as it appears on screen
    const { w: W, h: H } = project.canvas;
    const [bw, bh] = (boxAr > W / H) !== cover ? [W, W / boxAr] : [H * boxAr, H];
    i.w = (rotated ? bh : bw) / W;
    i.x = 0.5; i.y = 0.5;
    fixAspect(i);
  }
  /** Fill in the settings newer features expect, so older saved projects keep working. */
  function norm(i) {
    i.fx ||= { fadeIn: 0, fadeOut: 0, zoom: '', vignette: false };
    if (i.type === 'video' || i.type === 'image') { i.adj ||= { ...ADJUST0 }; i.blur ??= 0; i.filter ||= 'none'; i.mask ||= ''; i.key ||= ''; i.keyStrength ??= 30; }
    if (timed(i)) { i.enhance ??= false; i.afx ||= ''; }
    return i;
  }
  function dropNode(id) { const n = nodes.get(id); if (!n) return; n.media?.pause?.(); n.wrap?.remove(); n.media?.remove(); n.svgf?.remove(); nodes.delete(id); }
  const snapshot = () => JSON.stringify(project);
  function pushUndo() { undo.push(snapshot()); if (undo.length > 100) undo.shift(); redo.length = 0; }
  function change(fn) { pushUndo(); fn(); tidyTracks(); refresh(); }
  function doUndo() { if (!undo.length) return; redo.push(snapshot()); project = JSON.parse(undo.pop()); afterRestore(); }
  function doRedo() { if (!redo.length) return; undo.push(snapshot()); project = JSON.parse(redo.pop()); afterRestore(); }
  function afterRestore() { if (!item(sel)) sel = null; nameIn.value = project.name; layoutCanvas(); refresh(); }
  /** Renumber tracks 0,1,2… keeping their order, with the lowest visual track at 0. */
  function tidyTracks() {
    const used = [...new Set(project.items.map((i) => i.track))].sort((a, b) => a - b);
    const map = new Map(used.map((t, n) => [t, n]));
    project.items.forEach((i) => { i.track = map.get(i.track); });
  }
  const overlaps = (a, b) => a !== b && a.track === b.track && a.start < b.start + b.dur - 0.001 && b.start < a.start + a.dur - 0.001;
  function settle(i) { let guard = 0; while (project.items.some((o) => overlaps(i, o)) && guard++ < 200) i.track += 1; }
  const topTrack = () => project.items.reduce((m, i) => Math.max(m, i.track), -1);

  // ───────── files ─────────
  const kindOf = (f) => (f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : f.type.startsWith('image/') ? 'image'
    : /\.(mp4|mkv|mov|webm|avi|m4v)$/i.test(f.name) ? 'video' : /\.(mp3|wav|m4a|flac|ogg|opus|aac)$/i.test(f.name) ? 'audio' : /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name) ? 'image' : null);
  function loadMeta(rec) {
    return new Promise((res, rej) => {
      if (rec.kind === 'image') { const img = new Image(); img.onload = () => { rec.w = img.naturalWidth; rec.h = img.naturalHeight; rec.duration = 0; res(); }; img.onerror = rej; img.src = rec.url; return; }
      const m = document.createElement(rec.kind);
      m.preload = 'metadata'; m.muted = true;
      const done = () => { rec.duration = m.duration; rec.w = m.videoWidth || 0; rec.h = m.videoHeight || 0; if (rec.kind === 'video' && !rec.w) return rej(new Error('no video')); res(); };
      m.onloadedmetadata = () => {
        if (Number.isFinite(m.duration)) return done();
        m.ondurationchange = () => { if (Number.isFinite(m.duration)) { m.ondurationchange = null; m.currentTime = 0; done(); } }; // browser recordings report their length only after a seek
        m.currentTime = 1e7;
      };
      m.onerror = () => rej(new Error('unsupported'));
      m.src = rec.url;
    });
  }
  /** A few small frames per video, used to paint the clip on the timeline. */
  async function makeThumbs(rec) {
    if (rec.kind !== 'video') return;
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = rec.url;
    await new Promise((r) => { v.onloadeddata = r; v.onerror = r; });
    const n = clamp(Math.round(rec.duration / 2), 4, 16);
    rec.thumbs = [];
    for (let k = 0; k < n && !dead; k++) {
      const t = ((k + 0.5) / n) * rec.duration;
      await new Promise((r) => { v.onseeked = r; v.currentTime = t; setTimeout(r, 1500); });
      const c = document.createElement('canvas');
      c.height = 44; c.width = Math.max(8, Math.round((44 * rec.w) / rec.h));
      try { c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); rec.thumbs.push({ t, c }); } catch { /* frame not ready */ }
      if (k % 4 === 3) drawTimeline();
    }
    v.removeAttribute('src'); v.load();
    drawTimeline();
  }
  async function register(file, id = uid()) {
    const kind = kindOf(file);
    if (!kind) { say(`“${file.name}” is not a video, audio or image file.`); return null; }
    const rec = { id, name: file.name, file, kind, url: URL.createObjectURL(file), duration: 0, w: 0, h: 0, thumbs: [] };
    try { await loadMeta(rec); } catch { URL.revokeObjectURL(rec.url); say(`“${file.name}” cannot be previewed by this browser. Convert it to MP4 with the Video Converter first.`); return null; }
    files.set(rec.id, rec);
    makeThumbs(rec);
    return rec;
  }
  async function addFiles(list, { place = true, at = null } = {}) {
    for (const f of list) {
      const rec = await register(f);
      if (!rec) continue;
      filesDirty = true;
      if (place) addToTimeline(rec, at);
    }
    refresh();
  }
  function addToTimeline(rec, at = null) {
    pushUndo();
    const base = { id: uid(), type: rec.kind, file: rec.id, in: 0, speed: 1, x: 0.5, y: 0.5, w: 1, h: 1, rot: 0, flipH: false, flipV: false, opacity: 100, volume: 100, muted: false, fadeIn: 0, fadeOut: 0, crop: { x: 0, y: 0, w: 1, h: 1 } };
    const hadVisual = project.items.some(visual);
    let it;
    if (rec.kind === 'video') {
      if (project.canvas.auto && !hadVisual) { project.canvas.w = rec.w; project.canvas.h = rec.h; layoutCanvas(); }
      const main = project.items.filter((i) => i.track === 0 && visual(i));
      it = { ...base, track: 0, start: at ?? main.reduce((m, i) => Math.max(m, i.start + i.dur), 0), dur: rec.duration };
      if (!hadVisual) it.track = 0;
      fitItem(it, false);
    } else if (rec.kind === 'image') {
      it = { ...base, track: hadVisual ? topTrack() + 1 : 0, start: at ?? time, dur: 5 };
      if (project.canvas.auto && !hadVisual) { project.canvas.w = rec.w - (rec.w % 2); project.canvas.h = rec.h - (rec.h % 2); layoutCanvas(); }
      fitItem(it, false);
      if (hadVisual) { it.w *= 0.4; fixAspect(it); }
    } else {
      it = { ...base, track: -1, start: at ?? 0, dur: rec.duration };
      project.items.forEach((i) => { i.track += 1; }); // make room for a new bottom track
      it.track = 0;
    }
    project.items.push(it);
    settle(it);
    tidyTracks();
    sel = it.id; panel = 'edit';
  }
  function addText(preset = {}) {
    change(() => {
      const it = { id: uid(), type: 'text', track: topTrack() + 1, start: time, dur: 4, in: 0, speed: 1, x: 0.5, y: 0.5, w: 0.5, h: 0.1, rot: 0, opacity: 100, text: 'Your text', font: 'sans', size: 0.08, color: '#ffffff', bg: '', bold: true, italic: false, align: 'center', crop: { x: 0, y: 0, w: 1, h: 1 }, ...preset };
      fixAspect(it);
      project.items.push(it);
      sel = it.id; panel = 'edit';
    });
  }

  // ───────── stage ─────────
  function layoutCanvas() {
    const r = stageArea.getBoundingClientRect();
    const s = Math.min((r.width - 48) / project.canvas.w, (r.height - 84) / project.canvas.h);
    if (!(s > 0)) return;
    canvasWrap.style.width = `${project.canvas.w * s}px`;
    canvasWrap.style.height = `${project.canvas.h * s}px`;
    canvasEl.style.background = project.canvas.bg;
  }
  function syncStage() {
    const live = new Set(project.items.map((i) => i.id));
    for (const id of [...nodes.keys()]) if (!live.has(id)) dropNode(id);
    const ordered = [...project.items].sort((a, b) => a.track - b.track);
    for (const it of ordered) {
      norm(it);
      let n = nodes.get(it.id);
      const f = files.get(it.file);
      if (!n) {
        n = {};
        if (it.type === 'audio') { n.media = h('audio', { src: f?.url, preload: 'auto' }); audioHost.append(n.media); } else {
          n.media = it.type === 'video' ? h('video', { src: f?.url, preload: 'auto', playsInline: true }) : it.type === 'image' ? h('img', { src: f?.url, alt: '', draggable: false }) : h('canvas');
          n.clip = h('div', { class: 'ed-clipbox' }, n.media);
          n.wrap = h('div', { class: 'ed-item' }, n.clip);
          n.wrap.addEventListener('pointerdown', (e) => stagePointer(e, it.id));
        }
        nodes.set(it.id, n);
      }
      if (!n.wrap) continue;
      canvasEl.append(n.wrap); // re-append in track order = stacking order
      const st = n.wrap.style;
      st.left = `${it.x * 100}%`; st.top = `${it.y * 100}%`; st.width = `${it.w * 100}%`; st.height = `${it.h * 100}%`;
      st.transform = `translate(-50%,-50%) rotate(${it.rot}deg)`; st.opacity = it.opacity / 100;
      const m = n.media.style;
      if (it.type === 'text') {
        const key = JSON.stringify([it.text, it.font, it.size, it.color, it.bg, it.bold, it.italic, it.align]);
        if (n.key !== key) { const c = renderText(it, REF); n.media.width = c.width; n.media.height = c.height; n.media.getContext('2d').drawImage(c, 0, 0); n.key = key; }
        m.width = '100%'; m.height = '100%';
      } else {
        m.width = `${100 / it.crop.w}%`; m.height = `${100 / it.crop.h}%`; m.left = `${(-it.crop.x / it.crop.w) * 100}%`; m.top = `${(-it.crop.y / it.crop.h) * 100}%`;
        m.transform = `scale(${it.flipH ? -1 : 1},${it.flipV ? -1 : 1})`;
        // looks: colour matrix and colour key through an SVG filter, blur, mask shape, vignette
        const cm = colorMatrix(it);
        const fkey = JSON.stringify([cm, it.key, it.keyStrength]);
        if (cm || it.key) {
          if (!n.svgf) { n.svgf = document.createElementNS('http://www.w3.org/2000/svg', 'filter'); n.svgf.id = `edf-${it.id}`; n.svgf.setAttribute('color-interpolation-filters', 'sRGB'); svgDefs.append(n.svgf); }
          if (n.fkey !== fkey) {
            n.svgf.innerHTML = (it.key ? `<feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 ${keyAlpha(it.key, it.keyStrength)}"/>` : '')
              + (cm ? `<feColorMatrix type="matrix" values="${cm[0]} ${cm[1]} ${cm[2]} 0 ${cm[3]} ${cm[4]} ${cm[5]} ${cm[6]} 0 ${cm[7]} ${cm[8]} ${cm[9]} ${cm[10]} 0 ${cm[11]} 0 0 0 1 0"/>` : '');
            n.fkey = fkey;
          }
        }
        m.filter = `${cm || it.key ? `url(#edf-${it.id})` : ''} ${it.blur > 0.05 ? `blur(${(it.blur * canvasWrap.clientHeight) / REF}px)` : ''}`.trim();
        n.clip.style.clipPath = MASKS[it.mask]?.css || '';
        if (it.fx.vignette && !n.vig) { n.vig = h('div', { class: 'ed-vig' }); n.clip.append(n.vig); }
        if (n.vig) n.vig.hidden = !it.fx.vignette;
      }
    }
    syncTime();
  }
  function stagePointer(e, id) {
    if (e.button) return;
    e.preventDefault(); e.stopPropagation();
    const it = item(id);
    if (sel !== id) { sel = id; panel = 'edit'; refresh(); }
    const handle = e.target.dataset?.h;
    const box = canvasEl.getBoundingClientRect();
    const cx = box.left + it.x * box.width; const cy = box.top + it.y * box.height;
    const s0 = { x: it.x, y: it.y, w: it.w, size: it.size, rot: it.rot, px: e.clientX, py: e.clientY, d: Math.hypot(e.clientX - cx, e.clientY - cy) || 1 };
    let moved = false;
    const move = (ev) => {
      if (!moved) { moved = true; pushUndo(); }
      if (handle === 'rot') {
        let a = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
        const near = Math.round(a / 90) * 90;
        if (Math.abs(a - near) < 4) a = near;
        it.rot = ((a % 360) + 360) % 360;
      } else if (handle) {
        const f = clamp(Math.hypot(ev.clientX - cx, ev.clientY - cy) / s0.d, 0.05, 20);
        if (it.type === 'text') it.size = clamp(s0.size * f, 0.01, 0.6); else it.w = clamp(s0.w * f, 0.02, 8);
        fixAspect(it);
      } else {
        it.x = s0.x + (ev.clientX - s0.px) / box.width; it.y = s0.y + (ev.clientY - s0.py) / box.height;
        if (Math.abs(it.x - 0.5) < 0.012) it.x = 0.5;
        if (Math.abs(it.y - 0.5) < 0.012) it.y = 0.5;
      }
      syncStage();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (moved) { scheduleSave(); drawPanel(); } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  stageArea.addEventListener('pointerdown', (e) => { if (e.target === stageArea || e.target === canvasEl || e.target === canvasWrap) { sel = null; refresh(); } });

  // ───────── playback ─────────
  function syncTime() {
    for (const it of project.items) {
      const n = nodes.get(it.id);
      if (!n) continue;
      const active = time >= it.start - 0.0005 && time < it.start + it.dur;
      if (n.wrap) {
        n.wrap.style.visibility = active ? 'visible' : 'hidden';
        const fx = it.fx;
        if (active && fx && (fx.fadeIn || fx.fadeOut || fx.zoom)) { // picture fades and slow zoom follow the playhead
          const at = time - it.start;
          const fade = Math.max(0, Math.min(1, fx.fadeIn > 0 ? at / fx.fadeIn : 1, fx.fadeOut > 0 ? (it.dur - at) / fx.fadeOut : 1));
          const z = fx.zoom === 'in' ? 1 + (0.2 * at) / it.dur : fx.zoom === 'out' ? 1.2 - (0.2 * at) / it.dur : 1;
          n.wrap.style.opacity = (it.opacity / 100) * fade;
          n.wrap.style.transform = `translate(-50%,-50%) rotate(${it.rot}deg) scale(${z})`;
        }
      }
      const m = n.media;
      if (!timed(it) || !m) continue;
      if (!active) { if (!m.paused) m.pause(); continue; }
      const local = time - it.start;
      const target = it.in + local * it.speed;
      if (Math.abs(m.currentTime - target) > (playing ? 0.35 : 0.04)) { try { m.currentTime = target; } catch { /* not ready */ } }
      m.playbackRate = it.speed;
      const fade = Math.min(1, it.fadeIn > 0 ? local / it.fadeIn : 1, it.fadeOut > 0 ? (it.dur - local) / it.fadeOut : 1);
      m.muted = !!it.muted;
      m.volume = clamp((it.volume / 100) * Math.max(0, fade), 0, 1); // the preview cannot go above 100%; the export can
      if (playing && m.paused) m.play().catch(() => {});
      if (!playing && !m.paused) m.pause();
    }
    const s = selected();
    const show = !!s && visual(s) && time >= s.start - 0.0005 && time < s.start + s.dur;
    selBox.hidden = !show;
    if (show) Object.assign(selBox.style, { left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%`, transform: `translate(-50%,-50%) rotate(${s.rot}deg)` });
    timeNow.textContent = fmtTime(time).replace(/\.(\d)$/, (_, d) => `.${d}${Math.floor((time * 100) % 10)}`);
    timeAll.textContent = fmtTime(total());
    const head = tlInner.querySelector('.ed-head');
    if (head) head.style.left = `${PAD + time * pps}px`;
  }
  function tick(now) {
    if (!playing) return;
    time += (now - last) / 1000; last = now;
    if (time >= total()) { time = total(); pause(); return; }
    syncTime();
    const x = PAD + time * pps;
    if (x > tlScroll.scrollLeft + tlScroll.clientWidth - 40) tlScroll.scrollLeft = x - 80;
    raf = requestAnimationFrame(tick);
  }
  function play() { if (!project.items.length) return; if (time >= total() - 0.02) time = 0; playing = true; last = performance.now(); playBtn.replaceChildren(ic('pause')); raf = requestAnimationFrame(tick); }
  function pause() { playing = false; cancelAnimationFrame(raf); playBtn.replaceChildren(ic('play')); syncTime(); }
  function seek(t) { time = clamp(t, 0, Math.max(total(), 0)); if (playing) last = performance.now(); syncTime(); }

  // ───────── timeline ─────────
  function setZoom(v) { pps = clamp(v, 4, 400); zoom.value = pps; drawTimeline(); }
  function fitZoom() { setZoom((tlScroll.clientWidth - PAD * 2 - 20) / Math.max(1, total())); }
  function snap(t, self) {
    const pts = [0, time];
    for (const o of project.items) if (o !== self) pts.push(o.start, o.start + o.dur);
    for (const p of pts) if (Math.abs(p - t) * pps < 7) return p;
    return t;
  }
  function drawTimeline() {
    const tot = total();
    const rows = Math.max(2, topTrack() + 2);
    const width = PAD * 2 + Math.max(tot + 4, tlScroll.clientWidth / pps) * pps;
    tlInner.textContent = '';
    tlInner.style.width = `${width}px`;
    tlInner.style.height = `${26 + rows * ROW + 8}px`;
    const ruler = h('div', { class: 'ed-ruler' });
    const step = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((s) => s * pps >= 70) || 600;
    for (let t = 0; t * pps < width; t += step) ruler.append(h('span', { style: { left: `${PAD + t * pps}px` } }, fmtTime(t, step < 1).replace(/^0:(?=\d\d\.)/, '')));
    const seekAt = (e) => seek((e.clientX - tlInner.getBoundingClientRect().left - PAD) / pps);
    ruler.addEventListener('pointerdown', (e) => { seekAt(e); const mv = (ev) => seekAt(ev); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); });
    tlInner.append(ruler);
    for (let r = 0; r < rows; r++) tlInner.append(h('div', { class: 'ed-row', style: { top: `${26 + r * ROW}px` } }));
    const rowTop = (track) => 26 + (rows - 1 - track) * ROW;
    for (const it of project.items) {
      const f = files.get(it.file);
      const w = Math.max(6, it.dur * pps);
      const clip = h('div', { class: `ed-clip ${it.type} ${it.id === sel ? 'sel' : ''}`, style: { left: `${PAD + it.start * pps}px`, top: `${rowTop(it.track) + 4}px`, width: `${w}px`, height: `${ROW - 8}px` } });
      if ((it.type === 'video' || it.type === 'image') && f) {
        const c = h('canvas', { class: 'ed-strip', width: Math.min(4000, Math.ceil(w)), height: 44 });
        const g = c.getContext('2d');
        const tw = Math.max(8, (44 * f.w) / f.h);
        if (it.type === 'image') { const img = nodes.get(it.id)?.media; if (img?.complete && img.naturalWidth) for (let x = 0; x < c.width; x += tw) g.drawImage(img, x, 0, tw, 44); } else if (f.thumbs.length) {
          for (let x = 0; x < c.width; x += tw) {
            const st = it.in + ((x + tw / 2) / pps) * it.speed;
            const best = f.thumbs.reduce((a, b) => (Math.abs(b.t - st) < Math.abs(a.t - st) ? b : a));
            g.drawImage(best.c, x, 0, tw, 44);
          }
        }
        clip.append(c);
      }
      clip.append(h('span', { class: 'ed-label' }, it.type === 'text' ? `Text · ${it.text.split('\n')[0]}` : `${it.muted ? 'Muted · ' : ''}${f?.name || 'missing file'}`), h('i', { class: 'ed-edge l', 'data-e': 'l' }), h('i', { class: 'ed-edge r', 'data-e': 'r' }));
      clip.addEventListener('pointerdown', (e) => clipPointer(e, it.id, rows));
      tlInner.append(clip);
    }
    const head = h('div', { class: 'ed-head', style: { left: `${PAD + time * pps}px` } }, h('b'));
    tlInner.append(head);
    if (!project.items.length) tlInner.append(h('div', { class: 'ed-empty' }, 'Add files from “Files” on the left, or drop them anywhere in the editor.'));
  }
  function clipPointer(e, id) {
    if (e.button) return;
    e.preventDefault();
    const it = item(id);
    const edge = e.target.dataset?.e;
    const f = files.get(it.file);
    const s0 = { start: it.start, dur: it.dur, in: it.in, track: it.track, px: e.clientX, py: e.clientY };
    const srcLen = timed(it) && f ? f.duration : Infinity;
    if (sel !== id) { sel = id; panel = 'edit'; refresh(); }
    let moved = false;
    const move = (ev) => {
      const dx = (ev.clientX - s0.px) / pps;
      if (!moved && Math.abs(ev.clientX - s0.px) + Math.abs(ev.clientY - s0.py) < 4) return;
      if (!moved) { moved = true; pushUndo(); }
      if (edge === 'l') {
        let ns = snap(clamp(s0.start + dx, 0, s0.start + s0.dur - 0.1), it);
        if (timed(it)) ns = Math.max(ns, s0.start - s0.in / it.speed);
        ns = Math.max(0, ns);
        it.start = ns; it.dur = s0.dur - (ns - s0.start); if (timed(it)) it.in = s0.in + (ns - s0.start) * it.speed;
      } else if (edge === 'r') {
        const end = snap(s0.start + s0.dur + dx, it);
        it.dur = clamp(end - s0.start, 0.1, (srcLen - s0.in) / it.speed);
      } else {
        it.start = Math.max(0, snap(s0.start + dx, it));
        const end = snap(it.start + it.dur, it);
        if (end !== it.start + it.dur) it.start = Math.max(0, end - it.dur);
        it.track = Math.max(0, s0.track + Math.round((s0.py - ev.clientY) / ROW));
      }
      drawTimeline(); syncTime();
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (moved) { settle(it); tidyTracks(); refresh(); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  // ───────── clip actions ─────────
  function split() {
    const targets = (selected() ? [selected()] : project.items).filter((i) => time > i.start + 0.05 && time < i.start + i.dur - 0.05);
    if (!targets.length) return say('Move the playhead over a clip to split it.');
    change(() => targets.forEach((i) => {
      const second = { ...JSON.parse(JSON.stringify(i)), id: uid(), start: time, dur: i.start + i.dur - time, in: timed(i) ? i.in + (time - i.start) * i.speed : 0, fadeIn: 0 };
      i.dur = time - i.start; i.fadeOut = 0;
      project.items.push(second);
      if (i.id === sel) sel = second.id; // keep the piece under the playhead selected
    }));
  }
  function duplicate() {
    const i = selected();
    if (!i) return say('Select a clip first.');
    change(() => { const c = { ...JSON.parse(JSON.stringify(i)), id: uid(), start: i.start + i.dur }; project.items.push(c); settle(c); sel = c.id; });
  }
  function remove() { if (!selected()) return; change(() => { project.items = project.items.filter((i) => i.id !== sel); sel = null; if (panel === 'edit') panel = 'files'; }); seek(time); }
  function toggleMute() { const i = selected(); if (!i || !timed(i)) return say('Select a video or audio clip first.'); change(() => { i.muted = !i.muted; }); }

  function copyClip() { const i = selected(); if (!i) return say('Select a clip first.'); clipboard = clone(i); say('Clip copied. Move the playhead and paste.'); }
  function pasteClip() {
    if (!clipboard) return say('Nothing copied yet.');
    if (clipboard.type !== 'text' && !files.has(clipboard.file)) return say('The copied clip’s file is no longer in the project.');
    change(() => { const c = { ...clone(clipboard), id: uid(), start: time }; project.items.push(c); settle(c); sel = c.id; });
  }
  /** Swap the selected clip's source for another file, keeping its place, size and settings. */
  async function replaceWith(file) {
    const i = selected();
    if (!i) return;
    const rec = await register(file);
    if (!rec) return;
    if (rec.kind !== i.type) { files.delete(rec.id); return say(`Choose ${i.type === 'audio' ? 'an audio' : i.type === 'image' ? 'an image' : 'a video'} file to replace this clip.`); }
    filesDirty = true;
    change(() => { i.file = rec.id; i.in = 0; if (timed(i)) i.dur = Math.min(i.dur, rec.duration / i.speed); i.crop = { x: 0, y: 0, w: 1, h: 1 }; fixAspect(i); dropNode(i.id); });
  }
  function extractAudio() {
    const i = selected();
    if (!i || i.type !== 'video') return say('Select a video clip first.');
    change(() => {
      project.items.forEach((o) => { o.track += 1; });
      project.items.push({ id: uid(), type: 'audio', file: i.file, track: 0, start: i.start, dur: i.dur, in: i.in, speed: i.speed, volume: i.volume, muted: false, fadeIn: i.fadeIn, fadeOut: i.fadeOut, enhance: i.enhance, afx: i.afx, opacity: 100, x: 0.5, y: 0.5, w: 1, h: 1, rot: 0, crop: { x: 0, y: 0, w: 1, h: 1 } });
      i.muted = true;
    });
    say('Sound moved to its own track; the video clip is now muted.');
  }
  /** Hold the frame under the playhead for two seconds. */
  async function freeze() {
    const i = selected();
    if (!i || i.type !== 'video' || time < i.start || time >= i.start + i.dur) return say('Select a video clip and put the playhead on the frame to freeze.');
    pause();
    const f = files.get(i.file); const media = nodes.get(i.id)?.media;
    const c = h('canvas', { width: f.w, height: f.h });
    try { c.getContext('2d').drawImage(media, 0, 0, f.w, f.h); } catch { return say('That frame is not ready yet. Try again in a moment.'); }
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const rec = await register(new File([blob], `freeze-${fmtTime(time).replace(/[:.]/g, '-')}.png`, { type: 'image/png' }));
    if (!rec) return;
    filesDirty = true;
    const hold = 2;
    change(() => {
      const t = time; const end = i.start + i.dur;
      const still = { ...clone(i), id: uid(), type: 'image', file: rec.id, start: t, dur: hold, in: 0, speed: 1, fx: { fadeIn: 0, fadeOut: 0, zoom: '', vignette: i.fx.vignette } };
      project.items.filter((o) => o !== i && o.track === i.track && o.start >= t - 0.001).forEach((o) => { o.start += hold; });
      if (t - i.start > 0.05 && end - t > 0.05) { project.items.push({ ...clone(i), id: uid(), start: t + hold, dur: end - t, in: i.in + (t - i.start) * i.speed, fadeIn: 0 }); i.dur = t - i.start; i.fadeOut = 0; } else if (t - i.start <= 0.05) i.start += hold;
      project.items.push(still); sel = still.id;
    });
  }
  let working = false;
  /** Run one of the server helpers on the selected clip's stretch of its file. */
  async function onServer(label, helper, fn) {
    const i = selected();
    if (!i || !timed(i)) return say('Select a video or audio clip first.');
    if (working) return;
    const f = files.get(i.file);
    const src = i.dur * i.speed;
    working = true; pause(); say(label);
    try { const r = await runTool(helper, { files: [f.file], opts: { start: i.in, dur: src } }); await fn(i, f, src, `${r.files[0].url}?inline=1`); } catch (e) { say(e.message); }
    working = false;
  }
  const reverseClip = () => onServer('Reversing the clip…', 'clip-reverse', async (i, f, src, url) => {
    const blob = await (await fetch(url)).blob();
    const video = f.kind === 'video';
    const rec = await register(new File([blob], `reversed-${f.name.replace(/\.[^.]+$/, '')}.${video ? 'mp4' : 'm4a'}`, { type: video ? 'video/mp4' : 'audio/mp4' }));
    if (!rec) return;
    filesDirty = true;
    change(() => { i.file = rec.id; i.in = 0; i.dur = Math.min(i.dur, rec.duration / i.speed); dropNode(i.id); });
    say('Clip reversed.');
  });
  const cutSilences = () => onServer('Looking for silent parts…', 'clip-silence', async (i, f, src, url) => {
    const { silences } = await (await fetch(url)).json();
    if (!silences.length) return say('No silent parts were found in this clip.');
    const keeps = []; let pos = 0;
    for (const [a, b] of silences) { const from = a + 0.08; const to = b - 0.08; if (to <= from) continue; if (from > pos + 0.05) keeps.push([pos, from]); pos = Math.max(pos, to); }
    if (src - pos > 0.05) keeps.push([pos, src]);
    if (!keeps.length) return say('This clip is silent from start to end.');
    let saved = 0;
    change(() => {
      const end = i.start + i.dur; let t = i.start;
      const pieces = keeps.map(([a, b]) => { const piece = { ...clone(i), id: uid(), start: t, in: i.in + a, dur: (b - a) / i.speed, fadeIn: 0, fadeOut: 0 }; t += piece.dur; return piece; });
      saved = end - t;
      project.items.filter((o) => o !== i && o.track === i.track && o.start >= end - 0.001).forEach((o) => { o.start -= saved; });
      project.items = project.items.filter((o) => o !== i).concat(pieces);
      sel = pieces[0].id;
    });
    say(`Cut ${silences.length} silent part${silences.length > 1 ? 's' : ''} — the clip is ${saved.toFixed(1)} s shorter.`);
  });
  function restack(front) { const i = selected(); if (!i) return; change(() => { i.track = front ? topTrack() + 1 : -1; if (!front) { project.items.forEach((o) => { o.track += 1; }); } }); }

  // ───────── doodles ─────────
  function drawDoodle() {
    const { g, c, strokes } = doodle;
    g.clearRect(0, 0, c.width, c.height); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const st of strokes) { g.strokeStyle = st.color; g.lineWidth = st.width; g.beginPath(); st.pts.forEach(([x, y], n) => (n ? g.lineTo(x, y) : g.moveTo(x, y))); if (st.pts.length === 1) g.lineTo(st.pts[0][0] + 0.1, st.pts[0][1]); g.stroke(); }
  }
  function startDoodle() {
    pause();
    const c = h('canvas', { class: 'ed-doodle', width: Math.round(REF * canvasAr()), height: REF });
    doodle = { c, g: c.getContext('2d'), strokes: [] };
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault(); c.setPointerCapture(e.pointerId);
      const at = (ev) => { const r = c.getBoundingClientRect(); return [((ev.clientX - r.left) / r.width) * c.width, ((ev.clientY - r.top) / r.height) * c.height]; };
      const st = { color: pen.color, width: pen.width, pts: [at(e)] };
      doodle.strokes.push(st); drawDoodle();
      const move = (ev) => { st.pts.push(at(ev)); drawDoodle(); };
      const up = () => { c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); drawPanel(); };
      c.addEventListener('pointermove', move); c.addEventListener('pointerup', up);
    });
    sel = null; canvasWrap.append(c); refresh();
  }
  function stopDoodle() { doodle?.c.remove(); doodle = null; drawPanel(); }
  async function saveDoodle() {
    if (!doodle.strokes.length) return stopDoodle();
    const blob = await new Promise((r) => doodle.c.toBlob(r, 'image/png'));
    stopDoodle();
    const rec = await register(new File([blob], `doodle-${Date.now().toString(36)}.png`, { type: 'image/png' }));
    if (!rec) return;
    filesDirty = true;
    change(() => { const it = norm({ id: uid(), type: 'image', file: rec.id, track: topTrack() + 1, start: time, dur: 5, in: 0, speed: 1, x: 0.5, y: 0.5, w: 1, h: 1, rot: 0, flipH: false, flipV: false, opacity: 100, crop: { x: 0, y: 0, w: 1, h: 1 } }); fixAspect(it); project.items.push(it); sel = it.id; panel = 'edit'; });
  }

  // ───────── side panels ─────────
  const field = (label, control, out) => h('div', { class: 'field' }, h('div', { class: 'lbl' }, label, out), control);
  /** A control bound to a property: the first movement records an undo step, the rest update live. */
  function bind(input, apply, { relayout = false } = {}) {
    let armed = false;
    input.addEventListener('input', () => { if (!armed) { armed = true; pushUndo(); } apply(input); if (relayout) layoutCanvas(); syncStage(); drawTimeline(); });
    input.addEventListener('change', () => { armed = false; scheduleSave(); });
    return input;
  }
  function slider(label, get, set, min, max, step, unit = '') {
    const out = h('output', {}, `${get()}${unit}`);
    return field(label, bind(h('input', { type: 'range', min, max, step, value: get() }), (i) => { set(Number(i.value)); out.textContent = `${i.value}${unit}`; }), out);
  }
  const numField = (label, get, set, min, max, step, unit) => field(label, h('div', { class: 'unit' }, bind(h('input', { type: 'number', min, max, step, value: Number(get().toFixed(2)) }), (i) => { if (i.value !== '') set(clamp(Number(i.value), min, max)); }), unit && h('span', {}, unit)));

  function panelFiles() {
    const list = h('div', { class: 'ed-files' });
    for (const f of files.values()) {
      list.append(h('div', { class: 'ed-file' },
        h('div', { class: `ed-fthumb ${f.kind}` }, f.kind === 'image' ? h('img', { src: f.url, alt: '' }) : f.kind === 'video' ? 'VID' : 'AUD'),
        h('div', { class: 'meta' }, h('b', { title: f.name }, f.name), h('small', {}, `${f.kind === 'image' ? `${f.w}×${f.h}` : fmtTime(f.duration)} · ${fmtSize(f.file.size)}`)),
        h('button', { class: 'btn small', type: 'button', onclick: () => { addToTimeline(f, f.kind === 'video' ? null : time); refresh(); } }, 'Add')));
    }
    return [h('h2', {}, 'Files'), h('button', { class: 'btn primary', type: 'button', style: { width: '100%' }, onclick: () => fileInput.click() }, 'Upload files'),
      h('p', { class: 'hint' }, files.size ? 'Click “Add” to place a file on the timeline again.' : 'Videos, images and audio. You can also drop files anywhere in the editor.'), list];
  }
  function panelText() {
    return [h('h2', {}, 'Text'), h('p', { class: 'hint' }, 'Adds a text layer at the playhead. Drag it on the preview; use the corners to resize.'),
      h('button', { class: 'ed-preset', type: 'button', style: { font: `700 22px ${FONTS.sans}` }, onclick: () => addText({ text: 'Title', size: 0.11, y: 0.5 }) }, 'Title'),
      h('button', { class: 'ed-preset', type: 'button', style: { font: `400 16px ${FONTS.sans}` }, onclick: () => addText({ text: 'Subtitle text', size: 0.055, bold: false, y: 0.62 }) }, 'Subtitle'),
      h('button', { class: 'ed-preset', type: 'button', style: { font: `700 15px ${FONTS.sans}`, background: '#000', color: '#fff' }, onclick: () => addText({ text: 'Caption on a dark bar', size: 0.05, bg: '#000000', y: 0.88 }) }, 'Caption'),
      h('button', { class: 'ed-preset', type: 'button', style: { font: `400 22px ${FONTS.display}` }, onclick: () => addText({ text: 'BIG IMPACT', size: 0.14, font: 'display', bold: false, color: '#ffe14a' }) }, 'BIG IMPACT')];
  }
  function panelCanvas() {
    const c = project.canvas;
    return [h('h2', {}, 'Canvas'), h('div', { class: 'section-label' }, 'Shape'),
      h('div', { class: 'ed-ratios' }, CANVASES.map(([label, w, hh]) => h('button', { class: `btn small ${Math.abs(c.w / c.h - w / hh) < 0.01 ? 'on' : ''}`, type: 'button',
        onclick: () => { change(() => { c.w = w; c.h = hh; c.auto = false; project.items.forEach(fixAspect); }); layoutCanvas(); syncStage(); } }, label))),
      h('p', { class: 'hint' }, `${c.w} × ${c.h}. Clips keep their size; use Fit or Fill on a clip to match the new shape.`),
      field('Background colour', bind(h('input', { type: 'color', value: c.bg }), (i) => { c.bg = i.value; }, { relayout: true }))];
  }
  function panelRecord() {
    if (!navigator.mediaDevices || !window.MediaRecorder) return [h('h2', {}, 'Record'), h('div', { class: 'alert' }, 'Recording is not available in this browser.')];
    if (recState) return [h('h2', {}, 'Record'), h('div', { class: 'ed-rec' }, h('span', { class: 'rec-dot' }), `Recording ${recState.label}…`, h('div', { class: 'rec-timer', id: 'ed-rec-time' }, '0:00')), h('button', { class: 'btn primary', type: 'button', style: { width: '100%' }, onclick: () => recState.recorder.stop() }, 'Stop and add to project')];
    const go = (label, getStream, audioOnly) => h('button', { class: 'ed-preset', type: 'button', onclick: async () => {
      try {
        const stream = await getStream();
        const mime = (audioOnly ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'] : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']).find((m) => MediaRecorder.isTypeSupported(m)) || '';
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks = []; let secs = 0;
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        const timer = setInterval(() => { secs++; const t = document.getElementById('ed-rec-time'); if (t) t.textContent = fmtTime(secs, false); }, 1000);
        recorder.onstop = () => {
          clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); recState = null;
          const blob = new Blob(chunks, { type: recorder.mimeType || mime });
          const ext = blob.type.includes('mp4') ? (audioOnly ? 'm4a' : 'mp4') : 'webm';
          if (blob.size && !dead) addFiles([new File([blob], `${label.replace(/\s+/g, '-')}-${Date.now().toString(36)}.${ext}`, { type: blob.type })], { at: audioOnly ? time : null }); else drawPanel();
        };
        stream.getVideoTracks()[0]?.addEventListener('ended', () => recorder.state !== 'inactive' && recorder.stop());
        recState = { recorder, label, stream };
        recorder.start(1000);
        drawPanel();
      } catch (e) { say(e.name === 'NotAllowedError' ? 'Recording was cancelled or blocked by the browser.' : `Could not start recording: ${e.message}`); }
    } }, label);
    return [h('h2', {}, 'Record'), h('p', { class: 'hint' }, 'Record straight into the project. The recording is added to the timeline when you stop.'),
      go('Screen', () => navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true })),
      go('Camera', () => navigator.mediaDevices.getUserMedia({ video: { height: { ideal: 720 } }, audio: true })),
      go('Voice', () => navigator.mediaDevices.getUserMedia({ audio: true }), true)];
  }
  function panelSpeech() {
    const text = h('textarea', { rows: 7, placeholder: 'Type what should be said…' });
    const voice = h('select', {}, TTS_VOICES.map(([v, l]) => h('option', { value: v, selected: v === 'slt' }, l)));
    const btn = h('button', { class: 'btn primary', type: 'button', style: { width: '100%' } }, 'Generate and add at playhead');
    btn.onclick = async () => {
      if (!text.value.trim()) return say('Type some text first.');
      btn.disabled = true; btn.textContent = 'Generating…';
      try {
        const r = await runTool('text-to-speech', { opts: { text: text.value, voice: voice.value, speed: 1, format: 'mp3' } });
        const blob = await (await fetch(`${r.files[0].url}?inline=1`)).blob();
        await addFiles([new File([blob], `speech-${Date.now().toString(36)}.mp3`, { type: 'audio/mpeg' })], { at: time });
      } catch (e) { say(e.message); btn.disabled = false; btn.textContent = 'Generate and add at playhead'; }
    };
    return [h('h2', {}, 'Text to speech'), field('Text', text), field('Voice', voice), btn, h('p', { class: 'hint' }, 'English voices. The spoken audio is added as a clip you can move and trim.')];
  }
  function panelStickers() {
    return [h('h2', {}, 'Stickers'), h('p', { class: 'hint' }, 'Adds a sticker at the playhead. Drag it on the preview and use the corners to resize.'),
      h('div', { class: 'ed-stickers' }, STICKERS.map((e) => h('button', { type: 'button', 'aria-label': `Sticker ${e}`, onclick: () => addText({ text: e, font: 'emoji', size: 0.16, bold: false }) }, e)))];
  }
  function panelDoodle() {
    const controls = [field('Colour', h('input', { type: 'color', value: pen.color, oninput: (e) => { pen.color = e.target.value; } })),
      (() => { const out = h('output', {}, `${pen.width}`); return field('Pen size', h('input', { type: 'range', min: 3, max: 60, step: 1, value: pen.width, oninput: (e) => { pen.width = Number(e.target.value); out.textContent = e.target.value; } }), out); })()];
    if (!doodle) return [h('h2', {}, 'Doodle'), h('p', { class: 'hint' }, 'Draw freehand over the video. The drawing becomes a layer you can move, resize and time like any clip.'), ...controls,
      h('button', { class: 'btn primary', type: 'button', style: { width: '100%' }, disabled: !project.items.length, onclick: startDoodle }, 'Start drawing')];
    return [h('h2', {}, 'Doodle'), h('p', { class: 'hint' }, 'Draw on the preview now.'), ...controls,
      h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', disabled: !doodle.strokes.length, onclick: () => { doodle.strokes.pop(); drawDoodle(); drawPanel(); } }, 'Undo stroke'),
        h('button', { class: 'btn small', type: 'button', disabled: !doodle.strokes.length, onclick: () => { doodle.strokes.length = 0; drawDoodle(); drawPanel(); } }, 'Clear')),
      h('button', { class: 'btn primary', type: 'button', style: { width: '100%' }, onclick: saveDoodle }, 'Done — add to video'),
      h('button', { class: 'btn', type: 'button', style: { width: '100%' }, onclick: stopDoodle }, 'Cancel')];
  }
  function panelCaptions() {
    const text = h('textarea', { rows: 8, placeholder: 'One caption per line…' });
    const secs = h('input', { type: 'number', min: 1, max: 3600, step: 0.5, value: Math.max(3, Math.round(total() - time)) || 6 });
    const style = h('select', {}, [['bar', 'White on a dark bar'], ['plain', 'White with shadow'], ['yellow', 'Yellow with shadow']].map(([v, l]) => h('option', { value: v }, l)));
    const add = () => {
      const lines = text.value.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return say('Type at least one caption line.');
      const span = clamp(Number(secs.value) || lines.length * 2.5, lines.length * 0.6, 3600);
      const weights = lines.map((l) => Math.max(10, l.length)); const sum = weights.reduce((x, y) => x + y, 0);
      change(() => {
        const track = topTrack() + 1; let t = time;
        lines.forEach((line, n) => {
          const it = norm({ id: uid(), type: 'text', track, start: t, dur: (span * weights[n]) / sum, in: 0, speed: 1, x: 0.5, y: 0.87, w: 0.5, h: 0.1, rot: 0, opacity: 100, text: line, font: 'sans', size: 0.045, color: style.value === 'yellow' ? '#ffe14a' : '#ffffff', bg: style.value === 'bar' ? '#000000' : '', bold: true, italic: false, align: 'center', crop: { x: 0, y: 0, w: 1, h: 1 } });
          fixAspect(it); project.items.push(it); t += it.dur;
        });
      });
      say(`${lines.length} caption${lines.length > 1 ? 's' : ''} added from the playhead.`);
    };
    return [h('h2', {}, 'Captions'), h('p', { class: 'hint' }, 'Type or paste the words, one caption per line. They are placed one after another from the playhead; longer lines stay on screen longer.'),
      field('Captions', text), field('Spread over', h('div', { class: 'unit' }, secs, h('span', {}, 'seconds'))), field('Style', style),
      h('button', { class: 'btn primary', type: 'button', style: { width: '100%' }, onclick: add }, 'Add captions'),
      h('p', { class: 'hint' }, 'Captions are typed, not recognised from speech. Drag each one on the timeline to fine-tune its timing.')];
  }
  function panelSounds() {
    return [h('h2', {}, 'Sound effects'), h('p', { class: 'hint' }, 'Adds the sound at the playhead as its own audio clip.'),
      h('div', { class: 'ed-actions' }, SOUNDS.map((name) => h('button', { class: 'btn small', type: 'button', onclick: async () => { try { await addFiles([await synth(name)], { at: time }); } catch (e) { say(`Could not create the sound: ${e.message}`); } } }, name)))];
  }
  /** The settings of one clip tool. They open in the tray under the timeline. */
  function clipSection(key, it) {
    const f = files.get(it.file);
    const toggle = (label, get, set) => h('label', { class: 'check' }, bind(h('input', { type: 'checkbox', checked: get() }), (i) => set(i.checked)), label);
    const choice = (label, get, set, list) => field(label, bind(h('select', {}, list.map(([v, l]) => h('option', { value: v, selected: get() === v }, l))), (i) => set(i.value)));
    const exportOnly = h('p', { class: 'hint wide' }, 'You will hear this in the exported video; the preview plays the original sound.');
    switch (key) {
      case 'text': return [h('div', { class: 'field wide' }, h('div', { class: 'lbl' }, 'Text'), bind(h('textarea', { rows: 2, value: it.text }), (i) => { it.text = i.value; fixAspect(it); })),
        field('Font', bind(h('select', {}, [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono'], ['display', 'Display'], ['emoji', 'Emoji']].map(([v, l]) => h('option', { value: v, selected: it.font === v }, l))), (i) => { it.font = i.value; fixAspect(it); })),
        slider('Size', () => Math.round(it.size * 1000) / 10, (v) => { it.size = v / 100; fixAspect(it); }, 1, 40, 0.5, '%'),
        h('div', { class: 'row' }, field('Colour', bind(h('input', { type: 'color', value: it.color }), (i) => { it.color = i.value; })), field('Background', bind(h('input', { type: 'color', value: it.bg || '#000000' }), (i) => { it.bg = i.value; })),
          h('button', { class: 'btn small', type: 'button', onclick: () => change(() => { it.bg = ''; }) }, 'No background')),
        h('div', { class: 'row' }, h('button', { class: `btn small ${it.bold ? 'on' : ''}`, type: 'button', onclick: () => change(() => { it.bold = !it.bold; fixAspect(it); }) }, 'Bold'),
          h('button', { class: `btn small ${it.italic ? 'on' : ''}`, type: 'button', onclick: () => change(() => { it.italic = !it.italic; fixAspect(it); }) }, 'Italic'),
          ['left', 'center', 'right'].map((a) => h('button', { class: `btn small ${it.align === a ? 'on' : ''}`, type: 'button', onclick: () => change(() => { it.align = a; }) }, a[0].toUpperCase() + a.slice(1))))];
      case 'transform': return [h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', onclick: () => change(() => fitItem(it, false)) }, ic('fit'), 'Fit'), h('button', { class: 'btn small', type: 'button', onclick: () => change(() => fitItem(it, true)) }, ic('fill'), 'Fill'),
        h('button', { class: 'btn small', type: 'button', onclick: () => change(() => { it.rot = (Math.round(it.rot / 90) * 90 + 90) % 360; }) }, ic('rot'), 'Rotate 90°')),
        slider('Rotation', () => Math.round(it.rot), (v) => { it.rot = v; }, 0, 359, 1, '°'),
        h('p', { class: 'hint' }, 'Drag the clip on the preview to move it; drag a corner to resize.')];
      case 'crop': {
        const cropSet = (k) => (v) => {
          const c = it.crop; const r = 1 - c.x - c.w; const b = 1 - c.y - c.h; const p = v / 100;
          const before = c.w;
          if (k === 'l') { c.x = Math.min(p, 0.95 - r); c.w = 1 - r - c.x; } else if (k === 'r') { c.w = Math.max(0.05, 1 - c.x - p); } else if (k === 't') { c.y = Math.min(p, 0.95 - b); c.h = 1 - b - c.y; } else c.h = Math.max(0.05, 1 - c.y - p);
          it.w *= c.w / before; // keep the picture the same scale while its edges move in
          fixAspect(it);
        };
        const c = it.crop;
        return [slider('Left', () => Math.round(c.x * 100), cropSet('l'), 0, 90, 1, '%'), slider('Right', () => Math.round((1 - c.x - c.w) * 100), cropSet('r'), 0, 90, 1, '%'),
          slider('Top', () => Math.round(c.y * 100), cropSet('t'), 0, 90, 1, '%'), slider('Bottom', () => Math.round((1 - c.y - c.h) * 100), cropSet('b'), 0, 90, 1, '%'),
          h('button', { class: 'btn small', type: 'button', onclick: () => change(() => { it.w /= it.crop.w; it.crop = { x: 0, y: 0, w: 1, h: 1 }; fixAspect(it); }) }, 'Reset crop')];
      }
      case 'trim': {
        const maxDur = timed(it) && f ? (f.duration - it.in) / it.speed : 3600;
        return [numField('Starts at', () => it.start, (v) => { it.start = v; }, 0, 21600, 0.1, 's'), numField('Length', () => it.dur, (v) => { it.dur = Math.min(v, maxDur); }, 0.1, 21600, 0.1, 's'),
          timed(it) && f && f.duration - it.dur * it.speed > 0.1 && slider('Slip (which part of the file plays)', () => Math.round(it.in * 10) / 10, (v) => { it.in = clamp(v, 0, f.duration - it.dur * it.speed); }, 0, Math.floor((f.duration - it.dur * it.speed) * 10) / 10, 0.1, ' s'),
          h('p', { class: 'hint' }, 'You can also drag the ends of the clip on the timeline.')];
      }
      case 'speed': return [slider('Speed', () => it.speed, (v) => { const src = it.dur * it.speed; it.speed = v; it.dur = src / v; }, 0.25, 4, 0.05, '×'),
        h('div', { class: 'row' }, [0.5, 1, 1.5, 2, 3].map((v) => h('button', { class: `btn small ${it.speed === v ? 'on' : ''}`, type: 'button', onclick: () => change(() => { const src = it.dur * it.speed; it.speed = v; it.dur = src / v; }) }, `${v}×`)))];
      case 'volume': return [slider('Volume', () => it.volume, (v) => { it.volume = v; }, 0, 200, 5, '%'), toggle('Mute', () => it.muted, (v) => { it.muted = v; })];
      case 'fade': return [slider('Fade in', () => it.fadeIn, (v) => { it.fadeIn = v; }, 0, 10, 0.5, ' s'), slider('Fade out', () => it.fadeOut, (v) => { it.fadeOut = v; }, 0, 10, 0.5, ' s')];
      case 'opacity': return [slider('Opacity', () => it.opacity, (v) => { it.opacity = v; }, 0, 100, 1, '%')];
      case 'adjust': { const a = it.adj; return [slider('Brightness', () => a.b, (v) => { a.b = v; }, -60, 60, 1), slider('Contrast', () => a.c, (v) => { a.c = v; }, -60, 60, 1), slider('Saturation', () => a.s, (v) => { a.s = v; }, -100, 100, 1),
        slider('Warmth', () => a.w, (v) => { a.w = v; }, -100, 100, 1), slider('Hue', () => a.h, (v) => { a.h = v; }, -180, 180, 1, '°'), slider('Blur', () => it.blur, (v) => { it.blur = v; }, 0, 30, 0.5),
        h('button', { class: 'btn small', type: 'button', onclick: () => change(() => { it.adj = { ...ADJUST0 }; it.blur = 0; }) }, 'Reset adjustments')]; }
      case 'filters': return [h('div', { class: 'ed-filters wide' }, FILTERS.map(([k, l]) => h('button', { class: `ed-filter ${it.filter === k ? 'on' : ''}`, type: 'button', 'aria-pressed': String(it.filter === k), onclick: () => change(() => { it.filter = k; }) }, h('i', { style: { filter: filterSwatch(k) } }), l)))];
      case 'effects': return [slider('Fade in', () => it.fx.fadeIn, (v) => { it.fx.fadeIn = v; }, 0, 5, 0.1, ' s'), slider('Fade out', () => it.fx.fadeOut, (v) => { it.fx.fadeOut = v; }, 0, 5, 0.1, ' s'),
        choice('Slow zoom', () => it.fx.zoom, (v) => { it.fx.zoom = v; }, [['', 'None'], ['in', 'Zoom in'], ['out', 'Zoom out']]),
        it.type !== 'text' && toggle('Vignette (dark corners)', () => it.fx.vignette, (v) => { it.fx.vignette = v; })];
      case 'mask': return [h('div', { class: 'row wide' }, h('button', { class: `btn small ${!it.mask ? 'on' : ''}`, type: 'button', onclick: () => change(() => { it.mask = ''; }) }, 'None'),
        Object.entries(MASKS).map(([k, m]) => h('button', { class: `btn small ${it.mask === k ? 'on' : ''}`, type: 'button', onclick: () => change(() => { it.mask = k; }) }, m.label))),
      h('p', { class: 'hint wide' }, 'The mask follows the clip’s box: resize or crop the clip to change the shape.')];
      case 'key': return [choice('Remove this background colour', () => it.key, (v) => { it.key = v; }, [['', 'Off'], ['green', 'Green'], ['blue', 'Blue']]), slider('Strength', () => it.keyStrength, (v) => { it.keyStrength = v; }, 5, 80, 1),
        h('p', { class: 'hint' }, 'Put this clip on a track above the background you want behind it. The preview is a close guide; the export keys more precisely.')];
      case 'afx': return [choice('Audio effect', () => it.afx, (v) => { it.afx = v; }, AUDIO_FX), exportOnly];
      default: return null;
    }
  }
  const pic = (i) => i.type === 'video' || i.type === 'image';
  const act = (fn) => () => fn();
  /** Every clip feature: its own icon, either opening settings (no `run`) or acting at once (`run`). */
  const CLIP_TOOLS = [
    { key: 'text', label: 'Edit text', icon: 'text', when: (i) => i.type === 'text' },
    { key: 'split', label: 'Split', icon: 'cut', when: () => true, run: act(split) },
    { key: 'volume', label: 'Volume', icon: 'sound', when: timed },
    { key: 'speed', label: 'Speed', icon: 'speed', when: timed },
    { key: 'effects', label: 'Effects', icon: 'sparkle', when: visual },
    { key: 'delete', label: 'Delete', icon: 'trash', when: () => true, run: act(remove) },
    { key: 'adjust', label: 'Adjust', icon: 'adjust', when: pic },
    { key: 'filters', label: 'Filters', icon: 'filters', when: pic },
    { key: 'crop', label: 'Crop', icon: 'crop', when: pic },
    { key: 'transform', label: 'Transform', icon: 'move', when: visual },
    { key: 'mirror', label: 'Mirror', icon: 'fliph', when: pic, run: (i) => change(() => { i.flipH = !i.flipH; }), on: (i) => i.flipH },
    { key: 'flip', label: 'Flip', icon: 'flipv', when: pic, run: (i) => change(() => { i.flipV = !i.flipV; }), on: (i) => i.flipV },
    { key: 'mask', label: 'Mask', icon: 'mask', when: pic },
    { key: 'opacity', label: 'Opacity', icon: 'drop', when: visual },
    { key: 'key', label: 'Green screen', icon: 'key', when: pic },
    { key: 'trim', label: 'Trim', icon: 'trim', when: () => true },
    { key: 'fade', label: 'Fade audio', icon: 'fadea', when: timed },
    { key: 'afx', label: 'Audio FX', icon: 'afx', when: timed },
    { key: 'enhance', label: 'Voice enhance', icon: 'enhance', when: timed, run: (i) => { change(() => { i.enhance = !i.enhance; }); say(i.enhance ? 'Voice enhance is on for this clip. You will hear it in the exported video.' : 'Voice enhance is off.'); }, on: (i) => i.enhance },
    { key: 'replace', label: 'Replace', icon: 'replace', when: (i) => i.type !== 'text', run: () => replaceInput.click() },
    { key: 'copy', label: 'Copy', icon: 'copy', when: () => true, run: act(copyClip) },
    { key: 'paste', label: 'Paste', icon: 'paste', when: () => true, run: act(pasteClip) },
    { key: 'duplicate', label: 'Duplicate', icon: 'dup', when: () => true, run: act(duplicate) },
    { key: 'extract', label: 'Extract audio', icon: 'extract', when: (i) => i.type === 'video', run: act(extractAudio) },
    { key: 'freeze', label: 'Freeze', icon: 'freeze', when: (i) => i.type === 'video', run: act(freeze) },
    { key: 'reverse', label: 'Reverse', icon: 'reverse', when: timed, run: act(reverseClip) },
    { key: 'silence', label: 'Cut silences', icon: 'silence', when: timed, run: act(cutSilences) },
    { key: 'front', label: 'To front', icon: 'front', when: () => true, run: () => restack(true) },
    { key: 'backward', label: 'To back', icon: 'backward', when: () => true, run: () => restack(false) },
  ];
  /** Features that add something to the project. */
  const MAIN_TOOLS = [['files', 'Media', 'media', panelFiles], ['sounds', 'Sound FX', 'note', panelSounds], ['text', 'Text', 'text', panelText], ['record', 'Record', 'mic', panelRecord], ['captions', 'Captions', 'cc', panelCaptions],
    ['doodle', 'Doodle', 'doodle', panelDoodle], ['stickers', 'Stickers', 'sticker', panelStickers], ['speech', 'Speech', 'speech', panelSpeech], ['canvas', 'Canvas', 'canvas', panelCanvas]];
  const toolBtn = (icon, label, onclick, cls) => h('button', { class: `ed-tool ${cls}`, type: 'button', onclick }, ic(icon), h('span', {}, label));
  function drawPanel() {
    const it = selected();
    let title = ''; let content = null;
    tools.textContent = '';
    if (it) { // a clip is selected: its tools replace the main ones
      norm(it);
      const list = CLIP_TOOLS.filter((t) => t.when(it));
      if (!list.some((t) => t.key === editTab && !t.run)) editTab = null;
      tools.append(toolBtn('back', 'Back', () => { sel = null; refresh(); }, 'ed-back'), h('i', { class: 'ed-sep' }));
      for (const t of list) {
        const open = editTab === t.key;
        tools.append(toolBtn(t.icon, t.label, t.run ? () => t.run(it) : () => { editTab = open ? null : t.key; drawPanel(); }, `ed-sub ${open || t.on?.(it) ? 'on' : ''}`));
        if (open) { title = t.label; content = clipSection(t.key, it); }
      }
    } else {
      for (const [key, label, icon, fn] of MAIN_TOOLS) {
        const open = panel === key;
        tools.append(toolBtn(icon, label, () => { panel = open ? '' : key; drawPanel(); }, `ed-tab ${open ? 'on' : ''}`));
        if (open) { content = fn(); title = label; if (content[0]?.tagName === 'H2') content.shift(); }
      }
    }
    side.textContent = '';
    side.hidden = !content;
    if (content) side.append(h('div', { class: 'ed-tray-head' }, h('h2', {}, title), iconBtn('close', 'Close', () => { if (it) editTab = null; else panel = ''; drawPanel(); })), ...content.filter(Boolean));
    undoBtn.disabled = !undo.length; redoBtn.disabled = !redo.length;
  }
  function refresh() { syncStage(); drawTimeline(); drawPanel(); scheduleSave(); }

  // ───────── saving ─────────
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await dbSet('project', snapshot());
        if (filesDirty) { filesDirty = false; await dbSet('files', [...files.values()].map((f) => ({ id: f.id, name: f.name, blob: f.file }))); }
        const s = document.getElementById('ed-saved'); if (s) s.textContent = 'Saved in this browser';
      } catch { /* storage unavailable (private window or full disk): the editor still works */ }
    }, 700);
  }
  async function restore() {
    try {
      const saved = await dbGet('project');
      if (!saved) return;
      const stored = (await dbGet('files')) || [];
      for (const s of stored) await register(new File([s.blob], s.name, { type: s.blob.type }), s.id);
      const p = JSON.parse(saved);
      p.items = p.items.filter((i) => i.type === 'text' || files.has(i.file));
      project = p;
      nameIn.value = project.name;
    } catch { /* nothing saved */ }
  }
  function newProject() {
    if (project.items.length && !window.confirm('Start a new project? The current one will be cleared from this browser.')) return;
    pause();
    for (const f of files.values()) URL.revokeObjectURL(f.url);
    files.clear(); filesDirty = true;
    project = { name: 'Untitled project', canvas: { w: 1920, h: 1080, bg: '#000000', auto: true }, items: [] };
    undo.length = 0; redo.length = 0; sel = null; time = 0; panel = 'files'; nameIn.value = project.name;
    layoutCanvas(); refresh();
  }

  // ───────── export ─────────
  function openExport() {
    if (!project.items.length) return say('Add something to the timeline first.');
    pause();
    const opts = { height: '720', format: 'mp4', quality: '22' };
    const pickOne = (key, label, choices) => field(label, h('select', { onchange: (e) => { opts[key] = e.target.value; } }, choices.map(([v, l]) => h('option', { value: v, selected: opts[key] === v }, l))));
    const body = h('div', { class: 'stack' });
    const close = () => modal.remove();
    const modal = h('div', { class: 'ed-modal', onpointerdown: (e) => { if (e.target === modal && !modal.dataset.busy) close(); } }, h('div', { class: 'panel ed-dialog', role: 'dialog', 'aria-label': 'Export video' }, body));
    const start = async () => {
      const used = [...new Set(project.items.filter((i) => i.type !== 'text').map((i) => i.file))];
      const uploads = used.map((id) => files.get(id).file);
      const side2 = Number(opts.height);
      const H = canvasAr() >= 1 ? side2 : side2 / canvasAr();
      const items = [];
      for (const it of project.items) {
        if (it.type === 'text') {
          const blob = await new Promise((r) => renderText(it, H).toBlob(r, 'image/png'));
          uploads.push(new File([blob], `text-${it.id}.png`, { type: 'image/png' }));
          items.push({ ...it, file: uploads.length - 1 });
        } else {
          const out = { ...it, file: used.indexOf(it.file), cm: colorMatrix(it) };
          if (MASKS[it.mask]) { uploads.push(new File([await maskPng(it.mask)], `mask-${it.id}.png`, { type: 'image/png' })); out.maskFile = uploads.length - 1; }
          items.push(out);
        }
      }
      const prog = progressView();
      body.replaceChildren(h('h2', {}, 'Exporting…'), prog.el);
      modal.dataset.busy = '1';
      try {
        const result = await runTool('video-editor', { files: uploads, opts: { ...opts, project: { name: project.name, canvas: project.canvas, items } } }, (f) => prog.set(f));
        body.replaceChildren(resultsView(result, { onReset: close, resetLabel: 'Back to the editor' }));
      } catch (e) { body.replaceChildren(h('h2', {}, 'Export failed'), h('div', { class: 'alert' }, e.message), h('button', { class: 'btn', type: 'button', onclick: close }, 'Back to the editor')); }
      delete modal.dataset.busy;
    };
    body.append(h('h2', {}, 'Export video'), h('p', { class: 'hint' }, `${fmtTime(total())} long · canvas ${project.canvas.w}×${project.canvas.h}`),
      pickOne('height', 'Resolution', [['480', '480p'], ['720', '720p (HD)'], ['1080', '1080p (Full HD)'], ['1440', '1440p'], ['2160', '4K']]),
      pickOne('format', 'Format', [['mp4', 'MP4'], ['mov', 'MOV'], ['mkv', 'MKV'], ['webm', 'WebM']]),
      pickOne('quality', 'Quality', [['22', 'Standard'], ['18', 'High (larger file)'], ['27', 'Small file']]),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn', type: 'button', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', type: 'button', onclick: start }, 'Export')));
    el.append(modal);
  }

  // ───────── global events ─────────
  const onKey = (e) => {
    if (e.target.closest('input, textarea, select') || el.querySelector('.ed-modal') || doodle) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); if (playing) pause(); else play(); } else if (k === 'delete' || k === 'backspace') remove();
    else if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); } else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); doRedo(); } else if ((e.ctrlKey || e.metaKey) && k === 'c') copyClip(); else if ((e.ctrlKey || e.metaKey) && k === 'v') pasteClip(); else if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); duplicate(); } else if (k === 's' && !e.ctrlKey && !e.metaKey) split();
    else if (k === 'm') toggleMute(); else if (k === 'arrowleft') seek(time - (e.shiftKey ? 1 : 1 / 30)); else if (k === 'arrowright') seek(time + (e.shiftKey ? 1 : 1 / 30)); else if (k === 'escape') { sel = null; refresh(); }
  };
  window.addEventListener('keydown', onKey);
  el.addEventListener('dragover', (e) => e.preventDefault());
  el.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); });
  // a mouse wheel over the toolbar scrolls it sideways
  tools.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && tools.scrollWidth > tools.clientWidth) { e.preventDefault(); tools.scrollLeft += e.deltaY; } }, { passive: false });
  const ro = new ResizeObserver(() => { layoutCanvas(); syncStage(); drawTimeline(); });
  ro.observe(stageArea); ro.observe(tlScroll);

  drawPanel(); drawTimeline();
  restore().then(() => { if (dead) return; layoutCanvas(); refresh(); if (project.items.length) fitZoom(); });

  return () => {
    dead = true; pause(); ro.disconnect(); window.removeEventListener('keydown', onKey); clearTimeout(saveTimer);
    recState?.recorder.state !== 'inactive' && recState?.stream.getTracks().forEach((t) => t.stop());
    for (const n of nodes.values()) n.media?.pause?.();
    for (const f of files.values()) URL.revokeObjectURL(f.url);
  };
}
