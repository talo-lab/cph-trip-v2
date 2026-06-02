// Vercel Serverless: /api/auth
// crypto import 없이 globalThis.crypto 사용 (Node 18+ / Vercel 기본 런타임)

function getKv() {
  // 1) Vercel KV (REST)
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    return { base: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };

  // 2) Upstash REST 직접
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    return { base: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };

  // 3) REDIS_URL / STORAGE_URL 파싱: rediss://default:TOKEN@HOST:PORT
  const rawUrl = process.env.REDIS_URL || process.env.STORAGE_URL || process.env.KV_URL;
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      return { base: `https://${u.hostname}`, token: u.password };
    } catch {}
  }
  return null;
}

async function kvSet(kv, key, value, exSeconds) {
  const cmd = exSeconds
    ? ['SET', key, JSON.stringify(value), 'EX', exSeconds]
    : ['SET', key, JSON.stringify(value)];
  const r = await fetch(`${kv.base}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([cmd]),
  });
  if (!r.ok) throw new Error(`KV write 실패 (${r.status})`);
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
    // 로그인
    if (req.method === 'POST') {
      const { user, password } = req.body || {};

      if (!user || !USERS[user])
        return res.status(401).json({ error: '사용자를 선택해주세요' });
      if (!USERS[user] || USERS[user] !== password)
        return res.status(401).json({ error: '비밀번호가 틀렸습니다' });

      const kv = getKv();
      if (!kv) return res.status(500).json({ error: 'KV 스토리지 미연결 — 환경변수를 확인하세요 (REDIS_URL 또는 KV_REST_API_URL)' });

      // globalThis.crypto: Node 18+ 기본 제공, import 불필요
      const buf = new Uint8Array(24);
      globalThis.crypto.getRandomValues(buf);
      const token = [...buf].map(b=>b.toString(16).padStart(2,'0')).join('');
      await kvSet(kv, `session:${token}`, { user, created: Date.now() }, SESSION_TTL);
      return res.json({ token, user });
    }

    // 로그아웃
    if (req.method === 'DELETE') {
      const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
      const kv = getKv();
      if (kv && token) {
        await fetch(`${kv.base}/pipeline`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${kv.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([['DEL', `session:${token}`]]),
        });
      }
      return res.json({ ok: true });
    }

    return res.status(405).end();

  } catch (e) {
    console.error('[auth] error:', e);
    return res.status(500).json({ error: `서버 오류: ${e.message}` });
  }
}
