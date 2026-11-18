// Parses a torrent release name into a quality tier and rejects junk releases.

// Pre-release / low-quality sources that should never appear.
const JUNK = new RegExp(
  '(^|[^a-z0-9])(' +
    [
      'cam', 'camrip', 'cam-?rip', 'hd-?cam', 'hqcam',
      'ts', 'hd-?ts', 'telesync', 'pdvd', 'predvdrip',
      'tc', 'hd-?tc', 'telecine',
      'scr', 'screener', 'dvd-?scr', 'bd-?scr', 'web-?scr',
      'r5', 'r6', 'workprint', 'wp',
      'hc', 'hc-?rip', 'hdrip-?hc', // hard-coded subs, almost always pre-release rips
    ].join('|') +
  ')([^a-z0-9]|$)',
  'i'
);

// Fake 4K: upscales of 1080p sources.
const UPSCALE = /(^|[^a-z0-9])(upscaled?|ai[-. ]?upscaled?|up[-. ]?scale|ai|ds4k|60fps|regraded)([^a-z0-9]|$)/i;

const RES_PATTERNS = [
  { tier: '4k', re: /(^|[^a-z0-9])(2160p|4k|uhd)([^a-z0-9]|$)/i },
  { tier: '1080p', re: /(^|[^a-z0-9])1080[pi]([^a-z0-9]|$)/i },
  { tier: '720p', re: /(^|[^a-z0-9])720p([^a-z0-9]|$)/i },
];

const SOURCE_PATTERNS = [
  { source: 'Remux', re: /remux/i },
  { source: 'BluRay', re: /blu-?ray|bdrip|brrip/i },
  { source: 'WEB-DL', re: /web-?dl/i },
  { source: 'WEBRip', re: /web-?rip|(^|[^a-z0-9])web([^a-z0-9]|$)/i },
  { source: 'HDTV', re: /hdtv/i },
];

function isJunk(name) {
  return JUNK.test(name);
}

function parseRelease(name) {
  if (!name || typeof name !== 'string') return null;
  if (isJunk(name)) return null;

  const res = RES_PATTERNS.find((p) => p.re.test(name));
  if (!res) return null;
  if (res.tier === '4k' && UPSCALE.test(name)) return null;

  const src = SOURCE_PATTERNS.find((p) => p.re.test(name));
  return {
    tier: res.tier,
    source: src ? src.source : 'Unknown',
    hdr: /(^|[^a-z0-9])(hdr10\+?|hdr|dv|dovi|dolby[-. ]?vision)([^a-z0-9]|$)/i.test(name),
  };
}

module.exports = { parseRelease, isJunk };
