import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  envDir: '../',
});

//Esto le dice a Vite que el proyecto utiliza React.