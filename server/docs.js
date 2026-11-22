// PDF tools and file converters (Ghostscript, poppler, LibreOffice, 7z, pdf-lib).
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { run, ff, office, UserError, uniquePath, clamp, parseRanges, fmtSize, stripSpecial, walk, extOf } from './util.js';

const require = createRequire(import.meta.url);
globalThis.crypto ??= crypto.webcrypto; // Node 18 has no global Web Crypto, which PDF encryption needs
const { PDFDocument, StandardFonts, rgb, degrees } = require('@cantoo/pdf-lib');

const pick = (v, allowed, def) => (allowed.includes(String(v)) ? String(v) : def);

async function loadPdf(file) {
  try {
    return await PDFDocument.load(await fs.readFile(file.path));
  } catch (e) {
    if (/encrypt/i.test(e.message)) throw new UserError(`"${file.name}" is password-protected. Unlock it first with the Unlock PDF tool.`);
    throw new UserError(`"${file.name}" could not be read as a PDF. It may be damaged.`);
  }
}
const savePdf = async (doc, p) => fs.writeFile(p, await doc.save());

async function gs(args, file) {
  try {
    await run('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite', ...args]);
  } catch (e) {
    const msg = `${e.stderr || ''}${e.stdout || ''}${e.message}`;
    if (/password/i.test(msg)) throw new UserError(`"${file.name}" needs a password, or the password is wrong.`);
    throw new UserError(`"${file.name}" could not be processed. It may be damaged.`);
  }
}

async function poppler(cmd, args, file) {
  try { return await run(cmd, args); } catch (e) {
    if (/password/i.test(e.message)) throw new UserError(`"${file.name}" is password-protected. Unlock it first with the Unlock PDF tool.`);
    throw new UserError(`"${file.name}" could not be read as a PDF. It may be damaged.`);
  }
}

/** Text of a PDF as rows of cells, split wherever the layout leaves a gap of two or more spaces. */
async function pdfToCsv(file, csvPath) {
  const { stdout } = await poppler('pdftotext', ['-layout', '-enc', 'UTF-8', file.path, '-'], file);
  const cell = (c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  const rows = stdout.replace(/\f/g, '\n').split('\n').map((l) => l.trimEnd()).map((l) => (l.trim() ? l.trim().split(/\s{2,}/).map(cell).join(',') : ''));
  if (!rows.some(Boolean)) throw new UserError(`"${file.name}" has no selectable text. Scanned PDFs need OCR first.`);
  await fs.writeFile(csvPath, `${rows.join('\n').replace(/\n{3,}/g, '\n\n')}\n`);
}

const WRITER = ['docx', 'doc', 'odt', 'rtf', 'txt', 'html', 'epub'];
const CALC = ['xlsx', 'xls', 'ods', 'csv'];
const IMPRESS = ['pptx', 'ppt', 'odp'];
const TARGET = { txt: 'txt:Text (encoded):UTF8', docx: 'docx:MS Word 2007 XML', doc: 'doc:MS Word 97', html: 'html:HTML (StarWriter)' };

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">`;
const PRINT_CSS = '<style>body{font:11pt/1.5 "Noto Serif",Georgia,serif;margin:0;color:#111}pre{white-space:pre-wrap;font:10.5pt/1.5 "Noto Sans Mono",monospace}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #999;padding:3px 6px}@page{margin:2cm}</style>';
const escHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripTags = (h) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<\/(p|div|h\d|li|tr|section)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

// Is LibreOffice Writer usable on this machine? Checked once, on first need.
let writerCheck;
function writerWorks(ctx) {
  writerCheck ||= (async () => {
    const dir = path.join(ctx.work, 'lo-check');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'check.txt'), 'check\n');
    try { await office(path.join(dir, 'check.txt'), 'pdf', dir); return true; } catch {
      console.warn('LibreOffice Writer is not working on this machine — using the built-in fallback converters for text documents.');
      return false;
    }
  })();
  return writerCheck;
}

/** A print-safe HTML rendering of a txt / html / docx file, or null when we cannot make one. */
async function toSafeHtml(ctx, file) {
  let body;
  if (file.ext === 'txt') body = `<pre>${escHtml(await fs.readFile(file.path, 'utf8'))}</pre>`;
  else if (file.ext === 'html' || file.ext === 'htm') body = await fs.readFile(file.path, 'utf8');
  else if (file.ext === 'docx') {
    try { body = (await require('mammoth').convertToHtml({ path: file.path })).value; } catch { throw new UserError(`"${file.name}" could not be read as a Word document.`); }
  } else return null;
  const out = path.join(ctx.work, `safe-${crypto.randomUUID()}.html`);
  // The policy comes first so nothing in the document can run scripts or pull in other files.
  await fs.writeFile(out, `<!doctype html><meta charset="utf-8">${CSP}${PRINT_CSS}\n${body}`);
  return out;
}

