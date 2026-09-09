import { describe, expect, it } from 'vitest'
import { createEdge, createNode } from '@ncuscc/assessment-schema'
import { resolveCheckerEdges } from './routes'

describe('checker route integration', () => {
  it('maps checker status to existing edge triggers', () => {
    const start = createNode('task', { x: 0, y: 0 }, 'start')
    const success = createNode('end', { x: 100, y: 0 }, 'success')
    const failure = createNode('end', { x: 100, y: 100 }, 'failure')
    const map = { schemaVersion: '1.0.0' as const, meta: { id: 'm', name: 'm', description: '', version: 1 }, nodes: [start, success, failure], edges: [createEdge(start.id, success.id, 'ok'), { ...createEdge(start.id, failure.id, 'bad'), trigger: 'failure' as const }] }
    const result = { schemaVersion: 'checker-result.v1' as const, sessionId: 's', status: 'failed' as const, feedback: [], metrics: {}, artifacts: [], checkerVersion: 'c@1' }
    expect(resolveCheckerEdges(map, start.id, result).map((edge) => edge.id)).toEqual(['bad'])
  })
})
