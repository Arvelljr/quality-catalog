// Small fetch helpers with timeout + in-memory TTL cache.

const cache = new Map();

async function fetchWithTimeout(url, { timeout = 15000, ...opts } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'User-Agent': 'stremio-quality-catalog/1.0', ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function getJson(url, opts) {
  return (await fetchWithTimeout(url, opts)).json();
}

async function getText(url, opts) {
  return (await fetchWithTimeout(url, opts)).text();
}

// Caches the promise so concurrent requests share one fetch.
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = Promise.resolve()
    .then(fn)
    .catch((err) => {
      cache.delete(key);
      throw err;
    });
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

// Run async fn over items with limited concurrency.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await fn(items[idx], idx);
      } catch {
        out[idx] = null;
      }
    }
  });
  await Promise.all(workers);
  return out;
}

module.exports = { getJson, getText, cached, mapLimit };
