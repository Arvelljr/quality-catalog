// Builds a static version of the add-on (manifest + catalog JSON + posters) into ./dist
// so it can be hosted for free on GitHub Pages. Run by the GitHub Action on a schedule.

const fs = require('fs');
const path = require('path');
const { manifest, ROWS, GENRES } = require('../src/manifest');
const { parseConfig } = require('../src/config');
const { applyFilters } = require('../src/filters');
const { getFeed } = require('../src/feed');
const { toMetaPreview } = require('../src/catalog');
const { buildPosters } = require('./posters');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'filters.json'), 'utf8'));
const cfg = parseConfig(settings);
const SITE_URL = (process.env.SITE_URL || '').replace(/\/?$/, '/');
const TITLE_POSTERS = settings.titleOnPoster !== false && SITE_URL !== '/';
const PER_FILE = 100;

function write(rel, data) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const staticManifest = {
    ...manifest,
    catalogs: manifest.catalogs.map((c) => ({ ...c, extra: [{ name: 'genre', options: GENRES, isRequired: false }] })),
    behaviorHints: {},
  };
  delete staticManifest.config;
  write('manifest.json', staticManifest);

  // 1. Build every catalog file's item list.
  const files = []; // { rel, row, items }
  const summary = [];
  let total = 0;
  for (const row of ROWS) {
    const feed = await getFeed(row.type, row.tier, cfg);
    const base = applyFilters(feed, cfg);
    total += feed.length;
    files.push({ rel: `catalog/${row.type}/${row.id}.json`, row, items: base.slice(0, PER_FILE) });
    for (const g of GENRES) {
      files.push({ rel: `catalog/${row.type}/${row.id}/genre=${g}.json`, row, items: applyFilters(base, parseConfig({}), g).slice(0, PER_FILE) });
    }
    base.slice(0, 6).forEach((i) => console.log(`  ${row.name} | ${i.name} (${i.year}) ★${i.rating ?? '-'} | ${i.release.episode || ''} ${i.release.title}`));
    summary.push(`${row.name}: ${base.length} titles (from ${feed.length} before filters)`);
  }

  // 2. Posters with the title printed under the artwork.
  let posterMap = new Map();
  if (TITLE_POSTERS) {
    const unique = new Map();
    files.forEach((f) => f.items.forEach((i) => unique.set(i.id, { id: i.id, name: i.name, poster: i.poster })));
    posterMap = await buildPosters([...unique.values()], OUT, path.join(ROOT, '.poster-cache'));
  }

  // 3. Write catalog files.
  for (const f of files) {
    write(f.rel, {
      metas: f.items.map((i) => {
        const m = toMetaPreview(i, f.row.tier);
        if (posterMap.has(i.id)) m.poster = SITE_URL + posterMap.get(i.id);
        return m;
      }),
    });
  }

  fs.writeFileSync(
    path.join(OUT, 'index.html'),
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quality Catalog</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;background:#0f0d16;color:#eee}
a.b{display:inline-block;background:#7b5bf5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;margin:8px 8px 8px 0}
code{background:#222;padding:2px 6px;border-radius:4px;word-break:break-all}li{margin:4px 0}</style>
<h1>Quality Catalog</h1>
<p>Latest movies &amp; shows by release quality. No cam / TS / screener releases.</p>
<a class="b" id="app" href="#">Install in Stremio app</a>
<p>Or paste this into Stremio's add-on search bar:<br><code id="u"></code></p>
<h3>Last refresh</h3><p>${new Date().toUTCString()}</p><ul>${summary.map((s) => `<li>${s}</li>`).join('')}</ul>
<script>const u=new URL('manifest.json',location.href).href;document.getElementById('u').textContent=u;
document.getElementById('app').href=u.replace(/^https?:/,'stremio:');</script>`
  );
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log(summary.join('\n'));
  console.log('Knaben sites seen:', JSON.stringify(require('../src/sources/knaben').trackerStats));
  if (total === 0) {
    console.error('All rows are empty: every source failed.');
    process.exit(1);
  }
})();
