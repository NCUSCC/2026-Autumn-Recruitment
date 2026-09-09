import { describe, expect, it } from 'vitest'
import { createNode } from '../../assessment-schema/src/document'
import { validateMap } from './validation'

describe('map runtime validation', () => {
  it('requires start and end nodes', () => {
    const task = createNode('task', { x: 0, y: 0 }, 'node-task')
    const messages = validateMap({
      schemaVersion: '1.0.0',
      meta: { id: 'example', name: 'Example', description: '', version: 1 },
      nodes: [task],
      edges: [],
    })

    expect(messages.some((message) => message.id === 'missing-start' && message.severity === 'error')).toBe(true)
    expect(messages.some((message) => message.id === 'missing-end' && message.severity === 'error')).toBe(true)
  })
})
