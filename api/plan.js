// Vercel Serverless: /api/plan
// GET  (auth)       → { plan, favs }
// POST (auth) body  → { plan?, favs? }

function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    return { base: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    return { base: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };

  // REDIS_URL 파싱: rediss://default:TOKEN@HOST:PORT
  if (process.env.REDIS_URL) {
    try {
      const u = new URL(process.env.REDIS_URL);
      return { base: `https://${u.hostname}`, token: u.password };
    } catch {}
  }
  return null;
}

async function kvGet(key) {
  const kv = getKv();
  if (!kv) return null;
  const r = await fetch(`${kv.base}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${kv.token}` },
  });
  const { result } = await r.json();
  try { return result != null ? JSON.parse(result) : null; } catch { return null; }
}

async function kvSet(key, value) {
  const kv = getKv();
  if (!kv) return;
  await fetch(`${kv.base}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', key, JSON.stringify(value)]]),
  });
}

async function getSession(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return null;
  return kvGet(`session:${token}`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const session = await getSession(req);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const { user } = session;

  // 플랜 + 개인 즐겨찾기 조회
  if (req.method === 'GET') {
    const [plan, favs] = await Promise.all([
      kvGet('plan'),
      kvGet(`favs:${user}`),
    ]);
    return res.json({ plan, favs: favs || [] });
  }

  // 플랜 / 즐겨찾기 저장
  if (req.method === 'POST') {
    const { plan, favs } = req.body || {};
    await Promise.all([
      plan !== undefined ? kvSet('plan', plan)          : Promise.resolve(),
      favs !== undefined ? kvSet(`favs:${user}`, favs) : Promise.resolve(),
    ]);
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
