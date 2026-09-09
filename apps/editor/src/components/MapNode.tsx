import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CircleDot, Flag, GitBranch, Milestone, Play, Sparkles } from 'lucide-react'
import type { NodeType } from '@ncuscc/assessment-schema'
import { nodeTypeLabels } from '../lib/map'

const icons = { start: Play, task: Sparkles, branch: GitBranch, checkpoint: Milestone, end: Flag }

export function MapNode({ data, selected, type }: NodeProps) {
  const nodeType = (type || 'task') as NodeType
  const Icon = icons[nodeType] || CircleDot
  const nodeData = data as { title?: string; directionTags?: string[]; description?: string; completionCriteria?: string }
  const title = nodeData.title?.trim() || '待命名节点'
  const tags = nodeData.directionTags || []
  const incomplete = !nodeData.description?.trim() || !nodeData.completionCriteria?.trim()

  return (
    <div className={`map-node map-node-${nodeType} ${selected ? 'is-selected' : ''}`}>
      {nodeType !== 'start' && <Handle type="target" position={Position.Left} />}
      <div className="map-node-header">
        <span className="node-icon"><Icon size={14} strokeWidth={2.2} /></span>
        <span className="node-type">{nodeTypeLabels[nodeType]}</span>
        {incomplete && <span className="node-status">待补充</span>}
      </div>
      <div className="map-node-title">{title}</div>
      {tags.length > 0 && <div className="map-node-tags">{tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>}
      <div className="map-node-footer">{nodeData.description?.trim() ? '已有任务说明' : '尚未填写任务说明'}</div>
      {nodeType !== 'end' && <Handle type="source" position={Position.Right} />}
    </div>
  )
}
