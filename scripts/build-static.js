// Builds a static version of the add-on (manifest + catalog JSON files) into ./dist
// so it can be hosted for free on GitHub Pages. Run by the GitHub Action on a schedule.

const fs = require('fs');
const path = require('path');
const { manifest, ROWS, GENRES } = require('../src/manifest');
const { parseConfig } = require('../src/config');
const { applyFilters } = require('../src/filters');
const { getFeed } = require('../src/feed');
const { toMetaPreview } = require('../src/catalog');

const OUT = path.join(__dirname, '..', 'dist');
const cfg = parseConfig(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'filters.json'), 'utf8')));

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

  const summary = [];
  let total = 0;
  for (const row of ROWS) {
    const feed = await getFeed(row.type, row.tier, cfg);
    const base = applyFilters(feed, cfg);
    const metas = (items) => ({ metas: items.slice(0, 100).map((i) => toMetaPreview(i, row.tier)) });
    write(`catalog/${row.type}/${row.id}.json`, metas(base));
    for (const g of GENRES) {
      write(`catalog/${row.type}/${row.id}/genre=${g}.json`, metas(applyFilters(base, parseConfig({}), g)));
    }
    total += feed.length;
    summary.push(`${row.name}: ${base.length} titles (from ${feed.length} before filters)`);
  }

  const installUrl = 'manifest.json';
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
<script>const u=new URL('${installUrl}',location.href).href;document.getElementById('u').textContent=u;
document.getElementById('app').href=u.replace(/^https?:/,'stremio:');</script>`
  );
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log(summary.join('\n'));
  if (total === 0) {
    console.error('All rows are empty: every source failed.');
    process.exit(1);
  }
})();
