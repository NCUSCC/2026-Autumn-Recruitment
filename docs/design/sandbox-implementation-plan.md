# 独立节点 Sandbox 第一阶段实现计划

> **For agentic workers:** Execute this plan task-by-task with test-first checkpoints. Do not add Kubernetes or microVM integration until the contract and mock lifecycle are passing.

**Goal:** 在现有地图编辑器仓库中实现可测试的 sandbox 契约、配置校验、会话状态机和 mock adapter，为后续 Kubernetes + microVM 运行器提供稳定边界。

**Architecture:** 将 sandbox 运行层放在 `src/sandbox/`，与 React 编辑器和地图拓扑代码隔离。`SandboxSpec` 是节点资源包的静态配置，`SandboxSession` 是一次尝试的生命周期对象，`CheckerResult` 是唯一返回给地图运行器的结果。第一阶段只实现内存 mock adapter，不启动真实容器、Kubernetes 或终端服务。

**Tech Stack:** TypeScript、Vitest、现有 Vite 构建链；不引入 Kubernetes SDK，不在浏览器中执行 sandbox。

---

## 文件边界

- Create: `src/sandbox/types.ts` — sandbox 配置、会话、checker 和 adapter 的公共类型。
- Create: `src/sandbox/validation.ts` — 对外部 JSON 的运行时结构校验。
- Create: `src/sandbox/session.ts` — session 状态集合、合法转移和不可变状态更新。
- Create: `src/sandbox/mockAdapter.ts` — 可注入 checker 和时钟的内存 adapter。
- Create: `src/sandbox/index.ts` — 对外导出入口。
- Create: `src/sandbox/validation.test.ts` — SandboxSpec、SandboxSession、CheckerResult 的校验测试。
- Create: `src/sandbox/session.test.ts` — 状态机和终态保护测试。
- Create: `src/sandbox/mockAdapter.test.ts` — provision、terminal attach、submit、reset、destroy 生命周期测试。
- Create: `vitest.config.ts` — Node 测试环境配置。
- Modify: `package.json` — 添加 `test` 和 `test:watch` 脚本以及 Vitest 开发依赖。
- Modify: `package-lock.json` — 由 npm 更新依赖锁定。
- Modify: `README.md` — 增加 sandbox 第一阶段的范围和测试命令。

## Task 1: 建立测试运行器

**Files:** `package.json`, `package-lock.json`, `vitest.config.ts`

- [x] **Step 1: 添加测试脚本和依赖。** 将 scripts 扩展为：

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

执行 `npm install -D vitest`，让 npm 更新 `package.json` 和 `package-lock.json`。

- [x] **Step 2: 添加 Vitest 配置。** 创建：

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [x] **Step 3: 验证测试入口。** 运行 `npm test -- --passWithNoTests`。预期命令以退出码 0 完成；如果 Vitest 启动失败，先修复配置再进入下一任务。

## Task 2: 定义契约并先写校验测试

**Files:** `src/sandbox/types.ts`, `src/sandbox/validation.ts`, `src/sandbox/validation.test.ts`

- [x] **Step 1: 写失败测试。** 测试以下行为：

```ts
it('accepts an offline interactive SandboxSpec', () => {
  expect(validateSandboxSpec(validSpec())).toEqual([])
})

it('rejects network modes other than none', () => {
  const issues = validateSandboxSpec({ ...validSpec(), network: { mode: 'egress' } })
  expect(issues).toContainEqual({ path: 'network.mode', message: '第一阶段只允许 none' })
})

it('rejects an idle timeout larger than the maximum lifetime', () => {
  const issues = validateSandboxSpec({
    ...validSpec(),
    lifecycle: { ...validSpec().lifecycle, maxLifetimeSeconds: 60, idleTimeoutSeconds: 61 },
  })
  expect(issues).toContainEqual({ path: 'lifecycle.idleTimeoutSeconds', message: '不能大于 maxLifetimeSeconds' })
})

it('validates CheckerResult status and score bounds', () => {
  expect(validateCheckerResult(validResult())).toEqual([])
  expect(validateCheckerResult({ ...validResult(), status: 'unknown' })).toContainEqual({
    path: 'status',
    message: 'status 不是受支持的值',
  })
})
```

使用测试辅助对象：`validSpec()` 返回 `schemaVersion: 'sandbox.v1'`、`profileRef: 'basic-linux@1'`、`network.mode: 'none'`、`/workspace` 和有效生命周期；`validResult()` 返回 `status: 'passed'`、空 feedback/metrics/artifacts 和 `checkerVersion: 'checker@1'`。

