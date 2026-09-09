# 独立节点 Sandbox 设计

## 1. 文档目的

本文档定义招新考核平台中“独立节点 Sandbox”的架构边界、资源模型和运行生命周期。它是题目编排之后的运行层设计基线，供后续实现运行器、终端网关和 checker 使用。

本文档不定义具体关卡题目、答案或评分细则，也不要求当前版本立即部署 Kubernetes 集群。

## 2. 设计结论

第一版运行方案采用以下组合：

- Kubernetes 负责会话调度、资源编排和生命周期管理。
- microVM-backed RuntimeClass 负责隔离，首个部署目标使用 Kata Containers；后续可以接入 Firecracker 兼容后端。
- 每个参与者的每次尝试使用独立、临时、可重建的 sandbox。
- sandbox 默认无网络，工具和依赖全部预置在不可变 profile 镜像中。
- 参与者通过浏览器终端连接 sandbox 内的 PTY，不直接接触宿主机或 Kubernetes API。
- 提交后冻结工作区，由独立 checker 使用隐藏测试判定。
- Git 任务只使用 sandbox 内的本地 Git，不创建远程仓库。

核心数据流如下：

```text
MapDocument
    ↓ nodeRef
NodePackage
    ↓ SandboxSpec + profileRef
Sandbox Controller
    ↓
Kubernetes + microVM Runtime
    ↓
SandboxSession + Terminal Gateway
    ↓ submit
CheckerAdapter
    ↓ CheckerResult
MapState / 路线引擎
```

## 3. 目标与非目标

### 3.1 目标

1. 为每次尝试提供可交互的 Shell/PTY 环境。
2. 默认阻断外部网络和宿主机访问。
3. 保证重试从干净的初始状态开始。
4. 让 Git、Shell、Python、编译器和后续 AI/HPC 工具通过 profile 预置。
5. 将任务内容、运行环境、判定逻辑和地图路线解耦。
6. 支持浏览器刷新或短暂断线后的会话重连。
7. 让 checker 返回稳定的结构化结果，而不是直接修改地图状态。

### 3.2 非目标

- 不允许参与者在 sandbox 内访问互联网、GitHub、GitLab 或远程镜像仓库。
- 不在 sandbox 内动态执行 `apt`、`pip install` 或其他联网安装操作。
- 不把宿主机目录、Kubernetes 凭据或云平台密钥挂载给参与者。
- 不在第一版实现实时逐命令判题。
- 不在第一版直接把参与者任务提交到真实 HPC/Slurm 集群。
- 不把评分规则写死在地图拓扑或节点类型中。

## 4. 资源包与目录模型

地图文件只保存路线拓扑、节点位置和稳定引用。节点资源包负责描述任务和运行环境：

```text
content/nodes/<node-id>/
  node.json                 # 节点元数据
  public/                   # 参与者可见的说明、起始文件和示例
  sandbox/
    spec.json               # SandboxSpec
    seed/                   # 初始工作区，可包含本地 Git 仓库
```

隐藏测试和 checker 实现不默认挂载到参与者环境。它们可以存放在受控的私有仓库或镜像仓库中，节点只保存稳定的 `checkerRef`。

### 4.1 Profile

节点不直接填写镜像、RuntimeClass 或 CPU/内存上限，而是引用平台维护的 profile：

```text
basic-linux@1
python-cpu@1
gpu-small@1
hpc-adapter@1
```

Profile 至少定义：

- 不可变镜像 digest。
- microVM RuntimeClass。
- CPU、内存、磁盘、进程数和 GPU 配额。
- 已安装的工具链和 Python/AI/HPC 依赖。
- 根文件系统和工作区权限。
- 网络策略和最大运行时长。

依赖更新通过发布新的 profile 或镜像版本完成，不在运行中的 sandbox 内修改环境。

## 5. 核心数据结构

### 5.1 SandboxSpec

`SandboxSpec` 是节点资源包中的静态、版本化配置：

```json
{
  "schemaVersion": "sandbox.v1",
  "id": "node-example",
  "version": "1.0.0",
  "profileRef": "basic-linux@1",
  "terminal": {
    "enabled": true,
    "shell": "/bin/bash"
  },
  "network": {
    "mode": "none"
  },
  "workspace": {
    "seedRef": "seed/",
    "writablePath": "/workspace",
    "maxSizeMiB": 1024
  },
  "lifecycle": {
    "maxLifetimeSeconds": 1800,
    "idleTimeoutSeconds": 600,
    "retryPolicy": "recreate"
  },
  "checkerRef": "checker/node-example@1"
}
```

字段约束：

