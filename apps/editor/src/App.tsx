import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyEdgeChanges, applyNodeChanges, type Connection, type Edge, type EdgeChange, type Node, type NodeChange, useReactFlow } from '@xyflow/react'
import { EditorCanvas } from './components/EditorCanvas'
import { NodePalette } from './components/NodePalette'
import { PropertiesPanel } from './components/PropertiesPanel'
import { Toolbar } from './components/Toolbar'
import { ValidationPanel } from './components/ValidationPanel'
import { createEdge, createNode, isMapDocument, type MapDocument, type MapEdge, type MapNode, type NodeType, type Selection, type ValidationMessage } from '@ncuscc/assessment-schema'
import { validateMap } from '@ncuscc/map-runtime'
import { fromFlowEdges, fromFlowNodes, toFlowEdges, toFlowNodes } from './lib/map'

const STORAGE_KEY = 'ncuscc-recruitment-assessment:draft'

const emptyMap = (): MapDocument => ({
  schemaVersion: '1.0.0',
  meta: { id: 'ncuscc-recruitment-map', name: 'NCUSCC 招新考核示例地图', description: '', version: 1 },
  nodes: [],
  edges: [],
})

function App() {
  const [map, setMap] = useState<MapDocument>(() => loadDraft() || emptyMap())
  const [selection, setSelection] = useState<Selection>(null)
  const [dirty, setDirty] = useState(false)
  const [messages, setMessages] = useState<ValidationMessage[]>(() => validateMap(loadDraft() || emptyMap()))
  const [toast, setToast] = useState('')
  const flow = useReactFlow()
  const toastTimer = useRef<number | undefined>(undefined)

  const flowNodes = useMemo(() => toFlowNodes(map.nodes).map((node) => ({
    ...node,
    selected: selection?.kind === 'node' && selection.id === node.id,
  })), [map.nodes, selection])
  const flowEdges = useMemo(() => toFlowEdges(map.edges).map((edge) => ({
    ...edge,
    selected: selection?.kind === 'edge' && selection.id === edge.id,
  })), [map.edges, selection])
  const selectedNode = selection?.kind === 'node' ? map.nodes.find((node) => node.id === selection.id) : undefined
  const selectedEdge = selection?.kind === 'edge' ? map.edges.find((edge) => edge.id === selection.id) : undefined

  const announce = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }, [])

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current) }, [])

  const updateMap = useCallback((updater: (current: MapDocument) => MapDocument) => {
    setMap((current) => updater(current))
    setDirty(true)
  }, [])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.every((change) => change.type === 'select')) return
    updateMap((current) => {
      const nextFlowNodes = applyNodeChanges(changes, toFlowNodes(current.nodes))
      return { ...current, nodes: fromFlowNodes(nextFlowNodes, current.nodes) }
    })
  }, [updateMap])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.every((change) => change.type === 'select')) return
    updateMap((current) => {
      const nextFlowEdges = applyEdgeChanges(changes, toFlowEdges(current.edges))
      return { ...current, edges: fromFlowEdges(nextFlowEdges, current.edges) }
    })
  }, [updateMap])

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    updateMap((current) => {
      if (current.edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) return current
      const edge = createEdge(connection.source, connection.target)
      return { ...current, edges: [...current.edges, edge] }
    })
  }, [updateMap])

  const createCanvasNode = useCallback((type: NodeType, position?: { x: number; y: number }) => {
    const offset = map.nodes.length * 28
    const node = createNode(type, position || { x: 120 + offset, y: 100 + offset })
    updateMap((current) => ({ ...current, nodes: [...current.nodes, node] }))
    setSelection({ kind: 'node', id: node.id })
  }, [map.nodes.length, updateMap])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/map-node-type') as NodeType
    if (!type) return
    createCanvasNode(type, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }, [createCanvasNode, flow])

  const updateNode = useCallback((patch: Partial<MapNode>) => {
    if (!selectedNode) return
    updateMap((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNode.id ? { ...node, ...patch } : node) }))
  }, [selectedNode, updateMap])

  const updateMetadata = useCallback((patch: Partial<MapNode['metadata']>) => {
    if (!selectedNode) return
    updateMap((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedNode.id ? { ...node, metadata: { ...node.metadata, ...patch } } : node) }))
  }, [selectedNode, updateMap])

  const updateEdge = useCallback((patch: Partial<MapEdge>) => {
    if (!selectedEdge) return
    updateMap((current) => ({ ...current, edges: current.edges.map((edge) => edge.id === selectedEdge.id ? { ...edge, ...patch } : edge) }))
  }, [selectedEdge, updateMap])

  const deleteSelection = useCallback(() => {
    if (!selection) return
    updateMap((current) => selection.kind === 'node'
      ? { ...current, nodes: current.nodes.filter((node) => node.id !== selection.id), edges: current.edges.filter((edge) => edge.source !== selection.id && edge.target !== selection.id) }
      : { ...current, edges: current.edges.filter((edge) => edge.id !== selection.id) })
    setSelection(null)
  }, [selection, updateMap])

  const handleSelectionChange = useCallback(({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
    if (nodes[0]) setSelection({ kind: 'node', id: nodes[0].id })
    else if (edges[0]) setSelection({ kind: 'edge', id: edges[0].id })
    else setSelection(null)
  }, [])

  const handleValidate = useCallback(() => {
    const result = validateMap(map)
    setMessages(result)
    announce(result.filter((message) => message.severity === 'error').length ? '校验完成：发现结构错误' : '校验完成')
  }, [announce, map])

  const handleSave = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map, null, 2))
    setDirty(false)
    announce('草稿已保存到本地浏览器')
  }, [announce, map])

  const handleNew = useCallback(() => {
    if (map.nodes.length && !window.confirm('新建地图会清空当前编辑内容，是否继续？')) return
    setMap(emptyMap())
    setMessages(validateMap(emptyMap()))
    setSelection(null)
    setDirty(false)
    announce('已创建空白地图')
  }, [announce, map.nodes.length])

  const handleExport = useCallback(() => {
    const payload = JSON.stringify(map, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${map.meta.id || 'recruitment-map'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    announce('地图 JSON 已导出')
  }, [announce, map])

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result))
        if (!isMapDocument(parsed)) throw new Error('文件缺少 1.0.0 地图结构')
        setMap(parsed)
        setMessages(validateMap(parsed))
        setSelection(null)
        setDirty(false)
        announce(`已导入 ${file.name}`)
      } catch (error) {
        announce(error instanceof Error ? `导入失败：${error.message}` : '导入失败：JSON 格式不可读')
      }
    }
    reader.readAsText(file)
  }, [announce])

  const locateMessage = useCallback((message: ValidationMessage) => {
    if (!message.targetId) return
    const node = map.nodes.find((item) => item.id === message.targetId)
    const edge = map.edges.find((item) => item.id === message.targetId)
    if (node) { setSelection({ kind: 'node', id: node.id }); flow.setCenter(node.position.x + 100, node.position.y + 60, { zoom: 1.1, duration: 300 }) }
    else if (edge) setSelection({ kind: 'edge', id: edge.id })
  }, [flow, map.edges, map.nodes])

  return <div className="app-shell"><Toolbar mapName={map.meta.name} dirty={dirty} onMapNameChange={(name) => updateMap((current) => ({ ...current, meta: { ...current.meta, name } }))} onNew={handleNew} onSave={handleSave} onValidate={handleValidate} onExport={handleExport} onImport={handleImport} onFitView={() => flow.fitView({ padding: 0.2, duration: 300 })} /><div className="workspace"><NodePalette onCreate={createCanvasNode} /><EditorCanvas mapName={map.meta.name} nodes={flowNodes} edges={flowEdges} onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange} onConnect={handleConnect} onSelectionChange={handleSelectionChange} onDrop={handleDrop} onDragOver={(event) => event.preventDefault()} onInit={() => undefined} /><PropertiesPanel node={selectedNode} edge={selectedEdge} onUpdateNode={updateNode} onUpdateMetadata={updateMetadata} onUpdateEdge={updateEdge} onDelete={deleteSelection} onClear={() => setSelection(null)} flowNodes={flowNodes} /></div><ValidationPanel messages={messages} onLocate={locateMessage} />{toast && <div className="toast" role="status">{toast}</div>}</div>
}

function loadDraft(): MapDocument | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null
    const parsed: unknown = JSON.parse(saved)
    return isMapDocument(parsed) ? parsed : null
  } catch { return null }
}

export default App
