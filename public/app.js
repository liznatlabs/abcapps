import { TOOLS, CATEGORIES, toolById, BRAND } from '/shared/catalog.js';
import { h, icon, toolIcon, glyph, fmtSize, runTool, resultsView, progressView, API } from './ui.js';
import { meta, about, HOME_FAQS } from '/shared/seo.js';
import { player } from './widgets.js';
import { buildOptions } from './options.js';
import { recorderPage } from './special.js';
import { editorPage } from './editor.js';

const main = document.getElementById('main');
const catOf = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
let cleanup = null; // called when leaving a page (stops cameras, frees previews)
let keepHours = 2;

// Free hosts put the processing server to sleep when idle. This first call wakes it; if that takes a
// while, say so instead of leaving people wondering why a tool is slow.
const wake = h('div', { class: 'wake', role: 'status', hidden: true });
document.body.append(wake);
const slow = setTimeout(() => { wake.textContent = 'Waking up the processing server — this can take up to a minute after a quiet spell.'; wake.hidden = false; }, 3000);
fetch(`${API}/api/health`).then((r) => r.json()).then((d) => {
  clearTimeout(slow); wake.hidden = true;
  keepHours = d.keepHours;
  document.getElementById('foot-note').textContent = `Your files are processed on this server and deleted automatically after ${d.keepHours} hour${d.keepHours === 1 ? '' : 's'}.`;
}).catch(() => {
  clearTimeout(slow);
  wake.textContent = 'The processing server cannot be reached right now, so tools will not run. Please try again in a few minutes.';
  wake.classList.add('down'); wake.hidden = false;
});
document.getElementById('year').textContent = new Date().getFullYear();

// ───────── navigation ─────────
function go(path) { history.pushState(null, '', path); render(); }
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});
window.addEventListener('popstate', render);
const link = (tool, ...kids) => h('a', { href: `/${tool.id}`, 'data-link': true }, ...kids);

function buildMenu() {
  const menu = document.getElementById('menu');
  const toggle = document.getElementById('menu-toggle');
  const closeAll = () => menu.querySelectorAll('.open').forEach((m) => { m.classList.remove('open'); m.firstChild.setAttribute('aria-expanded', 'false'); });
  for (const cat of CATEGORIES) {
    const tools = TOOLS.filter((t) => t.cat === cat.id);
    const panel = h('div', { class: `menu-panel ${tools.length > 9 ? 'cols' : ''}` });
    let group;
    for (const t of tools) {
      if (t.group !== group && t.group) panel.append(h('div', { class: 'group' }, t.group));
      group = t.group;
      panel.append(link(t, t.name));
    }
    const btn = h('button', { class: 'menu-btn', 'data-cat': cat.id, 'aria-expanded': 'false', 'aria-haspopup': 'true' }, cat.name);
    const item = h('div', { class: 'menu-item' }, btn, panel);
    btn.onclick = (e) => { e.stopPropagation(); const was = item.classList.contains('open'); closeAll(); if (!was) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); } };
    menu.append(item);
  }
  document.addEventListener('click', () => { closeAll(); menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  toggle.onclick = (e) => { e.stopPropagation(); toggle.setAttribute('aria-expanded', String(menu.classList.toggle('open'))); };
}

function buildSearch() {
  const input = document.getElementById('search');
  const box = document.getElementById('search-results');
  let active = 0;
  let hits = [];
  const draw = () => {
    box.textContent = '';
    if (!input.value.trim()) { box.hidden = true; return; }
    box.hidden = false;
    if (!hits.length) return box.append(h('div', { class: 'none' }, 'No tool matches that. Try “pdf”, “trim” or “mp3”.'));
    hits.forEach((t, i) => box.append(h('a', { href: `/${t.id}`, 'data-link': true, class: i === active ? 'active' : '' }, t.name, h('small', {}, catOf[t.cat].name))));
  };
  input.oninput = () => { hits = matchTools(input.value).slice(0, 12); active = 0; draw(); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(hits.length - 1, active + 1); draw(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); draw(); e.preventDefault(); }
    if (e.key === 'Enter' && hits[active]) { go(`/${hits[active].id}`); input.value = ''; draw(); input.blur(); }
    if (e.key === 'Escape') { input.value = ''; draw(); input.blur(); }
  };
  box.addEventListener('click', () => { input.value = ''; setTimeout(draw); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) box.hidden = true; });
  input.onfocus = draw;
  // "/" jumps to search from anywhere outside a text field
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !e.target.closest('input, textarea, select')) { e.preventDefault(); input.focus(); } });
}
function matchTools(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return TOOLS.filter((t) => words.every((w) => `${t.name} ${t.tagline} ${t.id} ${catOf[t.cat].name}`.toLowerCase().includes(w)))
    .sort((a, b) => words.every((w) => b.name.toLowerCase().includes(w)) - words.every((w) => a.name.toLowerCase().includes(w)));
}