- `profileRef` 是实际运行环境的唯一入口，节点不直接指定镜像。
- `network.mode` 第一版只能为 `none`；回环通信由运行器内部决定是否保留。
- `seedRef` 指向只读初始资源，参与者只能修改 `writablePath`。
- `maxLifetimeSeconds` 和 `idleTimeoutSeconds` 由 profile 设置上限，节点只能在上限内选择。
- `retryPolicy` 固定为 `recreate`，不允许从失败环境恢复。

### 5.2 SandboxSession

`SandboxSession` 表示一次参与者尝试，由控制面创建和更新：

```json
{
  "schemaVersion": "session.v1",
  "id": "attempt-uuid",
  "nodeRef": "node-example@1.0.0",
  "mapRef": "recruitment-map@1",
  "attempt": 1,
  "phase": "running",
  "createdAt": "2026-09-10T12:00:00Z",
  "expiresAt": "2026-09-10T12:30:00Z",
  "lastActivityAt": "2026-09-10T12:08:00Z",
  "terminal": {
    "protocol": "pty-v1",
    "attachable": true
  }
}
```

公开给浏览器的会话信息与控制面内部对象分离。短期终端 token 不写入地图、节点资源或持久化日志。

### 5.3 CheckerResult

checker 只返回结构化结果：

```json
{
  "schemaVersion": "checker-result.v1",
  "sessionId": "attempt-uuid",
  "status": "passed",
  "score": {
    "value": 80,
    "max": 100
  },
  "feedback": [
    {
      "code": "BRANCH_CREATED",
      "message": "本地分支结构正确",
      "visibility": "participant"
    }
  ],
  "metrics": [],
  "artifacts": [],
  "checkerVersion": "git-basic@1.0.0"
}
```

第一版路线只依据 `status` 和已有连线条件工作；`score`、`metrics` 和 `artifacts` 作为可选输出保存，不能直接改变地图拓扑。

`status` 的第一版取值为 `passed`、`failed`、`error` 或 `timeout`。

## 6. 会话生命周期

```text
pending
  → provisioning
  → ready
  → running
  → submitted
  → checking
  → passed / failed / error
  → destroying
  → destroyed
```

补充状态：

- `expired`：达到最大时长或空闲时长。
- `resetting`：参与者请求重试，旧 session 正在销毁。
- `terminal-disconnected`：终端断开但 session 仍在有效期内，可重新连接。

生命周期规则：

1. 浏览器刷新或短暂断线时，恢复同一 session。
2. 点击提交后冻结工作区，禁止继续写入。
3. checker 完成后销毁 microVM 和临时工作区。
4. 失败重试创建新的 session 和新的 attempt 编号。
5. 超时、异常和主动退出都必须执行清理流程。

## 7. 终端设计

浏览器端使用终端组件，通过 WebSocket 连接 Terminal Gateway：

```text
Browser Terminal
    ↓ WebSocket + short-lived token
Terminal Gateway
    ↓ session-scoped PTY protocol
Sandbox Agent
    ↓
microVM / bash
```

Terminal Gateway 负责：

- 校验 session token 和参与者权限。
- 转发键盘输入、终端输出和窗口尺寸变化。
- 限制单次输出量、连接数和空闲时间。
- 在 session 结束后关闭所有终端连接。

Sandbox Agent 负责：

- 在 microVM 内创建受控 PTY。
- 不暴露 Kubernetes API 或宿主机接口。
- 使用运行器提供的内部传输通道；具体可以是 vsock、串口代理或 RuntimeClass 的专用连接。

外部客户端不直接执行 `kubectl exec`，也不直接访问 microVM 管理接口。

## 8. 网络与依赖策略

第一版 sandbox 的网络模式为 `none`：

- 不分配可访问外部网络的网卡。
- Kubernetes NetworkPolicy 作为额外防线，而不是唯一防线。
- 不挂载云凭据、仓库 token 或镜像仓库凭据。
- 本地服务之间如有需要，使用 sandbox 内部回环通信，不开放外部出口。

由于没有网络，所有工具和依赖必须由 profile 镜像预置。参与者不能执行在线的 `apt`、`pip`、`npm` 或模型下载操作。需要更新依赖时，构建新镜像并发布新 profile 版本。

## 9. Git 任务模型

Git 任务只在 sandbox 内使用本地仓库：

- 不创建 GitHub、GitLab 或其他远程仓库。
- 可以在 `seed/` 中预置一个本地仓库、分支和提交历史。
- 远程列表默认为空，或只保留用于教学的本地路径。
- 参与者可以练习分支、提交、合并、rebase 和冲突处理。
- checker 通过本地 refs、提交图、工作区状态和文件内容进行判定。
- 不向参与者提供任何远程凭据。

