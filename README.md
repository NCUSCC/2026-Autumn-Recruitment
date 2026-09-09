# NCUSCC 招新考核平台

南昌大学超算俱乐部（NCUSCC）的招新考核题目构建与运行框架。

本项目帮助出题者定义独立题目节点、编排分支地图、配置 Sandbox 和 Checker，并在离线环境中验证题目结构。地图编辑器只是题目编排入口，不是项目本身的全部目标。

> 当前版本处于早期工程化阶段：编辑器、Sandbox 契约和基础设施控制面参考实现已有可运行原型，真实集群连接、在线评测和具体招新题内容仍在后续建设中。

## 能做什么

- 使用 React Flow 拖拽编排考核地图和分支。
- 编辑节点的任务说明、提示、通关条件、重试策略和 Sandbox 引用。
- 导入、导出和校验版本化的地图 JSON。
- 使用离线 `MockSandboxAdapter` 验证 Sandbox 会话状态机与 `CheckerResult` 契约。
- 使用 transport-neutral 的基础设施参考实现验证 profile、session、terminal、snapshot 和 checker 边界。
- 为 Git、Linux、C/C++、HPC、CPU/GPU、CUDA、机器学习/深度学习等方向持续添加题目内容。

## 当前边界

当前仓库不连接远程 Git、外部网络或 HPC 集群。基础设施层的 TypeScript 实现使用内存存储，Kubernetes/Kata、对象存储、PostgreSQL、真实 PTY 和在线 checker 仍需后续接入。所有示例和测试都应能在本地、断网环境中重复运行。

真实招新活动中的隐藏测试、参考答案、个人信息和凭据不得提交到公开内容目录。

## 快速开始

环境要求：Node.js 20 LTS 或更高版本、npm 10 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开 Vite 输出的本地地址即可使用题目编排器。

提交前运行完整检查：

```bash
npm run check
```

单独运行构建和测试：

```bash
npm run build
npm test
```

## 仓库结构

```text
apps/editor/                 # 题目地图编排 Web 应用
packages/assessment-schema/  # Map/Node/Edge 等题目文档契约
packages/map-runtime/        # 地图结构校验与运行辅助逻辑
packages/sandbox-contracts/  # Sandbox、Session、CheckerResult 和 Mock
packages/infrastructure/     # 控制面、profile、terminal、snapshot、checker 参考实现
content/                     # NCUSCC 的公开地图、节点和分类
docs/                        # 架构、出题、运维和正式设计文档
infra/                       # Kubernetes policy、CRD 和 profile 基线
.github/                     # CI、Issue/PR 模板与协作规范
```

详细边界见：[开源项目整理设计](docs/design/open-source-project-organization.md)和[基础设施层设计](docs/design/infrastructure-design.md)。

## 内容工作流

1. 在 GitHub Issue 中讨论方向和题目节点目标。
2. 在 `content/nodes/` 定义独立节点，在 `content/maps/` 编排地图。
3. 使用 `assessment-schema` 和 `map-runtime` 校验文档。
4. 为需要执行环境的节点声明 profile/Sandbox 引用和 Checker 契约。
5. 通过编辑器导入/导出 JSON，提交可审查的内容变更。

出题指南和 Sandbox 设计位于 [`docs/design/`](docs/design/)。

## 基础设施层参考实现

`packages/infrastructure/` 提供与真实控制面相同的替换边界：profile registry/admission、session service 的幂等创建/提交/重试/销毁、短期终端 token 与 `pty-v1` 消息校验、冻结快照、checker timeout、controller reconcile、API facade 以及内存指标和审计事件。生产部署应将这些接口接到 PostgreSQL、对象存储、Kubernetes/Kata 和真实 Terminal Gateway；参与者环境始终要求不可变 profile、只读根文件系统和 `network: none`。

`infra/kubernetes/` 和 `infra/profiles/` 只保存平台基线，不包含参与者内容、secret、hostPath 或 floating image tag。

## 参与贡献

请先阅读：

- [贡献指南](CONTRIBUTING.md)
- [行为准则](CODE_OF_CONDUCT.md)
- [安全策略](SECURITY.md)
- [变更记录](CHANGELOG.md)

方向设计、题目内容和平台代码应分开提交；所有改动必须通过 CI 的类型检查、测试和构建。

## 许可证

平台代码和仓库文档以 [Apache License 2.0](LICENSE) 发布。外部课程、图片、数据集和工具只保留其官方链接，并遵守各自许可证与署名要求。

NCUSCC 是南昌大学超算俱乐部的组织标识；许可证不授予未经许可使用组织名称或标识的权利。
