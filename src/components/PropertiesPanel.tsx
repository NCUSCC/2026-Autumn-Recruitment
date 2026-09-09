import { Plus, Trash2, X } from 'lucide-react'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeTrigger, MapEdge, MapNode, NodeType } from '../types'
import { edgeTriggerLabels, nodeTypeLabels } from '../lib/map'

interface PropertiesPanelProps {
  node?: MapNode
  edge?: MapEdge
  onUpdateNode: (patch: Partial<MapNode>) => void
  onUpdateMetadata: (patch: Partial<MapNode['metadata']>) => void
  onUpdateEdge: (patch: Partial<MapEdge>) => void
  onDelete: () => void
  onClear: () => void
  flowNodes: Node[]
}

const typeOptions: NodeType[] = ['start', 'task', 'branch', 'checkpoint', 'end']
const triggerOptions: EdgeTrigger[] = ['success', 'failure', 'skip', 'manual']

export function PropertiesPanel({ node, edge, onUpdateNode, onUpdateMetadata, onUpdateEdge, onDelete, onClear, flowNodes }: PropertiesPanelProps) {
  return (
    <aside className="panel properties-panel">
      <div className="panel-kicker">INSPECTOR</div>
      <div className="panel-title-row"><h2>属性</h2>{(node || edge) && <button className="close-button" title="取消选择" onClick={onClear}><X size={16} /></button>}</div>
      {!node && !edge && <div className="inspector-empty"><div className="empty-inspector-icon">◌</div><strong>选择一个对象</strong><span>节点用于承载关卡元数据，连线用于描述路线转移。</span></div>}
      {node && <NodeInspector node={node} onUpdateNode={onUpdateNode} onUpdateMetadata={onUpdateMetadata} onDelete={onDelete} />}
      {edge && <EdgeInspector edge={edge} nodes={flowNodes} onUpdate={onUpdateEdge} onDelete={onDelete} />}
    </aside>
  )
}

function NodeInspector({ node, onUpdateNode, onUpdateMetadata, onDelete }: Pick<PropertiesPanelProps, 'node' | 'onUpdateNode' | 'onUpdateMetadata' | 'onDelete'> & { node: MapNode }) {
  const metadata = node.metadata
  const setHint = (index: number, value: string) => onUpdateMetadata({ hints: metadata.hints.map((hint, hintIndex) => hintIndex === index ? value : hint) })
  return (
    <div className="inspector-content">
      <div className="selected-object"><span className={`object-dot object-${node.type}`} /><div><strong>{nodeTypeLabels[node.type]}</strong><small>{node.id}</small></div><button className="delete-button" title="删除节点" onClick={onDelete}><Trash2 size={15} /></button></div>
      <label className="field"><span>节点类型</span><select value={node.type} onChange={(event) => onUpdateNode({ type: event.target.value as NodeType })}>{typeOptions.map((type) => <option key={type} value={type}>{nodeTypeLabels[type]}</option>)}</select></label>
      <label className="field"><span>显示名称</span><input value={metadata.title} placeholder="待命名节点" onChange={(event) => onUpdateMetadata({ title: event.target.value })} /></label>
      <label className="field"><span>方向标签</span><input value={metadata.directionTags.join(', ')} placeholder="例如：AI Infra，传统 HPC" onChange={(event) => onUpdateMetadata({ directionTags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} /></label>
      <label className="field"><span>任务说明</span><textarea rows={5} value={metadata.description} placeholder="先留空，后续由出题负责人补充。" onChange={(event) => onUpdateMetadata({ description: event.target.value })} /></label>
      <div className="field"><span>提示</span><div className="repeat-list">{metadata.hints.map((hint, index) => <div className="repeat-row" key={`${index}-${hint}`}><input value={hint} placeholder={`提示 ${index + 1}`} onChange={(event) => setHint(index, event.target.value)} /><button type="button" title="删除提示" onClick={() => onUpdateMetadata({ hints: metadata.hints.filter((_, hintIndex) => hintIndex !== index) })}><Trash2 size={13} /></button></div>)}<button type="button" className="add-row" onClick={() => onUpdateMetadata({ hints: [...metadata.hints, ''] })}><Plus size={14} />添加提示</button></div></div>
      <label className="field"><span>通关条件</span><textarea rows={4} value={metadata.completionCriteria} placeholder="描述完成此节点所需满足的条件。" onChange={(event) => onUpdateMetadata({ completionCriteria: event.target.value })} /></label>
      <div className="field"><span>重试配置</span><div className="retry-box"><label className="toggle-row"><input type="checkbox" checked={metadata.retryPolicy.enabled} onChange={(event) => onUpdateMetadata({ retryPolicy: { ...metadata.retryPolicy, enabled: event.target.checked } })} /><span>允许重试</span></label><label className="mini-field"><span>最多次数</span><input type="number" min={1} placeholder="不限" value={metadata.retryPolicy.maxAttempts ?? ''} onChange={(event) => onUpdateMetadata({ retryPolicy: { ...metadata.retryPolicy, maxAttempts: event.target.value ? Number(event.target.value) : null } })} /></label></div></div>
      <label className="field"><span>sandbox 引用</span><input value={node.sandboxRef} placeholder="预留：节点资源路径或标识" onChange={(event) => onUpdateNode({ sandboxRef: event.target.value })} /></label>
    </div>
  )
}

function EdgeInspector({ edge, nodes, onUpdate, onDelete }: { edge: MapEdge; nodes: Node[]; onUpdate: (patch: Partial<MapEdge>) => void; onDelete: () => void }) {
  const source = String((nodes.find((node) => node.id === edge.source)?.data as { title?: string } | undefined)?.title || edge.source)
  const target = String((nodes.find((node) => node.id === edge.target)?.data as { title?: string } | undefined)?.title || edge.target)
  return <div className="inspector-content"><div className="selected-object"><span className="object-dot object-edge" /><div><strong>路线连线</strong><small>{source} → {target}</small></div><button className="delete-button" title="删除连线" onClick={onDelete}><Trash2 size={15} /></button></div><label className="field"><span>触发方式</span><select value={edge.trigger} onChange={(event) => onUpdate({ trigger: event.target.value as EdgeTrigger })}>{triggerOptions.map((trigger) => <option key={trigger} value={trigger}>{edgeTriggerLabels[trigger]}</option>)}</select></label><label className="field"><span>条件描述</span><textarea rows={4} value={edge.condition} placeholder="分支或人工转移时填写可读条件。" onChange={(event) => onUpdate({ condition: event.target.value })} /></label><label className="field"><span>画布标签</span><input value={edge.label} placeholder="可选，例如：完成后进入" onChange={(event) => onUpdate({ label: event.target.value })} /></label></div>
}
