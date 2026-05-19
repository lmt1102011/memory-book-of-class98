import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    cssCodeSplit: true,
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-app': ['firebase/app'],
          'firebase-auth': ['firebase/auth'],
          'firebase-data': ['firebase/firestore/lite'],
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          webcam: ['react-webcam'],
        },
      },
    },
  },
});
