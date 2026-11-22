# The File Kit by Liznat Labs

51 browser tools for video, audio, PDF and file conversion, served by one small Node.js app.

## Run it

```bash
npm install
npm start          # http://127.0.0.1:5123
./restart.sh       # stop the running copy and start it again in the background
```

Requires Node 18+ and these programs on the server:

| Program | Used for |
|---|---|
| `ffmpeg` / `ffprobe` (with libx264, libvidstab, librubberband, libflite) | every video and audio tool, image conversion, text to speech |
| `gs` (Ghostscript) | Compress PDF, Unlock PDF |
| poppler-utils (`pdftoppm`, `pdfimages`, `pdftotext`, `pdftohtml`, `pdfinfo`) | PDF to JPG/PNG/HTML/Excel, page previews |
| `libreoffice` | Office ↔ PDF and document conversion |
| `7z`, `tar`, `zip` | archives, "Download all" |
| Chrome or Chromium | fallback for text documents → PDF (see below) |

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `5123` | Port to listen on |
| `HOST` | `127.0.0.1` | Set to `0.0.0.0` to allow other machines to connect |
| `MAX_UPLOAD_MB` | `4096` | Largest file accepted |
| `KEEP_HOURS` | `2` | Uploaded and processed files are deleted after this long |
| `MAX_PARALLEL` | `3` | Jobs processed at the same time; the rest queue |
| `FILEKIT_DATA_DIR` | `./data` | Where job files are kept while they exist |
| `LIBREOFFICE_BIN` | `libreoffice` | Path to a LibreOffice binary |
| `CHROME_BIN` | auto | Path to Chrome/Chromium for the PDF fallback |

There are no accounts, payments or ads. The app has no login, so only expose it
beyond `127.0.0.1` on a network you trust or behind your own authentication.

## Deploying

The app has two halves, and they go to different places:

| Half | What it is | Where it can run |
|---|---|---|
| Website | Static pages built into `dist/` by `npm run build` | Vercel (or any static host) |
| Processing server | `server/`, which runs ffmpeg, Ghostscript, LibreOffice and 7z | A container host: Railway, Render, Fly.io or a VPS, using the `Dockerfile` |

Vercel cannot run the processing server: it has none of those programs, limits uploads to about
4.5 MB and limits how long a request may run.

**1. Processing server.** Build and run the `Dockerfile` on a container host. Set:

- `ALLOWED_ORIGINS` — the website's address(es), comma-separated, e.g. `https://thefilekit.com`
- a persistent or temporary volume at `/data`

**2. Website on Vercel.** Import the repository in Vercel (settings come from `vercel.json`) and add
two Environment Variables:

- `SITE_URL` — the public address, e.g. `https://thefilekit.com` (used for canonical links and the sitemap)
- `API_URL` — the processing server's address from step 1

**Automatic deploys.** Either of these redeploys the site on every push to `main`:

- connect the repository in the Vercel dashboard (simplest; then delete `.github/workflows/deploy.yml`), or
- keep `.github/workflows/deploy.yml` and add the secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
  and the variables `SITE_URL`, `API_URL` in GitHub.

`./scripts/deploy.sh` deploys from this machine; `./scripts/deploy.sh --watch` redeploys whenever a file changes.

Running everything on one server instead (no Vercel) also works: the processing server serves the
same pages itself. Set `SITE_URL` on it.

## Search and AI visibility

Every address is served as complete HTML (`server/seo.js`): its own title and description, canonical
link, Open Graph and Twitter tags, and schema.org data (`WebApplication`, `HowTo`, `FAQPage`,
`BreadcrumbList`; `WebSite`, `ItemList` and `FAQPage` on the home page). The wording lives in
`shared/seo.js` and is the same text shown on screen. Also served: `/sitemap.xml`, `/robots.txt`
and `/llms.txt` (a plain-language map of the site for AI assistants).

After going live: add the site in Google Search Console and Bing Webmaster Tools and submit
`/sitemap.xml`.

## Layout

