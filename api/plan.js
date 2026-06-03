// Vercel Serverless: /api/plan
// GET  (auth) → { plan, favs }
// POST (auth) → { plan?, favs? }
import Redis from 'ioredis';

let _redis = null;
function getRedis() {
  if (_redis && _redis.status !== 'end') return _redis;
  const url = process.env.REDIS_URL || process.env.STORAGE_URL || process.env.KV_URL;
  if (!url) throw new Error('Redis URL 환경변수가 없습니다 (REDIS_URL)');
  _redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    connectTimeout: 8000,
    enableReadyCheck: false,
    tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  });
  return _redis;
}

async function getSession(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return null;
  const val = await getRedis().get(`session:${token}`);
  return val ? JSON.parse(val) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    const { user } = session;
    const redis = getRedis();

    if (req.method === 'GET') {
      const [planRaw, favsRaw] = await Promise.all([
        redis.get('plan'),
        redis.get(`favs:${user}`),
      ]);
      return res.json({
        plan: planRaw ? JSON.parse(planRaw) : null,
        favs: favsRaw ? JSON.parse(favsRaw) : [],
      });
    }

    if (req.method === 'POST') {
      const { plan, favs } = req.body || {};
      await Promise.all([
        plan !== undefined ? redis.set('plan', JSON.stringify(plan)) : Promise.resolve(),
        favs !== undefined ? redis.set(`favs:${user}`, JSON.stringify(favs)) : Promise.resolve(),
      ]);
      return res.json({ ok: true });
    }

    return res.status(405).end();
  } catch (e) {
    console.error('[plan] error:', e);
    return res.status(500).json({ error: `서버 오류: ${e.message}` });
  }
}
