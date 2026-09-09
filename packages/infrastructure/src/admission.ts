import type { SandboxProfile } from './types'
import type { SandboxSpec } from '@ncuscc/sandbox-contracts'
import { InfrastructureError } from './errors'

/** Admission policy applied before a node supplied spec reaches a runtime adapter. */
export const admitSandboxSpec = (spec: SandboxSpec, profile: SandboxProfile): void => {
  if (spec.profileRef !== `${profile.id}@${profile.version}`) throw new InfrastructureError('SandboxSpec profile 与已解析 profile 不一致', 'ADMISSION_REJECTED')
  if (spec.network.mode !== 'none') throw new InfrastructureError('sandbox 必须使用无网络模式', 'ADMISSION_REJECTED')
  if (!spec.workspace.writablePath.startsWith('/') || spec.workspace.writablePath === '/') throw new InfrastructureError('workspace 必须是独立的绝对可写路径', 'ADMISSION_REJECTED')
  if (spec.workspace.maxSizeMiB > profile.resources.ephemeralStorageMiB) throw new InfrastructureError('workspace 超过 profile 磁盘配额', 'ADMISSION_REJECTED')
  if (spec.terminal.enabled && (!profile.terminal.pty || spec.terminal.shell !== profile.terminal.shell)) throw new InfrastructureError('终端 shell 不符合 profile 策略', 'ADMISSION_REJECTED')
  if (spec.lifecycle.maxLifetimeSeconds > profile.limits.maxLifetimeSeconds || spec.lifecycle.idleTimeoutSeconds > profile.limits.idleTimeoutSeconds) throw new InfrastructureError('生命周期超过 profile 策略上限', 'ADMISSION_REJECTED')
}
