import type { SandboxSpec, ValidationIssue } from '@ncuscc/sandbox-contracts'
import { validateSandboxSpec } from '@ncuscc/sandbox-contracts'

export interface CheckerRef {
  id: string
  version: string
  imageDigest: `sha256:${string}`
}

export interface NodePackage {
  schemaVersion: 'node-package.v1'
  id: string
  version: string
  publicRef: string
  sandbox: SandboxSpec
  checkerRef: CheckerRef
}

export interface SeedStore {
  put(ref: string, content: Record<string, string>): void
  read(ref: string): Readonly<Record<string, string>>
}

const safePath = (path: string): boolean => path.length > 0 && !path.startsWith('/') && !path.split('/').some((part) => part === '..' || part === '')

export class InMemorySeedStore implements SeedStore {
  private readonly seeds = new Map<string, Readonly<Record<string, string>>>()
  put(ref: string, content: Record<string, string>): void {
    if (!ref.trim()) throw new Error('seed ref 不能为空')
    for (const path of Object.keys(content)) if (!safePath(path)) throw new Error(`seed 路径不安全: ${path}`)
    this.seeds.set(ref, Object.freeze({ ...content }))
  }
  read(ref: string): Readonly<Record<string, string>> {
    const seed = this.seeds.get(ref)
    if (!seed) throw new Error(`seed 不存在: ${ref}`)
    return seed
  }
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const digest = (value: unknown): value is `sha256:${string}` => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value)

export const validateNodePackage = (value: unknown): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [{ path: '$', message: '必须是对象' }]
  const packageValue = value as Record<string, unknown>
  if (packageValue.schemaVersion !== 'node-package.v1') issues.push({ path: 'schemaVersion', message: '必须为 node-package.v1' })
  for (const key of ['id', 'version', 'publicRef']) if (!nonEmpty(packageValue[key])) issues.push({ path: key, message: '不能为空' })
  const sandboxIssues = validateSandboxSpec(packageValue.sandbox)
  issues.push(...sandboxIssues.map((item) => ({ path: `sandbox.${item.path}`, message: item.message })))
  const checker = packageValue.checkerRef
  if (!checker || typeof checker !== 'object' || Array.isArray(checker)) issues.push({ path: 'checkerRef', message: '必须是对象' })
  else {
    const value = checker as Record<string, unknown>
    for (const key of ['id', 'version']) if (!nonEmpty(value[key])) issues.push({ path: `checkerRef.${key}`, message: '不能为空' })
    if (!digest(value.imageDigest)) issues.push({ path: 'checkerRef.imageDigest', message: '必须是完整 sha256 digest' })
  }
  return issues
}

export class InMemoryNodePackageRegistry {
  private readonly packages = new Map<string, Readonly<NodePackage>>()
  register(nodePackage: NodePackage): void {
    const issues = validateNodePackage(nodePackage)
    if (issues.length) throw new Error(`节点资源包校验失败: ${issues.map((item) => `${item.path} ${item.message}`).join('; ')}`)
    const key = `${nodePackage.id}@${nodePackage.version}`
    if (this.packages.has(key)) throw new Error(`节点资源包已存在: ${key}`)
    this.packages.set(key, Object.freeze({ ...nodePackage, sandbox: Object.freeze({ ...nodePackage.sandbox }), checkerRef: Object.freeze({ ...nodePackage.checkerRef }) }))
  }
  resolve(ref: string): Readonly<NodePackage> {
    const value = this.packages.get(ref)
    if (!value) throw new Error(`节点资源包不存在或未批准: ${ref}`)
    return value
  }
}
