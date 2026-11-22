import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

/**
 * Content-Security-Policy for the packaged app only (the dev server needs inline
 * scripts for React Fast Refresh). Inline style attributes are used throughout the UI,
 * images can be data:/blob: URLs (screenshots, inserted pictures).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const cspPlugin = (): Plugin => ({
  name: 'malipen-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  build: {
    // Embed the About mark as a data URL: CSS masks loaded from file:// fail CORS in the packaged app
    assetsInlineLimit: (file: string) => (file.endsWith('malipen_mark.png') ? true : undefined),
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    cspPlugin(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    renderer()
  ],
})
