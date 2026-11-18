# Quality Catalog — Stremio add-on

Adds rows to Stremio's Board/Discover that list the newest movies and shows **by the quality of the release that just appeared**:

| Row | What lands here |
|---|---|
| **4K Movies** | A movie shows up the moment a real 2160p release (WEB-DL / BluRay / Remux) appears |
| **1080p Movies** | Same, for 1080p |
| **4K Shows** | A series jumps to the top when a new 4K episode drops (e.g. "S02E05 available in 4K · WEB") |
| **1080p Shows** | Same, for 1080p |

**Always excluded:** CAM, HDCAM, TS/HDTS/Telesync, TC/Telecine, screeners (DVDSCR/BDSCR), R5/R6, workprints, hard-coded-sub HC rips, and AI-upscaled "4K".

This is a **catalog-only** add-on: it tells you *what* is newly available and in what quality. Playback still comes from whatever stream add-ons you already have installed.

## Filters (all optional, all stack together)

| Filter | Where you set it |
|---|---|
| Genre | Dropdown on each row in Discover, **and/or** a genre list on the config page |
| Genre match mode | Config page: `any` (Action OR Sci-Fi) or `all` (Action AND Sci-Fi) |
| Excluded genres | Config page (e.g. hide Horror, Animation) |
| Year range | Config page: from / to |
| Minimum IMDb rating | Config page (e.g. 6.5) |
| Keep unrated titles | Config page checkbox (brand-new releases often have no rating yet) |

Example: min rating `7`, year from `2025`, genres `Action, Sci-Fi` + `any` → the 4K Movies row only shows 2025+ action or sci-fi films rated 7+.

> Stremio's app only shows a dropdown for **genre**, so year and rating are set on the `/configure` page. They're baked into your install URL, so set them once and they apply everywhere. To change them, reconfigure and reinstall.

## Run it

```bash
npm install
npm start            # → http://127.0.0.1:7000/configure
```

Open the configure page, fill in the filters you want, click **Install**. Stremio must be able to reach the server, so for use on a TV or phone, host it (Render, Railway, Fly.io, a VPS, or a home server behind HTTPS) and install from that URL.

## Sources

| Source | Covers | Notes |
|---|---|---|
| YTS API | Movies | Built-in. Includes IMDb ID, rating, genres. |
| EZTV API | TV episodes | Built-in. Metadata filled in from Cinemeta. |
| Torznab (Prowlarr / Jackett) | Movies + TV | Optional, on the config page. Adds every indexer you've set up there. This is the best way to get broad coverage (BluRay remuxes, scene WEB-DLs, etc.). |

Genres, year, rating and posters come from **Cinemeta** (Stremio's own metadata service) so they match what Stremio shows.

Torrent sites change domains often. Override them with env vars, no code changes needed:

```
YTS_URL=https://yts.mx/api/v2
EZTV_URL=https://eztvx.to/api
CINEMETA_URL=https://v3-cinemeta.strem.io
FEED_TTL_MIN=30          # how often rows refresh (minutes)
PORT=7000
```

## How it decides the quality

`src/quality.js` parses each release name:

1. Reject if it matches any junk tag (CAM, TS, SCR, …). Tags are matched as whole tokens, so a title like *Tsunami* or *Cats* is safe.
2. Read resolution: `2160p`/`4K`/`UHD` → 4K, `1080p` → 1080p.
3. Reject "4K" that's tagged as upscaled.
4. Tag source (Remux / BluRay / WEB-DL / WEBRip / HDTV) and HDR/Dolby Vision for the description.

Per row, each title keeps only its **newest** qualifying release, and rows are sorted newest-first.

## Project layout

```
src/
  index.js          server entry (stremio-addon-sdk)
  manifest.js       rows, genre dropdown, config page fields
  catalog.js        request handler → filtered, paginated metas
  feed.js           merges sources, dedupes by IMDb ID, enriches, caches
  quality.js        release-name parser + junk filter
  filters.js        genre / year / rating filtering
  config.js         parses the user's config
  metadata.js       Cinemeta lookups (cached 24h)
  http.js           fetch w/ timeout, TTL cache, concurrency limit
  sources/yts.js
  sources/eztv.js
  sources/torznab.js
test/quality.test.js
```

`npm test` runs the parser and filter tests.

## Ideas for later

- A **720p** or **"Just Upgraded"** row (titles that went from 1080p to 4K)
- Extra rows per genre (e.g. "4K Action") for one-tap browsing without the dropdown
- Persist the cache to Redis if you host it for multiple people
