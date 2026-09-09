import type { Edge, Node } from '@xyflow/react'
import {
  defaultMetadata,
  type EdgeTrigger,
  type MapEdge,
  type MapNode,
  type NodeMetadata,
  type NodeType,
} from '@ncuscc/assessment-schema'

export { cloneDocument, createEdge, createNode, defaultMetadata, isMapDocument } from '@ncuscc/assessment-schema'

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
