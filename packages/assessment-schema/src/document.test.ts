import { describe, expect, it } from 'vitest'
import { createEdge, createNode, isMapDocument } from './document'

describe('assessment document helpers', () => {
  it('creates nodes and edges with stable prefixes', () => {
    const node = createNode('task', { x: 10, y: 20 })
    const edge = createEdge(node.id, 'node-end')

    expect(node.id).toMatch(/^node-/)
    expect(edge.id).toMatch(/^edge-/)
    expect(node.metadata.retryPolicy.enabled).toBe(true)
    expect(edge.trigger).toBe('success')
  })

  it('accepts a structurally valid map document', () => {
    const node = createNode('start', { x: 0, y: 0 }, 'node-start')
    const end = createNode('end', { x: 240, y: 0 }, 'node-end')
    const map = {
      schemaVersion: '1.0.0' as const,
      meta: { id: 'example', name: 'Example', description: '', version: 1 },
      nodes: [node, end],
      edges: [createEdge(node.id, end.id, 'edge-start-end')],
    }

    expect(isMapDocument(map)).toBe(true)
  })

  it('rejects malformed map documents', () => {
    expect(isMapDocument({ schemaVersion: '0.0.0', nodes: [], edges: [] })).toBe(false)
  })
})
