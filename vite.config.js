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
    },
  },
})
