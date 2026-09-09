import type { MapDocument, ValidationMessage } from '../../assessment-schema/src/types'

export const validateMap = (map: MapDocument): ValidationMessage[] => {
  const messages: ValidationMessage[] = []
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const nodeById = new Map(map.nodes.map((node) => [node.id, node]))

  map.nodes.forEach((node) => {
    if (nodeIds.has(node.id)) messages.push({ id: `duplicate-node-${node.id}`, severity: 'error', message: `节点 ID 重复：${node.id}`, targetId: node.id })
    nodeIds.add(node.id)
    if (!node.metadata.title.trim()) messages.push({ id: `title-${node.id}`, severity: 'info', message: '节点名称尚未填写', targetId: node.id })
    if (!node.metadata.description.trim()) messages.push({ id: `description-${node.id}`, severity: 'info', message: '任务说明尚未填写', targetId: node.id })
    if (!node.metadata.completionCriteria.trim()) messages.push({ id: `criteria-${node.id}`, severity: 'info', message: '通关条件尚未填写', targetId: node.id })
    if (!node.sandboxRef.trim()) messages.push({ id: `sandbox-${node.id}`, severity: 'info', message: 'sandbox 引用尚未关联', targetId: node.id })
  })

  map.edges.forEach((edge) => {
    if (edgeIds.has(edge.id)) messages.push({ id: `duplicate-edge-${edge.id}`, severity: 'error', message: `连线 ID 重复：${edge.id}`, targetId: edge.id })
    edgeIds.add(edge.id)
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      messages.push({ id: `dangling-${edge.id}`, severity: 'error', message: '连线引用了不存在的节点', targetId: edge.id })
    }
    if (nodeById.get(edge.source)?.type === 'branch' && !edge.condition.trim()) {
      messages.push({ id: `branch-condition-${edge.id}`, severity: 'warning', message: '分支连线缺少条件描述', targetId: edge.id })
    }
  })

  const starts = map.nodes.filter((node) => node.type === 'start')
  const ends = map.nodes.filter((node) => node.type === 'end')
  if (!starts.length) messages.push({ id: 'missing-start', severity: 'error', message: '地图没有起点' })
  if (!ends.length) messages.push({ id: 'missing-end', severity: 'error', message: '地图没有终点' })

  const outgoing = new Map<string, string[]>()
  map.edges.forEach((edge) => outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge.target]))
  map.nodes.forEach((node) => {
    const targets = outgoing.get(node.id) || []
    if (node.type !== 'end' && nodeIds.has(node.id) && targets.length === 0) {
      messages.push({ id: `dead-end-${node.id}`, severity: 'warning', message: '非终点节点没有后继节点', targetId: node.id })
    }
    if (node.type === 'branch' && targets.length < 2) {
      messages.push({ id: `branch-outgoing-${node.id}`, severity: 'warning', message: '分支节点建议至少连接两条出边', targetId: node.id })
    }
  })

  if (starts.length) {
    const reachable = new Set<string>()
    const queue = starts.map((node) => node.id)
    while (queue.length) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      reachable.add(current)
      queue.push(...(outgoing.get(current) || []))
    }
    map.nodes.forEach((node) => {
      if (!reachable.has(node.id)) messages.push({ id: `unreachable-${node.id}`, severity: 'warning', message: '节点无法从起点到达', targetId: node.id })
    })
  }

  return messages
}
