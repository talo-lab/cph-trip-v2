// Vercel Serverless Function: /api/transit
// Rejseplanen (덴마크 공식 대중교통) REST API 프록시
// CORS 및 XML→JSON 변환을 서버에서 처리합니다.

const BASE = 'https://xmlopen.rejseplanen.dk/bin/rest.exe';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, lat, lng, name, originId, destId, datetime } = req.query;

  try {
    let url = '';

    if (type === 'location') {
      // 좌표 또는 이름으로 정류장 검색
      if (lat && lng) {
        url = `${BASE}/coordsToStops?coordX=${Math.round(+lng*1000000)}&coordY=${Math.round(+lat*1000000)}&maxRadius=600&maxResults=3&format=json`;
      } else if (name) {
        url = `${BASE}/location?input=${encodeURIComponent(name)}&format=json`;
      } else {
        return res.status(400).json({ error: 'lat/lng 또는 name 필요' });
      }
    } else if (type === 'trip') {
      if (!originId || !destId) return res.status(400).json({ error: 'originId, destId 필요' });
      const dt = datetime ? new Date(datetime) : new Date();
      const date = dt.toLocaleDateString('en-GB').replace(/\//g,'.'); // DD.MM.YYYY
      const time = dt.toTimeString().slice(0,5); // HH:MM
      url = `${BASE}/trip?originId=${originId}&destId=${destId}&date=${date}&time=${time}&format=json`;
    } else {
      return res.status(400).json({ error: 'type=location 또는 trip 필요' });
    }

    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(`Rejseplanen HTTP ${r.status}`);
    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
