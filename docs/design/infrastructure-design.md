# 招新考核 Sandbox 基础设施层总体设计

## 1. 文档目的

本文档把现有的地图编辑器和 sandbox 契约扩展为一套完整的基础设施层设计。它描述从节点资源包到可交互运行环境、终端连接、提交判定和资源回收的完整边界，供后续实现控制面、Kubernetes 部署、microVM runtime、终端网关和 checker 使用。

本文档仍然不包含具体关卡题目、答案、隐藏测试内容或参与者端地图产品设计。Git、Linux、C/C++、HPC、CPU/GPU、机器学习/深度学习会作为独立方向继续拆分设计。

## 2. 已确认的架构决策

| 决策 | 结论 |
| --- | --- |
| 运行调度 | Kubernetes 负责资源调度、会话编排和生命周期 |
| 隔离边界 | 使用 microVM-backed RuntimeClass；首个目标为 Kata Containers，保留 Firecracker 适配接口 |
| 终端 | 浏览器通过 WebSocket 连接交互式 PTY；不把 `kubectl exec` 暴露给用户 |
| 网络 | 参与者 sandbox 默认完全断网；控制面通过运行时专用通道提供终端和控制能力 |
| 依赖 | 工具、编译器、Python 包、AI/HPC 库全部预置在不可变 profile 镜像中 |
| Git | 只使用 sandbox 内的本地 Git，不创建 GitHub/GitLab 远程仓库 |
| 重试 | 每次重试创建全新的 session、microVM 和工作区，不恢复失败环境 |
| 判定 | 显式提交后冻结工作区，由独立 checker 读取隐藏测试并返回结构化结果 |
| 地图关系 | checker 只返回结果，不直接修改地图拓扑；路线引擎消费 `CheckerResult` |

## 3. 目标与边界

### 3.1 目标

1. 为每次参与者尝试提供可重建、可审计、可限额的交互式终端环境。
2. 将任务内容、运行 profile、sandbox 生命周期、checker 和地图路线解耦。
3. 在断网条件下支持基础 Shell、Git、C/C++、Python、GPU 和模拟/远程 HPC 方向。
4. 支持浏览器刷新、短暂断线后的会话重连，并保证提交后的环境不可继续写入。
5. 允许后续从 Kata 切换到 Firecracker，或增加 GPU、远程 HPC adapter，而不修改节点资源格式。
6. 对环境创建、终端连接、提交、判定、超时和销毁提供可观测性。

### 3.2 非目标

- 不允许参与者从 sandbox 访问互联网、GitHub、GitLab、包仓库或云 API。
- 不允许运行时执行 `apt`、`pip install`、`npm install` 或下载模型/数据集。
- 不把宿主机目录、Kubernetes 凭据、云密钥或镜像仓库凭据挂载给参与者。
- 不把真实参与者任务直接提交到生产 HPC/Slurm 集群；该能力通过后续受控 adapter 设计。
- 不在第一版实现逐命令实时判题、排行榜或复杂计费。

## 4. 分层架构

```text
内容层 Content Plane
  NodePackage / Seed / SandboxSpec / CheckerRef
              │
              ▼
控制层 Control Plane
  API Gateway ─ Session Service ─ Sandbox Controller
       │              │                  │
       │              ├─ PostgreSQL       ├─ Kubernetes API
       │              ├─ Object Storage   └─ RuntimeClass
       │              └─ Audit/Event Log
       │
       └─ Terminal Gateway ─ Runtime Connector
                                      │
                                      ▼
执行层 Execution Plane
  Kubernetes Workload → Kata/Firecracker microVM → Sandbox Agent → PTY
                                      │
                                      ▼ submit / frozen snapshot
判定层 Checking Plane
  Checker Controller → isolated Checker Job → CheckerResult
                                      │
                                      ▼
路线层 Map Runtime / MapState
```

### 4.1 内容层

内容层是版本化、可审查的 Git 资源，不在运行时动态修改：

