/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'pong-primary': '#00ff41',     // Classic green for Pong
          'pong-secondary': '#008f11',   // Darker green
          'pong-bg': '#0a0a0a',          // Dark background
          'pong-accent': '#ff0080',      // Accent color
        },
        fontFamily: {
          'mono': ['Courier New', 'monospace'],
          'game': ['Press Start 2P', 'monospace'],
        },
        animation: {
          'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'bounce-slow': 'bounce 2s infinite',
        },
        screens: {
          'xs': '475px',
        },
      },
    },
    plugins: [],
  }