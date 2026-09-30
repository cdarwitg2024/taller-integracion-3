import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  envDir: path.resolve(__dirname, '..'),
});

// Esto le dice a Vite que el proyecto utiliza React.
// base './' permite que el build funcione cargado desde file:// en Electron.
// envDir '../' carga el .env centralizado de la raíz del proyecto.
