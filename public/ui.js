// Small DOM and formatting helpers shared by every page.

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

export const fmtSize = (n) => {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < 2);
  return `${n.toFixed(n < 10 ? 2 : 1)} ${u[i]}`;
};

export function fmtTime(s, tenths = true) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const str = tenths ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0');
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${str}` : `${m}:${str}`;
}

/** "1:23.5", "83.5" or "1:02:03" → seconds (NaN when unreadable). */
export function parseTime(str) {
  const parts = String(str).trim().split(':').map((p) => p.trim());
  if (!parts.length || parts.some((p) => p === '' || Number.isNaN(Number(p)))) return NaN;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  video: svg('<rect x="3" y="5.5" width="13.5" height="13" rx="2"/><path d="m16.5 10.5 4.5-2.7v8.4l-4.5-2.7"/>'),
  audio: svg('<path d="M4 10v4M8 6.5v11M12 3.5v17M16 7.5v9M20 10v4"/>'),
  pdf: svg('<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  convert: svg('<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>'),
  upload: svg('<path d="M12 16V4.5m0 0-4 4m4-4 4 4M4.5 16v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>'),
  arrow: svg('<path d="M4 12h16m0 0-6-6m6 6-6 6"/>'),
  up: svg('<path d="M12 19V5m0 0-6 6m6-6 6 6"/>'),
  down: svg('<path d="M12 5v14m0 0-6-6m6 6 6-6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  play: svg('<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>'),
  pause: svg('<path d="M8 5.5v13M16 5.5v13" stroke-width="2.5"/>'),
  // per-tool icons
  scissors: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4"/>'),
  merge: svg('<path d="M4 6h4.5l3.5 6-3.5 6H4M12 12h8M17 9l3 3-3 3"/>'),
  timeline: svg('<rect x="3" y="4" width="18" height="10" rx="2"/><path d="M3 18.5h6M12 18.5h9M9 16.5v4"/>'),
  screen: svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10.5" r="2.2"/>'),
  speech: svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M9 9.5v2M12 8.5v4M15 9.5v2"/>'),
  music: svg('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/>'),
  type: svg('<path d="M5 7V5h14v2M12 5v14M9 19h6"/>'),
  eraser: svg('<path d="m7.5 20-4-4L14 5.5l6 6L11.5 20zM7.5 20H20M9.5 10l6 6"/>'),
  crop: svg('<path d="M7 3v14h14M3 7h14v14"/>'),
  rotate: svg('<path d="M4.5 9a8 8 0 1 1 1.5 8"/><path d="M4 4v5h5"/>'),
  flip: svg('<path d="M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z"/>'),
  resize: svg('<path d="M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7"/>'),
  loop: svg('<path d="m17 3 3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4"/>'),
  volume: svg('<path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  speed: svg('<path d="M5 18a9 9 0 1 1 14 0"/><path d="m12 13 4-5"/>'),
  target: svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  pitch: svg('<path d="M10 17V5l7-2v4l-7 2"/><circle cx="7.5" cy="17" r="2.5"/><path d="M18.5 12v9m0-9L16 14.5m2.5-2.5 2.5 2.5"/>'),
  sliders: svg('<path d="M6 4v5M6 15v5M12 4v1M12 11v9M18 4v9M18 19v1"/><circle cx="6" cy="12" r="2.5"/><circle cx="12" cy="8" r="2.5"/><circle cx="18" cy="16" r="2.5"/>'),
  reverse: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  compress: svg('<path d="M4 9h5V4M20 15h-5v5M9 9 4 4M15 15l5 5"/>'),
  split: svg('<path d="M12 3v18" stroke-dasharray="2.5 3"/><path d="M8 8.5 4.5 12 8 15.5M16 8.5l3.5 3.5-3.5 3.5"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  unlock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>'),
  numbers: svg('<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M10.5 13.5 12 12.5V18M10.5 18h3"/>'),
  sheet: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>'),
  code: svg('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
  slides: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8M9 8.5h6M9 11.5h3"/>'),
  font: svg('<path d="M5 19 11 5h2l6 14M8 14h8"/>'),
  archive: svg('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>'),
  unpack: svg('<path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M3 9h18l-2-5H5zM12 18v-6m0 0-2.5 2.5M12 12l2.5 2.5"/>'),
  book: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>'),
};
const TOOL_ICON = {
  'video-editor': 'timeline', 'screen-recorder': 'screen', 'text-to-speech': 'speech', 'merge-videos': 'merge', 'trim-video': 'scissors', 'add-audio': 'music', 'add-image': 'image', 'add-text': 'type',
  'remove-logo': 'eraser', 'crop-video': 'crop', 'rotate-video': 'rotate', 'flip-video': 'flip', 'resize-video': 'resize', 'loop-video': 'loop', 'video-volume': 'volume', 'video-speed': 'speed', 'stabilize-video': 'target', 'video-recorder': 'video',
  'trim-audio': 'scissors', 'audio-volume': 'volume', 'audio-speed': 'speed', 'audio-pitch': 'pitch', equalizer: 'sliders', 'reverse-audio': 'reverse', 'voice-recorder': 'mic', 'audio-joiner': 'merge',
  'compress-pdf': 'compress', 'merge-pdf': 'merge', 'split-pdf': 'split', 'rotate-pdf': 'rotate', 'protect-pdf': 'lock', 'unlock-pdf': 'unlock', 'page-numbers': 'numbers', 'pdf-to-word': 'pdf', 'pdf-to-excel': 'sheet', 'pdf-to-jpg': 'image', 'pdf-to-png': 'image', 'pdf-to-html': 'code',
  'word-to-pdf': 'pdf', 'excel-to-pdf': 'sheet', 'ppt-to-pdf': 'slides', 'jpg-to-pdf': 'image', 'png-to-pdf': 'image',
  'audio-converter': 'audio', 'video-converter': 'video', 'image-converter': 'image', 'document-converter': 'pdf', 'font-converter': 'font', 'archive-converter': 'archive', 'ebook-converter': 'book', 'archive-extractor': 'unpack',
};
export function icon(name, cls = 'ico') {
  const el = h('span', { class: cls });
  el.innerHTML = ICONS[name] || '';
  return el;
}
/** The tinted icon tile for a tool (falls back to its category icon). */
export const toolIcon = (tool) => icon(TOOL_ICON[tool.id] || tool.cat);
/** An unframed inline icon. */
export const glyph = (name) => icon(name, 'gl');

/** Upload files to a tool and resolve with its result. `onProgress(fraction|null)` — null means "processing". */
export function runTool(toolId, { files = [], extra, opts = {} }, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    if (extra) fd.append('extra', extra, extra.name);
    fd.append('options', JSON.stringify(opts));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/run/${toolId}`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.upload.onload = () => onProgress(null);
    xhr.onload = () => {
      const body = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300 && body?.files) resolve(body);
      else reject(new Error(body?.error || `The server could not process this request (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('The connection to the server was lost. Check that the app is still running and try again.'));
    xhr.send(fd);
  });
}

const MEDIA = { video: ['mp4', 'webm', 'mov', 'mkv'], audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus'], image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] };
const kindOf = (name) => { const e = name.split('.').pop().toLowerCase(); return Object.keys(MEDIA).find((k) => MEDIA[k].includes(e)); };

/** The "your files are ready" view. */
export function resultsView(result, { onReset, resetLabel = 'Start over' } = {}) {
  const files = result.files;
  const one = files.length === 1;
  const total = files.reduce((s, f) => s + f.size, 0);
  const box = h('div', { class: 'stack' });
  let sub = one ? fmtSize(total) : `${files.length} files · ${fmtSize(total)}`;
  if (one && result.inputSize && result.files[0].name.endsWith('-compressed.pdf') && total < result.inputSize) sub = `${fmtSize(result.inputSize)} → ${fmtSize(total)}`;
  box.append(h('div', { class: 'done' }, h('h2', {}, one ? 'Your file is ready' : 'Your files are ready'), h('p', {}, sub)));
  for (const n of result.notes || []) box.append(h('div', { class: 'note' }, n));
  if (one) {
    const k = kindOf(files[0].name);
    const src = `${files[0].url}?inline=1`;
    if (k === 'video') box.append(h('video', { class: 'result-media', src, controls: true, playsInline: true }));
    if (k === 'audio') box.append(h('audio', { class: 'result-media', src, controls: true }));
    if (k === 'image') box.append(h('img', { class: 'result-media', src, alt: 'Result preview' }));
  }
  const shown = files.slice(0, 300);
  box.append(h('ul', { class: 'files' }, shown.map((f) => h('li', {},
    h('span', { class: 'name', title: f.name }, f.name), h('span', { class: 'size' }, fmtSize(f.size)),
    h('a', { class: `btn small ${one ? 'primary' : ''}`, href: f.url, download: f.name.split('/').pop() }, 'Download')))));
  if (files.length > shown.length) box.append(h('p', { class: 'hint' }, `…and ${files.length - shown.length} more. Use “Download all” to get everything.`));
  box.append(h('div', { class: 'row', style: { justifyContent: 'center' } },
    !one && h('a', { class: 'btn primary big', href: `/api/zip/${result.job}` }, 'Download all (.zip)'),
    onReset && h('button', { class: 'btn', onclick: onReset }, resetLabel)));
  return box;
}

export function progressView(label = 'Uploading…') {
  const bar = h('i');
  const text = h('div', {}, label);
  const el = h('div', { class: 'progress', role: 'status' }, text, h('div', { class: 'bar' }, bar));
  return {
    el,
    set(frac) {
      if (frac == null) { el.querySelector('.bar').classList.add('busy'); text.textContent = 'Processing… this can take a while for large files.'; } else {
        el.querySelector('.bar').classList.remove('busy'); bar.style.width = `${Math.round(frac * 100)}%`; text.textContent = `Uploading… ${Math.round(frac * 100)}%`;
      }
    },
  };
}
