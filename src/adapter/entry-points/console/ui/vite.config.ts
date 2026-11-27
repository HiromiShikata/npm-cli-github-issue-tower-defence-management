import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const MERMAID_FRAME_MODE = 'mermaid-frame';

export default defineConfig(({ mode }) => {
  const isMermaidFrameBuild = mode === MERMAID_FRAME_MODE;
  return {
    root: path.resolve(__dirname),
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: path.resolve(__dirname, '../ui-dist'),
      emptyOutDir: !isMermaidFrameBuild,
      rollupOptions: {
        input: isMermaidFrameBuild
          ? { 'mermaid-frame': path.resolve(__dirname, 'mermaid-frame.html') }
          : { index: path.resolve(__dirname, 'index.html') },
        output: {
          codeSplitting: false,
          entryFileNames: isMermaidFrameBuild
            ? 'assets/mermaid-frame.js'
            : 'assets/[name]-[hash].js',
        },
      },
    },
  };
});
