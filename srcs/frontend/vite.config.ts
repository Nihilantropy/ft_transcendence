/**
 * @brief Vite configuration for ft_transcendence frontend
 * 
 * @description Configures Vite development server for Docker container networking,
 * includes Tailwind CSS plugin, and sets up TypeScript path mapping aliases.
 */

import { defineConfig } from 'vite'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  
  // TypeScript path mapping aliases
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/pages': resolve(__dirname, './src/pages'),
      '@/services': resolve(__dirname, './src/services'),
      '@/stores': resolve(__dirname, './src/stores'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/router': resolve(__dirname, './src/router'),
      '@/i18n': resolve(__dirname, './src/i18n'),
      '@/assets': resolve(__dirname, './src/assets'),
      '@/styles': resolve(__dirname, './src/styles')
    }
  },
  
  // Server configuration for Docker container networking
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  
  // Preview server configuration (for production builds)
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})