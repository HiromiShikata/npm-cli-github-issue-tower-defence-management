import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { toClassicMermaidFrameHtml } from './src/features/console/lib/mermaidFrameClassicScript';

const MERMAID_FRAME_MODE = 'mermaid-frame';

const classicMermaidFrameScript = {
  name: 'classic-mermaid-frame-script',
  apply: 'build' as const,
  transformIndexHtml: {
    order: 'post' as const,
    handler: toClassicMermaidFrameHtml,
  },
};

export default defineConfig(({ mode }) => {
  const isMermaidFrameBuild = mode === MERMAID_FRAME_MODE;
  return {
    root: path.resolve(__dirname),
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      ...(isMermaidFrameBuild ? [classicMermaidFrameScript] : []),
    ],
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
          format: isMermaidFrameBuild ? 'iife' : 'es',
          entryFileNames: isMermaidFrameBuild
            ? 'assets/mermaid-frame.js'
            : 'assets/[name]-[hash].js',
        },
      },
    },
  };
});
