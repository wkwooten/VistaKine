import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    open: '/book.html', // Open book.html by default
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'), // Root alias
      'three': resolve(__dirname, 'node_modules/three')
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        book: resolve(__dirname, 'book.html'),
      }
    }
  },
  css: {
    modules: false,
    postcss: false
  }
});