async function chromePdf(htmlPath, outPdf, work) {
  const bins = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const bin of bins) {
    try {
      await run(bin, ['--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-pdf-header-footer',
        `--user-data-dir=${path.join(work, 'chrome')}`, `--print-to-pdf=${outPdf}`, pathToFileURL(htmlPath).href], { timeout: 5 * 60 * 1000 });
      await fs.access(outPdf);
      return;
    } catch { /* try the next browser */ }
  }
  throw new UserError('This conversion needs LibreOffice Writer or Chrome on the server, and neither is working.');
}

/**
 * Plain text → DOCX. By default each source line is kept (good for tables and forms).
 * With `reflow`, lines are joined back into flowing paragraphs, which is what scanned pages need.
 */
async function textDocx(text, outPath, { reflow = false } = {}) {
  const { Document, Packer, Paragraph, TextRun, PageBreak } = require('docx');
  const children = [];
  const startsClause = (l) => /^(\(?\d{1,3}(\.\d{1,3})*[.)]?|[•\-–*]|\(?[a-z][.)])\s+\S/.test(l); // "3.", "2.4", "(a)", bullets
  text.split('\f').forEach((pageText, i, all) => {
    if (reflow) {
      const blocks = [];
      for (const para of pageText.split(/\n\s*\n/)) {
        const raw = para.split('\n').map((l) => l.trim()).filter(Boolean);
        // rows with column gaps are a table: keep them as rows, with tabs between the columns
        if (raw.length >= 2 && raw.filter((l) => /\S\s{2,}\S/.test(l)).length >= raw.length * 0.6) {
          children.push(new Paragraph({ children: raw.map((l, n) => new TextRun({ text: l.replace(/\s{2,}/g, '\t'), break: n ? 1 : 0 })), spacing: { after: 160 } }));
          continue;
        }
        let cur = '';
        for (const line of raw.map((l) => l.replace(/\s{2,}/g, ' '))) {
          if (cur && startsClause(line)) { blocks.push(cur); cur = ''; }
          // re-join words that were hyphenated across a line end
          cur = !cur ? line : /[A-Za-z]-$/.test(cur) && /^[a-z]/.test(line) ? cur.slice(0, -1) + line : `${cur} ${line}`;
        }
        if (cur) blocks.push(cur);
      }
      for (const b of blocks) {
        const heading = b.length < 80 && !/[.;,:]$/.test(b) && /^(\d{1,3}\.?\s+)?[A-Z]/.test(b) && !/^\d{1,3}\.\d/.test(b);
        children.push(new Paragraph({ children: [new TextRun({ text: b, bold: heading })], spacing: { before: heading ? 200 : 0, after: 160 } }));
      }
      if (i < all.length - 1 && all[i + 1].trim()) children.push(new Paragraph({ children: [new PageBreak()] }));
      return;
    }
    for (const para of pageText.split(/\n\s*\n/)) {
      // keep the original line breaks; gaps between columns become tabs
      const lines = para.split('\n').map((l) => l.trim().replace(/\s{2,}/g, '\t')).filter(Boolean);
      if (lines.length) children.push(new Paragraph({ children: lines.map((l, n) => new TextRun({ text: l, break: n ? 1 : 0 })), spacing: { after: 160 } }));
    }
    if (i < all.length - 1 && all[i + 1].trim()) children.push(new Paragraph({ children: [new PageBreak()] }));
  });
  if (!children.length) throw new UserError('No selectable text was found. Scanned documents need OCR first.');
  await fs.writeFile(outPath, await Packer.toBuffer(new Document({ sections: [{ children }] })));
}

