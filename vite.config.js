import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Target modern browsers — smaller, faster output
    target: 'es2015',

    // No sourcemaps in production (smaller dist folder)
    sourcemap: false,

    // Suppress false chunk-size warnings
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // Split vendor libraries into separately cached chunks
        manualChunks: {
          // React core — almost never changes, cached forever by browser
          'vendor-react': ['react', 'react-dom'],
          // Router
          'vendor-router': ['react-router-dom'],
          // HTTP client
          'vendor-axios': ['axios'],
          // Icon library
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
  },
})
