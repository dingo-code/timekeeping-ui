import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || ''
          if (name.endsWith('.traineddata.gz')) return 'ocr/[name][extname]'
          if (/^tesseract-core(?:-[a-z]+)*\.wasm\.js$/.test(name)) return 'ocr-core/[name][extname]'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
