// EZTV TV feed. Each item is one episode with the series IMDb ID; we group episodes by series.

const { getJson } = require('../http');
const { parseRelease } = require('../quality');

const BASE = process.env.EZTV_URL || 'https://eztvx.to/api';

async function fetchSeries(tier, pages = 5) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const data = await getJson(`${BASE}/get-torrents?limit=100&page=${page}`);
    const torrents = (data && data.torrents) || [];
    for (const t of torrents) {
      if (!t.imdb_id || t.imdb_id === '0') continue;
      const parsed = parseRelease(t.title || t.filename);
      if (!parsed || parsed.tier !== tier) continue;
      const imdb = String(t.imdb_id).startsWith('tt') ? t.imdb_id : `tt${String(t.imdb_id).padStart(7, '0')}`;
      const ep = t.season && t.episode ? `S${String(t.season).padStart(2, '0')}E${String(t.episode).padStart(2, '0')}` : null;
      out.push({
        id: imdb,
        type: 'series',
        releaseDate: (t.date_released_unix || 0) * 1000,
        release: { title: t.title, episode: ep, ...parsed },
        hasMeta: false,
      });
    }
    if (torrents.length < 100) break;
  }
  return out;
}

module.exports = { name: 'eztv', types: ['series'], fetch: (type, tier) => (type === 'series' ? fetchSeries(tier) : []) };
