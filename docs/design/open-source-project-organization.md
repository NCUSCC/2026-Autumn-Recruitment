# NCUSCC 招新考核平台开源项目整理设计

## 1. 项目定位

本项目是南昌大学超算俱乐部（NCUSCC）的招新考核题目构建与运行框架，目标是让出题者能够定义、编排、验证并逐步运行面向零基础新生的计算机系统与高性能计算考核题目。

项目不是单一的“地图编辑器”。地图编辑器是题目编排入口；题目文档、节点 Sandbox、Checker 和结果反馈共同组成考核平台。

```text
题目定义 -> 地图编排 -> Sandbox 执行 -> Checker 评测 -> 结果反馈
```

第一阶段仍然是本地、离线、可重复的原型：真实 Kubernetes、microVM、远程集群和在线评测服务不在本次整理范围内。

## 2. 开源项目边界

### 2.1 平台代码

- 题目文档 schema、版本校验和地图运行契约。
- 地图编排前端及其导入、导出、草稿保存能力。
- Sandbox 会话、适配器和 CheckerResult 的离线实现与测试。
- 未来可替换的运行时接口，不把 Kubernetes 或宿主机路径暴露给题目内容。

### 2.2 NCUSCC 内容

- 招新地图、独立节点、方向分类和 profile 索引。
- 题目说明、提示、通关条件、参考资料和 checker 配置。
- 课程参考链接与出题讨论记录。

内容必须通过稳定契约消费平台能力，不能从题目 JSON 反向依赖编辑器组件或宿主机实现。

## 3. 目标目录

```text
apps/
  editor/                         # 题目地图编排 Web 应用

packages/
  assessment-schema/             # Map/Node/Edge/Metadata 等题目契约
  map-runtime/                   # 地图结构校验和运行辅助逻辑
  sandbox-contracts/             # Sandbox、Session、CheckerResult 契约和 Mock

content/
  catalogs/                      # 阶段、方向、标签和 profile 索引
  maps/                          # 可编排地图文档
  nodes/                         # 独立题目节点包
  checkers/                      # checker 配置或后续实现

docs/
  architecture/                  # 平台架构、数据流和部署边界
  authoring/                     # 出题与节点编写指南
  operations/                    # 本地开发、发布和维护
  references/                    # 方向课程和公开资料
  design/                        # 已确认的正式设计与实施计划

infra/                           # CI、镜像和后续运行环境配置
.github/                         # Issue/PR 模板和 GitHub Actions
```

当前迁移保持功能等价：编辑器仍然使用 React/Vite，Sandbox 仍然是离线 Mock，不在整理阶段引入新的在线服务。

## 4. 包边界

### `@ncuscc/assessment-schema`

只包含题目文档的 TypeScript 类型、默认值、ID 生成、深拷贝和结构校验。它不依赖 React、浏览器 API 或具体运行时。

### `@ncuscc/map-runtime`

包含地图结构校验、可达性和分支配置检查。它只依赖 `assessment-schema`，校验结果使用稳定的 `ValidationMessage` 契约。

### `@ncuscc/sandbox-contracts`

包含 SandboxSpec、SandboxSession、CheckerResult、状态机、适配器接口和 MockSandboxAdapter。真正的容器、Kubernetes、microVM 和远程 HPC 适配器只能通过这些接口接入。

### `apps/editor`

只负责编辑器交互、React Flow 映射、表单和本地文件入口。它可以依赖上述 packages，但 packages 不得反向导入编辑器组件。

## 5. 内容版本与协作

- `schemaVersion`、地图版本、节点版本和 profile 引用必须显式记录。
- `content/` 中的每个地图或节点都应能在断网环境下被解析和校验。
- 参考答案、隐藏测试和组织内部凭据不得进入公开题目内容。
- 开源仓库提交平台代码、公开示例和设计文档；涉及真实考核答案的内容应通过私有内容包或受控发布流程管理。
- 所有新增方向先以 Issue 形式讨论，再添加节点包和 checker。

## 6. 开源工程规范

- 根 README 介绍项目目标、当前能力、快速开始、内容模型和路线图。
- `CONTRIBUTING.md` 规定分支、提交、测试和内容审查流程。
- `CODE_OF_CONDUCT.md`、`SECURITY.md` 和 Issue/PR 模板明确协作边界。
- GitHub Actions 至少执行 `npm ci`、`npm run build` 和 `npm test`。
- Apache-2.0 继续作为平台代码许可证；第三方资料只保留链接并尊重原许可证。
- 任何声称完成的改动都必须附带构建或测试结果。

## 7. 分阶段迁移

1. 建立 `apps/`、`packages/`、`content/`、`docs/` 和 `.github/` 边界，补齐项目元信息。
2. 将编辑器代码迁移到 `apps/editor`，将题目 schema、地图运行逻辑和 Sandbox 契约拆为 packages。
3. 将现有 `data` 迁移到 `content`，修复示例 JSON 的编码和项目命名。
4. 增加文档、贡献规范、CI 和内容校验入口。
5. 保持现有 `npm run dev`、`npm run build` 和 `npm test` 可用，再逐步增加节点包和真实运行时。

## 8. 本阶段完成标准

- 新贡献者可以只阅读 README 和 authoring 文档，理解项目不是单纯的编辑器，而是招新考核题目平台。
- 前端、题目契约、地图校验和 Sandbox Mock 的依赖方向清晰。
- 示例地图和分类位于 `content/`，设计文档位于 `docs/`，不再通过模糊的根目录 `data` 表达职责。
- CI 能在干净环境中构建和运行全部测试。
- 根目录不提交临时导出物、个人考核方案或包含隐私的文件。
