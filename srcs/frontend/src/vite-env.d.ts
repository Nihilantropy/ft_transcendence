/// <reference types="vite/client" />

/**
 * @brief Vite environment type declarations
 * 
 * @description Extended type declarations for Vite environment,
 * including SVG imports and other asset types used in ft_transcendence.
 */

// SVG file imports
declare module '*.svg' {
  const content: string
  export default content
}

// CSS file imports
declare module '*.css' {
  const content: string
  export default content
}

// Image file imports
declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.gif' {
  const content: string
  export default content
}

declare module '*.webp' {
  const content: string
  export default content
}

// Font file imports
declare module '*.woff' {
  const content: string
  export default content
}

declare module '*.woff2' {
  const content: string
  export default content
}

declare module '*.ttf' {
  const content: string
  export default content
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WS_BASE_URL: string
  readonly VITE_APP_TITLE: string
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}