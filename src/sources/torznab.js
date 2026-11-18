// Optional: any Torznab feed (Prowlarr or Jackett). Covers every indexer you have set up there.
// Uses the IMDb ID from the feed when present, otherwise resolves the title through Cinemeta.

const { XMLParser } = require('fast-xml-parser');
const { getText } = require('../http');
const { parseRelease } = require('../quality');
const { searchImdbId } = require('../metadata');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const CATS = { movie: '2000', series: '5000' };

// "Some.Movie.2025.2160p.WEB-DL..." -> { title: "Some Movie", year: 2025 }
// "Some.Show.S02E05.2160p..."       -> { title: "Some Show" }
function guessTitle(name) {
  const clean = name.replace(/[._]/g, ' ');
  const ep = clean.match(/^(.*?)\s+S\d{1,2}E\d{1,3}/i);
  if (ep) return { title: ep[1].trim(), year: null };
  const yr = clean.match(/^(.*?)\s*\(?((?:19|20)\d{2})\)?\s/);
  if (yr) return { title: yr[1].trim(), year: parseInt(yr[2], 10) };
  return { title: clean.split(/\s(?:2160p|1080p|720p|4k)/i)[0].trim(), year: null };
}

function attrsOf(item) {
  const raw = item['torznab:attr'] || [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return Object.fromEntries(arr.map((a) => [a.name, a.value]));
}

async function fetchTorznab(type, tier, cfg) {
  if (!cfg || !cfg.torznabUrl) return [];
  const sep = cfg.torznabUrl.includes('?') ? '&' : '?';
  const t = type === 'movie' ? 'movie' : 'tvsearch';
  const url = `${cfg.torznabUrl}${sep}t=${t}&cat=${CATS[type]}&limit=100${cfg.torznabKey ? `&apikey=${encodeURIComponent(cfg.torznabKey)}` : ''}`;

  const xml = await getText(url, { timeout: 30000 });
  const doc = parser.parse(xml);
  const raw = (doc.rss && doc.rss.channel && doc.rss.channel.item) || [];
  const items = Array.isArray(raw) ? raw : [raw];

  const out = [];
  for (const it of items) {
    const parsed = parseRelease(it.title);
    if (!parsed || parsed.tier !== tier) continue;
    const attrs = attrsOf(it);
    let imdb = attrs.imdbid || attrs.imdb || null;
    if (imdb && !String(imdb).startsWith('tt')) imdb = `tt${String(imdb).padStart(7, '0')}`;
    if (!imdb) {
      const g = guessTitle(it.title);
      try {
        imdb = await searchImdbId(type, g.title, g.year);
      } catch {
        imdb = null;
      }
    }
    if (!imdb) continue;
    const ep = (it.title.match(/S\d{1,2}E\d{1,3}/i) || [null])[0];
    out.push({
      id: imdb,
      type,
      releaseDate: it.pubDate ? Date.parse(it.pubDate) : Date.now(),
      release: { title: it.title, episode: ep ? ep.toUpperCase() : null, ...parsed },
      hasMeta: false,
    });
  }
  return out;
}

module.exports = { name: 'torznab', types: ['movie', 'series'], fetch: fetchTorznab, guessTitle };
