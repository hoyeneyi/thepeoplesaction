// Static site build: assembles src/pages/**/*.html with shared partials into public/.
// Zero dependencies. Run: node scripts/build.mjs
//
// Page syntax:
//   <!--page title="..." description="..." nav="programs" body="page-home" noindex -->
//   {{> header}} {{> footer}}  ... any partial in src/partials/
//   {{title}} {{description}} {{canonical}} {{year}} are replaced from the page meta.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');
const OUT = join(root, 'public');
const SITE_URL = 'https://www.thepeoplesaction.org';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function parseMeta(html) {
  const m = html.match(/<!--page([\s\S]*?)-->/);
  if (!m) return { meta: {}, body: html };
  const meta = {};
  for (const a of m[1].matchAll(/(\w+)(?:="([^"]*)")?/g)) meta[a[1]] = a[2] ?? true;
  return { meta, body: html.replace(m[0], '').trimStart() };
}

const partials = Object.fromEntries(
  readdirSync(join(SRC, 'partials')).map((f) => [f.replace(/\.html$/, ''), readFileSync(join(SRC, 'partials', f), 'utf8')])
);

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });
for (const f of ['CNAME', 'robots.txt', '.nojekyll']) {
  if (existsSync(join(SRC, f))) cpSync(join(SRC, f), join(OUT, f));
}

// {{img src="hero-march" alt="..." sizes="100vw" eager pos="60% 30%"}} -> responsive <picture>
const imgFiles = readdirSync(join(SRC, 'assets/img'));
function picture(attrStr, rel) {
  const a = {};
  for (const m of attrStr.matchAll(/(\w+)(?:="([^"]*)")?/g)) a[m[1]] = m[2] ?? true;
  if (!a.src || a.alt === undefined) throw new Error(`{{img}} needs src and alt (in ${rel})`);
  const widths = imgFiles
    .map((f) => f.match(new RegExp(`^${a.src}-(\\d+)\\.jpg$`)))
    .filter(Boolean)
    .map((m) => +m[1])
    .sort((x, y) => x - y);
  if (!widths.length) throw new Error(`No image files for "${a.src}" (in ${rel})`);
  const set = (ext) => widths.map((w) => `/assets/img/${a.src}-${w}.${ext} ${w}w`).join(', ');
  const largest = widths[widths.length - 1];
  const sizes = a.sizes || '(max-width: 860px) 100vw, 50vw';
  const style = a.pos ? ` style="object-position:${a.pos}"` : '';
  const loading = a.eager ? 'eager" fetchpriority="high' : 'lazy';
  const alt = String(a.alt).replace(/"/g, '&quot;');
  return `<picture><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="/assets/img/${a.src}-${largest}.jpg" srcset="${set('jpg')}" sizes="${sizes}" alt="${alt}" loading="${loading}" decoding="async"${style}></picture>`;
}

const pagesDir = join(SRC, 'pages');
const sitemap = [];
for (const file of walk(pagesDir).filter((f) => f.endsWith('.html'))) {
  const rel = relative(pagesDir, file).replace(/\\/g, '/');
  const { meta, body } = parseMeta(readFileSync(file, 'utf8'));
  const urlPath = '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '');
  const vars = {
    title: meta.title || 'The Peoples Action',
    description: meta.description || '',
    canonical: SITE_URL + urlPath,
    year: String(new Date().getFullYear()),
    body: meta.body || '',
    robots: meta.noindex ? 'noindex, nofollow' : 'index, follow',
  };
  let html = body;
  // partials may themselves contain {{> other}}
  for (let i = 0; i < 3; i++) html = html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => {
    if (!(n in partials)) throw new Error(`Unknown partial "${n}" in ${rel}`);
    return partials[n];
  });
  html = html.replace(/\{\{img\s+([\s\S]*?)\}\}/g, (_, attrs) => picture(attrs, rel));
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
  // current-page marker for nav
  if (meta.nav) html = html.replace(new RegExp(`data-nav="${meta.nav}"`, 'g'), `data-nav="${meta.nav}" aria-current="page"`);
  const dest = join(OUT, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, html);
  if (!meta.noindex && rel !== '404.html') sitemap.push(SITE_URL + urlPath);
}

// Registry of admin-editable text: every element with data-cms="key" and its default text.
// The admin portal reads this to build the "Page text" editor, so new editable fields
// only need a data-cms attribute in the page source.
const cmsFields = [];
for (const file of walk(pagesDir).filter((f) => f.endsWith('.html'))) {
  const rel = relative(pagesDir, file).replace(/\\/g, '/');
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/data-cms="([^"]+)"[^>]*>([^<]*)</g)) {
    cmsFields.push({ key: m[1], page: '/' + rel.replace(/index\.html$/, ''), default: m[2].replace(/\s+/g, ' ').trim() });
  }
}
mkdirSync(join(OUT, 'assets/data'), { recursive: true });
cmsFields.sort((a, b) => (a.page === '/' ? -1 : b.page === '/' ? 1 : a.page.localeCompare(b.page)));
writeFileSync(join(OUT, 'assets/data/cms-fields.json'), JSON.stringify(cmsFields, null, 2));

writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .sort()
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`
);
console.log(`Built ${sitemap.length} indexable pages into public/`);