/** Footer links and the appearance switch. */
function buildChrome() {
  const nav = document.getElementById('foot-nav');
  for (const cat of CATEGORIES) nav.append(h('a', { href: `/#${cat.id}`, onclick: (e) => { e.preventDefault(); toSection(cat.id); } }, cat.name));
  const buttons = [...document.querySelectorAll('[data-theme-set]')];
  const apply = (pref) => {
    try { localStorage.setItem('abc-theme', pref); } catch { /* private window: applies for this visit only */ }
    const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === pref)));
  };
  let saved = 'auto';
  try { saved = localStorage.getItem('abc-theme') || 'auto'; } catch { /* default */ }
  buttons.forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.themeSet === saved)); b.onclick = () => apply(b.dataset.themeSet); });
  document.getElementById('theme-toggle').onclick = () => apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (buttons.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.themeSet === 'auto') apply('auto'); });
}
function toSection(id) {
  if (location.pathname !== '/') go('/');
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
}

// ───────── pages ─────────
const POPULAR = ['compress-pdf', 'video-editor', 'merge-pdf', 'trim-video', 'pdf-to-word', 'audio-converter'];
const tint = (cat) => ({ '--c': `var(--${cat})` });
/** A tool card: tinted icon, name, one-line description. */
function card(t) {
  const a = link(t, toolIcon(t), h('div', {}, h('b', {}, t.name), h('small', {}, t.tagline)), glyph('arrow'));
  a.className = 'entry';
  a.dataset.tool = t.id;
  a.style.setProperty('--c', `var(--${t.cat})`);
  return a;
}

