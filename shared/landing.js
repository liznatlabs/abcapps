// Pages for specific searches ("MP4 to MP3", "video to GIF", "compress video"…).
// Each one is a real tool with its settings already chosen, plus text about that particular job —
// not a copy of the general tool page. Also: the other names people use for each tool.
import { TOOLS, toolById } from './catalog.js';

/** One plain sentence about each format, used to explain a conversion. */
const F = {
  mp3: ['MP3', 'MP3 is the most widely supported audio format: small files that play on every phone, car stereo and app.'],
  wav: ['WAV', 'WAV stores uncompressed audio: large files with no quality loss, the standard for editing.'],
  m4a: ['M4A', 'M4A (AAC) sounds better than MP3 at the same size and is the native audio format of Apple devices.'],
  flac: ['FLAC', 'FLAC compresses audio with no loss in quality, at roughly half the size of WAV.'],
  ogg: ['OGG', 'OGG Vorbis is an open, patent-free audio format used by games and websites.'],
  aac: ['AAC', 'AAC is the audio format used inside most MP4 videos and by streaming services.'],
  wma: ['WMA', 'WMA is an older Windows audio format that many phones and players cannot open.'],
  m4r: ['M4R', 'M4R is the ringtone format used by iPhones.'],
  mp4: ['MP4', 'MP4 (H.264) is the most compatible video format: it plays on virtually every device, browser and social network.'],
  mov: ['MOV', 'MOV is Apple’s QuickTime format, recorded by iPhones and used by Mac editing software.'],
  mkv: ['MKV', 'MKV can hold several audio and subtitle tracks in one file, but many phones, TVs and editors cannot play it.'],
  webm: ['WebM', 'WebM is an open format built for the web, with small files that play in every modern browser.'],
  avi: ['AVI', 'AVI is an older Windows video format with large files and patchy support on phones.'],
  flv: ['FLV', 'FLV is the old Flash video format, which current browsers and phones no longer play.'],
  wmv: ['WMV', 'WMV is a Windows video format that Apple devices and many apps cannot open.'],
  gif: ['GIF', 'GIF is a silent, looping animation that plays anywhere, including chats and email.'],
  jpg: ['JPG', 'JPG is the standard photo format: small files that open everywhere, without transparency.'],
  png: ['PNG', 'PNG keeps every pixel exact and supports transparency, which suits logos, screenshots and graphics.'],
  webp: ['WebP', 'WebP is a modern web image format, typically 25–35% smaller than JPG or PNG at the same quality.'],
  bmp: ['BMP', 'BMP is an uncompressed Windows image format with very large files.'],
  tiff: ['TIFF', 'TIFF is a high-quality format used in printing and scanning, with large files.'],
  ico: ['ICO', 'ICO is the icon format used for website favicons and Windows shortcuts.'],
  pdf: ['PDF', 'PDF looks the same on every device and printer, which makes it the standard for sharing finished documents.'],
  docx: ['Word', 'Word (DOCX) is the standard editable document format.'],
  odt: ['ODT', 'ODT is the open document format used by LibreOffice and Google Docs.'],
  rtf: ['RTF', 'RTF is a simple formatted-text format that almost any word processor can open.'],
  txt: ['TXT', 'TXT is plain text with no formatting, readable by every program.'],
  html: ['HTML', 'HTML is the format of web pages.'],
  csv: ['CSV', 'CSV is plain text with comma-separated values, the simplest way to move table data between programs.'],
  xlsx: ['Excel', 'Excel (XLSX) is the standard spreadsheet format, with formulas, formatting and several sheets.'],
  epub: ['EPUB', 'EPUB is the standard ebook format: text reflows to fit any screen on phones, tablets and e-readers.'],
  ttf: ['TTF', 'TTF (TrueType) is the desktop font format that every operating system installs.'],
  otf: ['OTF', 'OTF (OpenType) is a desktop font format with advanced typographic features.'],
  woff: ['WOFF', 'WOFF is a compressed font format for websites, supported by all browsers.'],
  woff2: ['WOFF2', 'WOFF2 is the smallest web font format, about 30% smaller than WOFF, and the one to use on modern websites.'],
  zip: ['ZIP', 'ZIP is the archive format every computer and phone can open without extra software.'],
  '7z': ['7z', '7z compresses more tightly than ZIP but needs a program such as 7-Zip to open.'],
  'tar.gz': ['TAR.GZ', 'TAR.GZ is the standard archive format on Linux and for source code.'],
};
const slugOf = (f) => f.replace('.', '-');

