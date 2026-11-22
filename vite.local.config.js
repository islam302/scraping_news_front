// Local development against a local Django backend on :8000.
//   npx vite --config vite.local.config.js
//
// Same as vite.config.js, except:
//   * /scraping-api goes to http://127.0.0.1:8000 (prefix stripped — runserver
//     serves the API at /api/... directly).
//   * /auth-api is answered HERE by a local-only login (localDevAuth below),
//     so you can sign in without an account on the shared auth service. The
//     test users live in .local-auth.json (gitignored) — never in the real
//     auth API. /scraping-api goes through the same proxy core as production
//     (api/_lib/proxyCore.js): it requires one of these local sessions and adds
//     the X-API-Key from SCRAPING_API_KEY in .env.local.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { scrapingProxyPlugin, serverEnv } from './vite.config.js'
import { decodeJwtPayload } from './api/_lib/proxyCore.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const USERS_FILE = path.join(here, '.local-auth.json')

// Unsigned JWT-shaped token: the frontend only decodes `exp` to know when to
// refresh, and nothing on the local backend verifies it.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const makeToken = (username, seconds) =>
  `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    user_id: `local-${username}`, username, exp: Math.floor(Date.now() / 1000) + seconds,
  })}.local-dev`

const readUsers = () => {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')).users || []
  } catch {
    return []
  }
}

const readBody = (req) => new Promise((resolve) => {
  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', () => {
    try { resolve(raw ? JSON.parse(raw) : {}) } catch { resolve({}) }
  })
})

const send = (res, status, data) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function localDevAuth() {
  return {
    name: 'local-dev-auth',
    configureServer(server) {
      server.middlewares.use('/auth-api/api/auth', async (req, res) => {
        const route = (req.url || '').split('?')[0].replace(/\/+$/, '')
        const profileOf = (u) => ({
          id: `local-${u.username}`, username: u.username, email: u.email || '',
          organization: u.organization || 'local', role: u.role || 'admin',
        })

        if (req.method === 'POST' && route === '/token') {
          const { username, password } = await readBody(req)
          const user = readUsers().find((u) => u.username === username && u.password === password)
          if (!user) return send(res, 401, { detail: 'No active account found with the given credentials' })
          return send(res, 200, {
            access: makeToken(user.username, 3 * 24 * 3600),
            refresh: makeToken(user.username, 7 * 24 * 3600),
            ...profileOf(user),
          })
        }
        if (req.method === 'POST' && route === '/token/refresh') {
          return send(res, 200, { access: makeToken('local', 3 * 24 * 3600) })
        }
        if (req.method === 'POST' && route === '/token/verify') return send(res, 200, {})
        if (route === '/profile') {
          const user = readUsers()[0]
          return user ? send(res, 200, profileOf(user)) : send(res, 401, { detail: 'No local user' })
        }
        if (route === '/users' || route === '/api-keys') return send(res, 200, [])
        return send(res, 404, { detail: 'Not available in local dev auth' })
      })
    },
  }
}

// Local sessions are the unsigned tokens minted above: accept only those, and
// only while unexpired. (The remote verifier would reject them.)
const verifyLocalToken = async (token) => {
  const parts = String(token).split('.')
  if (parts.length !== 3 || parts[2] !== 'local-dev') return false
  const payload = decodeJwtPayload(token)
  return !!payload && typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    localDevAuth(),
    scrapingProxyPlugin({
      // runserver serves the API at /api/... directly (no /scraping-api prefix).
      upstream: 'http://127.0.0.1:8000',
      apiKey: serverEnv('SCRAPING_API_KEY'),
      verifyToken: verifyLocalToken,
      // The local backend would try to validate these fake JWTs against the real
      // auth service; identify as the service key instead.
      forwardAuthorization: false,
    }),
  ],
  server: { port: 5174 },
})
