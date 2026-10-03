import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  envDir: '../',
  server: {
    // Antes escuchaba solo en [::1]:5173 (IPv6). Como 'localhost' no siempre
    // resuelve a ::1 —Firefox y Chrome según la configuración pueden usar
    // 127.0.0.1—, la página no cargaba y parecía que el servidor estaba caído.
    // Con host: true atiende en IPv4 e IPv6, así que ambos funcionan.
    host: true,
    // Si el puerto 5173 está ocupado, Vite se corre solo al 5174 sin avisar
    // y la URL que estaba en el navegador deja de servir. strictPort hace que
    // se queje en vez de mudarse de lado.
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        // La app.
        main: resolve(__dirname, 'index.html'),
        // Banco de pruebas del aviso de voz (T16). Sin esto queda solo en
        // el dev server: Vite no compila los .html sueltos que no estén
        // declarados como entrada, y al abrir la app compilada daba 404.
        'prueba-voz': resolve(__dirname, 'prueba-voz.html'),
      },
    },
  },
});

//Esto le dice a Vite que el proyecto utiliza React.
//base './' permite que el build funcione cargado desde file:// en Electron.