```text
data/nodes/<node-id>/
  node.json
  public/                       # 参与者可见材料
  sandbox/spec.json             # SandboxSpec
  sandbox/seed/                 # 只读初始工作区，可含本地 Git 仓库
  checker-ref.json              # checker 的不可变引用

infra/profiles/<profile-id>/
  profile.json                  # 平台维护的 profile 元数据
```

隐藏测试和 checker 镜像只通过 `checkerRef` 引用，不能从 `public/` 或参与者工作区读取。

### 4.2 控制层

控制层负责身份、session、权限、资源配额、状态机和 Kubernetes desired state，不执行参与者命令，也不直接判定任务答案。

主要服务：

- **API Gateway**：提供创建 session、查询状态、提交、重试和终端 token 接口。
- **Session Service**：持久化 `SandboxSession`，处理幂等请求、租约、超时和重连。
- **Sandbox Controller**：把 session desired state reconcile 为 Kubernetes 工作负载，处理就绪、失败和清理。
- **Terminal Gateway**：持有短期 token，转发 PTY 数据和窗口尺寸，不暴露 Kubernetes API。
- **Checker Controller**：接收冻结工作区，创建隔离 checker job 并回写 `CheckerResult`。
- **Profile Registry**：提供已批准 profile 的镜像 digest、RuntimeClass、配额和工具链声明。

### 4.3 执行层

每个 session 对应一个带唯一标签的 Kubernetes workload，并使用 microVM RuntimeClass：

- 首个 runtime 使用 Kata Containers。
- `SandboxAdapter` 不依赖 Kubernetes SDK 的具体实现，后续可接 Firecracker-backed runtime。
- sandbox 内运行 `Sandbox Agent`，负责创建 PTY、冻结工作区、报告心跳和执行受控的本地操作。
- 参与者进程不能访问 Kubernetes API；agent 也不向参与者暴露控制面凭据。

### 4.4 判定层

checker 与参与者 workload 分离：

- checker 在独立 namespace 或等价隔离域中运行。
- checker 只读访问冻结工作区快照和私有 checker bundle。
- checker 默认断网，使用独立的 CPU/内存/时长配额。
- checker 输出只能是经过 schema 校验的 `CheckerResult`。

## 5. Kubernetes 部署拓扑

### 5.1 集群组件

```text
recruitment-control namespace
  api-gateway
  session-service
  sandbox-controller
  checker-controller
  terminal-gateway

recruitment-runtime namespace
  SandboxSession workloads (one per active attempt)
  RuntimeClass: kata / firecracker

recruitment-checker namespace
  short-lived checker jobs

platform services
  PostgreSQL
  S3-compatible object storage
  container registry
  Prometheus / OpenTelemetry collector
```

控制服务可以部署多副本；session 状态以 PostgreSQL 为事实来源，Kubernetes workload 由 controller 通过幂等 reconcile 创建和清理。终端连接状态可以保存在 gateway 内存中，session 断线后由 token 重新绑定，不把 PTY 过程状态写入地图文件。

### 5.2 `SandboxSession` 自定义资源

真实部署可以使用 CRD，也可以先使用等价的内部数据库对象。若使用 CRD，建议分离 spec/status：

```yaml
apiVersion: recruitment.ncuscc.org/v1alpha1
kind: SandboxSession
metadata:
  name: attempt-uuid
  labels:
    recruitment.ncuscc.org/node: node-example
    recruitment.ncuscc.org/participant: participant-hash
spec:
  nodeRef: node-example@1.0.0
  profileRef: basic-linux@1
  attempt: 1
  networkMode: none
  runtimeClassName: kata
  maxLifetimeSeconds: 1800
status:
  phase: Running
  workloadName: sandbox-attempt-uuid
  agentReady: true
  terminalAttachable: true
  observedGeneration: 1
```

controller 只接受经过 profile registry 和 admission policy 校验的字段，参与者或节点作者不能通过 `SandboxSpec` 任意注入 Pod、volume、capability 或 RuntimeClass。

## 6. Profile 与离线镜像体系

