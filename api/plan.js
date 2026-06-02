// Vercel Serverless: /api/plan
// GET  (auth) → { plan, favs }
// POST (auth) → { plan?, favs? }

function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    return { base: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    return { base: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };

  const rawUrl = process.env.REDIS_URL || process.env.STORAGE_URL || process.env.KV_URL;
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      return { base: `https://${u.hostname}`, token: u.password };
    } catch {}
  }
  return null;
}

async function kvGet(kv, key) {
  const r = await fetch(`${kv.base}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${kv.token}` },
  });
  const { result } = await r.json();
  try { return result != null ? JSON.parse(result) : null; } catch { return null; }
}

async function kvSet(kv, key, value) {
  await fetch(`${kv.base}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', key, JSON.stringify(value)]]),
  });
}

async function getSession(req, kv) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return null;
  return kvGet(kv, `session:${token}`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const kv = getKv();
    if (!kv) return res.status(500).json({ error: 'KV 스토리지 미연결 — 환경변수를 확인하세요' });

    const session = await getSession(req, kv);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const { user } = session;

    if (req.method === 'GET') {
      const [plan, favs] = await Promise.all([
        kvGet(kv, 'plan'),
        kvGet(kv, `favs:${user}`),
      ]);
      return res.json({ plan, favs: favs || [] });
    }

    if (req.method === 'POST') {
      const { plan, favs } = req.body || {};
      await Promise.all([
        plan !== undefined ? kvSet(kv, 'plan', plan)          : Promise.resolve(),
        favs !== undefined ? kvSet(kv, `favs:${user}`, favs) : Promise.resolve(),
      ]);
      return res.json({ ok: true });
    }

    return res.status(405).end();

  } catch (e) {
    console.error('[plan] error:', e);
    return res.status(500).json({ error: `서버 오류: ${e.message}` });
  }
}
