// Vercel Serverless: /api/auth
// POST  { user, password } → { token, user }
// DELETE (Authorization: Bearer <token>) → logout

import crypto from 'crypto';

// 환경변수에서 Upstash REST API 설정 파싱
// 우선순위: KV_REST_API > UPSTASH_REDIS_REST > REDIS_URL 파싱
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

const USERS = {
  miju:    process.env.PASS_MIJU,
  sanghyo: process.env.PASS_SANGHYO,
};
const SESSION_TTL = 60 * 60 * 24 * 30; // 30일

async function kvSet(key, value, exSeconds) {
  const kv = getKv();
  if (!kv) throw new Error('KV 설정 없음');
  const cmd = exSeconds
    ? ['SET', key, JSON.stringify(value), 'EX', exSeconds]
    : ['SET', key, JSON.stringify(value)];
  await fetch(`${kv.base}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([cmd]),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 로그인
  if (req.method === 'POST') {
    const { user, password } = req.body || {};
    if (!USERS[user] || USERS[user] !== password)
      return res.status(401).json({ error: '비밀번호가 틀렸습니다' });

    const token = crypto.randomBytes(24).toString('hex');
    await kvSet(`session:${token}`, { user, created: Date.now() }, SESSION_TTL);
    return res.json({ token, user });
  }

  // 로그아웃
  if (req.method === 'DELETE') {
    const kv = getKv();
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (kv && token)
      await fetch(`${kv.base}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['DEL', `session:${token}`]]),
      });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
