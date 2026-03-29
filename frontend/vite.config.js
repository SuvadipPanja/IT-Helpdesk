import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [react()],
    build: {
      sourcemap: false,
      minify: 'esbuild',
      target: 'es2019',
    },
    esbuild: isProduction
      ? {
          drop: ['console', 'debugger'],
        }
      : undefined,
    server: {
      port: 5173,
      host: true,
      allowedHosts: true,
      proxy: {
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          xfwd: true, // Forward X-Forwarded-For so backend captures real client IP
        },
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          xfwd: true, // Forward X-Forwarded-For so backend captures real client IP
        }
      }
    }
  }
})