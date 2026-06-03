// Vercel Serverless: /api/auth
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

const USERS = {
  miju:    process.env.PASS_MIJU,
  sanghyo: process.env.PASS_SANGHYO,
};
const SESSION_TTL = 60 * 60 * 24 * 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const { user, password } = req.body || {};
      if (!user || !USERS[user])
        return res.status(401).json({ error: '사용자를 선택해주세요' });
      if (!USERS[user] || USERS[user] !== password)
        return res.status(401).json({ error: '비밀번호가 틀렸습니다' });

      const redis = getRedis();
      const buf = new Uint8Array(24);
      globalThis.crypto.getRandomValues(buf);
      const token = [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
      await redis.set(`session:${token}`, JSON.stringify({ user, created: Date.now() }), 'EX', SESSION_TTL);
      return res.json({ token, user });
    }

    if (req.method === 'DELETE') {
      const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
      if (token) await getRedis().del(`session:${token}`);
      return res.json({ ok: true });
    }

    return res.status(405).end();
  } catch (e) {
    console.error('[auth] error:', e);
    return res.status(500).json({ error: `서버 오류: ${e.message}` });
  }
}
