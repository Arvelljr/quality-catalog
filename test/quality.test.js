const test = require('node:test');
const assert = require('node:assert');
const { parseRelease } = require('../src/quality');
const { applyFilters } = require('../src/filters');
const { parseConfig } = require('../src/config');
const { guessTitle } = require('../src/sources/torznab');

test('4K web and bluray releases are accepted', () => {
  assert.equal(parseRelease('Spider-Man.2026.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX').tier, '4k');
  assert.equal(parseRelease('Spider-Man.2026.2160p.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX').hdr, true);
  assert.equal(parseRelease('Some Movie (2025) [2160p] [BluRay] [5.1] [YTS.MX]').source, 'BluRay');
  assert.equal(parseRelease('Some.Movie.2025.UHD.BluRay.REMUX.HDR-GRP').tier, '4k');
});

test('1080p and 720p are tiered correctly', () => {
  assert.equal(parseRelease('Show.S02E05.1080p.WEB.h264-ETHEL').tier, '1080p');
  assert.equal(parseRelease('Show.S02E05.720p.HDTV.x264-SYNCOPY').tier, '720p');
});

test('cam / TS / screener / HC releases are rejected', () => {
  for (const n of [
    'Spider-Man.2026.HDCAM.x264-AOC',
    'Spider-Man 2026 1080p CAM-RIP',
    'Spider-Man.2026.1080p.TS.x264',
    'Spider-Man.2026.1080p.HDTS.AAC',
    'Spider-Man.2026.TELESYNC.1080p',
    'Spider-Man.2026.DVDSCR.x264',
    'Spider-Man.2026.1080p.HC.HDRip.x264',
    'Spider-Man.2026.1080p.TC.x264',
    'Spider-Man.2026.2160p.AI.Upscaled.x265',
  ]) {
    assert.equal(parseRelease(n), null, n);
  }
});

test('words containing junk letters are not rejected', () => {
  assert.ok(parseRelease('Cats.and.Dogs.2001.1080p.BluRay.x264'));
  assert.ok(parseRelease('The.Scream.Team.2002.1080p.WEB-DL'));
  assert.ok(parseRelease('Tsunami.2025.2160p.WEB-DL.x265'));
});

test('no resolution => rejected', () => {
  assert.equal(parseRelease('Some.Movie.2025.DVDRip.XviD'), null);
});

const items = [
  { id: 'a', name: 'A', year: 2026, rating: 7.8, genres: ['Action', 'Sci-Fi'] },
  { id: 'b', name: 'B', year: 2024, rating: 5.9, genres: ['Comedy'] },
  { id: 'c', name: 'C', year: 2025, rating: null, genres: ['Horror', 'Thriller'] },
  { id: 'd', name: 'D', year: 2019, rating: 8.4, genres: ['Action', 'Drama'] },
];
const ids = (arr) => arr.map((i) => i.id).join(',');

test('filters work individually', () => {
  assert.equal(ids(applyFilters(items, parseConfig({ minRating: '7' }))), 'a,d');
  assert.equal(ids(applyFilters(items, parseConfig({ yearFrom: '2024', yearTo: '2025' }))), 'b,c');
  assert.equal(ids(applyFilters(items, parseConfig({}), 'Action')), 'a,d');
});

test('filters stack together', () => {
  const cfg = parseConfig({ minRating: '7', yearFrom: '2020' });
  assert.equal(ids(applyFilters(items, cfg, 'Action')), 'a');
  assert.equal(ids(applyFilters(items, parseConfig({ genres: 'action, sci-fi', genreMode: 'all' }))), 'a');
  assert.equal(ids(applyFilters(items, parseConfig({ genres: 'comedy, horror' }))), 'b,c');
  assert.equal(ids(applyFilters(items, parseConfig({ excludeGenres: 'horror' }))), 'a,b,d');
  assert.equal(ids(applyFilters(items, parseConfig({ minRating: '7', includeUnrated: 'checked' }))), 'a,c,d');
});

test('title guessing from release names', () => {
  assert.deepEqual(guessTitle('Spider-Man.Beyond.2026.2160p.WEB-DL'), { title: 'Spider-Man Beyond', year: 2026 });
  assert.deepEqual(guessTitle('The.Bear.S04E02.2160p.WEB.h265'), { title: 'The Bear', year: null });
});
