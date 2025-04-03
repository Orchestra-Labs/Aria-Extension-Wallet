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
    },
  },
  plugins: [viteTsconfigPaths()],
  publicDir: 'public',
  build: {
    emptyOutDir: false, // Don't clear dist folder
    rollupOptions: {
      input: 'src/scripts/background-script.ts',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        format: 'iife', // iife is for browser compatibility
      },
    },
  },
});
