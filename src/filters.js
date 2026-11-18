// Applies genre / year / rating filters. Every filter is optional and they all stack (AND).

function applyFilters(items, cfg, dropdownGenre) {
  const wanted = [...cfg.genres];
  if (dropdownGenre) wanted.push(dropdownGenre.toLowerCase());

  return items.filter((item) => {
    const genres = (item.genres || []).map((g) => g.toLowerCase());

    // Year range
    if (cfg.yearFrom !== null && !(item.year >= cfg.yearFrom)) return false;
    if (cfg.yearTo !== null && !(item.year <= cfg.yearTo)) return false;

    // IMDb rating
    if (cfg.minRating !== null) {
      if (item.rating === null || item.rating === undefined) {
        if (!cfg.includeUnrated) return false;
      } else if (item.rating < cfg.minRating) {
        return false;
      }
    }

    // Excluded genres
    if (cfg.excludeGenres.some((g) => genres.includes(g))) return false;

    // Included genres. The in-app dropdown is always required; config genres follow genreMode.
    if (dropdownGenre && !genres.includes(dropdownGenre.toLowerCase())) return false;
    if (cfg.genres.length) {
      const hit = cfg.genreMode === 'all'
        ? cfg.genres.every((g) => genres.includes(g))
        : cfg.genres.some((g) => genres.includes(g));
      if (!hit) return false;
    }

    return true;
  });
}

// Dropdown values combine a release year and/or a genre with an optional "Top rated" sort.
// Examples: "2026", "2026 · Top rated", "Top rated", "Action", "Action · Top rated".
const SEP = ' · ';
const TOP = 'Top rated';

function dropdownOptions(genres, now = new Date()) {
  const y = now.getUTCFullYear();
  const years = [y, y - 1, y - 2, y - 3, y - 4].map(String);
  const opts = [TOP];
  for (const yr of years) opts.push(yr, `${yr}${SEP}${TOP}`);
  opts.push(`Before ${y - 4}`, `Before ${y - 4}${SEP}${TOP}`);
  for (const g of genres) opts.push(g, `${g}${SEP}${TOP}`);
  return opts;
}

function applyDropdown(items, value) {
  if (!value) return items;
  let year = null;
  let before = null;
  let genre = null;
  let top = false;
  for (const raw of String(value).split(/\s*[·|]\s*/)) {
    const part = raw.trim();
    let m;
    if (!part) continue;
    if (part.toLowerCase() === TOP.toLowerCase()) top = true;
    else if ((m = part.match(/^before\s+((?:19|20)\d{2})$/i))) before = parseInt(m[1], 10);
    else if (/^(19|20)\d{2}$/.test(part)) year = parseInt(part, 10);
    else genre = part.toLowerCase();
  }
  let out = items.filter((i) => {
    if (year !== null && i.year !== year) return false;
    if (before !== null && !(i.year < before)) return false;
    if (genre && !(i.genres || []).some((g) => g.toLowerCase() === genre)) return false;
    return true;
  });
  if (top) {
    out = [...out].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.releaseDate - a.releaseDate);
  }
  return out;
}

module.exports = { applyFilters, applyDropdown, dropdownOptions };
