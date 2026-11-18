const GENRES = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi',
  'Sport', 'Thriller', 'War', 'Western',
];

const ROWS = [
  { id: 'qc-movie-4k', type: 'movie', tier: '4k', name: '4K Movies' },
  { id: 'qc-movie-1080p', type: 'movie', tier: '1080p', name: '1080p Movies' },
  { id: 'qc-series-4k', type: 'series', tier: '4k', name: '4K Shows' },
  { id: 'qc-series-1080p', type: 'series', tier: '1080p', name: '1080p Shows' },
];

const manifest = {
  id: 'community.quality.catalog',
  version: '1.1.0',
  name: 'Quality Catalog',
  description:
    'Latest movies & shows grouped by release quality (4K / 1080p). No cam, TS or screener releases. Filter by genre, year and IMDb rating.',
  resources: ['catalog'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: ROWS.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    extra: [
      { name: 'genre', options: GENRES, isRequired: false },
      { name: 'skip', isRequired: false },
    ],
  })),
  behaviorHints: { configurable: true, configurationRequired: false },
  config: [
    { key: 'minRating', type: 'number', title: 'Minimum IMDb rating (e.g. 6.5). Leave blank for any.' },
    { key: 'yearFrom', type: 'number', title: 'Released from year (e.g. 2020). Leave blank for any.' },
    { key: 'yearTo', type: 'number', title: 'Released up to year (e.g. 2026). Leave blank for any.' },
    { key: 'genres', type: 'text', title: 'Only these genres, comma separated (e.g. Action, Sci-Fi)' },
    { key: 'genreMode', type: 'select', title: 'Genre matching', options: ['any', 'all'], default: 'any' },
    { key: 'excludeGenres', type: 'text', title: 'Hide these genres, comma separated (e.g. Horror, Animation)' },
    { key: 'includeUnrated', type: 'checkbox', title: 'Keep titles with no IMDb rating yet when a minimum rating is set' },
    { key: 'torznabUrl', type: 'text', title: 'Optional: Prowlarr/Jackett Torznab URL (adds more sources)' },
    { key: 'torznabKey', type: 'password', title: 'Optional: Torznab API key' },
  ],
};

module.exports = { manifest, ROWS, GENRES };
