import type {
  EdgeTrigger,
  MapDocument,
  MapEdge,
  MapNode,
  NodeMetadata,
  NodeType,
} from './types'

const randomId = (prefix: string): string => {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `${prefix}-${uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`
}

export const defaultMetadata = (): NodeMetadata => ({
  title: '',
  directionTags: [],
  description: '',
  hints: [],
  completionCriteria: '',
  retryPolicy: { enabled: true, maxAttempts: null, note: '' },
})

export const createNode = (
  type: NodeType,
  position: { x: number; y: number },
  id = randomId('node'),
): MapNode => ({
  id,
  type,
  metadata: defaultMetadata(),
  sandboxRef: '',
  position,
})

export const createEdge = (source: string, target: string, id = randomId('edge')): MapEdge => ({
  id,
  source,
  target,
  trigger: 'success',
  condition: '',
  label: '',
})

export const cloneDocument = (document: MapDocument): MapDocument => JSON.parse(JSON.stringify(document)) as MapDocument

export const isMapDocument = (value: unknown): value is MapDocument => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MapDocument>
  if (candidate.schemaVersion !== '1.0.0' || !candidate.meta || typeof candidate.meta !== 'object') return false
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) return false
  if (typeof candidate.meta.id !== 'string' || typeof candidate.meta.name !== 'string') return false

  const validNodes = candidate.nodes.every((node) => {
    if (!node || typeof node !== 'object') return false
    const item = node as Partial<MapNode>
    return typeof item.id === 'string'
      && ['start', 'task', 'branch', 'checkpoint', 'end'].includes(String(item.type))
      && !!item.metadata
      && typeof item.metadata === 'object'
      && Array.isArray(item.metadata.directionTags)
      && Array.isArray(item.metadata.hints)
      && !!item.metadata.retryPolicy
      && typeof item.sandboxRef === 'string'
      && !!item.position
      && typeof item.position.x === 'number'
      && typeof item.position.y === 'number'
  })

  const validEdges = candidate.edges.every((edge) => {
    if (!edge || typeof edge !== 'object') return false
    const item = edge as Partial<MapEdge>
    return typeof item.id === 'string'
      && typeof item.source === 'string'
      && typeof item.target === 'string'
      && ['success', 'failure', 'skip', 'manual'].includes(String(item.trigger as EdgeTrigger))
      && typeof item.condition === 'string'
      && typeof item.label === 'string'
  })

  return validNodes && validEdges
}
