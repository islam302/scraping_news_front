import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/auth-api': {
        target: 'https://una-ai-tools-apis.una-oic.org',
        changeOrigin: true,
      },
      '/scraping-api': {
        target: 'https://una-ai-tools-apis.una-oic.org',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-API-Key', 'nra_ce35c0f17f8ab7e1446eb14af61baf247e17aca000693b4ee4a0984e');
          });
        },
      },
    },
  },
})
