import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const allowedHosts = ['5174--main--am--am6737.coder.dootask.com'];
const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  server: {
    port: 5174,
    host: '0.0.0.0',
    allowedHosts,
  },
  preview: {
    port: 4174,
    host: '0.0.0.0',
    allowedHosts,
  },
});
