import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)

// Jeder Build bekommt eine eigene Kennung (1.0.0+260727-0912). Das Update-Modal
// zeigt sie an, damit man am Handy sieht, ob die neue Version wirklich drauf ist.
const buildId = `${pkg.version}+${new Date()
  .toISOString()
  .slice(2, 16)
  .replace(/-/g, '')
  .replace('T', '-')
  .replace(':', '')}`

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildId)
  },
  server : {
    host: true
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' statt 'autoUpdate': der neue Service Worker wartet, bis der
      // Spieler im Modal zustimmt. Ein automatischer Reload würde sonst mitten
      // im Spiel den laufenden Block wegreißen.
      registerType: 'prompt',
      // Kein automatisch injiziertes registerSW.js — wir registrieren selbst in
      // components/UpdatePrompt.jsx, weil wir regelmäßig nachfragen müssen.
      injectRegister: null,
      includeAssets: ['favicon.png', 'icons/*.png'],
      manifest: {
        name: 'Kniffel Block',
        short_name: 'Kniffel',
        description: 'Kniffel Score Tracker',
        lang: 'de',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: 'icons/Icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/Icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/Icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/Icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Vorsichtsmaßnahme: /_vercel/* sind die Analytics-Endpunkte, /api/* die
        // eigene Serverless Function. Der Fallback greift zwar nur bei
        // Navigationen und beides sind Script- bzw. Fetch-Requests — die Zeilen
        // kosten aber nichts.
        navigateFallbackDenylist: [/^\/_vercel\//, /^\/api\//],
        // Der wartende SW übernimmt erst auf Knopfdruck im Modal.
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true
      }
    })
  ]
})
