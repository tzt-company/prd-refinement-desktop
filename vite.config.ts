import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'docs/tmp/desktop-build/current/dist' },
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/docs/tmp/**', '**/docs/acceptance/**/electron-profile/**', '**/docs/acceptance/**/runtime/**'] },
  },
});
