import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In dev the API runs separately on :3000. Proxying keeps the browser on one
    // origin so the session cookie behaves exactly as it does in production.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
