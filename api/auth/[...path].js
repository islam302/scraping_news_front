export default async function handler(req, res) {
  // Extract the path after /api/auth
  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api\/auth/, '');
  const targetUrl = `https://authentication-system-4svs.onrender.com/api/auth${path}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const text = await response.text();

    // Forward the response status and body
    res.status(response.status);
    res.setHeader('Content-Type', 'application/json');
    res.end(text);
  } catch (error) {
    res.status(502).json({ detail: 'Auth service unavailable' });
  }
}
