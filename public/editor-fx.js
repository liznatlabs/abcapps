// Looks and sounds for the video editor: colour maths, filter presets, mask shapes, synthesised sound effects.
// Colour is expressed as one 3×4 matrix per clip so the preview (SVG filter) and the export (ffmpeg) do exactly the same sum.

const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
/** a∘b: apply b, then a. Each is rows of [r, g, b, offset]. */
function mul(a, b) {
  const o = new Array(12);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c] + a[r * 4 + 2] * b[8 + c] + (c === 3 ? a[r * 4 + 3] : 0);
  }
  return o;
}
const scale = (k, off = 0) => [k, 0, 0, off, 0, k, 0, off, 0, 0, k, off];
const sat = (s) => [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0];
const warm = (w) => [1 + 0.22 * w, 0, 0, 0, 0, 1 + 0.04 * w, 0, 0, 0, 0, 1 - 0.22 * w, 0];
function hue(deg) {
  const c = Math.cos((deg * Math.PI) / 180); const s = Math.sin((deg * Math.PI) / 180);
  return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0];
}
const SEPIA = [0.393, 0.769, 0.189, 0, 0.349, 0.686, 0.168, 0, 0.272, 0.534, 0.131, 0];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export const FILTERS = [['none', 'Original'], ['vivid', 'Vivid'], ['warm', 'Warm'], ['cool', 'Cool'], ['fade', 'Fade'], ['vintage', 'Vintage'], ['sepia', 'Sepia'], ['bw', 'B&W'], ['noir', 'Noir'], ['invert', 'Invert']];
const PRESET = {
  vivid: mul(scale(1.12, -0.06), sat(1.5)), warm: warm(0.7), cool: warm(-0.7), fade: mul(scale(0.82, 0.1), sat(0.8)),
  vintage: mul(scale(0.92, 0.05), mix(ID, SEPIA, 0.55)), sepia: SEPIA, bw: sat(0), noir: mul(scale(1.35, -0.175), sat(0)), invert: [-1, 0, 0, 1, 0, -1, 0, 1, 0, 0, -1, 1],
};
export const ADJUST0 = { b: 0, c: 0, s: 0, w: 0, h: 0 };

/** The clip's whole colour treatment as one matrix, or null when nothing is changed. */
export function colorMatrix(it) {
  const a = it.adj || ADJUST0;
  let m = ID;
  if (a.b) m = mul(scale(1 + a.b / 100), m);
  if (a.c) { const k = 1 + a.c / 100; m = mul(scale(k, 0.5 * (1 - k)), m); }
  if (a.s) m = mul(sat(1 + a.s / 100), m);
  if (a.w) m = mul(warm(a.w / 100), m);
  if (a.h) m = mul(hue(a.h), m);
  if (PRESET[it.filter]) m = mul(PRESET[it.filter], m);
  return m.every((v, i) => Math.abs(v - ID[i]) < 1e-4) ? null : m.map((v) => Math.round(v * 1e4) / 1e4);
}
/** A tiny CSS approximation of a preset, for the filter buttons. */
export const filterSwatch = (name) => ({ vivid: 'saturate(1.5) contrast(1.1)', warm: 'sepia(.35) saturate(1.3)', cool: 'hue-rotate(15deg) saturate(.9) brightness(1.05)', fade: 'contrast(.8) saturate(.8) brightness(1.1)', vintage: 'sepia(.55) contrast(.92)', sepia: 'sepia(1)', bw: 'grayscale(1)', noir: 'grayscale(1) contrast(1.35)', invert: 'invert(1)' }[name] || 'none');

/** Alpha row for the live preview of a colour key: transparent where the key colour dominates. */
export function keyAlpha(color, strength) {
  const s = 2 + strength / 8;
  return color === 'blue' ? `${0.5 * s} ${0.5 * s} ${-s} 0 1` : `${0.5 * s} ${-s} ${0.5 * s} 0 1`;
}