function home() {
  document.title = meta(null).title;
  const filter = h('input', { type: 'search', placeholder: 'Search tools — try “compress”', 'aria-label': 'Filter the tools below', autocomplete: 'off' });
  main.append(h('section', { class: 'hero' },
    h('span', { class: 'badge' }, h('i'), `${TOOLS.length} free tools · no sign-up`),
    h('h1', {}, 'Every file tool you need, ', h('em', {}, 'in one place.')),
    h('p', { class: 'lede' }, 'Edit video and audio, work with PDFs and convert files. Add your file, pick the settings, download the result.'),
    h('div', { class: 'hero-search' }, glyph('search'), filter),
    h('nav', { class: 'cats', 'aria-label': 'Categories' }, CATEGORIES.map((cat) => h('a', { href: `/#${cat.id}`, style: tint(cat.id), onclick: (e) => { e.preventDefault(); toSection(cat.id); } },
      icon(cat.id), cat.name, h('span', {}, TOOLS.filter((t) => t.cat === cat.id).length))))));

  const quick = h('section', { class: 'quick' }, h('h2', {}, 'Popular'), h('div', { class: 'quick-grid' }, POPULAR.map((id) => toolById[id]).filter(Boolean).map(card)));
  main.append(quick);

  const sections = CATEGORIES.map((cat) => {
    const tools = TOOLS.filter((x) => x.cat === cat.id);
    const index = h('div', { class: 'index' });
    let group;
    for (const t of tools) {
      if (t.group && t.group !== group) index.append(h('div', { class: 'sub-head' }, t.group));
      group = t.group;
      index.append(card(t));
    }
    const section = h('section', { class: 'cat', id: cat.id, style: tint(cat.id) },
      h('header', { class: 'cat-head' }, icon(cat.id), h('div', {}, h('h2', {}, cat.name), h('p', {}, cat.blurb)), h('span', { class: 'count' }, `${tools.length} tools`)), index);
    main.append(section);
    return section;
  });
  const none = h('div', { class: 'no-match', hidden: true }, h('b', {}, 'No tool matches that'), 'Try a broader word such as “pdf”, “trim” or “convert”.');
  main.append(none);

  filter.oninput = () => {
    const q = filter.value.trim();
    const keep = new Set(matchTools(q).map((t) => t.id));
    quick.hidden = !!q;
    let any = false;
    for (const s of sections) {
      let shown = 0;
      s.querySelectorAll('.entry').forEach((e) => { e.hidden = !!q && !keep.has(e.dataset.tool); if (!e.hidden) shown++; });
      s.querySelectorAll('.sub-head').forEach((g) => { g.hidden = !!q; });
      s.hidden = !shown;
      any = any || shown > 0;
    }
    none.hidden = any;
  };
  main.append(faqBlock(HOME_FAQS));
  const asked = new URLSearchParams(location.search).get('q');
  if (asked) { filter.value = asked; filter.oninput(); }
  filter.onkeydown = (e) => { if (e.key === 'Enter') { const first = main.querySelector('.cat:not([hidden]) .entry:not([hidden])'); if (first && filter.value.trim()) go(first.getAttribute('href')); } };
}

/** Questions with their answers in plain view, so people and search engines read the same thing. */
function faqBlock(faqs) {
  return h('section', { class: 'about' }, h('h2', {}, 'Questions and answers'), h('dl', { class: 'faq' }, faqs.map((f) => [h('dt', {}, f.q), h('dd', {}, f.a)])));
}

function notFound() {
  document.title = `Not found — ${BRAND.name}`;
  main.append(h('section', { class: 'lost' }, h('span', { class: 'eyebrow' }, '404'), h('h1', {}, 'This page does not exist'),
    h('p', {}, 'The address may be mistyped, or the tool may have moved.'), h('a', { class: 'btn primary big', href: '/', 'data-link': true }, 'Browse all tools')));
}

function toolPage(tool) {
  document.title = meta(tool).title;
  document.querySelectorAll('.menu-btn').forEach((b) => { if (b.dataset.cat === tool.cat) b.setAttribute('aria-current', 'true'); });
  if (tool.kind === 'editor') { // the editor takes the whole window
    document.body.classList.add('editor-mode');
    cleanup = editorPage(tool, main);
    return;
  }
  const cat = catOf[tool.cat];
  main.style.setProperty('--c', `var(--${tool.cat})`);
  const panel = h('section', { class: 'panel', 'aria-label': tool.name });
  const isRecorder = ['screen', 'webcam', 'voice'].includes(tool.kind);
  const others = TOOLS.filter((t) => t.cat === tool.cat && t.id !== tool.id);
  const info = about(tool, { keepHours });
  main.append(
    h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, h('a', { href: '/', 'data-link': true }, 'All tools'), h('i', {}, '/'), h('a', { href: `/#${cat.id}`, onclick: (e) => { e.preventDefault(); toSection(cat.id); } }, cat.name), h('i', {}, '/'), tool.name),
    h('header', { class: 'tool-head' }, toolIcon(tool), h('div', {}, h('span', { class: 'eyebrow' }, tool.group ? `${cat.name} · ${tool.group}` : cat.name), h('h1', {}, tool.name), h('p', {}, `${tool.tagline}.`))),
    h('div', { class: 'tool-layout' }, panel,
      h('aside', { class: 'tool-aside' },
        h('div', {}, h('h2', {}, 'How it works'), h('ol', { class: 'steps' }, info.steps.map((st) => h('li', {}, h('b', {}, st.name), h('span', {}, st.text))))),
        h('div', {}, h('h2', {}, `More ${cat.id === 'pdf' ? 'PDF' : cat.name.toLowerCase().replace(/s$/, '')} tools`), h('ul', { class: 'related' }, others.map((t) => h('li', {}, link(t, t.name, glyph('arrow')))))))),
  );
  main.append(h('section', { class: 'about' }, h('h2', {}, `About ${tool.name}`), h('p', { class: 'lede' }, info.intro)), faqBlock(info.faqs));
  const helpers = { jobPage, toolById };
  if (isRecorder) cleanup = recorderPage(tool, panel, helpers);
  else cleanup = jobPage(tool, panel);
}

