import type { ProfileRegistry, ProfileVerificationPolicy, ResourceLimits, SandboxProfile } from './types'
import type { ValidationIssue } from '@ncuscc/sandbox-contracts'
import { InfrastructureError } from './errors'

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0
const digest = (value: unknown): value is `sha256:${string}` => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value)

export const validateProfile = (value: unknown): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [{ path: '$', message: '必须是对象' }]
  const profile = value as Record<string, unknown>
  for (const key of ['id', 'version', 'runtimeClass']) if (typeof profile[key] !== 'string' || !(profile[key] as string).trim()) issues.push({ path: key, message: '不能为空' })
  if (!digest(profile.imageDigest)) issues.push({ path: 'imageDigest', message: '必须是完整 sha256 digest' })
  if (profile.network !== 'none') issues.push({ path: 'network', message: '第一阶段只允许 none' })
  if (!Array.isArray(profile.tools) || profile.tools.some((tool) => typeof tool !== 'string' || !tool.trim())) issues.push({ path: 'tools', message: '必须是非空字符串数组' })
  const resources = profile.resources as Record<string, unknown> | undefined
  if (!resources || typeof resources !== 'object') issues.push({ path: 'resources', message: '必须是对象' })
  else for (const key of ['cpuMillis', 'memoryMiB', 'ephemeralStorageMiB', 'pids']) if (!positive(resources[key])) issues.push({ path: `resources.${key}`, message: '必须是正整数' })
  const terminal = profile.terminal as Record<string, unknown> | undefined
  if (!terminal || typeof terminal.shell !== 'string' || !terminal.shell.startsWith('/')) issues.push({ path: 'terminal.shell', message: '必须是绝对路径' })
  if (terminal && typeof terminal.pty !== 'boolean') issues.push({ path: 'terminal.pty', message: '必须是布尔值' })
  const limits = profile.limits as Record<string, unknown> | undefined
  if (!limits || typeof limits !== 'object') issues.push({ path: 'limits', message: '必须是对象' })
  else for (const key of ['maxLifetimeSeconds', 'idleTimeoutSeconds', 'maxOutputBytes', 'checkerTimeoutSeconds']) if (!positive(limits[key])) issues.push({ path: `limits.${key}`, message: '必须是正整数' })
  if (limits && positive(limits.maxLifetimeSeconds) && positive(limits.idleTimeoutSeconds) && limits.idleTimeoutSeconds > limits.maxLifetimeSeconds) issues.push({ path: 'limits.idleTimeoutSeconds', message: '不能大于 maxLifetimeSeconds' })
  return issues
}

export class InMemoryProfileRegistry implements ProfileRegistry {
  private readonly profiles = new Map<string, SandboxProfile>()
  constructor(profiles: SandboxProfile[] = []) { profiles.forEach((profile) => this.register(profile)) }
  register(profile: SandboxProfile): void {
    const issues = validateProfile(profile)
    if (issues.length) throw new InfrastructureError(`profile 校验失败: ${issues.map((item) => `${item.path} ${item.message}`).join('; ')}`, 'PROFILE_INVALID')
    this.verify(profile.imageDigest, { allowedRuntimeClasses: new Set(['kata', 'firecracker']), runtimeClass: profile.runtimeClass, requireSignature: false, requireSbom: false, signature: profile.signature, sbomRef: profile.sbomRef })
    if (profile.tools.length === 0) throw new InfrastructureError('profile 至少需要声明一个预置工具', 'PROFILE_POLICY_REJECTED')
    const ref = `${profile.id}@${profile.version}`
    if (this.profiles.has(ref)) throw new InfrastructureError(`profile 已存在: ${ref}`, 'PROFILE_DUPLICATE')
    this.profiles.set(ref, Object.freeze({ ...profile, resources: { ...profile.resources }, limits: { ...profile.limits }, tools: [...profile.tools] }))
  }
  resolve(ref: string): SandboxProfile {
    const profile = this.profiles.get(ref)
    if (!profile) throw new InfrastructureError(`profile 未获批准或不存在: ${ref}`, 'PROFILE_NOT_FOUND')
    return profile
  }
  verify(imageDigestOrProfile: string | SandboxProfile, policy: ProfileVerificationPolicy = {}): void {
    const imageDigest = typeof imageDigestOrProfile === 'string' ? imageDigestOrProfile : imageDigestOrProfile.imageDigest
    if (typeof imageDigestOrProfile !== 'string') {
      policy = { ...policy, runtimeClass: policy.runtimeClass ?? imageDigestOrProfile.runtimeClass, signature: policy.signature ?? imageDigestOrProfile.signature, sbomRef: policy.sbomRef ?? imageDigestOrProfile.sbomRef }
    }
    if (!digest(imageDigest)) throw new InfrastructureError('profile 必须使用完整 sha256 digest', 'PROFILE_POLICY_REJECTED')
    if (policy.allowedDigests && !policy.allowedDigests.has(imageDigest)) throw new InfrastructureError('profile 镜像 digest 不在 allowlist', 'PROFILE_POLICY_REJECTED')
    if (policy.allowedRuntimeClasses && policy.allowedRuntimeClasses.size === 0) throw new InfrastructureError('runtimeClass allowlist 不能为空', 'PROFILE_POLICY_REJECTED')
    if (policy.allowedRuntimeClasses && (!policy.runtimeClass || !policy.allowedRuntimeClasses.has(policy.runtimeClass))) throw new InfrastructureError('profile runtimeClass 未获批准', 'PROFILE_POLICY_REJECTED')
    if (policy.requireSignature && !policy.signature) throw new InfrastructureError('profile 缺少镜像签名', 'PROFILE_POLICY_REJECTED')
    if (policy.requireSbom && !policy.sbomRef) throw new InfrastructureError('profile 缺少 SBOM 引用', 'PROFILE_POLICY_REJECTED')
  }
}

export const resourceWithin = (requested: ResourceLimits, allowed: ResourceLimits): boolean =>
  requested.cpuMillis <= allowed.cpuMillis && requested.memoryMiB <= allowed.memoryMiB && requested.ephemeralStorageMiB <= allowed.ephemeralStorageMiB && requested.pids <= allowed.pids && (requested.gpu ?? 0) <= (allowed.gpu ?? 0)