function make(base, slug, name, tagline, preset, intro, faq) {
  const tool = toolById[base];
  return { ...tool, id: slug, base, name, tagline, preset, intro, faq, group: undefined };
}
/** A page for converting one format into another. */
function conv(base, from, to, noun, extra = {}) {
  const [a, ad] = F[from]; const [b, bd] = F[to];
  return make(base, `${slugOf(from)}-to-${slugOf(to)}`, `${a} to ${b} Converter`, `Convert ${a} ${noun} to ${b} online`, { format: to === 'docx' ? 'docx' : to, ...extra },
    `Convert ${a} ${noun} to ${b} in your browser, with nothing to install. ${ad} ${bd}`,
    [`Why convert ${a} to ${b}?`, `${ad} ${bd} Converting gives you a file that suits where you want to use it.`]);
}

export const LANDINGS = [
  // audio
  ...['mp4', 'wav', 'm4a', 'flac', 'ogg', 'mov', 'webm', 'mkv', 'aac', 'wma'].map((f) => conv('audio-converter', f, 'mp3', f === 'mp4' || f === 'mov' || f === 'webm' || f === 'mkv' ? 'video' : 'audio')),
  conv('audio-converter', 'mp3', 'wav', 'audio'), conv('audio-converter', 'mp3', 'ogg', 'audio'), conv('audio-converter', 'mp3', 'm4a', 'audio'),
  conv('audio-converter', 'flac', 'wav', 'audio'), conv('audio-converter', 'wav', 'flac', 'audio'), conv('audio-converter', 'm4a', 'wav', 'audio'),
  make('audio-converter', 'video-to-mp3', 'Video to MP3 Converter', 'Extract the audio from any video and save it as MP3', { format: 'mp3' },
    'Pull the soundtrack out of a video and save it as an MP3. Works with MP4, MOV, MKV, WebM, AVI and other video files, so you can keep a song, lecture or interview as audio only.',
    ['How do I extract audio from a video?', 'Add the video file and press Convert. The picture is dropped and the soundtrack is saved as an MP3 at the quality you choose, up to 320 kbps.']),
  make('trim-audio', 'ringtone-maker', 'Ringtone Maker', 'Cut any song into a ringtone for iPhone or Android', { format: 'm4r', fadeIn: 0.5, fadeOut: 1 },
    'Turn any song into a ringtone. Pick the part you want, add a short fade in and out, and save it as M4R for iPhone or MP3 for Android.',
    ['What length and format should a ringtone be?', 'iPhones use M4R files and limit ringtones to 40 seconds (30 seconds for alert tones). Android phones accept MP3 of any length.']),
  // video
  ...['mov', 'mkv', 'webm', 'avi', 'flv', 'wmv'].map((f) => conv('video-converter', f, 'mp4', 'video')),
  conv('video-converter', 'mp4', 'webm', 'video'), conv('video-converter', 'mp4', 'mov', 'video'), conv('video-converter', 'mp4', 'mkv', 'video'), conv('video-converter', 'mp4', 'avi', 'video'),
  conv('video-converter', 'mp4', 'gif', 'video'), conv('video-converter', 'mov', 'gif', 'video'),
  make('video-converter', 'video-to-gif', 'Video to GIF Converter', 'Turn a video clip into an animated GIF', { format: 'gif' },
    'Turn a short video into an animated GIF you can drop into chats, emails and documents. Trim the video first for the best result: GIFs are silent and grow large quickly, so a few seconds works best.',
    ['How long should a GIF be?', 'Keep it under about 10 seconds. A GIF has no sound and is far less efficient than video, so longer clips produce very large files.']),
  make('video-converter', 'compress-video', 'Video Compressor', 'Reduce the file size of a video for email, WhatsApp or uploading', { format: 'mp4', quality: '34', resolution: '720' },
    'Make a video file smaller so it fits email, messaging apps and upload limits. The video is re-encoded as MP4 at 720p with stronger compression; change the resolution or quality if you need it smaller or sharper.',
    ['How much smaller will the video be?', 'It depends on the original. Phone and camera footage is often reduced by 60–90% at 720p. Lower the resolution to 480p for the smallest file, or choose a better quality setting to keep more detail.']),
  make('video-converter', 'remove-audio-from-video', 'Remove Audio from Video', 'Mute a video by removing its sound track', { format: 'mp4', noAudio: true },
    'Remove the sound from a video and download a silent copy. Useful for background noise, music you cannot publish, or clips that will get a new soundtrack.',
    ['Does muting change the picture quality?', 'The video is re-encoded as MP4 at high quality, so it looks the same. Only the sound track is removed.']),
  make('video-speed', 'slow-motion-video', 'Slow Motion Video Maker', 'Slow a video down to half speed or slower', { speed: 0.5 },
    'Make a slow-motion version of any video. Choose half speed or go down to a quarter; the sound is slowed to match without changing its pitch, or can be removed.',
    ['How slow can the video go?', 'Down to 0.25×, a quarter of the original speed. Footage shot at 60 frames per second or more stays smoothest when slowed.']),
  make('video-speed', 'speed-up-video', 'Speed Up Video', 'Make a video play 2×, 3× or up to 4× faster', { speed: 2 },
    'Speed a video up to make a time-lapse or get through slow footage. Choose anything up to 4×; the sound keeps its normal pitch, or can be removed.',
    ['Will the sound become high-pitched?', 'No. The audio is sped up to match the picture while its pitch is kept natural. You can also remove the sound altogether.']),
  // images
  conv('image-converter', 'png', 'jpg', 'images'), conv('image-converter', 'jpg', 'png', 'images'), conv('image-converter', 'webp', 'jpg', 'images'), conv('image-converter', 'webp', 'png', 'images'),
  conv('image-converter', 'jpg', 'webp', 'images'), conv('image-converter', 'png', 'webp', 'images'), conv('image-converter', 'bmp', 'jpg', 'images'), conv('image-converter', 'tiff', 'jpg', 'images'),
  conv('image-converter', 'gif', 'png', 'images'), conv('image-converter', 'png', 'ico', 'images'), conv('image-converter', 'jpg', 'ico', 'images'),
  // documents
  ...['odt', 'rtf', 'txt', 'html'].map((f) => conv('document-converter', f, 'pdf', 'files')),
  make('document-converter', 'pdf-to-text', 'PDF to Text Converter', 'Extract the text from a PDF as a plain TXT file', { format: 'txt' },
    'Get the text out of a PDF as a plain TXT file you can paste anywhere. The layout of each page is kept as closely as plain text allows.',
    ['Does it work on scanned PDFs?', 'Only if the scan has a text layer from OCR. A PDF that is just pictures of pages has no text to extract.']),
  make('document-converter', 'csv-to-excel', 'CSV to Excel Converter', 'Convert a CSV file into an Excel spreadsheet', { format: 'xlsx' },
    `Turn a CSV file into an Excel workbook. ${F.csv[1]} ${F.xlsx[1]}`, ['Will my columns stay in place?', 'Yes. Each comma-separated value goes into its own cell, in the same rows and columns as the CSV.']),
  make('document-converter', 'excel-to-csv', 'Excel to CSV Converter', 'Convert an Excel spreadsheet into a CSV file', { format: 'csv' },
    `Save an Excel sheet as CSV. ${F.xlsx[1]} ${F.csv[1]}`, ['What happens to formulas and several sheets?', 'CSV holds values only, so each formula is saved as its result, and only the first sheet is exported.']),
  make('document-converter', 'word-to-text', 'Word to Text Converter', 'Convert a Word document to a plain TXT file', { format: 'txt' },
    'Strip a Word document down to plain text. Fonts, pictures and layout are removed and the words are kept, ready to paste anywhere.', ['What is removed?', 'Everything except the text: fonts, colours, pictures, tables’ borders and page layout.']),
  // ebooks, fonts, archives
  conv('ebook-converter', 'epub', 'pdf', 'ebooks'), make('ebook-converter', 'epub-to-word', 'EPUB to Word Converter', 'Convert an EPUB ebook into an editable Word document', { format: 'docx' },
    `Turn an ebook into a Word document you can edit. ${F.epub[1]} ${F.docx[1]}`, ['Are the pictures kept?', 'The text and chapter order are kept. Depending on the book, pictures and detailed formatting may be simplified.']),
  make('ebook-converter', 'word-to-epub', 'Word to EPUB Converter', 'Turn a Word document into an EPUB ebook', { format: 'epub' },
    `Make an ebook from a Word document. ${F.docx[1]} ${F.epub[1]}`, ['Which e-readers open EPUB?', 'Kobo, Nook, Apple Books, Google Play Books and most reading apps. Recent Kindles accept EPUB through Send to Kindle.']),
  conv('font-converter', 'ttf', 'woff2', 'fonts'), conv('font-converter', 'ttf', 'woff', 'fonts'), conv('font-converter', 'otf', 'woff2', 'fonts'), conv('font-converter', 'woff2', 'ttf', 'fonts'), conv('font-converter', 'woff', 'ttf', 'fonts'),
  conv('archive-converter', '7z', 'zip', 'archives'), conv('archive-converter', 'tar.gz', 'zip', 'archives'), conv('archive-converter', 'zip', '7z', 'archives'),
];
export const landingBySlug = Object.fromEntries(LANDINGS.map((l) => [l.id, l]));
/** Any page with a tool on it: the 51 tools plus the pages above. */
export const pageBySlug = (slug) => toolById[slug] || landingBySlug[slug];
export const landingsFor = (toolId) => LANDINGS.filter((l) => l.base === toolId);

