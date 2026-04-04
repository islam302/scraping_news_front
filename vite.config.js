import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/auth': {
        target: 'https://una-ai-tools-apis.una-oic.org/auth-api',
        changeOrigin: true,
      },
    },
  },
})