### 6.1 Profile 内容

节点只引用 profile，不直接指定底层 Kubernetes 配置。每个 profile 至少包含：

```json
{
  "id": "basic-linux",
  "version": "1.0.0",
  "imageDigest": "sha256:...",
  "runtimeClass": "kata",
  "resources": {
    "cpuMillis": 1000,
    "memoryMiB": 1024,
    "ephemeralStorageMiB": 2048,
    "pids": 256
  },
  "tools": ["bash", "coreutils", "git"],
  "network": "none",
  "terminal": { "shell": "/bin/bash", "pty": true },
  "limits": {
    "maxLifetimeSeconds": 1800,
    "idleTimeoutSeconds": 600,
    "maxOutputBytes": 10485760
  }
}
```

profile 的资源上限由平台维护。节点可以在上限内选择生命周期参数，但不能扩大 CPU、内存、磁盘、进程数或输出量。

### 6.2 镜像发布链路

```text
锁定工具链清单
  → 离线/受控网络构建镜像
  → 生成 SBOM 和漏洞报告
  → 签名并推送不可变 digest
  → profile registry 发布新版本
  → staging smoke test
  → 生产 allowlist
```

运行中的 sandbox 只拉取已批准 digest；不允许浮动 tag。依赖升级通过新的 profile 版本完成，不能在 session 内安装。

### 6.3 初始 profile 分类

- `basic-linux`：Shell、文件、进程、权限和本地 Git。
- `c-cpp-cpu`：固定版本 GCC/Clang、CMake/Make、调试和 sanitizer 工具。
- `python-cpu`：固定 Python 和基础科学计算包。
- `gpu-small`：固定 CUDA/ROCm/驱动兼容矩阵和小型 GPU 配额。
- `hpc-adapter`：本地 MPI/OpenMP/性能工具或受控的远程 HPC 适配入口，不默认开放外部网络。
- `ml-dl-cpu`、`ml-dl-gpu`：预置框架、数据和模型缓存，运行时只读。

具体 profile 不在基础设施层写死任务内容；方向 issue 负责定义各 profile 的工具链和验收矩阵。

## 7. Session 生命周期与一致性

### 7.1 状态流转

```text
Pending
  → Provisioning
  → Ready
  → Running
  → Submitted
  → Checking
  → Passed / Failed / Error / Expired
  → Destroying
  → Destroyed
```

附加控制状态：

- `TerminalDisconnected`：PTY 断开，但 session 仍为 `Ready` 或 `Running`，可以重连。
- `Resetting`：旧 session 正在销毁，新的 attempt 尚未完成 provision。
- `Orphaned`：控制面丢失观察结果，controller 需要通过标签和 lease 恢复 reconcile。

### 7.2 一致性规则

1. 创建、提交、重试和销毁接口必须支持 idempotency key。
2. PostgreSQL session 状态是控制面事实来源，Kubernetes status 是执行观察结果。
3. controller 使用 generation、lease 和 finalizer 防止重复创建或遗漏清理。
4. session 进入 `Submitted` 后拒绝新的终端输入。
5. checker 超时、控制器重启和节点失联都必须最终收敛到 `Error`、`Expired` 或 `Destroyed`。
6. 重试永远增加 attempt 编号并使用新的 session ID、工作区和终端 token。

### 7.3 时间限制

- `maxLifetimeSeconds`：从 session 创建开始计算的硬上限。
- `idleTimeoutSeconds`：没有终端输入、窗口变化或心跳时的空闲上限。
- checker 有独立的 `checkerTimeoutSeconds`，不复用参与者 session 的终端超时。
- 控制器使用服务端时间，不信任浏览器时间。

## 8. 终端网关与 PTY 协议

### 8.1 连接路径

```text
Browser xterm.js
  ↓ HTTPS 获取短期 terminal token
Terminal Gateway
  ↓ WSS / session-scoped PTY protocol
Runtime Connector
  ↓ vsock / serial proxy / RuntimeClass 专用通道
Sandbox Agent
  ↓
PTY → /bin/bash
```