/** Other names people search for. The first one is used in the page title. */
export const ALIASES = {
  'video-editor': ['Online Video Maker', 'movie maker', 'edit video online', 'video editing app'],
  'screen-recorder': ['Screen Capture', 'record screen online', 'screen video recorder'],
  'text-to-speech': ['TTS Voice Generator', 'text to voice', 'read text aloud', 'text to MP3'],
  'merge-videos': ['Video Joiner', 'combine videos', 'join video clips', 'video merger'],
  'trim-video': ['Video Cutter', 'video trimmer', 'cut video online', 'clip video', 'shorten video'],
  'add-audio': ['Add Music to Video', 'put a song on a video', 'add background music', 'add voice-over'],
  'add-image': ['Add Logo or Watermark to Video', 'overlay picture on video', 'picture in video'],
  'add-text': ['Add Captions to Video', 'write on video', 'video text overlay', 'add title to video'],
  'remove-logo': ['Video Watermark Remover', 'remove watermark from video', 'blur logo in video', 'remove date stamp'],
  'crop-video': ['Video Cropper', 'crop video online', 'change video aspect ratio'],
  'rotate-video': ['Video Rotator', 'turn video sideways', 'fix upside-down video'],
  'flip-video': ['Mirror Video', 'flip video horizontally', 'reverse mirrored video'],
  'resize-video': ['Video Resizer', 'change video resolution', 'resize video for Instagram'],
  'loop-video': ['Video Looper', 'repeat video', 'make a looping video'],
  'video-volume': ['Video Volume Booster', 'make video louder', 'increase video sound'],
  'video-speed': ['Video Speed Changer', 'speed up video', 'slow down video'],
  'stabilize-video': ['Video Stabilizer', 'fix shaky video', 'remove camera shake'],
  'video-recorder': ['Webcam Recorder', 'record video online', 'camera recorder', 'webcam test'],
  'trim-audio': ['MP3 Cutter', 'audio cutter', 'song cutter', 'audio trimmer', 'cut MP3 online'],
  'audio-volume': ['MP3 Volume Booster', 'make audio louder', 'increase MP3 volume', 'volume changer'],
  'audio-speed': ['Audio Speed Changer', 'change song tempo', 'speed up audio', 'slow down a song'],
  'audio-pitch': ['Pitch Shifter', 'change song key', 'pitch changer', 'transpose music'],
  equalizer: ['Bass Booster', 'online equalizer', 'boost bass', 'audio EQ'],
  'reverse-audio': ['Audio Reverser', 'play audio backwards', 'reverse a song'],
  'voice-recorder': ['Online Voice Recorder', 'record audio online', 'microphone recorder', 'record voice to MP3'],
  'audio-joiner': ['MP3 Merger', 'merge audio files', 'combine songs', 'join MP3'],
  'compress-pdf': ['Reduce PDF Size', 'PDF compressor', 'shrink PDF', 'make PDF smaller'],
  'merge-pdf': ['Combine PDF Files', 'PDF joiner', 'join PDFs', 'PDF merger'],
  'split-pdf': ['Extract Pages from PDF', 'PDF splitter', 'separate PDF pages', 'cut PDF'],
  'rotate-pdf': ['Rotate PDF Pages', 'turn PDF pages', 'fix sideways PDF'],
  'protect-pdf': ['Password Protect PDF', 'lock PDF', 'encrypt PDF', 'add password to PDF'],
  'unlock-pdf': ['PDF Password Remover', 'remove PDF password', 'unlock secured PDF'],
  'page-numbers': ['Number PDF Pages', 'add page numbers to PDF', 'PDF page numbering'],
  'pdf-to-word': ['PDF to DOCX Converter', 'PDF to Word converter', 'make PDF editable'],
  'pdf-to-excel': ['PDF to XLSX Converter', 'PDF table to Excel', 'PDF to spreadsheet'],
  'pdf-to-jpg': ['PDF to Image Converter', 'PDF to JPEG', 'save PDF as picture', 'extract images from PDF'],
  'pdf-to-png': ['PDF to PNG Converter', 'PDF page to image'],
  'pdf-to-html': ['PDF to Web Page', 'PDF to HTML converter'],
  'word-to-pdf': ['DOCX to PDF Converter', 'DOC to PDF', 'Word to PDF converter'],
  'excel-to-pdf': ['XLSX to PDF Converter', 'spreadsheet to PDF', 'XLS to PDF'],
  'ppt-to-pdf': ['PPTX to PDF Converter', 'PowerPoint to PDF', 'slides to PDF'],
  'jpg-to-pdf': ['Image to PDF Converter', 'photo to PDF', 'JPEG to PDF', 'pictures to PDF'],
  'png-to-pdf': ['PNG to PDF Converter', 'image to PDF', 'screenshot to PDF'],
  'audio-converter': ['MP3 Converter', 'convert to MP3', 'audio file converter', 'extract audio from video'],
  'video-converter': ['MP4 Converter', 'convert video to MP4', 'video file converter'],
  'image-converter': ['Photo Converter', 'convert image format', 'picture converter'],
  'document-converter': ['File Converter', 'convert documents', 'DOC converter'],
  'font-converter': ['Web Font Converter', 'convert font', 'WOFF2 converter'],
  'archive-converter': ['ZIP Converter', 'convert archive', 'convert to ZIP'],
  'ebook-converter': ['EPUB Converter', 'convert ebook', 'ebook to PDF'],
  'archive-extractor': ['Unzip Files Online', 'ZIP extractor', 'open ZIP file', '7z extractor', 'open archive online'],
};
export const aliasesOf = (page) => (page.base ? [] : ALIASES[page.id] || []);
export const ALL_PAGES = [...TOOLS, ...LANDINGS];
