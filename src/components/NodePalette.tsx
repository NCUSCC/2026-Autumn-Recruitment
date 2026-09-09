import { Box, Flag, GitBranch, Milestone, Play, Plus } from 'lucide-react'
import type { NodeType } from '../types'
import { nodeTypeLabels } from '../lib/map'

const palette: Array<{ type: NodeType; icon: typeof Plus; note: string }> = [
  { type: 'start', icon: Play, note: '地图入口' },
  { type: 'task', icon: Box, note: '普通关卡' },
  { type: 'branch', icon: GitBranch, note: '路线分支' },
  { type: 'checkpoint', icon: Milestone, note: '阶段检查' },
  { type: 'end', icon: Flag, note: '地图出口' },
]

export function NodePalette({ onCreate }: { onCreate: (type: NodeType) => void }) {
  return (
    <aside className="panel palette-panel">
      <div className="panel-kicker">NODE LIBRARY</div>
      <div className="panel-title-row">
        <h2>节点库</h2>
        <span className="count-pill">{palette.length}</span>
      </div>
      <p className="panel-intro">拖入或点击创建空白节点，具体关卡内容稍后补充。</p>
      <div className="palette-list">
        {palette.map(({ type, icon: Icon, note }) => (
          <button className={`palette-item palette-${type}`} key={type} draggable onDragStart={(event) => event.dataTransfer.setData('application/map-node-type', type)} onClick={() => onCreate(type)}>
            <span className="palette-icon"><Icon size={16} /></span>
            <span className="palette-copy"><strong>{nodeTypeLabels[type]}</strong><small>{note}</small></span>
            <Plus className="palette-add" size={15} />
          </button>
        ))}
      </div>
      <div className="catalog-placeholder">
        <div className="section-label">分类目录</div>
        <div className="empty-catalog"><span>还没有阶段或方向分类</span><button type="button" onClick={() => onCreate('task')}>创建节点</button></div>
      </div>
    </aside>
  )
}
