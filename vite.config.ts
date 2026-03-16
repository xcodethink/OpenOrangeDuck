import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        options: 'src/options/index.html',
        manager: 'src/manager/index.html',
        dedupe: 'src/dedupe/index.html',
        tags: 'src/tags/index.html',
        auth: 'src/auth/index.html',
        classify: 'src/classify/index.html',
        welcome: 'src/welcome/index.html',
        warning: 'src/warning/index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
