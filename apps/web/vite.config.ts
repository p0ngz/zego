import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // The API URL lives in the repo-root .env alongside the server's own config.
  const env = loadEnv(mode, '../../', 'VITE_');
  const apiUrl = env.VITE_API_URL || 'http://localhost:3003';

  return {
    plugins: [react()],
    envDir: '../../',
    server: {
      port: 3002,
      strictPort: true,
      // Same-origin /api in the browser: no CORS preflight while developing.
      proxy: {
        '/api': { target: apiUrl, changeOrigin: true },
      },
    },
    build: { outDir: 'dist', sourcemap: true },
  };
});
