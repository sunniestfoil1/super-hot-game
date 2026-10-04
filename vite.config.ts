import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      exclude: ['three'],
    },
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssMinify: 'esbuild',
      reportCompressedSize: false,
      rollupOptions: {
        external: ['three'],
        output: {
          paths: {
            'three': 'https://unpkg.com/three@0.160.0/build/three.module.js',
          },
        },
      },
    },
    server: {
      port: 3001,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