- [x] **Step 2: 运行红灯测试。** 执行 `npm test -- src/sandbox/validation.test.ts`。预期测试因为 `src/sandbox/validation.ts` 和类型尚不存在而失败。

- [x] **Step 3: 写最小契约类型。** 在 `types.ts` 中定义：

```ts
export type SandboxPhase = 'pending' | 'provisioning' | 'ready' | 'running' | 'submitted' | 'checking' | 'passed' | 'failed' | 'error' | 'expired' | 'resetting' | 'destroying' | 'destroyed'
export type CheckerStatus = 'passed' | 'failed' | 'error' | 'timeout'
export interface SandboxSpec {
  schemaVersion: 'sandbox.v1'
  id: string
  version: string
  profileRef: string
  terminal: { enabled: boolean; shell: string }
  network: { mode: 'none' }
  workspace: { seedRef: string; writablePath: string; maxSizeMiB: number }
  lifecycle: { maxLifetimeSeconds: number; idleTimeoutSeconds: number; retryPolicy: 'recreate' }
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
  terminal: { protocol: 'pty-v1'; attachable: boolean }
}
export interface CheckerResult {
  schemaVersion: 'checker-result.v1'
  sessionId: string
  status: CheckerStatus
  score?: { value: number; max: number }
  feedback: Array<{ code: string; message: string; visibility: 'participant' | 'organizer' }>
  metrics: Record<string, number>
  artifacts: Array<{ id: string; name: string; mediaType: string; sizeBytes: number }>
  checkerVersion: string
}
export interface AttemptContext { nodeRef: string; mapRef: string; attempt: number; participantRef: string }
export interface TerminalAttachment { sessionId: string; protocol: 'pty-v1'; token: string }
export interface SandboxAdapter {
  provision(spec: SandboxSpec, context: AttemptContext): Promise<SandboxSession>
  attachTerminal(sessionId: string): Promise<TerminalAttachment>
  submit(sessionId: string): Promise<CheckerResult>
  reset(sessionId: string): Promise<SandboxSession>
  destroy(sessionId: string): Promise<void>
  getSession(sessionId: string): SandboxSession | undefined
}
export interface ValidationIssue { path: string; message: string }
```

`SandboxSpec.network.mode` 固定为 `'none'`，`lifecycle.retryPolicy` 固定为 `'recreate'`，`CheckerResult.status` 使用四个 `CheckerStatus` 值。

- [x] **Step 4: 实现运行时校验。** `validateSandboxSpec`, `validateSandboxSession` 和 `validateCheckerResult` 接收 `unknown`，返回 `ValidationIssue[]`，不得抛出类型错误。校验 schema 版本、非空 ID/ref、绝对可写路径、正整数配额、生命周期关系、状态枚举、score 范围和 feedback 字段。导出 `SandboxValidationError`，其构造函数接收 `ValidationIssue[]`，供 adapter 将无效外部数据转换为可识别异常。

- [x] **Step 5: 运行绿灯测试。** 执行 `npm test -- src/sandbox/validation.test.ts`，预期全部通过；随后执行 `npm run build`，确保浏览器构建不依赖 Node 专属模块。

## Task 3: 实现会话状态机

**Files:** `src/sandbox/session.ts`, `src/sandbox/session.test.ts`

- [x] **Step 1: 写失败测试。** 覆盖：

```ts
it('allows the normal session lifecycle', () => {
  let session = makeSession('ready')
  session = transitionSession(session, 'running', now)
  session = transitionSession(session, 'submitted', now)
  session = transitionSession(session, 'checking', now)
  session = transitionSession(session, 'passed', now)
  expect(session.phase).toBe('passed')
})

it('rejects writes after a terminal phase', () => {
  expect(() => transitionSession(makeSession('destroyed'), 'running', now)).toThrowError(SandboxTransitionError)
})

it('allows reconnect without changing a running session phase', () => {
  expect(canTransition('running', 'running')).toBe(true)
})
```

- [x] **Step 2: 运行红灯测试。** 执行 `npm test -- src/sandbox/session.test.ts`，确认失败原因是状态机模块缺失。

- [x] **Step 3: 实现状态转移。** 导出 `canTransition(from, to)`, `transitionSession(session, nextPhase, at)` 和 `SandboxTransitionError`。合法边界至少包含：`pending→provisioning→ready→running→submitted→checking→passed|failed|error`，`ready|running→expired|destroying`，以及所有非 `destroyed` 状态到 `destroying→destroyed`。`transitionSession` 必须返回新对象并更新 `lastActivityAt`，不得原地修改输入。

- [x] **Step 4: 运行绿灯测试。** 执行 `npm test -- src/sandbox/session.test.ts`，然后执行 `npm test`，确认所有测试通过。

