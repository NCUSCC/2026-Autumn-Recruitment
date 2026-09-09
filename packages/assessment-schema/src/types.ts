export type NodeType = 'start' | 'task' | 'branch' | 'checkpoint' | 'end'

export type EdgeTrigger = 'success' | 'failure' | 'skip' | 'manual'

export interface RetryPolicy {
  enabled: boolean
  maxAttempts: number | null
  note: string
}

export interface NodeMetadata {
  title: string
  directionTags: string[]
  description: string
  hints: string[]
  completionCriteria: string
  retryPolicy: RetryPolicy
}

export interface MapNode {
  id: string
  type: NodeType
  metadata: NodeMetadata
  sandboxRef: string
  position: { x: number; y: number }
}

export interface MapEdge {
  id: string
  source: string
  target: string
  trigger: EdgeTrigger
  condition: string
  label: string
}

export interface MapDocument {
  schemaVersion: '1.0.0'
  meta: {
    id: string
    name: string
    description: string
    version: number
  }
  nodes: MapNode[]
  edges: MapEdge[]
}

export interface CatalogCategory {
  id: string
  name: string
  description?: string
  color?: string
}

export interface CatalogDocument {
  schemaVersion: '1.0.0'
  categories: CatalogCategory[]
}

export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationMessage {
  id: string
  severity: ValidationSeverity
  message: string
  targetId?: string
}
