import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev loop: the browser only sees http://localhost:5173, so cookies stay same-origin.
  server: { proxy: { '/api': { target: 'https://localhost:8443', secure: false, changeOrigin: true } } },
})
