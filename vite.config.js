import { defineConfig } from 'vite';

// The production build is served from https://<user>.github.io/cloud-kingdom/,
// so assets need the repository name as the base path. Local dev uses '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/cloud-kingdom/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020'
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
}));
