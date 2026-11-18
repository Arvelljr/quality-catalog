// Generates posters with the title printed in a dark strip under the artwork.
// The bottom of the strip is left clear so the app's own "★ rating · genre" line still fits.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const LAYOUT_VERSION = 'v1';
const W = 500;
const H = 750;
const ART_H = 575; // artwork area
const FONT = "'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > maxChars - 1) last = last.slice(0, -1);
    kept[maxLines - 1] = last.replace(/[\s,:;-]+$/, '') + '…';
    return kept;
  }
  return lines;
}

function layoutTitle(title) {
  // Try big text first, shrink for long titles.
  for (const [size, chars] of [[38, 21], [32, 25], [28, 29]]) {
    const lines = wrap(title, chars, 2);
    if (!lines[lines.length - 1].endsWith('…') || size === 28) return { size, lines };
  }
}

function titleSvg(title, hasArt) {
  const { size, lines } = layoutTitle(title);
  const lineH = Math.round(size * 1.15);
  if (!hasArt) {
    // No artwork: big centered title on a plain card.
    const big = wrap(title, 14, 4);
    const fs2 = 48;
    const startY = H / 2 - ((big.length - 1) * fs2 * 1.15) / 2;
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2b2546"/><stop offset="1" stop-color="#0e0c18"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      ${big.map((l, i) => `<text x="${W / 2}" y="${startY + i * fs2 * 1.15}" font-family="${FONT}" font-weight="bold" font-size="${fs2}" fill="#fff" text-anchor="middle">${esc(l)}</text>`).join('')}
    </svg>`;
  }
  const top = ART_H + 18;
  const firstBaseline = top + size;
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0e0c18" stop-opacity="0"/><stop offset="1" stop-color="#0e0c18" stop-opacity="1"/></linearGradient></defs>
    <rect x="0" y="${ART_H - 60}" width="${W}" height="60" fill="url(#fade)"/>
    <rect x="0" y="${ART_H}" width="${W}" height="${H - ART_H}" fill="#0e0c18"/>
    ${lines.map((l, i) => `<text x="${W / 2}" y="${firstBaseline + i * lineH}" font-family="${FONT}" font-weight="bold" font-size="${size}" fill="#ffffff" text-anchor="middle">${esc(l)}</text>`).join('')}
  </svg>`;
}

async function render(artBuf, title) {
  let base;
  let hasArt = false;
  if (artBuf) {
    try {
      const art = await sharp(artBuf).resize(W, ART_H, { fit: 'cover', position: 'top' }).toBuffer();
      base = sharp({ create: { width: W, height: H, channels: 3, background: '#0e0c18' } }).composite([{ input: art, top: 0, left: 0 }]);
      base = sharp(await base.png().toBuffer());
      hasArt = true;
    } catch {
      base = null;
    }
  }
  if (!base) base = sharp({ create: { width: W, height: H, channels: 3, background: '#0e0c18' } });
  return base.composite([{ input: Buffer.from(titleSvg(title, hasArt)) }]).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

async function download(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'stremio-quality-catalog/1.0' } });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// items: [{ id, name, poster }]. Writes outDir/posters/<id>.jpg and returns Map(id -> relative path).
async function buildPosters(items, outDir, cacheDir) {
  fs.mkdirSync(path.join(outDir, 'posters'), { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  const used = new Set();
  const result = new Map();
  let made = 0;
  let reused = 0;
  const queue = [...items];
  const worker = async () => {
    while (queue.length) {
      const it = queue.shift();
      const key = crypto.createHash('sha1').update(`${LAYOUT_VERSION}|${it.name}|${it.poster || ''}`).digest('hex') + '.jpg';
      const cached = path.join(cacheDir, key);
      used.add(key);
      try {
        if (fs.existsSync(cached)) reused++;
        else {
          fs.writeFileSync(cached, await render(await download(it.poster), it.name));
          made++;
        }
        fs.copyFileSync(cached, path.join(outDir, 'posters', `${it.id}.jpg`));
        result.set(it.id, `posters/${it.id}.jpg`);
      } catch (e) {
        console.warn(`[posters] ${it.id} failed: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 10 }, worker));
  // Prune cache entries no longer used.
  for (const f of fs.readdirSync(cacheDir)) if (!used.has(f)) fs.rmSync(path.join(cacheDir, f));
  console.log(`[posters] ${made} new, ${reused} from cache`);
  return result;
}

module.exports = { buildPosters, render };
