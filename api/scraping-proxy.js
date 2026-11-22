// Vercel serverless function behind the /scraping-api/* rewrite (vercel.json).
// All logic lives in ./_lib/proxyCore.js (shared with the Vite dev servers).
//
// Required environment variables (Vercel → Project → Settings → Environment Variables):
//   SCRAPING_API_KEY        Service API key for the scraping API (server-side secret).
// Optional:
//   SCRAPING_API_UPSTREAM   default https://una-ai-tools-apis.una-oic.org/scraping-api
//   AUTH_VERIFY_URL         default https://una-ai-tools-apis.una-oic.org/auth-api/api/auth/token/verify/
import { createProxyHandler, createTokenVerifier } from './_lib/proxyCore.js';

const UPSTREAM = process.env.SCRAPING_API_UPSTREAM
  || 'https://una-ai-tools-apis.una-oic.org/scraping-api';
const VERIFY_URL = process.env.AUTH_VERIFY_URL
  || 'https://una-ai-tools-apis.una-oic.org/auth-api/api/auth/token/verify/';

export default createProxyHandler({
  upstream: UPSTREAM,
  apiKey: process.env.SCRAPING_API_KEY,
  verifyToken: createTokenVerifier({ verifyUrl: VERIFY_URL }),
});
