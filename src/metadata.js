// Enriches IMDb IDs with genres, year, rating and poster using Stremio's public Cinemeta service.

const { getJson, cached } = require('./http');

const CINEMETA = process.env.CINEMETA_URL || 'https://v3-cinemeta.strem.io';
const DAY = 24 * 60 * 60 * 1000;

function parseYear(meta) {
  const y = meta.year || meta.releaseInfo || '';
  const m = String(y).match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

function getMeta(type, imdbId) {
  return cached(`meta:${type}:${imdbId}`, DAY, async () => {
    const data = await getJson(`${CINEMETA}/meta/${type}/${imdbId}.json`);
    const m = data && data.meta;
    if (!m) return null;
    const rating = parseFloat(m.imdbRating);
    return {
      name: m.name,
      poster: m.poster || null,
      background: m.background || null,
      year: parseYear(m),
      genres: m.genres || m.genre || [],
      rating: Number.isFinite(rating) ? rating : null,
    };
  });
}

// For sources that only give a release title (no IMDb ID).
function searchImdbId(type, title, year) {
  return cached(`search:${type}:${title}:${year || ''}`, DAY, async () => {
    const q = encodeURIComponent(title);
    const data = await getJson(`${CINEMETA}/catalog/${type}/top/search=${q}.json`);
    const metas = (data && data.metas) || [];
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const match =
      metas.find((m) => norm(m.name) === norm(title) && (!year || String(m.releaseInfo || '').includes(String(year)))) ||
      metas.find((m) => norm(m.name) === norm(title));
    return match ? match.imdb_id || match.id : null;
  });
}

module.exports = { getMeta, searchImdbId };
