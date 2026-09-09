import type { Edge, Node } from '@xyflow/react'
import type { EdgeTrigger, MapDocument, MapEdge, MapNode, NodeMetadata, NodeType } from '../types'

export const nodeTypeLabels: Record<NodeType, string> = {
  start: '起点',
  task: '任务',
  branch: '分支',
  checkpoint: '检查点',
  end: '终点',
}

export const edgeTriggerLabels: Record<EdgeTrigger, string> = {
  success: '完成后',
  failure: '失败后',
  skip: '跳过后',
  manual: '人工选择',
}

export const defaultMetadata = (): NodeMetadata => ({
  title: '',
  directionTags: [],
  description: '',
  hints: [],
  completionCriteria: '',
  retryPolicy: { enabled: true, maxAttempts: null, note: '' },
})

export const createNode = (type: NodeType, position: { x: number; y: number }, id = `node-${crypto.randomUUID()}`): MapNode => ({
  id,
  type,
  metadata: defaultMetadata(),
  sandboxRef: '',
  position,
})

export const createEdge = (source: string, target: string, id = `edge-${crypto.randomUUID()}`): MapEdge => ({
  id,
  source,
  target,
  trigger: 'success',
  condition: '',
  label: '',
})

export const toFlowNodes = (nodes: MapNode[]): Node[] => nodes.map((node) => ({
  id: node.id,
  type: node.type,
  position: node.position,
  data: { ...node.metadata, sandboxRef: node.sandboxRef },
}))

export const toFlowEdges = (edges: MapEdge[]): Edge[] => edges.map((edge) => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  type: 'smoothstep',
  label: edge.label || undefined,
  data: { trigger: edge.trigger, condition: edge.condition },
  animated: edge.trigger === 'manual',
}))

export const fromFlowNodes = (nodes: Node[], existing: MapNode[]): MapNode[] => nodes.map((flowNode) => {
  const original = existing.find((node) => node.id === flowNode.id)
  const data = flowNode.data as Partial<NodeMetadata> & { sandboxRef?: string }
  const { sandboxRef, title, directionTags, description, hints, completionCriteria, retryPolicy } = data
  return {
    id: flowNode.id,
    type: (flowNode.type as NodeType) || original?.type || 'task',
    metadata: {
      ...defaultMetadata(),
      ...(original?.metadata || {}),
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(completionCriteria !== undefined ? { completionCriteria } : {}),
      ...(Array.isArray(directionTags) ? { directionTags } : {}),
      ...(Array.isArray(hints) ? { hints } : {}),
      ...(retryPolicy ? { retryPolicy } : {}),
    },
    sandboxRef: sandboxRef !== undefined ? sandboxRef : original?.sandboxRef || '',
    position: flowNode.position,
  }
})

export const fromFlowEdges = (edges: Edge[], existing: MapEdge[]): MapEdge[] => edges.map((flowEdge) => {
  const original = existing.find((edge) => edge.id === flowEdge.id)
  const data = flowEdge.data as { trigger?: EdgeTrigger; condition?: string } | undefined
  return {
    id: flowEdge.id,
    source: flowEdge.source,
    target: flowEdge.target,
    trigger: data?.trigger || original?.trigger || 'success',
    condition: data?.condition !== undefined ? data.condition : original?.condition || '',
    label: typeof flowEdge.label === 'string' ? flowEdge.label : original?.label || '',
  }
})

export const cloneDocument = (document: MapDocument): MapDocument => JSON.parse(JSON.stringify(document)) as MapDocument

export const isMapDocument = (value: unknown): value is MapDocument => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MapDocument>
  if (candidate.schemaVersion !== '1.0.0' || !candidate.meta || typeof candidate.meta !== 'object') return false
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) return false
  if (typeof candidate.meta.id !== 'string' || typeof candidate.meta.name !== 'string') return false
  return candidate.nodes.every((node) => {
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
  }) && candidate.edges.every((edge) => {
    if (!edge || typeof edge !== 'object') return false
    const item = edge as Partial<MapEdge>
    return typeof item.id === 'string'
      && typeof item.source === 'string'
      && typeof item.target === 'string'
      && ['success', 'failure', 'skip', 'manual'].includes(String(item.trigger))
      && typeof item.condition === 'string'
      && typeof item.label === 'string'
  })
}