对于不需要仓库的 Git 入门节点，可以只提供普通工作目录，由任务决定是否要求参与者执行 `git init`。

## 10. Checker 与提交

第一版采用显式提交：

1. 参与者点击“提交”。
2. Sandbox Controller 停止写入并冻结工作区。
3. 运行器生成只读工作区快照或受控挂载。
4. CheckerAdapter 在独立 checker 环境中加载隐藏测试。
5. checker 返回 `CheckerResult`。
6. 控制面保存结果，并通知地图运行器处理后续路线。

checker 不读取参与者网络、不修改参与者 session，也不把隐藏测试写回参与者工作区。原始终端日志和工作区快照是否保留由平台的留存策略决定，默认不长期保存。

## 11. Kubernetes 与 microVM 映射

控制面可以将 `SandboxSession` 映射为自定义资源或等价的内部对象。Controller 负责：

1. 解析 `nodeRef` 和 `profileRef`。
2. 校验资源上限、镜像 digest 和 sandbox 策略。
3. 创建使用 microVM RuntimeClass 的工作负载。
4. 创建有配额的临时工作区。
5. 等待 sandbox agent 就绪并发布终端连接信息。
6. 处理心跳、超时、提交、重试和销毁。

首个部署目标使用 Kata Containers RuntimeClass。后续 Firecracker-backed runtime 可以实现相同的 `SandboxAdapter` 接口，不改变 `SandboxSpec`、终端协议或地图模型。

## 12. 安全边界

每个参与者工作负载至少满足：

- microVM 隔离和独立 Kubernetes namespace 或等价隔离域。
- 非 root 用户和非特权运行。
- 只读根文件系统，只有工作区可写。
- 禁止 `hostPath`、host network、host PID 和任意设备挂载。
- 丢弃不需要的 Linux capabilities。
- 启用 seccomp、AppArmor 或等效运行时防护。
- 限制 CPU、内存、磁盘、PID 数量、输出量和总时长。
- ServiceAccount 只拥有运行器所需的最小权限。
- session token 短期有效，并且只绑定单个 session。

GPU 和未来 HPC profile 需要额外的设备与调度策略，但不能降低基础 sandbox 的默认隔离级别。

## 13. 逻辑接口

运行层只依赖抽象接口：

```text
SandboxAdapter
  ├─ provision(spec, attemptContext)
  ├─ attachTerminal(session)
  ├─ submit(session)
  ├─ reset(session)
  └─ destroy(session)

CheckerAdapter
  └─ check(frozenWorkspace, checkerRef)
```

地图运行器只消费 `CheckerResult`，不直接调用 Kubernetes、microVM 或终端接口。

## 14. 分阶段实现

### 阶段 1：契约与验证

- 固化 `SandboxSpec`、`SandboxSession` 和 `CheckerResult` schema。
- 实现离线 schema 校验和状态机测试。
- 增加 mock `SandboxAdapter`，验证地图运行器的调用边界。

### 阶段 2：基础 microVM sandbox

- 构建 `basic-linux@1` profile 镜像。
- 接入 Kubernetes + Kata RuntimeClass。
- 创建无网络、只读根文件系统和临时工作区。
- 实现 session 创建、销毁、超时和重试。

### 阶段 3：交互式终端

- 实现 Sandbox Agent 和 Terminal Gateway。
- 支持 PTY 输入、输出、窗口调整和断线重连。
- 增加输出限制、心跳和 session token。

### 阶段 4：Checker

- 实现提交冻结和工作区快照。
- 在独立 checker 环境中运行隐藏测试。
- 返回结构化结果，并接入地图路线引擎。

### 阶段 5：扩展 profile

- 增加 Python/AI、GPU 和模拟 HPC profile。
- 在不改变节点 schema 的前提下接入 Firecracker-backed runtime 或远程 HPC adapter。

## 15. 验收标准

设计进入实现后，至少应验证：

1. 可以为一个节点创建独立 session 并打开交互式终端。
2. 浏览器刷新后可以重连原 session。
3. sandbox 无法访问外部网络和宿主机文件。
4. 重试得到全新的工作区和 session。
5. Git 任务可以在本地仓库中完成，不依赖远程服务。
6. 点击提交后工作区被冻结，checker 可以读取但参与者不能继续修改。
7. checker 返回稳定的 `CheckerResult`，地图只消费结果而不依赖运行时实现。
8. 超时、失败、异常退出都能销毁资源并释放配额。
