import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type Connection, type Edge, type Node } from '@xyflow/react'
import type { DragEvent } from 'react'
import { MapNode } from './MapNode'

const nodeTypes = { start: MapNode, task: MapNode, branch: MapNode, checkpoint: MapNode, end: MapNode }

interface EditorCanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: Parameters<NonNullable<React.ComponentProps<typeof ReactFlow>['onNodesChange']>>[0]) => void
  onEdgesChange: (changes: Parameters<NonNullable<React.ComponentProps<typeof ReactFlow>['onEdgesChange']>>[0]) => void
  onConnect: (connection: Connection) => void
  onSelectionChange: (selection: { nodes: Node[]; edges: Edge[] }) => void
  mapName: string
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onInit: (instance: { fitView: () => void }) => void
}

export function EditorCanvas(props: EditorCanvasProps) {
  return (
    <main className="canvas-shell" onDrop={props.onDrop} onDragOver={props.onDragOver}>
      <div className="canvas-header"><div><span className="eyebrow">CANVAS / ROUTE DESIGN</span><h1>{props.mapName || '未命名招新地图'}</h1></div><span className="canvas-hint">拖拽节点，连接路线，逐步补充元数据</span></div>
      <div className="flow-wrap">
        <ReactFlow
          nodes={props.nodes}
          edges={props.edges}
          nodeTypes={nodeTypes}
          onNodesChange={props.onNodesChange}
          onEdgesChange={props.onEdgesChange}
          onConnect={props.onConnect}
          onSelectionChange={props.onSelectionChange}
          onInit={props.onInit}
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Lines} gap={32} size={1} color="#e7e9ed" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(node) => ({ start: '#246bfe', task: '#d7a23a', branch: '#9c6ade', checkpoint: '#2f9e8f', end: '#ef765f' }[node.type || 'task']) || '#aeb4be'} />
        </ReactFlow>
        {props.nodes.length === 0 && <div className="canvas-empty"><div className="empty-cross">+</div><strong>从节点库开始搭建路线</strong><span>选择一个节点类型，地图会从这里展开。</span></div>}
      </div>
    </main>
  )
}
