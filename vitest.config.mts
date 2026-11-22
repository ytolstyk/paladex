import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared'), '@data': resolve('data'), '@': resolve('src/renderer') } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] }
})
