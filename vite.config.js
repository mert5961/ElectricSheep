import { defineConfig } from 'vite';
import { resolve } from 'path';
import glsl from 'vite-plugin-glsl';

export default defineConfig(({ mode }) => {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'ElectricSheep';
  const isGitHubPagesBuild = mode === 'github-pages';

  return {
    base: isGitHubPagesBuild ? `/${repositoryName}/` : '/',
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
  };
});
