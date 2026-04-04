import express from 'express';

const router = express.Router();

const cache = new Map();
const CACHE_MS = 45 * 60 * 1000;
const MAX_CACHE = 400;

/** Access Key only — trim quotes / BOM / accidental "Client-ID " paste */
function getUnsplashAccessKey() {
  const raw = process.env.UNSPLASH_ACCESS_KEY || process.env.VITE_UNSPLASH_ACCESS_KEY || '';
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Client-ID\s+/i, '');
}

function cacheGet(key) {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() - e.t > CACHE_MS) {
    cache.delete(key);
    return undefined;
  }
  return e.url;
}

function cacheSet(key, url) {
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, { t: Date.now(), url });
}

/**
 * GET /search?q=...
 * Unsplash expects the Access Key as query param `client_id` (see API docs).
 * Always HTTP 200 so the client can use fallback images on errors.
 */
router.get('/search', async (req, res) => {
  const q = (req.query.q || 'travel destination').trim().slice(0, 200);
  const accessKey = getUnsplashAccessKey();

  if (!accessKey) {
    return res.json({ url: null, notConfigured: true });
  }

  const cached = cacheGet(q);
  if (cached !== undefined) {
    return res.json({ url: cached, cached: true });
  }

  try {
    const params = new URLSearchParams({
      query: q,
      per_page: '1',
      orientation: 'landscape',
      client_id: accessKey,
    });
    const apiUrl = `https://api.unsplash.com/search/photos?${params.toString()}`;

    /* Prefer client_id in query string (official search example); avoids 403 some setups see with header-only */
    const r = await fetch(apiUrl, {
      headers: { 'Accept-Version': 'v1' },
    });

    if (!r.ok) {
      let detail = '';
      try {
        const errBody = await r.json();
        detail = errBody?.errors?.join?.('; ') || errBody?.error || JSON.stringify(errBody).slice(0, 120);
      } catch {
        /* ignore */
      }
      console.warn('Unsplash HTTP', r.status, q.slice(0, 56), detail ? `— ${detail}` : '');
      if (r.status === 401 || r.status === 403) {
        console.warn(
          'Unsplash: use the Access Key from your app (not the Secret). See .env.example — unsplash.com/oauth/applications'
        );
      }
      cacheSet(q, null);
      return res.json({ url: null, status: r.status });
    }

    const data = await r.json();
    const photo = data.results?.[0];
    const imageUrl = photo?.urls?.regular || photo?.urls?.full || null;
    cacheSet(q, imageUrl);
    return res.json({
      url: imageUrl,
      thumb: photo?.urls?.small,
      alt: photo?.alt_description || q,
      credit: photo?.user?.name,
    });
  } catch (err) {
    console.warn('Unsplash error:', err.message || err);
    return res.json({ url: null });
  }
});

export default router;
