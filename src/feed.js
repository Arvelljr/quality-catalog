// Builds one row (e.g. "4K Movies"): pulls every source, merges by IMDb ID,
// keeps the newest qualifying release per title, fills in metadata, sorts newest first.

const { cached, mapLimit } = require('./http');
const { getMeta } = require('./metadata');
const yts = require('./sources/yts');
const eztv = require('./sources/eztv');
const torznab = require('./sources/torznab');
const apibay = require('./sources/apibay');

const FEED_TTL = (parseInt(process.env.FEED_TTL_MIN, 10) || 30) * 60 * 1000;
const SOURCES = [yts, eztv, apibay, torznab];

async function collect(type, tier, cfg) {
  const active = SOURCES.filter((s) => s.types.includes(type));
  const results = await Promise.allSettled(active.map((s) => s.fetch(type, tier, cfg)));
  if (process.env.LOG_SOURCES) {
    results.forEach((r, i) => console.log(`[feed] ${type}/${tier} ${active[i].name}: ${r.status === 'fulfilled' ? r.value.length + ' releases' : 'FAILED ' + (r.reason && r.reason.message)}`));
  }
  results
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.warn(`[feed] a source failed for ${type}/${tier}: ${r.reason && r.reason.message}`));

  // Merge: newest release per IMDb ID wins, but keep metadata if any source had it.
  const byId = new Map();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const item of r.value) {
      const prev = byId.get(item.id);
      if (!prev) {
        byId.set(item.id, { ...item });
      } else {
        if (item.releaseDate > prev.releaseDate) {
          prev.releaseDate = item.releaseDate;
          prev.release = item.release;
        }
        if (!prev.hasMeta && item.hasMeta) {
          Object.assign(prev, { name: item.name, year: item.year, rating: item.rating, genres: item.genres, poster: item.poster, hasMeta: true });
        }
      }
    }
  }

  const items = [...byId.values()];

  // Enrich items that lack genres/year/rating via Cinemeta (also refreshes rating for YTS items).
  await mapLimit(items, 8, async (item) => {
    const meta = await getMeta(type, item.id).catch(() => null);
    if (!meta) return;
    item.name = item.name || meta.name;
    item.poster = meta.poster || item.poster;
    item.year = item.year || meta.year;
    item.genres = item.genres && item.genres.length ? item.genres : meta.genres;
    if (meta.rating !== null) item.rating = meta.rating; // prefer live IMDb rating
    item.hasMeta = true;
  });

  return items.filter((i) => i.name).sort((a, b) => b.releaseDate - a.releaseDate);
}

function getFeed(type, tier, cfg) {
  const key = `feed:${type}:${tier}:${cfg.torznabUrl || '-'}`;
  return cached(key, FEED_TTL, () => collect(type, tier, cfg));
}

module.exports = { getFeed };
