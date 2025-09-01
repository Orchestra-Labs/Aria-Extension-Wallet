import inject from '@rollup/plugin-inject';
import path from 'path';
import { defineConfig } from 'vite';
import viteTsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    global: 'window',
    'process.env': {},
    'process.version': '"18.0.0"',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [viteTsconfigPaths()],
  publicDir: 'public',
  build: {
    emptyOutDir: false, // Don't clear dist folder
    rollupOptions: {
      input: 'src/scripts/content-script.ts',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        format: 'iife', // iife is for browser compatibility
      },
      plugins: [
        inject({
          process: 'process/browser',
        }),
      ],
    },
  },
});
