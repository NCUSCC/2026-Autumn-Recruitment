import type { FrozenWorkspace, SandboxProfile } from './types'
import type { TerminalAttachment } from '@ncuscc/sandbox-contracts'

export interface RuntimeWorkloadSpec {
  sessionId: string
  name: string
  runtimeClass: 'kata' | 'firecracker'
  profile: SandboxProfile
  networkMode: 'none'
  readOnlyRootFilesystem: true
  workspacePath: '/workspace'
  serviceAccountToken: false
}

export type RuntimeWorkloadPhase = 'provisioning' | 'ready' | 'running' | 'frozen' | 'destroying' | 'destroyed' | 'error'

export interface RuntimeWorkloadStatus {
  sessionId: string
  name: string
  phase: RuntimeWorkloadPhase
  agentReady: boolean
  terminalAttachable: boolean
  observedGeneration: number
  lastHeartbeatAt?: string
}

export interface RuntimeConnector {
  provision(spec: RuntimeWorkloadSpec): Promise<RuntimeWorkloadStatus>
  observe(sessionId: string): RuntimeWorkloadStatus | undefined
  attachTerminal(sessionId: string): Promise<TerminalAttachment>
  heartbeat(sessionId: string, at?: string): RuntimeWorkloadStatus
  freeze(sessionId: string): Promise<FrozenWorkspace>
  destroy(sessionId: string): Promise<void>
}

/** Runtime-neutral connector used by local tests; Kubernetes/Kata adapters implement the same boundary. */
export class InMemoryRuntimeConnector implements RuntimeConnector {
  private readonly workloads = new Map<string, RuntimeWorkloadStatus>()
  constructor(private readonly now = () => new Date().toISOString(), private readonly idFactory = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) {}
  async provision(spec: RuntimeWorkloadSpec): Promise<RuntimeWorkloadStatus> {
    if (spec.networkMode !== 'none' || !spec.readOnlyRootFilesystem || spec.serviceAccountToken) throw new Error('runtime workload 安全策略拒绝')
    if (this.workloads.has(spec.sessionId)) throw new Error(`runtime workload 已存在: ${spec.sessionId}`)
    const status: RuntimeWorkloadStatus = { sessionId: spec.sessionId, name: spec.name, phase: 'ready', agentReady: true, terminalAttachable: spec.profile.terminal.pty, observedGeneration: 1, lastHeartbeatAt: this.now() }
    this.workloads.set(spec.sessionId, status)
    return { ...status }
  }
  observe(sessionId: string): RuntimeWorkloadStatus | undefined { const value = this.workloads.get(sessionId); return value ? { ...value } : undefined }
  async attachTerminal(sessionId: string): Promise<TerminalAttachment> {
    const status = this.workloads.get(sessionId)
    if (!status || !['ready', 'running'].includes(status.phase) || !status.terminalAttachable) throw new Error('runtime 当前不能连接终端')
    status.phase = 'running'
    status.observedGeneration += 1
    return { sessionId, protocol: 'pty-v1', token: `runtime-${this.idFactory()}` }
  }
  heartbeat(sessionId: string, at = this.now()): RuntimeWorkloadStatus {
    const status = this.workloads.get(sessionId)
    if (!status || status.phase === 'destroyed') throw new Error('runtime workload 不存在或已销毁')
    status.lastHeartbeatAt = at
    return { ...status }
  }
  async freeze(sessionId: string): Promise<FrozenWorkspace> {
    const status = this.workloads.get(sessionId)
    if (!status || !['ready', 'running'].includes(status.phase)) throw new Error('runtime 当前不能冻结')
    status.phase = 'frozen'; status.terminalAttachable = false; status.observedGeneration += 1
    return Object.freeze({ snapshotId: `snapshot-${this.idFactory()}`, sessionId, workspacePath: '/workspace', content: Object.freeze({}), createdAt: this.now() })
  }
  async destroy(sessionId: string): Promise<void> {
    const status = this.workloads.get(sessionId)
    if (!status || status.phase === 'destroyed') return
    status.phase = 'destroying'; status.observedGeneration += 1
    status.phase = 'destroyed'; status.agentReady = false; status.terminalAttachable = false; status.observedGeneration += 1
  }
}

export class InMemoryRuntimeController {
  private readonly desired = new Map<string, RuntimeWorkloadSpec>()
  constructor(private readonly connector: RuntimeConnector) {}
  async ensure(spec: RuntimeWorkloadSpec): Promise<RuntimeWorkloadStatus> {
    this.desired.set(spec.sessionId, spec)
    const current = this.connector.observe(spec.sessionId)
    return current ?? this.connector.provision(spec)
  }
  reconcile(sessionId: string): RuntimeWorkloadStatus | undefined {
    const desired = this.desired.get(sessionId)
    const observed = this.connector.observe(sessionId)
    if (!observed && desired) void this.connector.provision(desired)
    return observed
  }
  async destroy(sessionId: string): Promise<void> { this.desired.delete(sessionId); await this.connector.destroy(sessionId) }
}
