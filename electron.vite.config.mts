import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Strict CSP for production; dev needs inline scripts + websocket for Vite HMR / React refresh.
const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "font-src 'self' data:; connect-src 'self' ws: http://localhost:*; object-src 'none'"

function cspPlugin(): Plugin {
  let isBuild = false
  return {
    name: 'paladex-csp',
    configResolved(cfg) {
      isBuild = cfg.command === 'build'
    },
    transformIndexHtml(html) {
      return html.replace('%CSP%', isBuild ? PROD_CSP : DEV_CSP)
    }
  }
}

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } } }
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } },
    // Sandboxed preloads must be a single CommonJS file.
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } } }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared'), '@data': resolve('data'), '@': resolve('src/renderer') } },
    plugins: [react(), cspPlugin()],
    // electron-vite leaves the renderer readable by default; minify explicitly and keep source maps out of the app.
    build: { minify: 'oxc', sourcemap: false }
  }
})