浏览器永远不直接调用 `kubectl exec`、containerd、Kata 或 Firecracker API。

### 8.2 `pty-v1` 消息

最小消息集合：

```json
{ "type": "input", "data": "git status\n" }
{ "type": "resize", "cols": 120, "rows": 36 }
{ "type": "output", "data": "..." }
{ "type": "heartbeat", "timestamp": "..." }
{ "type": "close", "reason": "submitted" }
```

网关必须实现：

- 短期 token 校验、session 绑定和单用户并发连接限制。
- 输入长度、输出速率、累计输出量和心跳限制。
- 断线重连窗口；重连不创建新 session。
- session 结束后关闭所有连接并撤销 token。
- 日志脱敏，不记录完整终端输入中的潜在密钥或个人信息。

## 9. 工作区与种子资源

### 9.1 目录布局

```text
/opt/recruitment/public       # 只读任务材料
/opt/recruitment/seed         # 只读种子来源
/workspace                    # 唯一可写目录
/run/recruitment              # agent 运行时目录
```

根文件系统只读；`/workspace` 使用带配额的临时卷。seed 可以在 session 启动时复制到 workspace，也可以通过只读层挂载后由任务显式复制。

### 9.2 本地 Git

- seed 可以包含完整的本地 Git 对象库、分支和提交历史。
- `.git/config` 中不写入外部远程 URL 或凭据。
- checker 只读取本地 refs、提交图、工作区状态和文件内容。
- 工作区、Git 对象和终端日志随 session 一起销毁或按留存策略短期保留。

## 10. 提交、冻结和 Checker

### 10.1 提交流程

```text
参与者点击提交
  → API Gateway 校验 session 和幂等 key
  → Session Service 标记 Submitted
  → Terminal Gateway 关闭输入
  → Sandbox Agent 停止新进程并冻结 workspace
  → 创建只读 snapshot
  → Checker Controller 创建 checker job
  → 校验 CheckerResult
  → 更新 session 结果
  → Map Runtime 根据结果处理连线
  → 清理 sandbox
```

冻结不是只依赖前端按钮：控制面、gateway、agent 和 checker 都要拒绝提交后的写入。快照必须是 checker 可复现的只读输入。

### 10.2 Checker Job

checker job 使用：

- 参与者 workspace 的只读快照。
- 私有 checker 镜像或 bundle。
- 独立 CPU、内存、磁盘、PID 和运行时长限制。
- 默认无网络和无参与者凭据。

checker 不得把隐藏测试、参考答案或私有路径写入参与者可见 artifact。返回结果使用已有 `CheckerResult`：

```text
passed | failed | error | timeout
score? / metrics? / artifacts?
feedback.visibility = participant | organizer
```

### 10.3 结果与地图解耦

地图运行器只接收结构化结果，并根据地图已有的 edge trigger/condition 决定后继节点。checker 不知道地图拓扑，也不能直接解锁节点或修改用户进度。

## 11. API 与内部接口

### 11.1 对外 API

```text
POST   /v1/sessions                         创建一次 attempt
GET    /v1/sessions/{id}                    查询状态和公开结果
POST   /v1/sessions/{id}/terminal-token     获取短期终端 token
WS     /v1/terminal?token=...               建立 pty-v1 连接
POST   /v1/sessions/{id}/submit             冻结并进入 checker
POST   /v1/sessions/{id}/reset              销毁旧 session 并创建新 attempt
DELETE /v1/sessions/{id}                    主动退出并清理
```

所有写操作要求 `Idempotency-Key`；响应不返回 Kubernetes Pod 名称、节点地址、运行时 socket 或 checker 私有信息。

### 11.2 控制面接口

```text
SandboxAdapter
  provision(spec, attemptContext)
  attachTerminal(session)
  submit(session)
  reset(session)
  destroy(session)

CheckerAdapter
  check(frozenWorkspace, checkerRef)

ProfileRegistry
  resolve(profileRef)
  verify(imageDigest, policy)
```

