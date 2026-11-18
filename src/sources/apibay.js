// apibay (public JSON API used by The Pirate Bay). Items include an IMDb ID when the uploader set one.
// Category lists: 207 HD Movies, 211 UHD/4K Movies, 208 HD TV, 212 UHD/4K TV.

const { getJson } = require('../http');
const { parseRelease } = require('../quality');

const BASE = process.env.APIBAY_URL || 'https://apibay.org';
const CATS = {
  movie: { '4k': ['211', '207'], '1080p': ['207'] },
  series: { '4k': ['212', '208'], '1080p': ['208'] },
};

async function fetchApibay(type, tier) {
  const cats = CATS[type][tier];
  const urls = [
    ...cats.map((c) => `${BASE}/precompiled/data_top100_${c}.json`),
    `${BASE}/precompiled/data_top100_recent.json`,
    ...cats.map((c) => `${BASE}/q.php?q=${tier === '4k' ? '2160p' : '1080p'}&cat=${c}`),
  ];
  const lists = await Promise.allSettled(urls.map((u) => getJson(u)));
  const out = [];
  const seen = new Set();
  for (const l of lists) {
    if (l.status !== 'fulfilled' || !Array.isArray(l.value)) continue;
    for (const t of l.value) {
      if (!t || !t.imdb || !String(t.imdb).startsWith('tt') || seen.has(t.info_hash)) continue;
      const cat = String(t.category || '');
      const isTv = ['205', '208', '212'].includes(cat);
      const isMovie = ['201', '207', '211'].includes(cat);
      if ((type === 'series' && !isTv) || (type === 'movie' && !isMovie)) continue;
      const parsed = parseRelease(t.name);
      if (!parsed || parsed.tier !== tier) continue;
      seen.add(t.info_hash);
      const ep = (t.name.match(/S\d{1,2}E\d{1,3}/i) || [null])[0];
      out.push({
        id: t.imdb,
        type,
        releaseDate: (parseInt(t.added, 10) || 0) * 1000,
        release: { title: t.name, episode: ep ? ep.toUpperCase() : null, ...parsed },
        hasMeta: false,
      });
    }
  }
  return out;
}

module.exports = { name: 'apibay', types: ['movie', 'series'], fetch: fetchApibay };