export const MASKS = {
  circle: { label: 'Circle', css: 'ellipse(50% 50% at 50% 50%)', draw: (g, n) => g.ellipse(n / 2, n / 2, n / 2, n / 2, 0, 0, Math.PI * 2) },
  rounded: { label: 'Rounded', css: 'inset(0 round 14%)', draw: (g, n) => g.roundRect(0, 0, n, n, n * 0.14) },
  diamond: { label: 'Diamond', css: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', draw: (g, n) => { g.moveTo(n / 2, 0); g.lineTo(n, n / 2); g.lineTo(n / 2, n); g.lineTo(0, n / 2); g.closePath(); } },
  hexagon: { label: 'Hexagon', css: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)', draw: (g, n) => { g.moveTo(n * 0.25, 0); g.lineTo(n * 0.75, 0); g.lineTo(n, n / 2); g.lineTo(n * 0.75, n); g.lineTo(n * 0.25, n); g.lineTo(0, n / 2); g.closePath(); } },
};
/** White shape on black: the export stretches it over the clip and uses it as transparency. */
export function maskPng(shape) {
  const n = 512;
  const c = document.createElement('canvas'); c.width = n; c.height = n;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
  g.fillStyle = '#fff'; g.beginPath(); MASKS[shape].draw(g, n); g.fill();
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

export const AUDIO_FX = [['', 'None'], ['echo', 'Echo'], ['hall', 'Large hall'], ['deep', 'Deep voice'], ['chipmunk', 'High voice'], ['phone', 'Telephone'], ['radio', 'Radio'], ['robot', 'Robot']];
export const STICKERS = ['😀', '😂', '😍', '😎', '🤔', '😭', '😡', '🥳', '👍', '👎', '👏', '🙏', '💪', '👉', '👈', '👆', '👇', '❤️', '🔥', '⭐', '💯', '🎉', '✅', '❌', '⚠️', '❓', '💡', '📌', '🎵', '🏆', '💰', '⏰', '➡️', '⬅️', '⬆️', '⬇️'];

// ───────── sound effects, synthesised in the browser ─────────
function tone(ctx, { type = 'sine', f0, f1 = f0, t0 = 0, d, g = 0.6 }) {
  const o = ctx.createOscillator(); const v = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + d);
  v.gain.setValueAtTime(0.0001, t0); v.gain.exponentialRampToValueAtTime(g, t0 + 0.008); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(v).connect(ctx.destination); o.start(t0); o.stop(t0 + d + 0.02);
}
function noise(ctx, { t0 = 0, d, g = 0.5, type = 'bandpass', f0 = 1000, f1 = f0, q = 1 }) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * d), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + d);
  const v = ctx.createGain(); v.gain.setValueAtTime(0.0001, t0); v.gain.exponentialRampToValueAtTime(g, t0 + d * 0.3); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  src.connect(f).connect(v).connect(ctx.destination); src.start(t0);
}
const SOUND_DEFS = {
  Beep: [0.3, (c) => tone(c, { f0: 880, d: 0.25 })],
  Ding: [1.2, (c) => { tone(c, { f0: 1320, d: 1.1, g: 0.5 }); tone(c, { f0: 1980, d: 0.7, g: 0.25 }); }],
  Chime: [1.4, (c) => [660, 880, 1320].forEach((f, i) => tone(c, { f0: f, t0: i * 0.16, d: 0.9, g: 0.4 }))],
  Pop: [0.18, (c) => tone(c, { f0: 420, f1: 70, d: 0.13, g: 0.8 })],
  Click: [0.06, (c) => noise(c, { d: 0.04, g: 0.7, type: 'highpass', f0: 3000 })],
  Whoosh: [0.9, (c) => noise(c, { d: 0.85, g: 0.7, f0: 300, f1: 5000, q: 1.5 })],
  Rise: [1.0, (c) => tone(c, { type: 'sawtooth', f0: 180, f1: 1400, d: 0.95, g: 0.3 })],
  Fall: [1.0, (c) => tone(c, { type: 'sawtooth', f0: 1400, f1: 120, d: 0.95, g: 0.3 })],
  Buzzer: [0.7, (c) => tone(c, { type: 'square', f0: 130, d: 0.65, g: 0.35 })],
  Drum: [0.4, (c) => { tone(c, { f0: 160, f1: 45, d: 0.35, g: 0.9 }); noise(c, { d: 0.08, g: 0.3, type: 'highpass', f0: 1500 }); }],
  Applause: [2.0, (c) => { for (let i = 0; i < 90; i++) noise(c, { t0: Math.random() * 1.8, d: 0.05 + Math.random() * 0.05, g: 0.25, f0: 1200 + Math.random() * 2500, q: 0.8 }); }],
  Success: [0.8, (c) => [523, 659, 784, 1047].forEach((f, i) => tone(c, { type: 'triangle', f0: f, t0: i * 0.1, d: 0.4, g: 0.45 }))],
};
export const SOUNDS = Object.keys(SOUND_DEFS);

function wav(buf) {
  const data = buf.getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + data.length * 2));
  const str = (o, s) => [...s].forEach((ch, i) => out.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
  return out.buffer;
}
/** Render one sound effect to a WAV file. */
export async function synth(name) {
  const [d, build] = SOUND_DEFS[name];
  const ctx = new OfflineAudioContext(1, Math.ceil(44100 * d), 44100);
  build(ctx);
  return new File([wav(await ctx.startRendering())], `${name.toLowerCase()}.wav`, { type: 'audio/wav' });
}
