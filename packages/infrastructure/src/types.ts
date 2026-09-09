import type { AttemptContext, CheckerResult, SandboxAdapter, SandboxSession, SandboxSpec } from '@ncuscc/sandbox-contracts'
export type { AttemptContext, CheckerResult, SandboxAdapter, SandboxSession, SandboxSpec } from '@ncuscc/sandbox-contracts'

export interface ResourceLimits {
  cpuMillis: number
  memoryMiB: number
  ephemeralStorageMiB: number
  pids: number
  gpu?: number
}

export interface ProfileLimits {
  maxLifetimeSeconds: number
  idleTimeoutSeconds: number
  maxOutputBytes: number
  checkerTimeoutSeconds: number
}

export interface SandboxProfile {
  id: string
  version: string
  imageDigest: `sha256:${string}`
  runtimeClass: string
  resources: ResourceLimits
  tools: string[]
  network: 'none'
  terminal: { shell: string; pty: boolean }
  limits: ProfileLimits
}

export interface SessionRequest {
  spec: SandboxSpec
  context: AttemptContext
  idempotencyKey: string
}

export interface TerminalToken {
  token: string
  sessionId: string
  participantRef: string
  expiresAt: string
}

export interface TerminalInputMessage { type: 'input'; data: string }
export interface TerminalResizeMessage { type: 'resize'; cols: number; rows: number }
export interface TerminalHeartbeatMessage { type: 'heartbeat'; timestamp: string }
export interface TerminalOutputMessage { type: 'output'; data: string }
export interface TerminalCloseMessage { type: 'close'; reason: 'submitted' | 'expired' | 'destroyed' | 'policy' }
export type PtyMessage = TerminalInputMessage | TerminalResizeMessage | TerminalHeartbeatMessage | TerminalOutputMessage | TerminalCloseMessage

export interface FrozenWorkspace {
  snapshotId: string
  sessionId: string
  workspacePath: string
  content: Readonly<Record<string, string>>
  createdAt: string
}

export interface CheckerAdapter {
  check(workspace: FrozenWorkspace, checkerRef: string, timeoutSeconds: number): Promise<CheckerResult>
}

export interface ProfileRegistry {
  resolve(ref: string): SandboxProfile
  verify(profile: SandboxProfile): void
  register(profile: SandboxProfile): void
}

export interface SnapshotStore {
  freeze(sessionId: string, workspacePath: string, content: Record<string, string>): FrozenWorkspace
  get(snapshotId: string): FrozenWorkspace | undefined
  delete(snapshotId: string): void
}

export interface AuditEvent {
  type: string
  sessionId?: string
  participantRef?: string
  at: string
  details?: Readonly<Record<string, string | number | boolean>>
}

export interface InfrastructureMetrics {
  sessionsCreated: number
  sessionsReady: number
  sessionsSubmitted: number
  checkerPassed: number
  checkerFailed: number
  checkerErrors: number
  checkerTimeouts: number
  terminalConnections: number
  terminalReconnects: number
  terminalRejected: number
  sessionsDestroyed: number
  orphanedSessions: number
}

export interface PublicSession {
  session: SandboxSession
  terminalAvailable: boolean
  result?: CheckerResult
}

export interface SessionServiceOptions {
  adapter: SandboxAdapter
  profiles: ProfileRegistry
  snapshots?: SnapshotStore
  checker?: CheckerAdapter
  now?: () => string
  idFactory?: () => string
  tokenTtlSeconds?: number
  audit?: (event: AuditEvent) => void
}

export interface SessionService {
  create(request: SessionRequest): Promise<PublicSession>
  get(sessionId: string): PublicSession | undefined
  terminalToken(sessionId: string, participantRef: string, idempotencyKey: string): Promise<TerminalToken>
  submit(sessionId: string, idempotencyKey: string): Promise<CheckerResult>
  reset(sessionId: string, idempotencyKey: string): Promise<PublicSession>
  destroy(sessionId: string, idempotencyKey: string): Promise<void>
  expire(now?: string): Promise<string[]>
}