真实 Kubernetes/Kata/Firecracker 实现只能依赖这些接口，不能渗透到地图编辑器和节点元数据模型。

## 12. 安全设计

### 12.1 Sandbox workload

- microVM-backed RuntimeClass。
- 非 root 用户、非特权容器、只读根文件系统。
- 禁止 `hostPath`、host network、host PID、host IPC 和任意设备挂载。
- 丢弃 Linux capabilities，启用 seccomp、AppArmor 或同等策略。
- 通过 admission policy 拒绝未签名镜像、浮动 tag、额外 volume 和未批准 runtime class。
- 每个 workload 绑定最小权限 ServiceAccount；参与者容器不挂载 token。
- 使用 ResourceQuota、LimitRange、PodDisruptionBudget 和节点污点隔离运行 profile。

### 12.2 网络

- sandbox 不创建可访问外部网络的接口。
- Kubernetes NetworkPolicy 作为第二层防线，不能替代 runtime 级断网。
- 终端和控制通道走 runtime connector 的 out-of-band 通道，不给参与者进程提供出口。
- checker 同样默认断网；profile 若未来需要内部服务，必须单独定义 allowlist 和安全审查。

### 12.3 凭据与隐私

- terminal token 短期有效、绑定 participant/session/权限和过期时间。
- 不将个人信息、token、云凭据、仓库凭据写入 seed 或镜像。
- 终端日志默认短期留存并脱敏；工作区快照在判定和申诉窗口结束后删除。
- 管理员操作、手动销毁、结果覆核和 profile 发布写入不可抵赖审计日志。

## 13. 存储与留存

| 数据 | 推荐存储 | 生命周期 |
| --- | --- | --- |
| Session 元数据和状态 | PostgreSQL | 至少保留到考核结束和申诉窗口结束 |
| NodePackage/profile/checker manifest | Git + 对象存储/镜像仓库 | 按版本长期保留 |
| seed/public 材料 | 镜像层或对象存储 | 随资源版本保留 |
| workspace snapshot | S3 兼容对象存储 | 默认短期，申诉时可延长 |
| 终端日志 | 日志系统 | 短期、脱敏、可配置 |
| CheckerResult | PostgreSQL | 与 session 结果一致 |
| 指标和审计事件 | Prometheus/日志系统 | 按平台留存策略 |

对象存储中的 snapshot 必须使用 session-scoped key、服务端加密和生命周期规则，checker job 只拿到一次性只读访问权限。

## 14. 可观测性与故障处理

### 14.1 指标

至少采集：

- session 创建成功率、provision 延迟、ready 延迟。
- active sessions、按 profile 的资源使用和配额拒绝数。
- terminal 连接数、断线率、重连率、输出限流次数。
- submit 到 checker 完成延迟、checker 失败/超时数。
- destroy 成功率、孤儿 workload 数和清理延迟。
- 镜像拉取失败、runtime 启动失败、agent 心跳丢失。

### 14.2 故障规则

- API 重试使用幂等 key，不能因为网络重试创建多个 session。
- controller 重启后通过 PostgreSQL/CRD 和 workload label 恢复 reconcile。
- agent 心跳超时进入 `Error` 或 `Expired`，随后强制销毁 workload。
- checker job 卡住由独立 timeout controller 清理，不阻塞 session controller。
- 节点维护时不迁移 `Running` session；向参与者报告错误并提供一次全新 retry。
- 所有清理动作使用 finalizer，避免删除记录后留下不可见 workload。

## 15. 资源配额与调度

配额分三层：

1. **平台配额**：整个考核活动的 CPU、内存、GPU、并发 session 和对象存储上限。
2. **方向/profile 配额**：例如 GPU profile 的并发数和单 session 显存限制。
3. **节点/session 配额**：生命周期、工作区大小、PID、输出量和 checker 时长。

