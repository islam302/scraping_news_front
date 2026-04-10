export default async function handler(req, res) {
  const path = req.url.replace(/^\/scraping-api/, '');
  const target = `https://una-ai-tools-apis.una-oic.org/scraping-api${path}`;

  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': 'nra_ce35c0f17f8ab7e1446eb14af61baf247e17aca000693b4ee4a0984e',
  };

  const fetchOptions = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    if (body) fetchOptions.body = body;
  }

  try {
    const response = await fetch(target, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    res.setHeader('Content-Type', contentType);
    res.status(response.status);

    if (contentType.includes('application/json')) {
      const data = await response.text();
      res.send(data);
    } else {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (err) {
    res.status(500).json({ error: 'Proxy error' });
  }
}
