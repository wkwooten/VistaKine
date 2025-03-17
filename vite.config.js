import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/VistaKine/', // Add base path for GitHub Pages
  server: {
    open: '/book.html', // Open book.html by default
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'), // Root alias
      'three': resolve(__dirname, 'node_modules/three'),
      '@dimforge/rapier3d-compat': resolve(__dirname, 'node_modules/@dimforge/rapier3d-compat'),
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'book.html'),
      },
    },
  },
  css: {
    modules: false,
    postcss: false
  },
  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/controls/OrbitControls.js',
      'three/examples/jsm/controls/TransformControls.js',
      '@dimforge/rapier3d-compat'
    ],
    exclude: []
  }
});
