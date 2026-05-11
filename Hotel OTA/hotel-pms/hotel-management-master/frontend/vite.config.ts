import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // TECH-005: Proper vendor isolation for caching and parallel loading
        // Uses function form to properly categorize by path
        manualChunks: (id) => {
          // React core — rarely changes, cache forever
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // React Router
          if (id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // MUI — heaviest dependency, cache separately
          if (id.includes('node_modules/@mui/')) {
            return 'vendor-mui';
          }
          // Radix UI
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          // Recharts + d3
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          // State management
          if (id.includes('node_modules/zustand') || id.includes('node_modules/@tanstack/')) {
            return 'vendor-state';
          }
          // Forms
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/zod')) {
            return 'vendor-forms';
          }
          // Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date';
          }
          // Framer Motion
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-animation';
          }
        },
        // Deterministic chunk names
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      }
    },

    // TECH-005: Reduced chunk size warning limit
    chunkSizeWarningLimit: 250, // 250KB — stricter than 600KB

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        // Always drop console in production builds
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        // Drop unused code
        unused: true,
        dead_code: true,
      },
      mangle: {
        safari10: true,
      },
    },

    // Report compressed sizes
    reportCompressedSize: true,

    // Source maps (disable in production)
    sourcemap: process.env.NODE_ENV !== 'production',
  },

  // Optimize deps
  optimizeDeps: {
    // Pre-bundle common dependencies
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'zustand',
      'axios',
      '@mui/material',
      'date-fns',
    ],
    // Exclude heavy deps from pre-bundling (load on demand)
    exclude: [
      '@mui/x-data-grid',
      'recharts',
      'framer-motion',
    ],
  },
})
