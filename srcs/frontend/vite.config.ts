/**
 * @brief Fixed Vite configuration for ft_transcendence frontend
 * 
 * @description Configures Vite development server for Docker container networking,
 * includes Tailwind CSS plugin, and sets up proper HMR for nginx proxy with HTTPS support.
 * 
 * @param None
 * @return Vite configuration object with corrected WebSocket settings
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
      '@/router': resolve(__dirname, './src/router'),
      '@/assets': resolve(__dirname, './src/assets'),
    }
  },
  
  // Server configuration for Docker container networking
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: false,  // Disable polling - use native file watching
      interval: 1000,     // If polling needed, increase interval
      ignored: ['**/node_modules/**', '**/dist/**', '**/build/**']
    },
    // ✅ FIXED: HMR configuration for HTTPS nginx proxy
    hmr: {
      port: 5173,           // Keep HMR server on container port
      host: 'localhost',    // Use localhost for client connection
      protocol: 'wss',      // ✅ SECURE WebSocket protocol for HTTPS
      clientPort: 443,      // Browser connects via nginx HTTPS port
      path: '/vite-hmr'     // ✅ Custom HMR path for nginx proxy
    },
    // ✅ ADDED: Origin configuration for nginx proxy
    origin: 'https://localhost'
  },
  
  // Preview server configuration (for production builds)
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize bundle for development debugging
    minify: false,
  }
})