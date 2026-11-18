// YTS movie feed. Comes with IMDb ID, rating, genres and year, so no extra lookups are needed.

const { getJson } = require('../http');
const { parseRelease } = require('../quality');

const BASE = process.env.YTS_URL || 'https://yts.mx/api/v2';
const QUALITY_PARAM = { '4k': '2160p', '1080p': '1080p' };

async function fetchMovies(tier, pages = 3) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${BASE}/list_movies.json?quality=${QUALITY_PARAM[tier]}&sort_by=date_added&order_by=desc&limit=50&page=${page}`;
    const data = await getJson(url);
    const movies = (data && data.data && data.data.movies) || [];
    for (const m of movies) {
      const torrent = (m.torrents || [])
        .filter((t) => t.quality === QUALITY_PARAM[tier])
        .sort((a, b) => b.date_uploaded_unix - a.date_uploaded_unix)[0];
      if (!torrent || !m.imdb_code) continue;

      const releaseName = `${m.title_long} ${torrent.quality} ${torrent.type} ${torrent.video_codec || ''}`;
      const parsed = parseRelease(releaseName);
      if (!parsed || parsed.tier !== tier) continue;

      out.push({
        id: m.imdb_code,
        type: 'movie',
        name: m.title,
        year: m.year || null,
        rating: typeof m.rating === 'number' && m.rating > 0 ? m.rating : null,
        genres: m.genres || [],
        poster: m.large_cover_image || null,
        releaseDate: torrent.date_uploaded_unix * 1000,
        release: { title: releaseName.trim(), ...parsed, source: torrent.type === 'web' ? 'WEB' : 'BluRay' },
        hasMeta: true,
      });
    }
    if (movies.length < 50) break;
  }
  return out;
}

module.exports = { name: 'yts', types: ['movie'], fetch: (type, tier) => (type === 'movie' ? fetchMovies(tier) : []) };
