const { ROWS } = require('./manifest');
const { parseConfig } = require('./config');
const { applyFilters } = require('./filters');
const { getFeed } = require('./feed');

const PAGE = 100;

function toMetaPreview(item, tier) {
  const label = tier === '4k' ? '4K' : tier;
  const rel = item.release || {};
  const tags = [label, rel.source !== 'Unknown' ? rel.source : null, rel.hdr ? 'HDR' : null, rel.site || null].filter(Boolean).join(' · ');
  const when = item.releaseDate ? new Date(item.releaseDate).toISOString().slice(0, 10) : 'recently';
  const what = rel.episode ? `${rel.episode} available in ${tags}` : `Available in ${tags}`;
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    poster: item.poster || undefined,
    genres: item.genres,
    releaseInfo: item.year ? String(item.year) : undefined,
    imdbRating: item.rating !== null && item.rating !== undefined ? item.rating.toFixed(1) : undefined,
    description: `${what} — added ${when}\n${rel.title || ''}`.trim(),
  };
}

async function handleCatalog({ type, id, extra = {}, config = {} }) {
  const row = ROWS.find((r) => r.id === id && r.type === type);
  if (!row) return { metas: [] };

  const cfg = parseConfig(config);
  const feed = await getFeed(type, row.tier, cfg);
  const filtered = applyFilters(feed, cfg, extra.genre);
  const skip = parseInt(extra.skip, 10) || 0;

  return {
    metas: filtered.slice(skip, skip + PAGE).map((i) => toMetaPreview(i, row.tier)),
    cacheMaxAge: 15 * 60,
    staleRevalidate: 60 * 60,
  };
}

module.exports = { handleCatalog, toMetaPreview };
