// Vercel Serverless Function: /api/events
// 3 Days of Design 공식 사이트에서 이벤트 데이터를 가져와 캐시합니다.
// 사이트가 JS 렌더링이므로 OpenGraph/RSS/meta 기반으로 접근 가능한 정보를 파싱합니다.

const CACHE_TTL = 3600; // 1시간 캐시
let _cache = null;
let _cacheAt = 0;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 캐시 유효 시 반환
  if (_cache && Date.now() - _cacheAt < CACHE_TTL * 1000) {
    return res.status(200).json({ source: 'cache', events: _cache });
  }

  try {
    // 공식 사이트 기본 HTML 파싱 (JS 렌더링 전 메타데이터)
    const r = await fetch('https://www.3daysofdesign.dk/events', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TripPlanner/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    // JSON-LD 이벤트 데이터 추출 시도
    const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    const events = [];

    for (const match of jsonLdMatches) {
      try {
        const obj = JSON.parse(match[1]);
        const items = Array.isArray(obj) ? obj : [obj];
        for (const item of items) {
          if (item['@type'] === 'Event' || item['@type'] === 'SocialEvent') {
            events.push({
              title: item.name || '',
              venue: item.location?.name || '',
              address: item.location?.address?.streetAddress || '',
              date: item.startDate ? new Date(item.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '',
              time: item.startDate && item.endDate
                ? `${new Date(item.startDate).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})}-${new Date(item.endDate).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})}`
                : '',
              desc: item.description?.slice(0, 120) || '',
              url: item.url || '',
            });
          }
        }
      } catch {}
    }

    if (events.length > 0) {
      _cache = events;
      _cacheAt = Date.now();
      return res.status(200).json({ source: 'live', count: events.length, events });
    }

    // JSON-LD 없으면 현재 하드코딩 데이터 유지 신호 반환
    return res.status(200).json({ source: 'static', events: [] });

  } catch (e) {
    return res.status(200).json({ source: 'error', error: String(e), events: [] });
  }
}
