// Single source of truth for every tool: used by the server (validation) and the browser (UI).

export const BRAND = { name: 'The File Kit', by: 'Liznat Labs' };

export const CATEGORIES = [
  { id: 'video', name: 'Video', blurb: 'Edit, trim, merge and record video' },
  { id: 'audio', name: 'Audio', blurb: 'Cut, tune and record sound' },
  { id: 'pdf', name: 'PDF', blurb: 'Compress, convert and organise PDFs' },
  { id: 'convert', name: 'Converters', blurb: 'Change any file into another format' },
];

const VIDEO_IN = 'video/*,.mkv,.mov,.avi,.flv,.wmv,.webm,.m4v,.3gp,.mpg,.mpeg,.ts,.gif';
const AUDIO_IN = 'audio/*,video/*,.mp3,.wav,.m4a,.flac,.ogg,.opus,.aac,.wma,.amr,.m4r,.mkv';
const IMAGE_IN = 'image/*,.jpg,.jpeg,.png,.webp,.bmp,.tif,.tiff,.gif';

const sel = (key, label, choices, def) => ({ key, label, type: 'select', choices, def: def ?? choices[0][0] });
const num = (key, label, def, min, max, step = 1, unit = '') => ({ key, label, type: 'number', def, min, max, step, unit });
const rng = (key, label, def, min, max, step = 1, unit = '') => ({ key, label, type: 'range', def, min, max, step, unit });
const chk = (key, label, def = false) => ({ key, label, type: 'checkbox', def });
const txt = (key, label, def = '', placeholder = '') => ({ key, label, type: 'text', def, placeholder });

