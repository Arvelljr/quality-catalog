// EZTV TV feed. Each item is one episode with the series IMDb ID; we group episodes by series.

const { getJson } = require('../http');
const { parseRelease } = require('../quality');

const BASES = (process.env.EZTV_URL || 'https://eztvx.to/api,https://eztv.re/api,https://eztv.wf/api').split(',');

async function eztvGet(q) {
  let lastErr;
  for (const b of BASES) {
    try { return await getJson(`${b}${q}`, { timeout: 15000 }); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function fetchSeries(tier, pages = 10) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const data = await eztvGet(`/get-torrents?limit=100&page=${page}`);
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
