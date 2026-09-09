export type SandboxPhase =
  | 'pending'
  | 'provisioning'
  | 'ready'
  | 'running'
  | 'submitted'
  | 'checking'
  | 'passed'
  | 'failed'
  | 'error'
  | 'expired'
  | 'resetting'
  | 'destroying'
  | 'destroyed'

export type CheckerStatus = 'passed' | 'failed' | 'error' | 'timeout'

export interface SandboxSpec {
  schemaVersion: 'sandbox.v1'
  id: string
  version: string
  profileRef: string
  terminal: {
    enabled: boolean
    shell: string
  }
  network: {
    mode: 'none'
  }
  workspace: {
    seedRef: string
    writablePath: string
    maxSizeMiB: number
  }
  lifecycle: {
    maxLifetimeSeconds: number
    idleTimeoutSeconds: number
    retryPolicy: 'recreate'
  }
  checkerRef: string
}

export interface SandboxSession {
  schemaVersion: 'session.v1'
  id: string
  nodeRef: string
  mapRef: string
  attempt: number
  phase: SandboxPhase
  createdAt: string
  expiresAt: string
  lastActivityAt: string
  terminal: {
    protocol: 'pty-v1'
    attachable: boolean
  }
}

export interface CheckerFeedback {
  code: string
  message: string
  visibility: 'participant' | 'organizer'
}

export interface CheckerArtifact {
  id: string
  name: string
  mediaType: string
  sizeBytes: number
}

export interface CheckerResult {
  schemaVersion: 'checker-result.v1'
  sessionId: string
  status: CheckerStatus
  score?: {
    value: number
    max: number
  }
  feedback: CheckerFeedback[]
  metrics: Record<string, number>
  artifacts: CheckerArtifact[]
  checkerVersion: string
}

export interface AttemptContext {
  nodeRef: string
  mapRef: string
  attempt: number
  participantRef: string
}

export interface TerminalAttachment {
  sessionId: string
  protocol: 'pty-v1'
  token: string
}

export interface SandboxAdapter {
  provision(spec: SandboxSpec, context: AttemptContext): Promise<SandboxSession>
  attachTerminal(sessionId: string): Promise<TerminalAttachment>
  submit(sessionId: string): Promise<CheckerResult>
  reset(sessionId: string): Promise<SandboxSession>
  destroy(sessionId: string): Promise<void>
  /** Optional control-plane expiry hook; adapters without it are force-destroyed. */
  expire?(sessionId: string): Promise<void>
  touch?(sessionId: string, at: string): Promise<void>
  getSession(sessionId: string): SandboxSession | undefined
}

export interface ValidationIssue {
  path: string
  message: string
}
