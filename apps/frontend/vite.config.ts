import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@cx-dam/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  optimizeDeps: {
    include: ['@cx-dam/shared'],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    commonjsOptions: {
      include: [/@cx-dam\/shared/, /node_modules/],
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
