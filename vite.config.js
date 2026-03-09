import { defineConfig } from 'vite';
import { resolve } from 'path';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl()],
  server: {
    open: '/control.html',
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        output: resolve(__dirname, 'output.html'),
        control: resolve(__dirname, 'control.html'),
      },
    },
  },
});
