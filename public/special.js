// The three recorders: screen, webcam and voice.
import { h, fmtTime, fmtSize, runTool, resultsView, progressView } from './ui.js';

const pickMime = (list) => list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
const VIDEO_MIME = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
const AUDIO_MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
const stopStream = (s) => s?.getTracks().forEach((t) => t.stop());

function permissionMessage(e, what) {
  if (e.name === 'NotAllowedError') return `Access to your ${what} was blocked. Click the lock icon in the address bar, allow it, then try again.`;
  if (e.name === 'NotFoundError') return `No ${what} was found. Connect one and try again.`;
  if (e.name === 'NotReadableError') return `Your ${what} is being used by another app. Close it and try again.`;
  return `Could not start recording: ${e.message}`;
}

/** Screen recorder, webcam recorder and voice recorder. */
export function recorderPage(tool, panel) {
  const kind = tool.kind; // screen | webcam | voice
  const isAudio = kind === 'voice';
  let streams = [];
  let recorder = null;
  let ctx = null;
  let timer = null;
  let raf = null;
  let url = null;
  const opts = { mic: kind !== 'screen', system: true, quality: '720', mirror: true, camera: '', micId: '', trimSilence: true };
  const release = () => {
    clearInterval(timer); cancelAnimationFrame(raf);
    if (recorder && recorder.state !== 'inactive') { recorder.onstop = null; recorder.stop(); }
    streams.forEach(stopStream); streams = [];
    ctx?.close().catch(() => {}); ctx = null;
    if (url) { URL.revokeObjectURL(url); url = null; }
  };
  const error = h('div', { class: 'alert', role: 'alert', hidden: true });
  const fail = (m) => { error.textContent = m; error.hidden = false; };

  if (!navigator.mediaDevices || !window.MediaRecorder || (kind === 'screen' && !navigator.mediaDevices.getDisplayMedia)) {
    panel.append(h('div', { class: 'alert' }, kind === 'screen' ? 'Screen recording is not available in this browser. Use a current desktop version of Chrome, Edge or Firefox.' : 'Recording is not available in this browser. Use a current version of Chrome, Edge, Firefox or Safari.'));
    return release;
  }

  async function devices(type) {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === type && d.label); } catch { return []; }
  }

  function start() {
    release();
    panel.textContent = '';
    error.hidden = true;
    const stack = h('div', { class: 'stack', style: { textAlign: 'center' } });
    const check = (key, label) => h('label', { class: 'check', style: { justifyContent: 'center' } }, h('input', { type: 'checkbox', checked: opts[key], onchange: (e) => { opts[key] = e.target.checked; } }), label);
    if (kind === 'screen') {
      stack.append(h('div', {}, check('system', 'Record system or tab sound (your browser will ask)'), check('mic', 'Record my microphone too')),
        h('div', {}, h('button', { class: 'btn primary big', type: 'button', onclick: beginScreen }, 'Start recording')),
        h('p', { class: 'hint' }, 'You choose whether to share the whole screen, one window or one browser tab.'));
    } else if (kind === 'voice') {
      stack.append(h('div', {}, h('button', { class: 'btn primary big', type: 'button', onclick: () => beginLive() }, 'Start recording')),
        h('p', { class: 'hint' }, 'Your browser will ask to use the microphone. The recording stays on this device until you choose to convert it.'));
    } else {
      stack.append(h('div', {}, h('button', { class: 'btn primary big', type: 'button', onclick: () => beginLive() }, 'Turn on camera')),
        h('p', { class: 'hint' }, 'Your browser will ask to use the camera and microphone.'));
    }
    stack.append(error);
    panel.append(stack);
  }

  function recordingUI(stream, { preview, extraControls, levelFrom }) {
    panel.textContent = '';
    const chunks = [];
    const mime = pickMime(isAudio ? AUDIO_MIME : VIDEO_MIME);
    const clock = h('div', { class: 'rec-timer' }, '0:00');
    const status = h('div', { class: 'hint' }, 'Ready');
    const recBtn = h('button', { class: 'btn primary big', type: 'button' }, 'Record');
    const pauseBtn = h('button', { class: 'btn', type: 'button', hidden: true }, 'Pause');
    const level = h('i');
    let seconds = 0;
    const begin = () => {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => finish(new Blob(chunks, { type: recorder.mimeType || mime }));
      recorder.start(1000);
      seconds = 0;
      timer = setInterval(() => { if (recorder.state === 'recording') { seconds++; clock.textContent = fmtTime(seconds, false); } }, 1000);
      status.replaceChildren(h('span', { class: 'rec-dot' }), 'Recording');
      recBtn.textContent = 'Stop'; pauseBtn.hidden = false;
    };
    recBtn.onclick = () => { if (!recorder || recorder.state === 'inactive') begin(); else recorder.stop(); };
    pauseBtn.onclick = () => {
      if (recorder.state === 'recording') { recorder.pause(); pauseBtn.textContent = 'Resume'; status.textContent = 'Paused'; } else { recorder.resume(); pauseBtn.textContent = 'Pause'; status.replaceChildren(h('span', { class: 'rec-dot' }), 'Recording'); }
    };
    stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (recorder?.state !== 'inactive') recorder?.stop(); else start(); });
    if (levelFrom) {
      ctx = ctx || new AudioContext();
      const an = ctx.createAnalyser(); an.fftSize = 512;
      ctx.createMediaStreamSource(levelFrom).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => { an.getByteTimeDomainData(buf); let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128)); level.style.width = `${Math.min(100, (peak / 128) * 160)}%`; raf = requestAnimationFrame(tick); };
      tick();
    }
    panel.append(h('div', { class: 'stack', style: { textAlign: 'center' } }, preview, levelFrom && h('div', { class: 'level', title: 'Microphone level' }, level), clock, status,
      h('div', { class: 'row', style: { justifyContent: 'center' } }, recBtn, pauseBtn, extraControls, h('button', { class: 'btn ghost', type: 'button', onclick: start }, 'Cancel')), error));
    return { begin };
  }

  async function beginScreen() {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: opts.system });
      streams.push(display);
      let mic = null;
      if (opts.mic) { try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); streams.push(mic); } catch (e) { fail(permissionMessage(e, 'microphone')); } }
      const tracks = [...display.getVideoTracks()];
      const sources = [display, mic].filter((s) => s && s.getAudioTracks().length);
      if (sources.length === 1) tracks.push(sources[0].getAudioTracks()[0]);
      else if (sources.length > 1) { // mix system sound and microphone into one track
        ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        sources.forEach((s) => ctx.createMediaStreamSource(s).connect(dest));
        tracks.push(dest.stream.getAudioTracks()[0]);
      }
      const preview = h('video', { class: 'result-media', muted: true, autoplay: true, playsInline: true, srcObject: display });
      recordingUI(new MediaStream(tracks), { preview, levelFrom: mic }).begin();
    } catch (e) { if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') fail(permissionMessage(e, 'screen')); else if (e.name === 'NotAllowedError') fail('Screen sharing was cancelled or blocked. Click “Start recording” and choose what to share.'); }
  }

  async function beginLive() {
    try {
      streams.forEach(stopStream); streams = [];
      const audio = opts.micId ? { deviceId: { exact: opts.micId } } : true;
      const video = isAudio ? false : { ...(opts.camera ? { deviceId: { exact: opts.camera } } : {}), ...(opts.quality === 'auto' ? {} : { height: { ideal: Number(opts.quality) } }) };
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio, video }); } catch (e) {
        if (isAudio || e.name !== 'NotFoundError') throw e;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video }); // camera without a microphone
        fail('No microphone was found — recording video without sound.');
      }
      streams.push(stream);
      const pickDevice = async (type, key, label) => {
        const list = await devices(type);
        if (list.length < 2) return null;
        const current = stream.getTracks().find((t) => t.kind === (type === 'videoinput' ? 'video' : 'audio'))?.getSettings().deviceId;
        return h('select', { 'aria-label': label, style: { width: 'auto', maxWidth: '220px' }, onchange: (e) => { opts[key] = e.target.value; beginLive(); } }, list.map((d) => h('option', { value: d.deviceId, selected: d.deviceId === current }, d.label)));
      };
      const controls = [await pickDevice('audioinput', 'micId', 'Microphone')];
      let preview;
      if (isAudio) preview = h('div', { class: 'hint' }, 'Microphone is on. Press Record when you are ready.');
      else {
        preview = h('video', { class: `result-media ${opts.mirror ? 'mirror' : ''}`, muted: true, autoplay: true, playsInline: true, srcObject: stream });
        controls.unshift(await pickDevice('videoinput', 'camera', 'Camera'));
        controls.push(h('select', { 'aria-label': 'Quality', style: { width: 'auto' }, onchange: (e) => { opts.quality = e.target.value; beginLive(); } }, [['auto', 'Auto'], ['1080', '1080p'], ['720', '720p'], ['480', '480p']].map(([v, l]) => h('option', { value: v, selected: v === opts.quality }, l))),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: opts.mirror, onchange: (e) => { opts.mirror = e.target.checked; preview.classList.toggle('mirror', opts.mirror); } }), 'Mirror'),
          h('button', { class: 'btn', type: 'button', onclick: () => {
            const c = h('canvas', { width: preview.videoWidth, height: preview.videoHeight });
            const g = c.getContext('2d');
            if (opts.mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
            g.drawImage(preview, 0, 0);
            c.toBlob((b) => { const a = h('a', { href: URL.createObjectURL(b), download: `photo-${stamp()}.png` }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }, 'image/png');
          } }, 'Take photo'));
      }
      recordingUI(stream, { preview, extraControls: controls.filter(Boolean), levelFrom: stream.getAudioTracks().length ? stream : null });
    } catch (e) { start(); fail(permissionMessage(e, isAudio ? 'microphone' : 'camera')); }
  }

  function finish(blob) {
    clearInterval(timer); cancelAnimationFrame(raf);
    streams.forEach(stopStream); streams = [];
    ctx?.close().catch(() => {}); ctx = null;
    recorder = null;
    if (!blob.size) { start(); return fail('Nothing was recorded. Try again.'); }
    const ext = blob.type.includes('mp4') ? (isAudio ? 'm4a' : 'mp4') : blob.type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `${isAudio ? 'voice' : kind === 'screen' ? 'screen' : 'video'}-${stamp()}.${ext}`, { type: blob.type });
    url = URL.createObjectURL(blob);
    panel.textContent = '';
    const target = isAudio ? 'MP3' : 'MP4';
    const err = h('div', { class: 'alert', role: 'alert', hidden: true });
    const stack = h('div', { class: 'stack' });
    const convert = async () => {
      err.hidden = true;
      const prog = progressView();
      stack.hidden = true; panel.append(prog.el);
      try {
        const result = isAudio ? await runTool('audio-converter', { files: [file], opts: { format: 'mp3', bitrate: '192', trimSilence: opts.trimSilence } }, (f) => prog.set(f))
          : await runTool('video-converter', { files: [file], opts: { format: 'mp4', quality: '20' } }, (f) => prog.set(f));
        panel.textContent = '';
        panel.append(resultsView(result, { onReset: start, resetLabel: 'Record again' }));
      } catch (e) { prog.el.remove(); stack.hidden = false; err.textContent = e.message; err.hidden = false; }
    };
    stack.append(h('div', { class: 'done' }, h('h2', {}, 'Recording finished'), h('p', {}, `${file.name} · ${fmtSize(file.size)}`)),
      h(isAudio ? 'audio' : 'video', { class: 'result-media', src: url, controls: true, playsInline: true }),
      isAudio && h('label', { class: 'check', style: { justifyContent: 'center' } }, h('input', { type: 'checkbox', checked: opts.trimSilence, onchange: (e) => { opts.trimSilence = e.target.checked; } }), 'Trim silence at the start and end'),
      err,
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('button', { class: 'btn primary big', type: 'button', onclick: convert }, `Save as ${target}`),
        h('a', { class: 'btn', href: url, download: file.name }, `Download original (.${ext})`),
        h('button', { class: 'btn ghost', type: 'button', onclick: start }, 'Record again')),
      h('p', { class: 'hint', style: { textAlign: 'center' } }, `“Save as ${target}” uploads the recording to convert it. The original stays on your device only.`));
    panel.append(stack);
  }

  start();
  return release;
}
