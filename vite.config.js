import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// "npm run dev:phone" serves over https. Phones only allow the microphone on https or localhost,
// so testing recording from a phone on your Wi-Fi needs this.
// On GitHub Pages the app lives under /Gala-Studio/, not at the site root. The deploy sets BASE_PATH.
const base = process.env.BASE_PATH || '/'

export default defineConfig(({ mode }) => ({
  base,
  plugins: [
    mode === 'phone' && basicSsl(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/gala.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Gala Studio',
        short_name: 'Gala',
        id: base,
        lang: 'en',
        description: 'An offline-first music studio for young producers and artists.',
        theme_color: '#0c0c0e',
        background_color: '#0c0c0e',
        display: 'standalone',
        orientation: 'any',
        shortcuts: [
          { name: 'Record', url: `${base}record`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Timeline', url: `${base}timeline`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Piano', url: `${base}piano`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Drum pads', url: `${base}drums`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
        screenshots: [
          { src: 'screenshots/wide-home.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Gala Studio home' },
          { src: 'screenshots/wide-piano.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Piano' },
          { src: 'screenshots/narrow-home.png', sizes: '540x960', type: 'image/png', form_factor: 'narrow', label: 'Gala Studio home' },
          { src: 'screenshots/narrow-piano.png', sizes: '540x960', type: 'image/png', form_factor: 'narrow', label: 'Piano' },
        ],
        start_url: base,
        scope: base,
        categories: ['music', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the studio needs must be in the precache so it opens with no network.
        // Audio samples are added here as they land in later stages.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,mp3,wav,ogg,json}'],
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    maxWorkers: 2,
    pool: 'vmThreads',
  },
}))