/** A small, valid EPUB 3 holding the text as paragraphs. */
async function textEpub(ctx, text, title, outPath) {
  const dir = path.join(ctx.work, `mkepub-${crypto.randomUUID()}`);
  await fs.mkdir(path.join(dir, 'META-INF'), { recursive: true });
  await fs.mkdir(path.join(dir, 'OEBPS'));
  const t = escHtml(title);
  const paras = text.replace(/\f/g, '\n\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escHtml(p).replace(/\n/g, '<br/>')}</p>`).join('\n');
  if (!paras) throw new UserError('No text was found to put in the ebook.');
  await fs.writeFile(path.join(dir, 'mimetype'), 'application/epub+zip');
  await fs.writeFile(path.join(dir, 'META-INF/container.xml'), '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  await fs.writeFile(path.join(dir, 'OEBPS/content.opf'), `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${t}</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="text" href="text.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="text"/></spine></package>`);
  const page = (body) => `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${t}</title></head><body>${body}</body></html>`;
  await fs.writeFile(path.join(dir, 'OEBPS/nav.xhtml'), page(`<nav epub:type="toc"><ol><li><a href="text.xhtml">${t}</a></li></ol></nav>`));
  await fs.writeFile(path.join(dir, 'OEBPS/text.xhtml'), page(`<h1>${t}</h1>\n${paras}`));
  await run('zip', ['-q', '-X', '-0', outPath, 'mimetype'], { cwd: dir }); // the mimetype entry must come first, uncompressed
  await run('zip', ['-q', '-X', '-r', '-9', outPath, 'META-INF', 'OEBPS'], { cwd: dir });
}

/** Text-document conversions without LibreOffice Writer. Simpler output, but it keeps the tools working. */
async function writerFallback(ctx, file, fmt) {
  const out = await uniquePath(ctx.out, `${file.base}.${fmt}`);
  const note = () => ctx.note('LibreOffice Writer is not available on this server, so a simpler built-in converter was used. Text is kept; complex layout may differ.');
  const html = await toSafeHtml(ctx, file);
  if (fmt === 'pdf' && html) { await chromePdf(html, out, ctx.work); return note(); }
  if (fmt === 'html' && html) { await fs.copyFile(html, out); return note(); }
  let text;
  if (file.ext === 'pdf') text = (await poppler('pdftotext', ['-layout', '-enc', 'UTF-8', file.path, '-'], file)).stdout;
  else if (html) text = stripTags(await fs.readFile(html, 'utf8'));
  if (text != null && fmt === 'txt') { await fs.writeFile(out, text.replace(/\f/g, '\n')); return note(); }
  if (text != null && fmt === 'docx') { await textDocx(text, out); return note(); }
  if (text != null && fmt === 'epub') { await textEpub(ctx, text, file.base, out); return note(); }
  throw new UserError(`Converting ${file.ext.toUpperCase()} to ${fmt.toUpperCase()} needs LibreOffice Writer, which is not working on this server. Reinstall LibreOffice (or set LIBREOFFICE_BIN to a working copy) to enable it.`);
}

/** True when most pages are one picture of the page — a scan, with or without a hidden OCR text layer. */
async function isScannedPdf(file) {
  const info = (await poppler('pdfinfo', ['-l', '30', file.path], file)).stdout;
  const area = {};
  for (const m of info.matchAll(/^Page\s+(\d+)\s+size:\s+([\d.]+) x ([\d.]+) pts/gm)) area[m[1]] = Number(m[2]) * Number(m[3]);
  const pages = Object.keys(area).length;
  if (!pages) return false;
  const rows = (await poppler('pdfimages', ['-list', '-l', '30', file.path], file)).stdout.split('\n').slice(2);
  const scanned = new Set();
  for (const row of rows) {
    const c = row.trim().split(/\s+/); // page num type width height … x-ppi y-ppi size ratio
    const [xppi, yppi] = [Number(c[12]), Number(c[13])];
    if (c.length < 14 || c[2] !== 'image' || !(xppi > 0 && yppi > 0) || !area[c[0]]) continue;
    const shown = (Number(c[3]) / xppi) * 72 * (Number(c[4]) / yppi) * 72; // printed size of the picture, in square points
    if (shown >= 0.7 * area[c[0]]) scanned.add(c[0]);
  }
  return scanned.size >= Math.max(1, pages * 0.6);
}

/**
 * Scanned PDF → editable document. A layout-preserving import would stack the hidden OCR words on top of
 * the page photo, so the text layer is rebuilt as ordinary paragraphs instead.
 */
async function scannedToDocument(ctx, file, fmt, stage, { scanned = true } = {}) {
  // scans read best in plain reading order; real PDFs keep their column spacing so tables survive
  const text = (await poppler('pdftotext', [...(scanned ? [] : ['-layout']), '-enc', 'UTF-8', file.path, '-'], file)).stdout;
  if (text.replace(/\s/g, '').length < 20) {
    if (!scanned) throw new UserError(`"${file.name}" has no selectable text, so there is nothing to turn into editable text.`);
    throw new UserError(`"${file.name}" is a scan with no text layer — its pages are only pictures, so there is no text to make editable. Run it through OCR (text recognition) first, then convert it again.`);
  }
  const docx = path.join(stage, `${file.base}.docx`);
  await textDocx(text, docx, { reflow: true });
  const out = await uniquePath(ctx.out, `${file.base}.${fmt}`);
  if (fmt === 'docx') await fs.rename(docx, out);
  else {
    if (!(await writerWorks(ctx))) throw new UserError(`"${file.name}" is a scan; it can be converted to DOCX on this server, but ${fmt.toUpperCase()} needs LibreOffice Writer.`);
    const stage2 = path.join(stage, 'out');
    await fs.mkdir(stage2);
    await fs.rename(await office(docx, TARGET[fmt] || fmt, stage2), out);
  }
  if (!scanned) return ctx.note(`${file.name}: converted as flowing, editable text. Fonts, pictures and exact positions are not carried over; choose “Keep the page layout” if you need those.`);
  ctx.note(`${file.name} is a scanned document, so its text was taken from the hidden text-recognition layer and laid out as normal, editable paragraphs. Check it against the original: recognition can misread characters, and pictures, stamps and signatures are not carried over.`);
}

/** Convert any office document to `fmt`, written into ctx.out under the original name. */
async function officeConvert(ctx, file, fmt) {
  if (file.ext === fmt) throw new UserError(`"${file.name}" is already in ${fmt.toUpperCase()} format.`);
  const stage = path.join(ctx.work, `lo-${crypto.randomUUID()}`);
  await fs.mkdir(stage);
  let input = file.path;
  let infilter;
  let target = fmt;
  let writer = false; // does this conversion go through LibreOffice Writer?
  if (file.ext === 'pdf') {
    // poppler does these two directly, and better
    if (fmt === 'txt') return fs.writeFile(await uniquePath(ctx.out, `${file.base}.txt`), (await poppler('pdftotext', ['-layout', '-enc', 'UTF-8', file.path, '-'], file)).stdout);
    if (fmt === 'html') return poppler('pdftohtml', ['-s', '-noframes', '-c', '-dataurls', '-enc', 'UTF-8', file.path, path.join(ctx.out, file.base)], file);
    if (CALC.includes(fmt)) {
      input = path.join(stage, `${file.base}.csv`);
      await pdfToCsv(file, input);
      if (fmt === 'csv') { await fs.rename(input, await uniquePath(ctx.out, `${file.base}.csv`)); return; }
      infilter = 'Text - txt - csv (StarCalc):44,34,76,1';
    } else if (IMPRESS.includes(fmt)) infilter = 'impress_pdf_import';
    else if (await isScannedPdf(file)) return scannedToDocument(ctx, file, fmt, stage);
    else if (ctx.opts.layout === 'flow') return scannedToDocument(ctx, file, fmt, stage, { scanned: false });
    else { infilter = 'writer_pdf_import'; target = TARGET[fmt] || fmt; writer = true; }
  } else if (!CALC.includes(file.ext) && !IMPRESS.includes(file.ext)) { target = TARGET[fmt] || fmt; writer = true; }
  if (file.ext === 'csv') infilter = 'Text - txt - csv (StarCalc):44,34,76,1';
  if (writer && !(await writerWorks(ctx))) return writerFallback(ctx, file, fmt);
  const produced = await office(input, target, stage, infilter);
  await fs.rename(produced, await uniquePath(ctx.out, `${file.base}.${fmt}`));
}

const PAGE = { A3: [841.89, 1190.55], A4: [595.28, 841.89], A5: [419.53, 595.28], Letter: [612, 792], Legal: [612, 1008] };
const MARGIN = { none: 0, narrow: 36, moderate: 54, wide: 72 };

async function imagesToPdf(ctx) {
  const o = ctx.opts;
  const doc = await PDFDocument.create();
  const margin = MARGIN[o.margins] ?? 0;
  for (const [i, file] of ctx.files.entries()) {
    let bytes = await fs.readFile(file.path);
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    let img;
    try {
      if (!isJpg && !isPng) {
        const png = path.join(ctx.work, `img-${i}.png`);
        await ff(['-i', file.path, '-frames:v', '1', png]);
        bytes = await fs.readFile(png);
      }
      img = isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
    } catch { throw new UserError(`"${file.name}" could not be read as an image.`); }
    let [pw, ph] = PAGE[o.pageSize] || [img.width * 0.75 + margin * 2, img.height * 0.75 + margin * 2];
    const wide = img.width > img.height;
    if (PAGE[o.pageSize] && (o.orientation === 'landscape' || (o.orientation !== 'portrait' && wide))) [pw, ph] = [ph, pw];
    const page = doc.addPage([pw, ph]);
    const scale = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height);
    const w = img.width * scale; const h = img.height * scale;
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  await savePdf(doc, await uniquePath(ctx.out, `${ctx.files.length === 1 ? ctx.files[0].base : 'images'}.pdf`));
}

async function pdfToImages(ctx, kind) {
  const file = ctx.files[0];
  const o = ctx.opts;
  if (o.mode === 'images') {
    const stage = path.join(ctx.work, 'embedded');
    await fs.mkdir(stage);
    await poppler('pdfimages', [kind === 'png' ? '-png' : '-all', file.path, path.join(stage, 'image')], file);
    const found = await fs.readdir(stage);
    if (!found.length) throw new UserError('No embedded images were found in this PDF. Try "Every page as an image" instead.');
    for (const name of found.sort()) {
      const src = path.join(stage, name);
      if (extOf(name) === kind) await fs.rename(src, path.join(ctx.out, `${file.base}-${name}`));
      else await ff(['-i', src, '-frames:v', '1', ...(kind === 'jpg' ? ['-q:v', '2'] : []), path.join(ctx.out, `${file.base}-${path.basename(name, path.extname(name))}.${kind}`)]).catch(() => {});
    }
    return;
  }
  const dpi = pick(o.dpi, ['72', '144', '300', '600'], '144');
  const args = ['-r', dpi];
  if (kind === 'jpg') args.push('-jpeg', '-jpegopt', `quality=${pick(o.quality, ['30', '60', '90', '100'], '90')}`);
  else args.push('-png');
  await poppler('pdftoppm', [...args, file.path, path.join(ctx.out, `${file.base}-page`)], file);
}

async function unpack(ctx, file, dest) {
  await fs.mkdir(dest, { recursive: true });
  const pw = String(ctx.opts.password || '').slice(0, 200) || '-';
  const x = async (src) => {
    try { await run('7z', ['x', '-y', '-bd', `-p${pw}`, `-o${dest}`, src], { okCodes: [0, 1] }); } catch (e) {
      const msg = `${e.stdout || ''}${e.stderr || ''}`;
      if (/wrong password|encrypted/i.test(msg)) throw new UserError(`"${file.name}" is password-protected. Enter the correct password.`);
      if (/unsupported method|rar/i.test(msg) && file.ext === 'rar') throw new UserError('This RAR archive uses a compression method the server cannot open. Install the "unrar" or "p7zip-rar" package to enable it.');
      throw new UserError(`"${file.name}" could not be opened as an archive.`);
    }
  };
  await x(file.path);
  // .tar.gz and friends unpack to a single .tar first
  const top = await fs.readdir(dest);
  if (top.length === 1 && /\.tar$/i.test(top[0])) {
    const inner = path.join(ctx.work, `inner-${crypto.randomUUID()}.tar`);
    await fs.rename(path.join(dest, top[0]), inner);
    await x(inner);
    await fs.rm(inner, { force: true });
  }
  await stripSpecial(dest);
  if (!(await walk(dest)).length) throw new UserError(`"${file.name}" is empty or could not be opened as an archive.`);
}

/** Flatten an EPUB into one self-contained HTML file (chapters in reading order, images inlined). */
async function epubToHtml(ctx, file) {
  const dir = path.join(ctx.work, `epub-${crypto.randomUUID()}`);
  await unpack({ ...ctx, opts: {} }, file, dir);
  const read = (p) => fs.readFile(path.join(dir, p), 'utf8');
  let opfPath;
  try { opfPath = (await read('META-INF/container.xml')).match(/full-path="([^"]+)"/)[1]; } catch { throw new UserError(`"${file.name}" is not a valid EPUB.`); }
  const opf = await read(opfPath);
  const opfDir = path.posix.dirname(opfPath);
  const items = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    const href = m[0].match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) items[id] = decodeURIComponent(href);
  }
  const title = opf.match(/<dc:title[^>]*>([^<]*)</)?.[1] || file.base;
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
  let body = '';
  for (const m of opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)) {
    const href = items[m[1]];
    if (!href) continue;
    const chapPath = path.posix.join(opfDir, href);
    let html;
    try { html = await read(chapPath); } catch { continue; }
    let inner = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
    inner = inner.replace(/<script[\s\S]*?<\/script>/gi, '');
    const srcs = [...new Set([...inner.matchAll(/\b(?:src|xlink:href)="([^"#:]+)"/g)].map((s) => s[1]))];
    for (const src of srcs) {
      const p = path.posix.normalize(path.posix.join(path.posix.dirname(chapPath), decodeURIComponent(src)));
      const mime = MIME[extOf(p)];
      if (!mime || p.startsWith('..')) continue;
      try {
        const data = await fs.readFile(path.join(dir, p));
        if (data.length < 8 * 1024 * 1024) inner = inner.split(`"${src}"`).join(`"data:${mime};base64,${data.toString('base64')}"`);
      } catch { /* missing image: leave the reference */ }
    }
    body += `<section>${inner}</section>\n`;
  }
  if (!body) throw new UserError(`"${file.name}" has no readable chapters.`);
  const esc = title.replace(/&(?!\w+;)/g, '&amp;').replace(/</g, '&lt;');
  const out = path.join(ctx.work, `${file.base}.html`);
  await fs.writeFile(out, `<!doctype html><html><head><meta charset="utf-8"><title>${esc}</title></head><body>\n${body}</body></html>`);
  return out;
}

export const docs = {
  // ───────── PDF ─────────
  async 'compress-pdf'(ctx) {
    const o = ctx.opts;
    const level = pick(o.level, ['balanced', 'strong', 'light', 'custom'], 'balanced');
    for (const file of ctx.files) {
      const args = ['-dCompatibilityLevel=1.5', `-dPDFSETTINGS=/${{ strong: 'screen', balanced: 'ebook', light: 'printer', custom: 'ebook' }[level]}`,
        '-dDetectDuplicateImages=true', '-dCompressFonts=true', '-dSubsetFonts=true'];
      let post = [];
      if (level === 'custom') {
        const dpi = Math.round(clamp(o.dpi, 36, 300, 120));
        const qf = Math.min(2.4, Math.max(0.08, (100 - clamp(o.quality, 10, 95, 60)) / 45)).toFixed(2);
        for (const k of ['Color', 'Gray']) args.push(`-dDownsample${k}Images=true`, `-d${k}ImageDownsampleType=/Bicubic`, `-d${k}ImageResolution=${dpi}`, `-d${k}ImageDownsampleThreshold=1.0`);
        args.push('-dDownsampleMonoImages=true', `-dMonoImageResolution=${Math.min(600, dpi * 2)}`);
        const dict = `<< /QFactor ${qf} /Blend 1 /HSamples [2 1 1 2] /VSamples [2 1 1 2] >>`;
        post = ['-c', `<< /ColorACSImageDict ${dict} /GrayACSImageDict ${dict} /ColorImageDict ${dict} /GrayImageDict ${dict} >> setdistillerparams`, '-f'];
      }
      if (o.grayscale) args.push('-sColorConversionStrategy=Gray', '-dProcessColorModel=/DeviceGray');
      const out = await uniquePath(ctx.out, `${file.base}-compressed.pdf`);
      await gs([...args, `-sOutputFile=${out}`, ...post, file.path], file);
      const [before, after] = [(await fs.stat(file.path)).size, (await fs.stat(out)).size];
      if (after >= before) {
        await fs.copyFile(file.path, out);
        ctx.note(`${file.name} is already well optimised (${fmtSize(before)}) — it was left unchanged.`);
      } else ctx.note(`${file.name}: ${fmtSize(before)} → ${fmtSize(after)} (${Math.round((1 - after / before) * 100)}% smaller)`);
    }
  },

  async 'merge-pdf'(ctx) {
    const doc = await PDFDocument.create();
    for (const file of ctx.files) {
      const src = await loadPdf(file);
      (await doc.copyPages(src, src.getPageIndices())).forEach((p) => doc.addPage(p));
    }
    await savePdf(doc, await uniquePath(ctx.out, 'merged.pdf'));
  },

  async 'split-pdf'(ctx) {
    const file = ctx.files[0];
    const src = await loadPdf(file);
    const total = src.getPageCount();
    const spec = String(ctx.opts.ranges || '').trim();
    const write = async (indexes, name) => {
      const d = await PDFDocument.create();
      (await d.copyPages(src, indexes)).forEach((p) => d.addPage(p));
      await savePdf(d, await uniquePath(ctx.out, name));
    };
    const pad = (n) => String(n).padStart(String(total).length, '0');
    if (spec.includes(';')) { // "1-3; 4-6" → one file per group
      for (const [i, group] of spec.split(';').filter((g) => g.trim()).entries()) await write(parseRanges(group, total), `${file.base}-part-${i + 1}.pdf`);
    } else if (ctx.opts.separate || !spec) {
      for (const i of parseRanges(spec, total)) await write([i], `${file.base}-page-${pad(i + 1)}.pdf`);
    } else await write(parseRanges(spec, total), `${file.base}-pages.pdf`);
  },

  async 'rotate-pdf'(ctx) {
    const file = ctx.files[0];
    const doc = await loadPdf(file);
    const map = ctx.opts.rotations && typeof ctx.opts.rotations === 'object' ? ctx.opts.rotations : {};
    let changed = 0;
    doc.getPages().forEach((page, i) => {
      const turn = ((Number(map[i + 1] ?? map.all ?? 0) % 360) + 360) % 360;
      if (turn % 90 !== 0 || !turn) return;
      page.setRotation(degrees((page.getRotation().angle + turn) % 360));
      changed++;
    });
    if (!changed) throw new UserError('Rotate at least one page first.');
    await savePdf(doc, await uniquePath(ctx.out, `${file.base}-rotated.pdf`));
  },

  async 'protect-pdf'(ctx) {
    const file = ctx.files[0];
    const password = String(ctx.opts.password || '');
    if (password.length < 1) throw new UserError('Choose a password.');
    if (password.length > 127) throw new UserError('The password is too long (127 characters at most).');
    const doc = await loadPdf(file);
    doc.encrypt({
      userPassword: password,
      ownerPassword: crypto.randomBytes(18).toString('base64'),
      permissions: { printing: ctx.opts.noPrint ? false : 'highResolution', copying: !ctx.opts.noCopy, modifying: false, annotating: true, fillingForms: true, contentAccessibility: true, documentAssembly: false },
    });
    await savePdf(doc, await uniquePath(ctx.out, `${file.base}-protected.pdf`));
  },

  async 'unlock-pdf'(ctx) {
    const file = ctx.files[0];
    const pw = String(ctx.opts.password || '');
    // Ghostscript writes an empty document for a wrong password instead of failing, so check it first.
    const tries = pw ? [['-upw', pw], ['-opw', pw]] : [[]];
    let pages = 0;
    for (const t of tries) {
      try { pages = Number((await run('pdfinfo', [...t, file.path])).stdout.match(/^Pages:\s+(\d+)/m)?.[1] || 0); if (pages) break; } catch (e) {
        if (!/password/i.test(e.message)) throw new UserError(`"${file.name}" could not be read as a PDF. It may be damaged.`);
      }
    }
    if (!pages) throw new UserError(pw ? 'That password is not correct.' : 'This PDF needs its password to be unlocked. Enter the current password.');
    const out = await uniquePath(ctx.out, `${file.base}-unlocked.pdf`);
    await gs([...(pw ? [`-sPDFPassword=${pw}`] : []), `-sOutputFile=${out}`, file.path], file);
  },

  async 'page-numbers'(ctx) {
    const file = ctx.files[0];
    const o = ctx.opts;
    const doc = await loadPdf(file);
    const fnt = await doc.embedFont(StandardFonts.Helvetica);
    const size = clamp(o.fontSize, 6, 36, 11);
    const start = Math.round(clamp(o.start, 0, 99999, 1));
    const pos = pick(o.position, ['cfoot', 'rfoot', 'lfoot', 'chead', 'rhead', 'lhead'], 'cfoot');
    const pages = doc.getPages();
    const numbered = pages.length - (o.skipFirst ? 1 : 0);
    const last = start + numbered - 1;
    let n = start;
    pages.forEach((page, i) => {
      if (o.skipFirst && i === 0) return;
      const label = { n: `${n}`, page: `Page ${n}`, of: `Page ${n} of ${last}`, slash: `${n} / ${last}` }[o.style] || `${n}`;
      n++;
      const box = page.getCropBox();
      const tw = fnt.widthOfTextAtSize(label, size);
      const m = 28;
      const x = box.x + (pos[0] === 'l' ? m : pos[0] === 'r' ? box.width - m - tw : (box.width - tw) / 2);
      const y = box.y + (pos.endsWith('head') ? box.height - m - size * 0.75 : m);
      page.drawText(label, { x, y, size, font: fnt, color: rgb(0.15, 0.15, 0.15) });
    });
    await savePdf(doc, await uniquePath(ctx.out, `${file.base}-numbered.pdf`));
  },

  async 'pdf-to-word'(ctx) { for (const f of ctx.files) await officeConvert(ctx, f, pick(ctx.opts.format, ['docx', 'doc', 'odt', 'rtf'], 'docx')); },
  async 'pdf-to-excel'(ctx) {
    for (const f of ctx.files) await officeConvert(ctx, f, pick(ctx.opts.format, CALC, 'xlsx'));
    ctx.note('Columns are detected from the spacing of the text, so complex or scanned tables may need tidying up.');
  },
  'pdf-to-jpg': (ctx) => pdfToImages(ctx, 'jpg'),
  'pdf-to-png': (ctx) => pdfToImages(ctx, 'png'),

  async 'pdf-to-html'(ctx) {
    const file = ctx.files[0];
    const o = ctx.opts;
    const args = ['-s', '-noframes', '-enc', 'UTF-8', '-zoom', String(clamp(o.zoom, 0.5, 3, 1.5))];
    if (o.layout !== 'flow') args.push('-c');
    if (o.single) args.push('-dataurls');
    await poppler('pdftohtml', [...args, file.path, path.join(ctx.out, file.base)], file);
  },

  async 'word-to-pdf'(ctx) { for (const f of ctx.files) await officeConvert(ctx, f, 'pdf'); },
  async 'excel-to-pdf'(ctx) { for (const f of ctx.files) await officeConvert(ctx, f, 'pdf'); },
  async 'ppt-to-pdf'(ctx) { for (const f of ctx.files) await officeConvert(ctx, f, 'pdf'); },
  'jpg-to-pdf': imagesToPdf,
  'png-to-pdf': imagesToPdf,

  // ───────── converters ─────────
  async 'image-converter'(ctx) {
    const o = ctx.opts;
    const fmt = pick(o.format, ['jpg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'ico'], 'jpg');
    const q = clamp(o.quality, 10, 100, 85);
    const width = Math.round(clamp(o.width, 0, 16000, 0));
    for (const file of ctx.files) {
      const vf = [];
      if (fmt === 'ico') vf.push(`scale='min(256,iw)':'min(256,ih)':force_original_aspect_ratio=decrease`);
      else if (width) vf.push(`scale=${width}:-1:flags=lanczos`);
      if (fmt === 'jpg') vf.push('format=yuvj420p'); // flattens transparency onto black otherwise
      const args = ['-i', file.path];
      if (fmt === 'jpg') {
        // put transparent images on white before encoding
        args.splice(0, 0, '-f', 'lavfi', '-i', 'color=white:s=16x16');
        args.push('-filter_complex', `[1:v]${[...vf.filter((f) => !f.startsWith('format')), 'format=rgba'].join(',')}[fg];[0:v][fg]scale2ref[bg][fg2];[bg][fg2]overlay=format=auto,format=yuvj420p`, '-frames:v', '1', '-q:v', String(Math.round(2 + (100 - q) * 0.29)));
      } else {
        if (vf.length) args.push('-vf', vf.join(','));
        if (fmt === 'webp') args.push('-c:v', 'libwebp', '-quality', String(q));
        if (fmt !== 'gif') args.push('-frames:v', '1');
        if (fmt === 'tiff') args.push('-compression_algo', 'lzw');
      }
      try { await ff([...args, await uniquePath(ctx.out, `${file.base}.${fmt}`)]); } catch {
        throw new UserError(`"${file.name}" could not be read as an image. HEIC, RAW and SVG files are not supported yet.`);
      }
    }
  },

  async 'document-converter'(ctx) {
    const all = ['pdf', ...WRITER.filter((f) => f !== 'epub'), ...CALC, 'pptx', 'odp'];
    const fmt = pick(ctx.opts.format, all, 'pdf');
    for (const f of ctx.files) await officeConvert(ctx, f, fmt);
  },

  async 'ebook-converter'(ctx) {
    const fmt = pick(ctx.opts.format, ['epub', 'pdf', 'docx', 'txt', 'html'], 'epub');
    for (const f of ctx.files) {
      if (f.ext === fmt) throw new UserError(`"${f.name}" is already in ${fmt.toUpperCase()} format.`);
      if (f.ext !== 'epub') { await officeConvert(ctx, f, fmt); continue; }
      const html = await epubToHtml(ctx, f);
      if (fmt === 'html') await fs.rename(html, await uniquePath(ctx.out, `${f.base}.html`));
      else await officeConvert(ctx, { path: html, name: f.name, base: f.base, ext: 'html' }, fmt);
    }
  },

  async 'font-converter'(ctx) {
    const { Font, woff2 } = require('fonteditor-core');
    await woff2.init();
    const fmt = pick(ctx.opts.format, ['woff2', 'woff', 'ttf', 'eot', 'svg'], 'woff2');
    for (const f of ctx.files) {
      if (!['ttf', 'otf', 'woff', 'woff2', 'eot', 'svg'].includes(f.ext)) throw new UserError(`"${f.name}" is not a supported font file (TTF, OTF, WOFF, WOFF2, EOT, SVG).`);
      if (f.ext === fmt) throw new UserError(`"${f.name}" is already a ${fmt.toUpperCase()} font.`);
      let out;
      try {
        const data = await fs.readFile(f.path);
        const fontObj = Font.create(f.ext === 'svg' ? data.toString('utf8') : data, { type: f.ext });
        out = fontObj.write({ type: fmt, toBuffer: true });
        if (!out || !out.length) throw new Error('empty output');
      } catch (e) { throw new UserError(`"${f.name}" could not be converted: ${String(e.message || e).slice(0, 120)}`); }
      await fs.writeFile(await uniquePath(ctx.out, `${f.base}.${fmt}`), out);
    }
  },

  async 'archive-converter'(ctx) {
    const fmt = pick(ctx.opts.format, ['zip', '7z', 'tar', 'tar.gz', 'tar.bz2', 'tar.xz'], 'zip');
    for (const [i, f] of ctx.files.entries()) {
      const dir = path.join(ctx.work, `x-${i}`);
      await unpack(ctx, f, dir);
      const stem = f.name.replace(/\.(tar\.(gz|bz2|xz)|tgz|[^.]+)$/i, '') || f.base;
      const out = await uniquePath(ctx.out, `${stem}.${fmt}`);
      if (fmt === 'zip' || fmt === '7z') await run('7z', ['a', `-t${fmt}`, '-bd', '-y', out, '.'], { cwd: dir });
      else await run('tar', ['-C', dir, `-c${{ tar: '', 'tar.gz': 'z', 'tar.bz2': 'j', 'tar.xz': 'J' }[fmt]}f`, out, '.']);
    }
  },

  async 'archive-extractor'(ctx) {
    await unpack(ctx, ctx.files[0], ctx.out);
  },
};

/** Page count and small thumbnails for the page pickers. */
export async function pdfPreview(file, outDir) {
  const info = await poppler('pdfinfo', [file.path], file);
  const pages = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
  if (!pages) throw new UserError('This PDF has no pages.');
  const shown = Math.min(pages, 200);
  await poppler('pdftoppm', ['-r', '40', '-png', '-l', String(shown), file.path, path.join(outDir, 'p')], file);
  const thumbs = (await fs.readdir(outDir)).filter((n) => n.endsWith('.png')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { pages, thumbs };
}
