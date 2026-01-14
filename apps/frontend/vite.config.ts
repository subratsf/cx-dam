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
        changeOrigin: false, // CRITICAL: Must be false for localhost cookies
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Forward cookies from the browser to the backend
            if (req.headers.cookie) {
              proxyReq.setHeader('cookie', req.headers.cookie);
            }
          });
          
          // CRITICAL: Forward Set-Cookie headers from backend to browser
          proxy.on('proxyRes', (proxyRes, req, res) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              // Remove domain attribute if present (causes issues with localhost)
              proxyRes.headers['set-cookie'] = setCookie.map((cookie) => {
                // Remove domain completely for localhost
                let modified = cookie.replace(/domain=[^;]+;?/gi, '');
                // Clean up double semicolons
                modified = modified.replace(/;;+/g, ';');
                // Ensure proper format
                modified = modified.trim();
                if (!modified.endsWith(';') && !modified.match(/;\s*$/)) {
                  modified += ';';
                }
                console.log('[Proxy] Set-Cookie forwarded:', modified.substring(0, 100));
                return modified;
              });
            }
          });
        },
      },
    },
  },
});
