// Turns the user's add-on configuration (from the /configure page) into a filter object.

function num(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function list(v) {
  return String(v || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseConfig(raw = {}) {
  return {
    minRating: num(raw.minRating),
    yearFrom: num(raw.yearFrom),
    yearTo: num(raw.yearTo),
    genres: list(raw.genres),
    genreMode: raw.genreMode === 'all' ? 'all' : 'any',
    excludeGenres: list(raw.excludeGenres),
    includeUnrated: raw.includeUnrated === true || raw.includeUnrated === 'checked' || raw.includeUnrated === 'true',
    torznabUrl: (raw.torznabUrl || '').trim(),
    torznabKey: (raw.torznabKey || '').trim(),
  };
}

module.exports = { parseConfig };
