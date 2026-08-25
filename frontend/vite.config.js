import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      // Both REST and WebSocket traffic live under /api/v1
      '/api': {
        target: process.env.BACKEND_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: [
      'countin.ignacio.tech',
      'preview.countin.ignacio.tech',
      '.countin.ignacio.tech',
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          tensorflow: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd'],
          qrcode: ['qrcode'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