## Task 4: 实现内存 MockSandboxAdapter

**Files:** `src/sandbox/mockAdapter.ts`, `src/sandbox/mockAdapter.test.ts`, `src/sandbox/types.ts`

- [x] **Step 1: 写失败测试。** 覆盖以下行为：

```ts
it('provisions a ready session and attaches an interactive terminal', async () => {
  const adapter = new MockSandboxAdapter({ now, idFactory: ids() })
  const session = await adapter.provision(validSpec(), context())
  expect(session.phase).toBe('ready')
  const terminal = await adapter.attachTerminal(session.id)
  expect(terminal.protocol).toBe('pty-v1')
  expect(adapter.getSession(session.id)?.phase).toBe('running')
})

it('freezes and checks a submitted session', async () => {
  const adapter = new MockSandboxAdapter({ checker: () => validResult(), now, idFactory: ids() })
  const session = await adapter.provision(validSpec(), context())
  await adapter.attachTerminal(session.id)
  const result = await adapter.submit(session.id)
  expect(result.status).toBe('passed')
  expect(adapter.getSession(session.id)?.phase).toBe('passed')
})

it('creates a fresh attempt when resetting', async () => {
  const adapter = new MockSandboxAdapter({ now, idFactory: ids() })
  const first = await adapter.provision(validSpec(), context())
  const second = await adapter.reset(first.id)
  expect(second.id).not.toBe(first.id)
  expect(second.attempt).toBe(first.attempt + 1)
  expect(adapter.getSession(first.id)?.phase).toBe('destroyed')
})
```

- [x] **Step 2: 运行红灯测试。** 执行 `npm test -- src/sandbox/mockAdapter.test.ts`，确认 adapter 尚未实现。

- [x] **Step 3: 实现最小 adapter。** `MockSandboxAdapter` 使用内存 `Map` 保存 session 和上下文，构造参数注入 `now`, `idFactory` 和 `checker`。实现 `provision`, `attachTerminal`, `submit`, `reset`, `destroy`, `getSession`：

  - `provision` 校验 spec 后创建 `ready` session。
  - `attachTerminal` 只允许 `ready`/`running`，返回 `pty-v1` 和短期 mock token，并把 `ready` 转为 `running`。
  - `submit` 将 session 依次转为 `submitted`、`checking`，调用 checker，并按结果转为 `passed`、`failed`、`error` 或 `expired`。
  - `reset` 将旧 session 销毁，再以相同 node/map/context 创建递增 attempt 的新 session。
  - `destroy` 幂等地将 session 置为 `destroyed`。
  - 非法操作统一抛出 `SandboxTransitionError` 或 `SandboxValidationError`。

- [x] **Step 4: 运行绿灯测试。** 执行 `npm test -- src/sandbox/mockAdapter.test.ts` 和 `npm test`，确认生命周期测试全部通过。

## Task 5: 统一导出和仓库说明

**Files:** `src/sandbox/index.ts`, `README.md`

- [x] **Step 1: 导出公共入口。** `src/sandbox/index.ts` 只导出 types、validation、session 和 `MockSandboxAdapter` 的公共 API，避免调用方依赖内部 Map 或测试辅助函数。

- [x] **Step 2: 更新 README。** 增加以下边界说明：第一阶段只提供契约、校验、状态机和 mock adapter；真实 Kubernetes/microVM、Terminal Gateway 和 checker deployment 属于后续阶段；运行测试使用 `npm test`。

- [x] **Step 3: 运行全量验证。** 依次执行：

```bash
npm test
npm run build
git diff --check
```

预期所有测试通过，生产构建成功，格式检查无输出。

## Task 6: 提交前检查

**Files:** `package.json`, `package-lock.json`, `vitest.config.ts`, `README.md`, `docs/design/sandbox-implementation-plan.md`, `src/sandbox/types.ts`, `src/sandbox/validation.ts`, `src/sandbox/validation.test.ts`, `src/sandbox/session.ts`, `src/sandbox/session.test.ts`, `src/sandbox/mockAdapter.ts`, `src/sandbox/mockAdapter.test.ts`, `src/sandbox/index.ts`

- [x] **Step 1: 检查提交边界。** 确认暂存内容不包含原始 `.docx`、`node_modules/`、`dist/` 或 `docs/superpowers/`。
- [x] **Step 2: 提交实现。** 使用提交信息 `feat: add sandbox contracts and mock lifecycle`。
- [x] **Step 3: 推送并核对远端。** 执行 `git push origin main`，再用 `git ls-remote origin refs/heads/main` 确认远端指向新提交。