const VOUT = sel('format', 'Save as', [['mp4', 'MP4'], ['mkv', 'MKV'], ['mov', 'MOV'], ['webm', 'WebM']]);
const AOUT = sel('format', 'Save as', [['mp3', 'MP3'], ['m4a', 'M4A'], ['m4r', 'M4R (iPhone ringtone)'], ['flac', 'FLAC'], ['wav', 'WAV'], ['ogg', 'OGG']]);
const TRIM = { key: 'range', type: 'trim', label: 'Section' };
const RECT = (label) => ({ key: 'rect', type: 'rect', label });
const DPI = sel('dpi', 'Resolution', [['72', '72 dpi'], ['144', '144 dpi'], ['300', '300 dpi'], ['600', '600 dpi']], '144');
const PAGE_OPTS = [
  sel('pageSize', 'Page size', [['A4', 'A4'], ['A3', 'A3'], ['A5', 'A5'], ['Letter', 'US Letter'], ['Legal', 'US Legal'], ['Original', 'Same as image']]),
  sel('orientation', 'Orientation', [['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']]),
  sel('margins', 'Margins', [['none', 'None'], ['narrow', 'Narrow (1.27 cm)'], ['moderate', 'Moderate (1.9 cm)'], ['wide', 'Wide (2.54 cm)']]),
];

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_PRESETS = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass boost': [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
  'Bass cut': [-7, -6, -5, -3, -1, 0, 0, 0, 0, 0],
  'Treble boost': [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
  'Treble cut': [0, 0, 0, 0, 0, -1, -3, -5, -6, -7],
  Vocal: [-3, -2, 0, 2, 4, 4, 3, 1, 0, -1],
  Podcast: [-6, -3, 0, 1, 3, 4, 3, 1, -1, -3],
  Rock: [5, 4, 2, -1, -2, 0, 2, 4, 5, 5],
  Pop: [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  Dance: [6, 5, 2, 0, 0, -2, -1, 2, 4, 5],
  'Hip-hop': [6, 5, 2, 3, -1, -1, 1, 0, 2, 3],
  Electronic: [5, 4, 1, 0, -2, 2, 1, 2, 4, 5],
  Acoustic: [4, 3, 2, 1, 2, 2, 3, 3, 3, 2],
  Loudness: [6, 4, 0, 0, -1, 0, -1, -3, 5, 2],
  'Small speakers': [6, 5, 4, 2, 1, 0, -1, -2, -3, -4],
  Telephone: [-12, -12, -8, -2, 3, 5, 4, -2, -10, -12],
};

export const TTS_VOICES = [['kal', 'Kal (male)'], ['slt', 'Slt (female)'], ['awb', 'Awb (male, Scottish)'], ['rms', 'Rms (male)'], ['kal16', 'Kal 16 kHz (male)']];

export const TOOLS = [
  // ───────────── Video ─────────────
  { id: 'video-editor', cat: 'video', name: 'Video Editor', tagline: 'Timeline editor: layer video, images, text and audio, then export', kind: 'editor', accept: VIDEO_IN, multiple: true },
  { id: 'screen-recorder', cat: 'video', name: 'Screen Recorder', tagline: 'Record your screen, a window or a tab right from the browser', kind: 'screen' },
  { id: 'text-to-speech', cat: 'video', name: 'Text to Speech', tagline: 'Turn written text into a spoken audio track', kind: 'text',
    options: [
      { key: 'text', label: 'Text', type: 'textarea', def: '', placeholder: 'Type or paste the text to read aloud…' },
      sel('voice', 'Voice', TTS_VOICES), rng('speed', 'Reading speed', 1, 0.5, 2, 0.05, '×'),
      sel('format', 'Save as', [['mp3', 'MP3'], ['wav', 'WAV'], ['ogg', 'OGG'], ['m4a', 'M4A'], ['flac', 'FLAC']]),
    ] },
  { id: 'merge-videos', cat: 'video', name: 'Merge Videos', tagline: 'Join several clips into one video, in the order you choose', accept: VIDEO_IN, multiple: true, min: 2,
    options: [sel('size', 'Frame size', [['first', 'Match first clip'], ['1920x1080', '1920×1080 (landscape)'], ['1280x720', '1280×720'], ['1080x1920', '1080×1920 (vertical)'], ['1080x1080', '1080×1080 (square)']]),
      sel('fit', 'Clips with a different shape', [['pad', 'Fit with bars'], ['fill', 'Fill and crop']]), VOUT] },
  { id: 'trim-video', cat: 'video', name: 'Trim Video', tagline: 'Keep the part you want, or cut a section out of the middle', accept: VIDEO_IN, preview: 'video',
    options: [TRIM, sel('mode', 'What to do', [['keep', 'Keep the selection'], ['remove', 'Remove the selection']]), VOUT] },
  { id: 'add-audio', cat: 'video', name: 'Add Audio to Video', tagline: 'Put music or a voice-over on a video', accept: VIDEO_IN, preview: 'video',
    extra: { label: 'Audio track', accept: AUDIO_IN, required: true },
    options: [sel('mode', 'Original sound', [['mix', 'Keep and mix with new audio'], ['replace', 'Replace with new audio']]),
      rng('audioVolume', 'New audio volume', 100, 0, 200, 5, '%'), rng('videoVolume', 'Original volume', 100, 0, 200, 5, '%'),
      chk('loop', 'Repeat the audio until the video ends', true), VOUT] },
  { id: 'add-image', cat: 'video', name: 'Add Image to Video', tagline: 'Overlay a logo, picture or watermark', accept: VIDEO_IN, preview: 'video',
    extra: { label: 'Image', accept: IMAGE_IN, required: true },
    options: [RECT('Drag the box to where the image should sit'), rng('opacity', 'Opacity', 100, 10, 100, 5, '%'), TRIM, VOUT] },
  { id: 'add-text', cat: 'video', name: 'Add Text to Video', tagline: 'Put a caption or title over your video', accept: VIDEO_IN, preview: 'video',
    options: [{ key: 'text', label: 'Text', type: 'textarea', def: '', placeholder: 'Your caption…', rows: 2 },
      sel('position', 'Position', [['bottom', 'Bottom centre'], ['top', 'Top centre'], ['center', 'Centre'], ['top-left', 'Top left'], ['top-right', 'Top right'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right']]),
      rng('size', 'Text size', 6, 2, 20, 0.5, '% of height'), { key: 'color', label: 'Colour', type: 'color', def: '#ffffff' },
      chk('box', 'Dark background behind text', true), TRIM, VOUT] },
  { id: 'remove-logo', cat: 'video', name: 'Remove Logo from Video', tagline: 'Blur or erase a logo, watermark or date stamp', accept: VIDEO_IN, preview: 'video',
    options: [RECT('Drag the box over the logo'), sel('mode', 'Method', [['erase', 'Erase (fill from surroundings)'], ['blur', 'Blur']]), VOUT] },
  { id: 'crop-video', cat: 'video', name: 'Crop Video', tagline: 'Cut the frame down to the area you need', accept: VIDEO_IN, preview: 'video',
    options: [{ ...RECT('Drag the box around the area to keep'), ratios: true }, VOUT] },
  { id: 'rotate-video', cat: 'video', name: 'Rotate Video', tagline: 'Turn a video 90, 180 or 270 degrees', accept: VIDEO_IN, preview: 'video',
    options: [sel('angle', 'Rotate', [['90', '90° clockwise'], ['180', '180°'], ['270', '90° counter-clockwise']]), VOUT] },
  { id: 'flip-video', cat: 'video', name: 'Flip Video', tagline: 'Mirror a video horizontally or vertically', accept: VIDEO_IN, preview: 'video',
    options: [sel('direction', 'Flip', [['h', 'Horizontally (mirror)'], ['v', 'Vertically (upside down)'], ['both', 'Both']]), VOUT] },
  { id: 'resize-video', cat: 'video', name: 'Resize Video', tagline: 'Change the resolution of a video', accept: VIDEO_IN, preview: 'video',
    options: [sel('preset', 'Resolution', [['1080', '1080p'], ['2160', '4K (2160p)'], ['1440', '1440p'], ['720', '720p'], ['480', '480p'], ['360', '360p'], ['240', '240p'], ['custom', 'Custom size…']], '720'),
      { ...num('width', 'Width', 1280, 16, 7680, 2, 'px'), showIf: { preset: 'custom' } }, { ...num('height', 'Height', 720, 16, 4320, 2, 'px'), showIf: { preset: 'custom' } }, VOUT] },
  { id: 'loop-video', cat: 'video', name: 'Loop Video', tagline: 'Repeat a video, or part of it, several times in a row', accept: VIDEO_IN, preview: 'video',
    options: [TRIM, rng('times', 'Repeat', 3, 2, 16, 1, '×'), VOUT] },
  { id: 'video-volume', cat: 'video', name: 'Change Video Volume', tagline: 'Make the sound of a video louder or quieter', accept: VIDEO_IN, preview: 'video',
    options: [rng('volume', 'Volume', 150, 0, 400, 5, '%'), VOUT] },
  { id: 'video-speed', cat: 'video', name: 'Change Video Speed', tagline: 'Slow a video down or speed it up', accept: VIDEO_IN, preview: 'video',
    options: [rng('speed', 'Speed', 2, 0.25, 4, 0.05, '×'), chk('mute', 'Remove sound'), VOUT] },
  { id: 'stabilize-video', cat: 'video', name: 'Stabilize Video', tagline: 'Smooth out shaky, hand-held footage', accept: VIDEO_IN, preview: 'video',
    options: [rng('strength', 'Smoothing', 15, 5, 40, 1, ''), VOUT] },
  { id: 'video-recorder', cat: 'video', name: 'Video Recorder', tagline: 'Record video or take a photo with your webcam', kind: 'webcam' },

  // ───────────── Audio ─────────────
  { id: 'trim-audio', cat: 'audio', name: 'Trim Audio', tagline: 'Cut a song or recording down to the part you want', accept: AUDIO_IN, preview: 'audio',
    options: [TRIM, sel('mode', 'What to do', [['keep', 'Keep the selection'], ['remove', 'Remove the selection']]),
      num('fadeIn', 'Fade in', 0, 0, 30, 0.5, 's'), num('fadeOut', 'Fade out', 0, 0, 30, 0.5, 's'), AOUT] },
  { id: 'audio-volume', cat: 'audio', name: 'Change Volume', tagline: 'Make an audio file louder or quieter', accept: AUDIO_IN, preview: 'audio',
    options: [rng('volume', 'Volume', 150, 0, 400, 5, '%'), chk('normalize', 'Even out loudness automatically'), AOUT] },
  { id: 'audio-speed', cat: 'audio', name: 'Change Speed', tagline: 'Change tempo without changing the pitch', accept: AUDIO_IN, preview: 'audio',
    options: [rng('speed', 'Speed', 1.25, 0.25, 4, 0.05, '×'), AOUT] },
  { id: 'audio-pitch', cat: 'audio', name: 'Change Pitch', tagline: 'Shift the key of a song without changing its tempo', accept: AUDIO_IN, preview: 'audio',
    options: [rng('semitones', 'Pitch shift', 2, -12, 12, 0.5, ' semitones'), AOUT] },
  { id: 'equalizer', cat: 'audio', name: 'Equalizer', tagline: 'Boost bass, cut treble or shape any frequency band', accept: AUDIO_IN, preview: 'audio',
    options: [{ key: 'gains', type: 'eq', label: 'Bands' }, AOUT] },
  { id: 'reverse-audio', cat: 'audio', name: 'Reverse Audio', tagline: 'Make an audio file play backwards', accept: AUDIO_IN, preview: 'audio', options: [AOUT] },
  { id: 'voice-recorder', cat: 'audio', name: 'Voice Recorder', tagline: 'Record from your microphone and save it as MP3', kind: 'voice' },
  { id: 'audio-joiner', cat: 'audio', name: 'Audio Joiner', tagline: 'Merge several tracks into one, with optional crossfade', accept: AUDIO_IN, multiple: true, min: 2,
    options: [num('crossfade', 'Crossfade between tracks', 0, 0, 15, 0.5, 's'), num('fadeIn', 'Fade in first track', 0, 0, 30, 0.5, 's'),
      num('fadeOut', 'Fade out last track', 0, 0, 30, 0.5, 's'), AOUT] },

  // ───────────── PDF ─────────────
  { id: 'compress-pdf', cat: 'pdf', name: 'Compress PDF', tagline: 'Make a PDF smaller while keeping it readable', accept: '.pdf', multiple: true,
    options: [sel('level', 'Compression', [['balanced', 'Balanced — good quality, smaller file (150 dpi)'], ['strong', 'Strong — smallest file (72 dpi)'], ['light', 'Light — best quality (300 dpi)'], ['custom', 'Custom…']]),
      { ...rng('dpi', 'Image resolution', 120, 36, 300, 4, ' dpi'), showIf: { level: 'custom' } },
      { ...rng('quality', 'Image quality', 60, 10, 95, 5, '%'), showIf: { level: 'custom' } },
      chk('grayscale', 'Convert to grayscale')] },
  { id: 'merge-pdf', cat: 'pdf', name: 'Merge PDF', tagline: 'Combine several PDFs into one file', accept: '.pdf', multiple: true, min: 2, options: [] },
  { id: 'split-pdf', cat: 'pdf', name: 'Split PDF', tagline: 'Extract pages or break a PDF into separate files', accept: '.pdf', preview: 'pdf',
    options: [{ key: 'ranges', type: 'pages', label: 'Pages', mode: 'select' }, chk('separate', 'Save every page as its own PDF')] },
  { id: 'rotate-pdf', cat: 'pdf', name: 'Rotate PDF', tagline: 'Turn single pages or the whole document', accept: '.pdf', preview: 'pdf',
    options: [{ key: 'rotations', type: 'pages', label: 'Pages', mode: 'rotate' }] },
  { id: 'protect-pdf', cat: 'pdf', name: 'Protect PDF', tagline: 'Lock a PDF with a password (AES-256)', accept: '.pdf',
    options: [{ key: 'password', label: 'Password', type: 'password', def: '', strength: true }, chk('noPrint', 'Also block printing'), chk('noCopy', 'Also block copying text')] },
  { id: 'unlock-pdf', cat: 'pdf', name: 'Unlock PDF', tagline: 'Remove the password from a PDF you can open', accept: '.pdf',
    options: [{ key: 'password', label: 'Current password', type: 'password', def: '' }] },
  { id: 'page-numbers', cat: 'pdf', name: 'Add Page Numbers', tagline: 'Number the pages of a PDF', accept: '.pdf',
    options: [sel('position', 'Position', [['cfoot', 'Bottom centre'], ['rfoot', 'Bottom right'], ['lfoot', 'Bottom left'], ['chead', 'Top centre'], ['rhead', 'Top right'], ['lhead', 'Top left']]),
      sel('style', 'Format', [['n', '1, 2, 3…'], ['page', 'Page 1'], ['of', 'Page 1 of 9'], ['slash', '1 / 9']]),
      num('start', 'Start at', 1, 0, 99999), num('fontSize', 'Text size', 11, 6, 36, 1, 'pt'), chk('skipFirst', 'No number on the first page')] },
  { id: 'pdf-to-word', cat: 'pdf', group: 'Convert from PDF', name: 'PDF to Word', tagline: 'Convert a PDF into an editable Word document', accept: '.pdf', multiple: true,
    options: [sel('layout', 'Result', [['exact', 'Keep the page layout (text in boxes)'], ['flow', 'Editable flowing text (easier to edit)']]),
      sel('format', 'Save as', [['docx', 'DOCX'], ['doc', 'DOC'], ['odt', 'ODT'], ['rtf', 'RTF']])] },
  { id: 'pdf-to-excel', cat: 'pdf', group: 'Convert from PDF', name: 'PDF to Excel', tagline: 'Pull tables out of a PDF into a spreadsheet', accept: '.pdf', multiple: true,
    options: [sel('format', 'Save as', [['xlsx', 'XLSX'], ['xls', 'XLS'], ['ods', 'ODS'], ['csv', 'CSV']])] },
  { id: 'pdf-to-jpg', cat: 'pdf', group: 'Convert from PDF', name: 'PDF to JPG', tagline: 'Save each page as a JPG, or extract the embedded images', accept: '.pdf',
    options: [sel('mode', 'What to save', [['pages', 'Every page as an image'], ['images', 'Only images embedded in the PDF']]),
      { ...sel('quality', 'JPEG quality', [['90', 'High'], ['100', 'Maximum'], ['60', 'Medium'], ['30', 'Low']]), showIf: { mode: 'pages' } }, { ...DPI, showIf: { mode: 'pages' } }] },
  { id: 'pdf-to-png', cat: 'pdf', group: 'Convert from PDF', name: 'PDF to PNG', tagline: 'Save each page as a PNG, or extract the embedded images', accept: '.pdf',
    options: [sel('mode', 'What to save', [['pages', 'Every page as an image'], ['images', 'Only images embedded in the PDF']]), { ...DPI, showIf: { mode: 'pages' } }] },
  { id: 'pdf-to-html', cat: 'pdf', group: 'Convert from PDF', name: 'PDF to HTML', tagline: 'Turn a PDF into a web page', accept: '.pdf',
    options: [sel('layout', 'Layout', [['exact', 'Keep the page layout'], ['flow', 'Simple flowing text']]), chk('single', 'One self-contained HTML file (images embedded)', true), rng('zoom', 'Zoom', 1.5, 0.5, 3, 0.1, '×')] },
  { id: 'word-to-pdf', cat: 'pdf', group: 'Convert to PDF', name: 'Word to PDF', tagline: 'Convert DOC, DOCX, ODT or RTF to PDF', accept: '.doc,.docx,.odt,.rtf,.txt', multiple: true, options: [] },
  { id: 'excel-to-pdf', cat: 'pdf', group: 'Convert to PDF', name: 'Excel to PDF', tagline: 'Convert XLS, XLSX, ODS or CSV to PDF', accept: '.xls,.xlsx,.ods,.csv', multiple: true, options: [] },
  { id: 'ppt-to-pdf', cat: 'pdf', group: 'Convert to PDF', name: 'PowerPoint to PDF', tagline: 'Convert PPT, PPTX or ODP slides to PDF', accept: '.ppt,.pptx,.odp', multiple: true, options: [] },
  { id: 'jpg-to-pdf', cat: 'pdf', group: 'Convert to PDF', name: 'JPG to PDF', tagline: 'Combine JPG images into a single PDF', accept: '.jpg,.jpeg,image/jpeg', multiple: true, options: PAGE_OPTS },
  { id: 'png-to-pdf', cat: 'pdf', group: 'Convert to PDF', name: 'PNG to PDF', tagline: 'Combine PNG and other images into a single PDF', accept: IMAGE_IN, multiple: true, options: PAGE_OPTS },

  // ───────────── Converters ─────────────
  { id: 'audio-converter', cat: 'convert', name: 'Audio Converter', tagline: 'Convert audio (or the sound of a video) to MP3, WAV, FLAC and more', accept: AUDIO_IN, multiple: true,
    options: [sel('format', 'Convert to', [['mp3', 'MP3'], ['wav', 'WAV'], ['m4a', 'M4A'], ['flac', 'FLAC'], ['ogg', 'OGG'], ['opus', 'Opus'], ['mp2', 'MP2'], ['m4r', 'M4R (iPhone ringtone)']]),
      sel('bitrate', 'Quality', [['192', 'Good — 192 kbps'], ['64', 'Economy — 64 kbps'], ['128', 'Standard — 128 kbps'], ['256', 'High — 256 kbps'], ['320', 'Best — 320 kbps']]),
      sel('sampleRate', 'Sample rate', [['', 'Keep original'], ['22050', '22.05 kHz'], ['44100', '44.1 kHz'], ['48000', '48 kHz'], ['96000', '96 kHz']]),
      sel('channels', 'Channels', [['', 'Keep original'], ['1', 'Mono'], ['2', 'Stereo']]),
      chk('fadeIn', 'Fade in'), chk('fadeOut', 'Fade out'), chk('reverse', 'Reverse'), chk('trimSilence', 'Trim silence at both ends'),
      { ...txt('title', 'Title'), group: 'Track info' }, { ...txt('artist', 'Artist'), group: 'Track info' }, { ...txt('album', 'Album'), group: 'Track info' },
      { ...txt('year', 'Year'), group: 'Track info' }, { ...txt('genre', 'Genre'), group: 'Track info' }] },
  { id: 'video-converter', cat: 'convert', name: 'Video Converter', tagline: 'Convert video to MP4, MKV, WebM, GIF and more', accept: VIDEO_IN, multiple: true,
    options: [sel('format', 'Convert to', [['mp4', 'MP4'], ['mkv', 'MKV'], ['mov', 'MOV'], ['webm', 'WebM'], ['avi', 'AVI'], ['flv', 'FLV'], ['3gp', '3GP'], ['mpg', 'MPEG'], ['gif', 'Animated GIF']]),
      sel('resolution', 'Resolution', [['', 'Same as source'], ['2160', '4K (2160p)'], ['1440', '1440p'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p'], ['240', '240p']]),
      sel('quality', 'Quality', [['23', 'Optimal'], ['34', 'Smallest file'], ['28', 'Lower'], ['20', 'Better'], ['17', 'Best']]),
      { ...sel('vcodec', 'Video codec', [['h264', 'H.264 (plays everywhere)'], ['h265', 'H.265 / HEVC (smaller)']]), showIf: { format: ['mp4', 'mkv', 'mov'] } },
      chk('noAudio', 'No audio')] },
  { id: 'image-converter', cat: 'convert', name: 'Image Converter', tagline: 'Convert between JPG, PNG, WebP, GIF, BMP, TIFF and ICO', accept: IMAGE_IN + ',.ico,.avif,.heic,.svg,.psd', multiple: true,
    options: [sel('format', 'Convert to', [['jpg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP'], ['gif', 'GIF'], ['bmp', 'BMP'], ['tiff', 'TIFF'], ['ico', 'ICO (icon)']]),
      { ...rng('quality', 'Quality', 85, 10, 100, 5, '%'), showIf: { format: ['jpg', 'webp'] } },
      num('width', 'Resize to width (0 = keep size)', 0, 0, 16000, 1, 'px')] },
  { id: 'document-converter', cat: 'convert', name: 'Document Converter', tagline: 'Convert text documents, spreadsheets and presentations', accept: '.doc,.docx,.odt,.rtf,.txt,.html,.htm,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.pdf', multiple: true,
    options: [sel('format', 'Convert to', [['pdf', 'PDF'], ['docx', 'DOCX'], ['doc', 'DOC'], ['odt', 'ODT'], ['rtf', 'RTF'], ['txt', 'TXT'], ['html', 'HTML'], ['xlsx', 'XLSX'], ['xls', 'XLS'], ['ods', 'ODS'], ['csv', 'CSV'], ['pptx', 'PPTX'], ['odp', 'ODP']])] },
  { id: 'font-converter', cat: 'convert', name: 'Font Converter', tagline: 'Convert fonts between TTF, WOFF, WOFF2, EOT and SVG', accept: '.ttf,.otf,.woff,.woff2,.eot,.svg', multiple: true,
    options: [sel('format', 'Convert to', [['woff2', 'WOFF2'], ['woff', 'WOFF'], ['ttf', 'TTF'], ['eot', 'EOT'], ['svg', 'SVG font']])] },
  { id: 'archive-converter', cat: 'convert', name: 'Archive Converter', tagline: 'Repack an archive as ZIP, 7z or TAR', accept: '.zip,.7z,.rar,.tar,.gz,.tgz,.bz2,.xz,.iso,.cab,.jar,.deb,.rpm', multiple: true,
    options: [sel('format', 'Convert to', [['zip', 'ZIP'], ['7z', '7z'], ['tar', 'TAR'], ['tar.gz', 'TAR.GZ'], ['tar.bz2', 'TAR.BZ2'], ['tar.xz', 'TAR.XZ']]),
      { key: 'password', label: 'Password (if the archive is locked)', type: 'password', def: '' }] },
  { id: 'ebook-converter', cat: 'convert', name: 'Ebook Converter', tagline: 'Convert ebooks between EPUB, PDF, DOCX, FB2 and text', accept: '.epub,.fb2,.docx,.doc,.odt,.rtf,.txt,.html,.htm', multiple: true,
    options: [sel('format', 'Convert to', [['epub', 'EPUB'], ['pdf', 'PDF'], ['docx', 'DOCX'], ['txt', 'TXT'], ['html', 'HTML']])] },
  { id: 'archive-extractor', cat: 'convert', name: 'Archive Extractor', tagline: 'Open ZIP, 7z, RAR, TAR, ISO and 40+ other archives online', accept: '', multiple: false, resultMode: 'tree',
    options: [{ key: 'password', label: 'Password (if the archive is locked)', type: 'password', def: '' }] },
];

export const toolById = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

// Operations the video editor calls behind the scenes; they have no page of their own.
export const INTERNAL = { 'clip-reverse': { id: 'clip-reverse' }, 'clip-silence': { id: 'clip-silence' } };
