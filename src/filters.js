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

module.exports = { applyFilters };
