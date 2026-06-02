// Vercel Serverless Function: /api/extract
// 브라우저 대신 서버에서 Anthropic API를 호출합니다.
// API 키는 절대 브라우저로 내려가지 않고, Vercel 환경변수(ANTHROPIC_API_KEY)에만 보관됩니다.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "서버에 API 키가 설정되지 않았습니다." });
  }

  try {
    const { system, input, max_tokens } = req.body || {};
    if (!input) return res.status(400).json({ error: "input이 비어 있습니다." });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: max_tokens || 300,
        system: system || "",
        messages: [{ role: "user", content: String(input) }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({ error: "Anthropic API 오류", detail });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
