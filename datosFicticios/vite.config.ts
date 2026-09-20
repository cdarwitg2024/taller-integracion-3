import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { apiApp } from './server/api.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-server',
      configureServer(server) {
        server.middlewares.use(apiApp);
      },
    },
  ],
  server: {
    port: 5174,
  },
});