```
shared/catalog.js   every tool: name, accepted files, settings (used by server and browser)
server/index.js     HTTP server, uploads, job folders, downloads, clean-up
server/media.js     video and audio tools (ffmpeg)
server/docs.js      PDF tools and converters
public/             the interface (plain ES modules, no build step)
public/editor.js    the timeline video editor
```

## Design system

All styling lives in `public/style.css`, organised as tokens → base → controls → masthead/footer →
home → tool page → widgets → states → editor → responsive.

- **Palette:** neutral light or near-black dark surfaces with one blue accent, plus a colour per category
  (`--video`, `--audio`, `--pdf`, `--convert`). Pages set `--c` to their category colour, and buttons,
  icon tiles, sliders and focus rings follow it. Change colours only through the tokens at the top of the file.
- **Type:** Geist for everything, served from `public/fonts/`.
- **Shape:** rounded cards (10–22px radii), soft shadows, a blurred sticky header.
- **Appearance:** sun/moon button in the header, and Auto / Light / Dark in the footer; remembered in the browser.
- **Icons:** one inline set at 1.5px stroke; each tool has its own icon (`TOOL_ICON` in `public/ui.js`).

## Video editor

Layout: preview on top, then the transport bar, the timeline, and a toolbar of features along the
bottom. With nothing selected the toolbar adds things (media, text, stickers…); selecting a clip swaps
it for that clip's tools. A tool either acts at once or opens its settings in a tray above the toolbar.
Both lists are `MAIN_TOOLS` and `CLIP_TOOLS` in `public/editor.js`; each entry names its own icon.

`/video-editor` is a timeline editor: files go on stacked tracks (higher track = in front),
the preview canvas shows the frame at the playhead, and Export sends the project to the
server, which renders it with one ffmpeg filter graph (`video-editor` in `server/media.js`).

- Clip looks live in `public/editor-fx.js`. Colour (adjust sliders + filter presets) is reduced to one 3×4
  matrix per clip, shown through an SVG filter in the preview and applied with `colorchannelmixer` on
  export, so both do the same sum. Masks are drawn in the browser as a white-on-black picture and used
  as transparency on export. Sound effects are synthesised in the browser.
- Voice enhance and audio effects are export-only: the preview plays the original sound.
- Reverse and Cut silences call two server helpers that have no page (`clip-reverse`, `clip-silence`,
  listed as `INTERNAL` in `shared/catalog.js`).
- Not included, because they need AI models that are not installed: background cutout, restyle, and
  captions recognised from speech (captions are typed and auto-timed instead).
- Text is drawn in the browser and uploaded as a transparent image, so the export matches the preview.
- The project and its files autosave in the browser (IndexedDB); nothing is uploaded until Export.
- Shortcuts: Space play/pause, S split, Del delete, M mute, Ctrl+Z / Ctrl+Shift+Z undo/redo,
  Ctrl+D duplicate, ←/→ step one frame (Shift: one second).

To add a tool: add an entry to `shared/catalog.js` and a function with the same id
in `server/media.js` or `server/docs.js`. The page, menu entry and settings form are
generated from the catalog.

## LibreOffice Writer fallback

Text-document conversions (Word → PDF, PDF → Word, ebooks) use LibreOffice Writer.
The app checks once whether Writer can open a document. If it cannot, it switches to
built-in converters and says so on the result page:

- DOCX / TXT / HTML / EPUB → PDF: rendered with headless Chrome (formatting kept).
- PDF / DOCX / HTML / EPUB → DOCX, TXT, EPUB: text only, layout simplified.
- DOC, ODT and RTF as input or output need a working Writer and return an error without it.

Spreadsheet and presentation conversions use LibreOffice Calc and Impress and are not affected.

## Scanned PDFs in PDF to Word

A scanned PDF is a photo of each page, usually with an invisible text layer added by OCR. A
layout-preserving import turns every hidden word into a visible text box on top of the photo, which
is unreadable. So PDF to Word (and Document Converter) first checks whether most pages are a single
full-page picture (`isScannedPdf` in `server/docs.js`). If so, the text layer is rebuilt as ordinary
paragraphs and the page photos are left out. A scan with no text layer returns a message asking for
OCR; installing `tesseract` and wiring it in would be the way to support those.
