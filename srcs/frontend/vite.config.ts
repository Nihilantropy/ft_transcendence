/**
 * @brief Vite configuration for ft_transcendence frontend
 * 
 * @description Configures Vite development server for Docker container networking
 * and includes Tailwind CSS plugin for styling
 */

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss()],
  
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