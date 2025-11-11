import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // Suppress noisy Rollup warning when a manualChunks target ends up empty after tree-shaking
        if (warning.code === 'EMPTY_BUNDLE') return;
        defaultHandler(warning);
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          const parts = id.split('node_modules/')[1];
          if (!parts) return 'vendor';
          const slice = parts.startsWith('@')
            ? parts.split('/').slice(0, 2).join('/')
            : parts.split('/')[0];
          // Normalize chunk name (replace @ and /)
          const name = slice.replace('@', '').replace('/', '-');
          return `vendor-${name}`;
        },
        chunkFileNames: (chunkInfo) => {
          return chunkInfo.name && chunkInfo.name.startsWith('vendor-')
            ? 'assets/[name]-[hash].js'
            : 'assets/[name]-[hash].js';
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
