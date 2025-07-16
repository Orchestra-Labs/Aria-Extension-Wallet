/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    global: 'window',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      buffer: 'buffer/',
    },
  },
  plugins: [react(), viteTsconfigPaths()],
  publicDir: 'public',
  server: {
    open: true,
    host: true,
    proxy: {
      // Kleomedes proxies
      '/kleomedes-rpc': {
        target: 'https://symphony-rpc.kleomedes.network',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/kleomedes-rpc/, ''),
      },
      '/kleomedes-rest': {
        target: 'https://symphony-api.kleomedes.network',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/kleomedes-rest/, ''),
      },

      // Nodes Hub proxies
      '/nodeshub-rpc': {
        target: 'https://symphony.test.rpc.nodeshub.online',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/nodeshub-rpc/, ''),
      },
      '/nodeshub-rest': {
        target: 'https://symphony.test.api.nodeshub.online',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/nodeshub-rest/, ''),
      },

      // Cogwheel proxies
      '/cogwheel-rpc': {
        target: 'https://symphony-testnet-rpc.cogwheel.zone',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/cogwheel-rpc/, ''),
      },
      '/cogwheel-rest': {
        target: 'https://symphony-testnet-api.cogwheel.zone',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/cogwheel-rest/, ''),
      },
    },
  },

  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        'injected-script': 'src/scripts/injected-script.ts',
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        format: 'esm', // ES module
      },
    },
  },

  preview: {
    open: false,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts', // optional
  },
});
