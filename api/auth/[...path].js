export default async function handler(req, res) {
  const path = req.url.replace(/^\/api\/auth/, '');
  const targetUrl = `https://authentication-system-4svs.onrender.com/api/auth${path}`;

  try {
    const headers = { 'Content-Type': 'application/json' };

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    res.status(502).json({ error: 'Auth service unavailable' });
  }
}
