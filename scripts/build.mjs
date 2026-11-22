// Builds the static website into dist/ for hosts such as Vercel: one complete HTML file per page,
// plus sitemap.xml, robots.txt and llms.txt. The processing server is deployed separately (see README).
//
//   SITE_URL  public address of the site (defaults to https://thefilekit.com on Vercel production)
//   API_URL   address of the processing server, e.g. https://api.thefilekit.com
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS } from '../shared/catalog.js';
import { renderPage, sitemap, robots, llms } from '../server/seo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
// The address search engines should treat as the real one. Preview deployments use their own address;
// a local build uses localhost; everything else is the live domain unless SITE_URL says otherwise.
const LIVE = 'https://thefilekit.com';
const fallback = process.env.VERCEL_ENV === 'preview' ? `https://${process.env.VERCEL_URL}` : process.env.VERCEL ? LIVE : 'http://localhost:5123';
const site = (process.env.SITE_URL || fallback).replace(/\/$/, '');
const api = (process.env.API_URL || '').replace(/\/$/, '');

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'shared'), path.join(OUT, 'shared'), { recursive: true });

const write = (rel, text) => { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
write('index.html', renderPage('/', site, { api }).html);
for (const t of TOOLS) write(`${t.id}/index.html`, renderPage(`/${t.id}`, site, { api }).html);
write('404.html', renderPage('/page-not-found', site, { api }).html);
write('sitemap.xml', sitemap(site));
write('robots.txt', robots(site));
write('llms.txt', llms(site));

console.log(`Built ${TOOLS.length + 1} pages into dist/ for ${site}`);
if (api) console.log(`Tools will send files to ${api} — that server must list ${site} in ALLOWED_ORIGINS.`);
else console.warn('WARNING: API_URL is not set. The pages will load, but the tools cannot process files until it points at a running processing server.');
