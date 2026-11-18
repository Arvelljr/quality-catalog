// Knaben: a meta-search API that indexes many torrent sites (1337x, TorrentGalaxy,
// KickassTorrents, MagnetDL, The Pirate Bay, ...). Results carry the site name in `tracker`,
// so we keep only the sites listed in ALLOWED_TRACKERS. No IMDb IDs, so titles are resolved via Cinemeta.

const { mapLimit } = require('../http');
const { parseRelease } = require('../quality');
const { searchImdbId } = require('../metadata');
const { guessTitle } = require('./torznab');

const API = process.env.KNABEN_URL || 'https://api.knaben.org/v1';
const ALLOWED_TRACKERS = (process.env.KNABEN_TRACKERS ||
  'yts,eztv,rarbg,1337x,ext,thepiratebay,piratebay,kickass,kat,torrentgalaxy,tgx,uindex,magnetdl')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const allowed = (tracker) => {
  const t = norm(tracker);
  return ALLOWED_TRACKERS.some((a) => t.includes(norm(a)));
};

const isSeriesName = (n) => /(^|[^a-z0-9])S\d{1,2}(E\d{1,3})?([^a-z0-9]|$)/i.test(n) || /(^|[^a-z0-9])\d{4}[ .]\d{2}[ .]\d{2}([^a-z0-9]|$)/.test(n);

const trackerStats = {};

async function search(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'stremio-quality-catalog/1.0' },
    body: JSON.stringify({
      search_type: '100%', search_field: 'title', query,
      order_by: 'date', order_direction: 'desc',
      from: 0, size: 300, hide_unsafe: true, hide_xxx: true,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Knaben HTTP ${res.status}`);
  const data = await res.json();
  return data.hits || [];
}

async function fetchKnaben(type, tier) {
  const term = tier === '4k' ? '2160p' : '1080p';
  const queries = type === 'series' ? [term, `${term} WEB`] : [term, `${term} BluRay`, `${term} WEB-DL`];
  const settled = await Promise.allSettled(queries.map(search));
  const hits = settled.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
  if (!hits.length && settled.every((r) => r.status === 'rejected')) throw settled[0].reason;

  const seen = new Set();
  const candidates = [];
  for (const h of hits) {
    const name = h.title || '';
    if (!name || seen.has(h.hash || name)) continue;
    seen.add(h.hash || name);
    trackerStats[h.tracker || '?'] = (trackerStats[h.tracker || '?'] || 0) + 1;
    if (!allowed(h.tracker)) continue;
    if (isSeriesName(name) !== (type === 'series')) continue;
    const parsed = parseRelease(name);
    if (!parsed || parsed.tier !== tier) continue;
    candidates.push({ h, name, parsed, guess: guessTitle(name) });
  }

  // Resolve each distinct title once.
  const keys = [...new Set(candidates.map((c) => `${c.guess.title}|${c.guess.year || ''}`))];
  const ids = new Map();
  await mapLimit(keys, 6, async (k) => {
    const [title, year] = k.split('|');
    ids.set(k, await searchImdbId(type, title, year ? parseInt(year, 10) : null).catch(() => null));
  });

  return candidates
    .map(({ h, name, parsed, guess }) => {
      const id = ids.get(`${guess.title}|${guess.year || ''}`);
      if (!id) return null;
      const ep = (name.match(/S\d{1,2}E\d{1,3}/i) || [null])[0];
      return {
        id, type,
        releaseDate: Date.parse(h.date) || Date.now(),
        release: { title: name, episode: ep ? ep.toUpperCase() : null, site: h.tracker, ...parsed },
        hasMeta: false,
      };
    })
    .filter(Boolean);
}

module.exports = { name: 'knaben', types: ['movie', 'series'], fetch: fetchKnaben, trackerStats };
