/* eslint-env node */
import process from 'node:process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.includes('node_modules')) {
            if (normalizedId.includes('recharts') || normalizedId.includes('react-simple-maps')) {
              return 'vendor-visuals';
            }

            if (
              normalizedId.includes('/react/') ||
              normalizedId.includes('/react-dom/') ||
              normalizedId.includes('/react-router-dom/')
            ) {
              return 'vendor-react';
            }

            if (
              normalizedId.includes('@reduxjs') ||
              normalizedId.includes('/react-redux/') ||
              normalizedId.includes('/redux-persist/')
            ) {
              return 'vendor-state';
            }

            if (
              normalizedId.includes('/react-hook-form/') ||
              normalizedId.includes('/yup/') ||
              normalizedId.includes('@hookform')
            ) {
              return 'vendor-forms';
            }

            return 'vendor-misc';
          }

          if (normalizedId.includes('/src/pages/dashboards/')) {
            return 'dashboard-pages';
          }

          if (normalizedId.includes('/src/pages/marketplace/')) {
            return 'marketplace-pages';
          }

          if (normalizedId.includes('/src/pages/gyms/')) {
            return 'gym-pages';
          }

          if (normalizedId.includes('/src/pages/landing/')) {
            return 'landing-page';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
