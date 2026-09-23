import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    // Flutter web dev-server 5173 da — to'qnashmasligi uchun boshqa port.
    port: 5174,
    proxy: {
      // Backend'ga proxy: brauzer uchun origin bir xil bo'lib qoladi,
      // shuning uchun ishlab chiqishda CORS umuman kerak emas.
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
      // Yuklangan fayllar (profil rasmlari) ham backend'dan keladi.
      '/media': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