/** The standard flow: choose file(s) → settings → process → download. */
export function jobPage(tool, panel, { files: initial = [], onReset } = {}) {
  const state = { files: [...initial], extra: null, opts: {} };
  let pl = null;
  let extraUrl = null;
  const free = () => { pl?.destroy(); pl = null; if (extraUrl) URL.revokeObjectURL(extraUrl); extraUrl = null; };
  const picker = (accept, multiple, onPick) => {
    const input = h('input', { type: 'file', accept: accept || undefined, multiple, hidden: true, onchange: () => { if (input.files.length) onPick([...input.files]); input.value = ''; } });
    return input;
  };
  const addFiles = (list) => {
    if (tool.multiple) state.files.push(...list); else state.files = [list[0]];
    draw();
  };

  function drawEmpty() {
    const input = picker(tool.accept, tool.multiple, addFiles);
    const exts = (tool.accept || '').split(',').filter((x) => x.startsWith('.')).map((x) => x.slice(1).toUpperCase());
    const formats = exts.length ? exts.slice(0, 6).join(' · ') + (exts.length > 6 ? ' · and more' : '') : '';
    const drop = h('div', { class: 'drop', role: 'button', tabIndex: 0 }, icon('upload'),
      h('strong', {}, tool.multiple ? 'Choose files to start' : 'Choose a file to start'), h('span', {}, 'or drag and drop ' + (tool.multiple ? 'them' : 'it') + ' here'),
      h('span', { class: 'btn primary drop-btn' }, glyph('upload'), tool.multiple ? 'Select files' : 'Select file'),
      formats && h('span', { class: 'formats' }, formats), input);
    drop.onclick = () => input.click();
    drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); };
    panel.append(drop);
  }

  function fileList() {
    const move = (i, d) => { const [f] = state.files.splice(i, 1); state.files.splice(i + d, 0, f); draw(); };
    const many = state.files.length > 1;
    const input = picker(tool.accept, true, addFiles);
    return h('div', {},
      h('div', { class: 'row spread', style: { marginBottom: '8px' } }, h('div', { class: 'section-label', style: { margin: 0 } }, many ? `${state.files.length} files — processed in this order` : 'File'),
        h('div', { class: 'row' }, tool.multiple && h('button', { class: 'btn small', type: 'button', onclick: () => input.click() }, 'Add more'), input,
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => { state.files = []; state.extra = null; state.opts = {}; draw(); } }, 'Start over'))),
      h('ul', { class: 'files' }, state.files.map((f, i) => h('li', {},
        many && h('span', { class: 'n' }, i + 1), h('span', { class: 'name', title: f.name }, f.name), h('span', { class: 'size' }, fmtSize(f.size)),
        many && h('button', { class: 'btn small ghost', type: 'button', disabled: i === 0, 'aria-label': `Move ${f.name} up`, onclick: () => move(i, -1) }, glyph('up')),
        many && h('button', { class: 'btn small ghost', type: 'button', disabled: i === state.files.length - 1, 'aria-label': `Move ${f.name} down`, onclick: () => move(i, 1) }, glyph('down')),
        tool.multiple && h('button', { class: 'btn small ghost danger', type: 'button', 'aria-label': `Remove ${f.name}`, onclick: () => { state.files.splice(i, 1); draw(); } }, glyph('close'))))));
  }

  function drawReady() {
    const stack = h('div', { class: 'stack' });
    const error = h('div', { class: 'alert', role: 'alert', hidden: true });
    if (tool.kind !== 'text') stack.append(fileList());
    if (tool.preview === 'video' || tool.preview === 'audio') {
      pl = player(state.files[0], tool.preview);
      stack.append(pl.el);
    }
    let image = null;
    if (tool.extra) {
      const input = picker(tool.extra.accept, false, ([f]) => { state.extra = f; draw(); });
      if (state.extra && tool.id === 'add-image') { extraUrl = URL.createObjectURL(state.extra); image = h('img', { src: extraUrl, alt: '' }); }
      stack.append(h('div', {}, h('div', { class: 'section-label' }, tool.extra.label), h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, state.extra ? 'Change…' : `Choose ${tool.extra.label.toLowerCase()}…`), input,
        state.extra && h('span', { class: 'hint' }, `${state.extra.name} · ${fmtSize(state.extra.size)}`))));
    }
    const defs = (tool.options || []).filter((o) => !(o.type === 'rect' && tool.id === 'add-image' && !state.extra));
    if (defs.length) stack.append(h('div', {}, h('div', { class: 'section-label' }, 'Settings'), buildOptions(defs, state.opts, { pl, file: state.files[0], image })));
    const runBtn = h('button', { class: 'btn primary big', type: 'button' }, tool.kind === 'text' ? 'Generate speech' : tool.cat === 'convert' && tool.id !== 'archive-extractor' ? 'Convert' : tool.name);
    runBtn.onclick = async () => {
      error.hidden = true;
      const fail = (m) => { error.textContent = m; error.hidden = false; error.scrollIntoView({ block: 'nearest' }); };
      if (tool.kind !== 'text' && state.files.length < (tool.min || 1)) return fail(`Add at least ${tool.min} files.`);
      if (tool.extra?.required && !state.extra) return fail(`Choose the ${tool.extra.label.toLowerCase()} first.`);
      if (tool.kind === 'text' && !String(state.opts.text || '').trim()) return fail('Type or paste some text first.');
      pl?.media.pause();
      const prog = progressView();
      const form = [...panel.children];
      form.forEach((c) => { c.hidden = true; });
      panel.append(prog.el);
      if (tool.kind === 'text') prog.set(null);
      try {
        const result = await runTool(tool.id, state, (f) => prog.set(f));
        free();
        panel.textContent = '';
        panel.append(resultsView(result, { onReset: () => { state.files = []; state.extra = null; state.opts = {}; if (onReset) onReset(); else draw(); } }));
      } catch (e) {
        prog.el.remove();
        form.forEach((c) => { c.hidden = false; });
        fail(e.message);
      }
    };
    stack.append(error, h('div', { class: 'run' }, runBtn));
    panel.append(stack);
  }

  function draw() {
    free();
    panel.textContent = '';
    if (!state.files.length && tool.kind !== 'text') drawEmpty(); else drawReady();
  }
  draw();
  return free;
}

function render() {
  if (cleanup) { try { cleanup(); } catch { /* page already gone */ } cleanup = null; }
  main.textContent = '';
  document.querySelectorAll('.menu-btn[aria-current]').forEach((b) => b.removeAttribute('aria-current'));
  main.style.removeProperty('--c');
  document.body.classList.remove('editor-mode');
  document.getElementById('menu').classList.remove('open');
  const id = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, ''));
  if (!id) home(); else if (toolById[id]) toolPage(toolById[id]); else notFound();
  if (location.hash && !id) document.getElementById(location.hash.slice(1))?.scrollIntoView(); else window.scrollTo(0, 0);
}

buildMenu();
buildSearch();
buildChrome();
render();
