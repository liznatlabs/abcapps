// Turns the single-page shell into complete HTML for each address: title, description, social tags,
// structured data and readable content. Used live by the server and by scripts/build.mjs for static hosting.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS, CATEGORIES, toolById, BRAND } from '../shared/catalog.js';
import { meta, about, structuredData, HOME_FAQS } from '../shared/seo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const catOf = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
let template;
const shell = () => (template ||= fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8'));

function homeBody() {
  const m = meta(null);
  return `<section class="hero"><h1>Every file tool you need, in one place.</h1><p class="lede">${esc(m.description)}</p></section>
${CATEGORIES.map((c) => `<section class="cat" id="${c.id}"><h2>${esc(c.name)} tools</h2><p>${esc(c.blurb)}.</p><ul>${TOOLS.filter((t) => t.cat === c.id).map((t) => `<li><a href="/${t.id}">${esc(t.name)}</a> — ${esc(t.tagline)}</li>`).join('')}</ul></section>`).join('\n')}
<section class="about"><h2>Questions and answers</h2><dl class="faq">${HOME_FAQS.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl></section>`;
}

function toolBody(tool) {
  const a = about(tool);
  const cat = catOf[tool.cat];
  const others = TOOLS.filter((t) => t.cat === tool.cat && t.id !== tool.id);
  return `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">All tools</a> / <a href="/#${cat.id}">${esc(cat.name)}</a> / ${esc(tool.name)}</nav>
<header class="tool-head"><div><span class="eyebrow">${esc(cat.name)}</span><h1>${esc(tool.name)}</h1><p>${esc(tool.tagline)}.</p></div></header>
<section class="about"><p>${esc(a.intro)}</p>
<h2>How to use ${esc(tool.name)}</h2><ol>${a.steps.map((s) => `<li><b>${esc(s.name)}.</b> ${esc(s.text)}</li>`).join('')}</ol>
<h2>Questions and answers</h2><dl class="faq">${a.faqs.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('')}</dl>
<h2>More ${esc(cat.name)} tools</h2><ul>${others.map((t) => `<li><a href="/${t.id}">${esc(t.name)}</a></li>`).join('')}</ul></section>`;
}

/**
 * @param route  '/' or '/compress-pdf'
 * @param site   public address without trailing slash, e.g. https://thefilekit.com
 * @param opts   { api: address of the processing server when it is on another host }
 */
export function renderPage(route, site, { api = '' } = {}) {
  const id = decodeURIComponent(route.replace(/^\/+|\/+$/g, ''));
  const tool = toolById[id];
  const found = !id || !!tool;
  const m = found ? meta(tool) : { title: `Page not found | ${BRAND.name}`, description: `This page does not exist. Browse all ${TOOLS.length} tools on ${BRAND.name}.` };
  const url = `${site}${id && found ? `/${id}` : '/'}`;
  const head = [
    `<link rel="canonical" href="${esc(url)}">`,
    found ? '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">' : '<meta name="robots" content="noindex">',
    '<meta property="og:type" content="website">', `<meta property="og:site_name" content="${esc(BRAND.name)}">`, `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:title" content="${esc(m.title)}">`, `<meta property="og:description" content="${esc(m.description)}">`, `<meta property="og:image" content="${esc(site)}/og.png">`,
    '<meta name="twitter:card" content="summary_large_image">', `<meta name="twitter:title" content="${esc(m.title)}">`, `<meta name="twitter:description" content="${esc(m.description)}">`, `<meta name="twitter:image" content="${esc(site)}/og.png">`,
    ...(found ? structuredData(tool, site).map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`) : []),
    api ? `<script>window.FILEKIT_API=${JSON.stringify(api)};</script>` : '',
  ].filter(Boolean).join('\n  ');
  const body = !found ? `<section class="lost"><h1>This page does not exist</h1><p><a href="/">Browse all tools</a></p></section>` : tool ? toolBody(tool) : homeBody();
  const html = shell()
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(m.description)}">`)
    .replace(/\s*<meta property="og:title"[^>]*>\s*<meta property="og:description"[^>]*>/, '')
    .replace('</head>', `  ${head}\n</head>`)
    .replace(/(<main id="main"[^>]*>)<\/main>/, `$1\n${body}\n</main>`);
  return { status: found ? 200 : 404, html };
}

export function sitemap(site) {
  const day = new Date().toISOString().slice(0, 10);
  const entry = (loc, priority) => `<url><loc>${esc(loc)}</loc><lastmod>${day}</lastmod><changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[entry(`${site}/`, '1.0'), ...TOOLS.map((t) => entry(`${site}/${t.id}`, '0.8'))].join('\n')}\n</urlset>\n`;
}

export const robots = (site) => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`;

/** A plain-language map of the site for AI assistants (llmstxt.org convention). */
export function llms(site) {
  return `# ${BRAND.name}\n\n> ${meta(null).description}\n\n${BRAND.name} is made by ${BRAND.by}. Every tool is free, needs no account and adds no watermark. Uploaded files are processed on the server and deleted automatically after two hours.\n\n${CATEGORIES.map((c) => `## ${c.name}\n\n${TOOLS.filter((t) => t.cat === c.id).map((t) => `- [${t.name}](${site}/${t.id}): ${t.tagline}.`).join('\n')}`).join('\n\n')}\n\n## Common questions\n\n${HOME_FAQS.map((f) => `- **${f.q}** ${f.a}`).join('\n')}\n`;
}
