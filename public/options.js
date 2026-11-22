// Builds the settings form for a tool from its option definitions in the catalog.
import { h } from './ui.js';
import { trimWidget, rectWidget, eqWidget, pagesWidget } from './widgets.js';

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return pw ? Math.max(1, s) : 0;
}

/**
 * @param defs   option definitions
 * @param opts   object the chosen values are written into (pre-filled with defaults here)
 * @param env    { pl: preview player, file: first file, image: <img> for overlay tools }
 */
export function buildOptions(defs, opts, env = {}) {
  const form = h('div', { class: 'opts' });
  const groups = {};
  const conditional = [];
  const refresh = () => conditional.forEach(({ el, showIf }) => {
    el.hidden = !Object.entries(showIf).every(([k, v]) => (Array.isArray(v) ? v.includes(opts[k]) : opts[k] === v));
  });
  const set = (k, v) => { opts[k] = v; refresh(); };

  for (const o of defs) {
    if (!(o.key in opts) && 'def' in o) opts[o.key] = o.def;
    const id = `opt-${o.key}`;
    let field;
    switch (o.type) {
      case 'select':
        field = h('div', { class: 'field' }, h('label', { for: id }, o.label),
          h('select', { id, onchange: (e) => set(o.key, e.target.value) }, o.choices.map(([v, l]) => h('option', { value: v, selected: opts[o.key] === v }, l))));
        break;
      case 'range': {
        const out = h('output', {}, `${opts[o.key]}${o.unit || ''}`);
        field = h('div', { class: 'field' }, h('label', { for: id }, o.label, out),
          h('input', { id, type: 'range', min: o.min, max: o.max, step: o.step, value: opts[o.key], oninput: (e) => { out.textContent = `${e.target.value}${o.unit || ''}`; set(o.key, Number(e.target.value)); } }));
        break;
      }
      case 'number':
        field = h('div', { class: 'field' }, h('label', { for: id }, o.label), h('div', { class: 'unit' },
          h('input', { id, type: 'number', min: o.min, max: o.max, step: o.step, value: opts[o.key], oninput: (e) => set(o.key, e.target.value === '' ? o.def : Number(e.target.value)) }), o.unit && h('span', {}, o.unit)));
        break;
      case 'checkbox':
        field = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!opts[o.key], onchange: (e) => set(o.key, e.target.checked) }), o.label);
        break;
      case 'text':
        field = h('div', { class: 'field' }, h('label', { for: id }, o.label), h('input', { id, type: 'text', value: opts[o.key] || '', placeholder: o.placeholder || '', oninput: (e) => set(o.key, e.target.value) }));
        break;
      case 'textarea':
        field = h('div', { class: 'field wide' }, h('label', { for: id }, o.label), h('textarea', { id, rows: o.rows || 6, placeholder: o.placeholder || '', value: opts[o.key] || '', oninput: (e) => set(o.key, e.target.value) }));
        break;
      case 'color':
        field = h('div', { class: 'field' }, h('label', { for: id }, o.label), h('input', { id, type: 'color', value: opts[o.key], oninput: (e) => set(o.key, e.target.value) }));
        break;
      case 'password': {
        const bar = h('i');
        const word = h('span', { class: 'hint' });
        const input = h('input', { id, type: 'password', autocomplete: 'new-password', value: opts[o.key] || '', oninput: (e) => {
          set(o.key, e.target.value);
          if (!o.strength) return;
          const s = strength(e.target.value);
          bar.style.width = `${s * 20}%`; bar.style.background = ['', 'var(--danger)', 'var(--danger)', '#c98a00', 'var(--ok)', 'var(--ok)'][s];
          word.textContent = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][s];
        } });
        const show = h('label', { class: 'check', style: { padding: '0', fontSize: '13.5px' } }, h('input', { type: 'checkbox', onchange: (e) => { input.type = e.target.checked ? 'text' : 'password'; } }), 'Show');
        field = h('div', { class: 'field' }, h('label', { for: id }, o.label, show), input, o.strength && h('div', { class: 'meter' }, bar), o.strength && word);
        break;
      }
      case 'trim': {
        const w = trimWidget(opts[o.key], env.pl, (v) => { opts[o.key] = v; });
        field = h('div', { class: 'field wide' }, h('div', { class: 'lbl' }, o.label), w.el);
        break;
      }
      case 'rect': {
        const w = rectWidget(o, opts[o.key], env.pl, (v) => { opts[o.key] = v; }, { image: env.image });
        if (env.image) {
          const lock = () => env.pl?.onReady(() => w.setAspect(env.image.naturalWidth / env.image.naturalHeight));
          if (env.image.complete && env.image.naturalWidth) lock(); else env.image.addEventListener('load', lock);
        }
        field = h('div', { class: 'field wide' }, w.el);
        break;
      }
      case 'eq':
        field = h('div', { class: 'field wide' }, eqWidget(opts[o.key], (v) => { opts[o.key] = v; }).el);
        break;
      case 'pages':
        field = h('div', { class: 'field wide' }, pagesWidget(o, env.file, (v) => { opts[o.key] = v; }).el);
        break;
      default: continue;
    }
    if (o.showIf) conditional.push({ el: field, showIf: o.showIf });
    if (o.group) {
      if (!groups[o.group]) { groups[o.group] = h('div', { class: 'opts' }); form.append(h('details', { class: 'more' }, h('summary', {}, o.group), groups[o.group])); }
      groups[o.group].append(field);
    } else form.append(field);
  }
  refresh();
  return form;
}
