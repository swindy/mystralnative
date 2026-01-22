import { defineConfig } from 'vite';
import { resolve } from 'path';

// Bundle config for mystral native - creates a self-contained JS file
// that includes React and the Mystral engine
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'main.tsx'),
      name: 'MystralReactTest',
      formats: ['iife'],
      fileName: () => 'bundle.js'
    },
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      // Don't externalize anything - bundle it all
      external: [],
      output: {
        // Single file output
        inlineDynamicImports: true,
      }
    },
    // Target ES2020 for better compatibility
    target: 'es2020',
    minify: false, // Keep readable for debugging
    sourcemap: false,
  },
  resolve: {
    alias: {
      // Ensure single React instance by aliasing all react imports to the same path
      'react': resolve(__dirname, 'node_modules/react'),
      'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react-reconciler': resolve(__dirname, 'node_modules/react-reconciler'),
      'scheduler': resolve(__dirname, 'node_modules/scheduler'),
      '@mystral': resolve(__dirname, '../../../../src'),
      '@mystral/react': resolve(__dirname, '../../../../src/react'),
    },
    dedupe: ['react', 'react-reconciler', 'scheduler'],
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  optimizeDeps: {
    include: ['react', 'react-reconciler', 'scheduler'],
  }
});
