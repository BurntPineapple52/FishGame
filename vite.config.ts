import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built game works from any folder (itch.io, GitHub Pages, a zip).
  base: './',
  build: {
    // Phaser alone is ~1.2 MB minified; don't warn about it.
    chunkSizeWarningLimit: 2000,
  },
});
