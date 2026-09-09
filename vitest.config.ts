import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname)

export default defineConfig({
  resolve: {
    alias: {
      '@ncuscc/assessment-schema': resolve(repositoryRoot, 'packages/assessment-schema/src'),
      '@ncuscc/map-runtime': resolve(repositoryRoot, 'packages/map-runtime/src'),
      '@ncuscc/sandbox-contracts': resolve(repositoryRoot, 'packages/sandbox-contracts/src'),
      '@ncuscc/infrastructure': resolve(repositoryRoot, 'packages/infrastructure/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
  },
})
