import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: resolve(repositoryRoot, 'apps/editor'),
  plugins: [react()],
  resolve: {
    alias: {
      '@ncuscc/assessment-schema': resolve(repositoryRoot, 'packages/assessment-schema/src'),
      '@ncuscc/map-runtime': resolve(repositoryRoot, 'packages/map-runtime/src'),
      '@ncuscc/sandbox-contracts': resolve(repositoryRoot, 'packages/sandbox-contracts/src'),
    },
  },
  build: {
    outDir: resolve(repositoryRoot, 'dist'),
    emptyOutDir: true,
  },
})
