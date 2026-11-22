// Page titles, descriptions, how-to steps and questions for every page.
// Used by the server (pre-rendered HTML and structured data) and by the browser (the same text on screen),
// so what search engines and AI assistants read is exactly what visitors see.
import { TOOLS, CATEGORIES, BRAND } from './catalog.js';

const catOf = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const inputs = (tool) => (tool.accept || '').split(',').filter((x) => x.startsWith('.')).map((x) => x.slice(1).toUpperCase());
const outputs = (tool) => ((tool.options || []).find((o) => o.key === 'format')?.choices || []).map((c) => c[1].replace(/ \(.*$/, ''));
const settings = (tool) => (tool.options || []).filter((o) => o.label && !['format', 'password'].includes(o.key) && !o.group).map((o) => o.label.replace(/ \(.*$/, '').toLowerCase());
const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

export function meta(tool) {
  if (!tool) {
    return {
      title: `${BRAND.name} — Free Online Video, Audio, PDF & File Converter Tools`,
      description: `${TOOLS.length} free online tools by ${BRAND.by}: trim and edit video, cut and convert audio, compress, merge and convert PDFs, and convert images, documents and archives. No sign-up, no watermark.`,
    };
  }
  return {
    title: `${tool.name} Online — Free, No Sign-up | ${BRAND.name}`,
    description: clip(`${tool.tagline}. Free online ${tool.name.toLowerCase()} by ${BRAND.name}: no sign-up, no watermark, and your files are deleted automatically.`, 158),
  };
}

// A specific question for the tools people ask most about.
const EXTRA = {
  'compress-pdf': ['How much smaller will my PDF get?', 'It depends on what is inside. PDFs made of scans or photos often shrink by 40–80%, because their pictures are resampled. PDFs that are mostly text are already small and may hardly change; in that case the original is returned untouched rather than made bigger.'],
  'merge-pdf': ['In what order are the PDFs joined?', 'In the order shown in the file list. Use the up and down arrows next to each file to change it before you merge.'],
  'split-pdf': ['Can I pull out only some pages?', 'Yes. Click the page thumbnails or type the page numbers, for example 3-5, 9. Use a semicolon to make several files at once, for example 1-3; 4-6.'],
  'protect-pdf': ['How strong is the protection?', 'The PDF is encrypted with AES-256. Anyone opening it needs the password, so choose a long one and keep it safe: it cannot be recovered if you lose it.'],
  'unlock-pdf': ['Can it open a PDF if I forgot the password?', 'No. You need to know the current password. The tool removes the lock from a PDF you are allowed to open; it does not guess or break passwords.'],
  'pdf-to-word': ['Will a scanned PDF become editable?', 'If the scan has a text layer from OCR, that text is rebuilt as normal paragraphs. A scan that is only pictures has no text to extract and needs OCR first.'],
  'pdf-to-excel': ['How are the columns worked out?', 'From the spacing of the text on each line. Clean tables convert well; complex or scanned tables may need tidying in the spreadsheet afterwards.'],
  'trim-video': ['Does trimming reduce the quality?', 'The video is re-encoded so the cut lands on the exact frame you chose. The result is high quality with no watermark, though it is not a bit-for-bit copy of the original.'],
  'video-editor': ['What can the video editor do?', 'It is a timeline editor: stack video, images, text and audio on tracks, then split, trim, crop, rotate, speed up or slow down, adjust colour, add filters, masks, green screen, stickers, drawings, captions and sound effects, and export up to 4K.'],
  'remove-logo': ['Does this remove a watermark completely?', 'It hides the area you select by filling it from the surrounding picture or blurring it. That works well for small logos and date stamps on plain backgrounds; over detailed footage the patch can remain visible.'],
  'video-converter': ['Which format should I choose?', 'MP4 with H.264 plays on almost every phone, computer and website. Choose WebM for the web, MOV for Apple editing software, or GIF for a short silent loop.'],
  'audio-converter': ['Can it pull the sound out of a video?', 'Yes. Add a video file and choose an audio format such as MP3; the soundtrack is saved on its own.'],
  'text-to-speech': ['Which languages are supported?', 'English, with five voices. The audio is generated on the server and you can download it as MP3, WAV, OGG, M4A or FLAC.'],
  'screen-recorder': ['Do I need to install anything?', 'No. Your browser asks which screen, window or tab to share, and recording happens on your device. Screen recording needs a desktop browser.'],
  'archive-extractor': ['Can it open password-protected archives?', 'Yes, if you know the password. Enter it before extracting, then download single files or everything as a ZIP.'],
  'image-converter': ['Does converting to JPG keep transparency?', 'JPG cannot store transparency, so transparent areas are placed on white. Choose PNG or WebP to keep them.'],
};

/** Intro, how-to steps and questions for one tool. */
export function about(tool, { keepHours = 2, maxGb = 4 } = {}) {
  const name = tool.name;
  const lower = name.toLowerCase();
  const ins = inputs(tool);
  const outs = outputs(tool);
  const sets = settings(tool).slice(0, 4);
  const recorder = ['screen', 'webcam', 'voice'].includes(tool.kind);
  const many = tool.multiple ? 's' : '';
  let steps;
  if (tool.kind === 'editor') {
    steps = [['Add your media', 'Upload video, images and audio. Each file becomes a clip on the timeline.'], ['Edit on the timeline', 'Select a clip and use the toolbar under the timeline to split, trim, adjust, add text, effects and more.'], ['Export', 'Choose a resolution up to 4K and download the finished video.']];
  } else if (recorder) {
    steps = [['Allow access', 'Your browser asks once for permission. Recording happens on your device.'], ['Record', 'Start, pause and stop whenever you like.'], ['Save', `Download the recording, or convert it to ${tool.kind === 'voice' ? 'MP3' : 'MP4'}.`]];
  } else if (tool.kind === 'text') {
    steps = [['Enter your text', 'Type or paste what you want read aloud.'], ['Choose a voice', 'Pick the voice, reading speed and audio format.'], ['Download', 'Generate the speech and save the audio file.']];
  } else {
    steps = [[`Add your file${many}`, `Drop ${tool.multiple ? 'them' : 'it'} on the page or click to choose.`],
      [sets.length ? 'Adjust the settings' : 'Start', sets.length ? `Set the ${list(sets)}. Sensible defaults are already chosen.` : `There is nothing to configure: press the button and the file${many} ${tool.multiple ? 'are' : 'is'} processed.`],
      ['Download', `Save the result. Files are removed from the server after ${keepHours} hours.`]];
  }
  const intro = `${tool.tagline}. ${name} runs in your browser window with nothing to install${ins.length ? `, and works with ${list(ins.slice(0, 6))}${ins.length > 6 ? ' and other' : ''} files` : ''}. It is free, needs no account and adds no watermark.`;
  const faqs = [];
  if (EXTRA[tool.id]) faqs.push(EXTRA[tool.id]);
  faqs.push([`Is ${name} free?`, `Yes. ${name} is free to use, with no sign-up and no watermark on the result.`]);
  if (ins.length || outs.length) {
    faqs.push([`Which files does ${name} work with?`, `${ins.length ? `It accepts ${list(ins.slice(0, 10))}${ins.length > 10 ? ' and more' : ''} files.` : 'It accepts most common formats.'}${outs.length ? ` You can save the result as ${list(outs)}.` : ''}`]);
  }
  faqs.push(recorder
    ? ['Is my recording private?', 'Yes. Recording happens in your browser and stays on your device. It is only uploaded if you choose to convert it, and converted files are deleted automatically.']
    : ['Are my files private?', `Your file is sent to the server only to be processed and is deleted automatically after ${keepHours} hours. It is not shared, published or used for anything else.`]);
  if (!recorder && tool.kind !== 'text') faqs.push(['Is there a file size limit?', `Files up to ${maxGb} GB are accepted. Large files take longer to upload and process.`]);
  faqs.push([`Can I ${lower.startsWith('add ') || lower.startsWith('change ') ? lower : `use ${name}`} on a phone?`, 'Yes. It works in current versions of Chrome, Safari, Firefox and Edge on phones, tablets and computers.']);
  return { intro, steps: steps.map(([n, text]) => ({ name: n, text })), faqs: faqs.map(([q, a]) => ({ q, a })) };
}

export const HOME_FAQS = [
  { q: `What is ${BRAND.name}?`, a: `${BRAND.name} is a free set of ${TOOLS.length} online tools by ${BRAND.by} for video, audio, PDF files and file conversion. Each tool does one job: you add a file, choose the settings and download the result.` },
  { q: 'Is it really free?', a: 'Yes. Every tool is free to use, with no account, no trial period and no watermark added to your files.' },
  { q: 'What happens to my files?', a: 'Files are uploaded only so they can be processed and are deleted automatically after two hours. The recorders and the video editor preview work in your browser, and nothing is uploaded until you convert or export.' },
  { q: 'Do I need to install anything?', a: 'No. Everything runs in a web browser on a computer, tablet or phone.' },
  { q: 'Which formats are supported?', a: 'Video (MP4, MOV, MKV, WebM, AVI and more), audio (MP3, WAV, M4A, FLAC, OGG), PDF and office documents (Word, Excel, PowerPoint), images (JPG, PNG, WebP, GIF, TIFF), fonts, ebooks and archives (ZIP, 7z, TAR).' },
];

/** JSON-LD structured data for a page. `site` is the public address without a trailing slash. */
export function structuredData(tool, site) {
  const org = { '@type': 'Organization', name: BRAND.by };
  if (!tool) {
    return [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND.name, url: `${site}/`, publisher: org, potentialAction: { '@type': 'SearchAction', target: `${site}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: `${BRAND.name} tools`, itemListElement: TOOLS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${site}/${t.id}` })) },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: HOME_FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    ];
  }
  const a = about(tool);
  const url = `${site}/${tool.id}`;
  const cat = catOf[tool.cat];
  return [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: tool.name, url, description: meta(tool).description, applicationCategory: tool.cat === 'video' || tool.cat === 'audio' ? 'MultimediaApplication' : 'UtilitiesApplication', operatingSystem: 'Any', browserRequirements: 'Requires a modern web browser', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: org },
    { '@context': 'https://schema.org', '@type': 'HowTo', name: `How to use ${tool.name}`, step: a.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: a.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'All tools', item: `${site}/` }, { '@type': 'ListItem', position: 2, name: cat.name, item: `${site}/#${cat.id}` }, { '@type': 'ListItem', position: 3, name: tool.name, item: url }] },
  ];
}
