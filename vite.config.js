import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createProxyHandler, createTokenVerifier } from './api/_lib/proxyCore.js'

const here = fileURLToPath(new URL('.', import.meta.url))

// Server-side secrets for the dev proxy. Put them in .env.local (gitignored by
// "*.local") — never in source. No VITE_ prefix, so they are never bundled
// into the browser code.
//   SCRAPING_API_KEY=...
const fileEnv = loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', here, '')
export const serverEnv = (name) => process.env[name] || fileEnv[name] || ''

const REMOTE = 'https://una-ai-tools-apis.una-oic.org'

/**
 * Mounts the shared scraping proxy (api/_lib/proxyCore.js) on /scraping-api so
 * dev behaves exactly like the Vercel function in production.
 */
export function scrapingProxyPlugin(options) {
  return {
    name: 'scraping-proxy',
    configureServer(server) {
      if (!options.apiKey) {
        server.config.logger.warn(
          '[scraping-proxy] SCRAPING_API_KEY is not set — add it to scraping_news_front/.env.local. '
          + 'Requests to /scraping-api will fail with 500 until then.',
        )
      }
      const handler = createProxyHandler(options)
      server.middlewares.use('/scraping-api', (req, res) => { handler(req, res) })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    scrapingProxyPlugin({
      upstream: `${REMOTE}/scraping-api`,
      apiKey: serverEnv('SCRAPING_API_KEY'),
      verifyToken: createTokenVerifier({ verifyUrl: `${REMOTE}/auth-api/api/auth/token/verify/` }),
    }),
  ],
  server: {
    proxy: {
      '/auth-api': {
        target: REMOTE,
        changeOrigin: true,
      },
    },
  },
})