调度优先级默认为公平共享；不允许参与者通过节点元数据提高优先级。GPU profile 必须绑定明确的 device plugin、RuntimeClass 兼容矩阵和回收策略。HPC profile 若需要远程资源，应由独立队列和凭据代理控制，不能把集群凭据注入 sandbox。

## 16. 发布与环境管理

### 16.1 环境版本

节点引用和 profile 引用都必须包含版本。已开始的 session 永远使用解析时锁定的 node/profile/checker 版本，不随仓库最新内容漂移。

### 16.2 发布门禁

profile 或 checker 发布前必须完成：

- schema 校验和静态策略检查。
- 镜像 digest、SBOM、漏洞扫描和签名验证。
- 无网络 smoke test。
- 终端连接、断线重连、超时、提交和销毁测试。
- checker 对固定 seed 的可重复性测试。
- 资源上限和异常退出清理测试。

### 16.3 开发环境

本地开发先使用 `MockSandboxAdapter` 和固定测试夹具；真实集群使用独立 staging。禁止把本地 Docker socket、宿主机路径或开发者 kubeconfig 带入正式 workload。

## 17. 分阶段建设路线

### P0：契约与策略（当前已部分完成）

- `SandboxSpec`、`SandboxSession`、`CheckerResult` schema。
- 状态机、校验器、mock adapter。
- profile、网络、重试和 checker 边界的正式设计。

### P1：最小真实运行时

- 准备 staging Kubernetes 集群和 Kata RuntimeClass。
- 建立 `basic-linux@1` 镜像、profile registry 和 admission policy。
- 实现 Sandbox Controller、Session Service 和最小 CRD/数据库状态。
- 创建无网络、只读根文件系统、临时 workspace 的真实 session。

### P2：交互式终端

- 实现 Sandbox Agent、Runtime Connector 和 Terminal Gateway。
- 接通 `pty-v1`、短期 token、断线重连、输出限流和窗口调整。
- 完成浏览器终端与一个真实 Linux session 的端到端测试。

### P3：提交与 checker

- 实现 workspace freeze、snapshot、Checker Controller 和只读 checker job。
- 完成 `CheckerResult` 校验、结果持久化和地图运行器接口。
- 验证 Git 本地仓库任务不依赖网络。

### P4：方向 profile

- C/C++、Python、GPU、ML/DL 和 HPC profile。
- 为每个方向建立独立资源、工具链和 checker 设计。
- 进行资源压力、隔离、可重复性和清理测试。

### P5：强化隔离与扩展

- 评估 Firecracker-backed runtime、GPU microVM 和远程 HPC adapter。
- 增加 admission policy、SBOM/签名强制、灾备和多集群调度。
- 根据真实考核规模决定是否引入事件总线、独立队列和更细粒度租户隔离。

## 18. 基础设施层完成标准

只有同时满足以下条件，才能称为“真实基础设施层完成”：

1. 能从一个版本化节点资源包创建真实 microVM session。
2. 参与者能通过浏览器终端连接、执行命令并在断线后重连。
3. sandbox 不能访问外网、宿主机文件或 Kubernetes API。
4. profile 镜像可复现、依赖预置、使用不可变 digest 并通过发布门禁。
5. 提交后终端写入被拒绝，checker 能读取只读快照并返回结构化结果。
6. 失败、超时、断电、controller 重启和重试都能清理或收敛，不留下孤儿资源。
7. Git、Linux 和至少一个编译/运行方向可以在断网环境下完成端到端验收。
8. 资源、审计、终端、checker 和清理指标可观测，并有明确留存策略。

## 19. 后续方向 issue 的拆分原则

方向 issue 只负责内容模型、profile 工具链、节点模板、checker 规则和验收样例，不重复实现控制面或 runtime。所有方向必须遵守：

- 使用已批准的 profile，而不是自行配置 Kubernetes 参数。
- 默认无网络，依赖通过镜像版本发布。
- 任务可通过本地 seed 重现，checker 不依赖远程服务。
- 结果通过 `CheckerResult` 返回，不能直接修改地图路线。
- 先定义零基础新生可理解的渐进路线，再增加可选深度节点。

