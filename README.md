# 招新考核地图编辑器

这是超算俱乐部 2026 秋季招新的地图编排器骨架，面向组织者和出题协作者。第一版只负责地图结构与节点元数据编辑，不运行 sandbox、不判题，也不包含具体关卡内容。

## 启动

```bash
npm install
npm run dev
```

打开终端输出的本地地址即可使用。生产构建使用 `npm run build`。

## 目录模型

- `data/maps/<map-id>/map.json`：地图拓扑、节点引用和画布位置。
- `data/nodes/<node-id>/node.json`：独立节点元数据，第一版预留。
- `data/catalog/categories.json`：阶段、方向和标签分类，第一版为空。
- `docs/design/`：正式设计文档和实现计划。

编辑器中的导入与导出使用稳定的 `MapDocument` JSON。浏览器草稿保存在本地存储，导出的 JSON 才是适合提交到 Git 的正式文件。

## Sandbox 第一阶段

`src/sandbox/` 当前只提供独立节点 sandbox 的契约、离线校验、会话状态机和内存 `MockSandboxAdapter`，用于验证地图运行器的调用边界。真实 Kubernetes、microVM、Terminal Gateway 和 checker 部署属于后续阶段；第一阶段不会启动容器，也不会连接外部网络。

运行测试：

```bash
npm test
```

Sandbox 的正式边界和后续部署方案见 `docs/design/sandbox-design.md`，实现顺序见 `docs/design/sandbox-implementation-plan.md`。

## 基础设施层

`src/infrastructure/` 提供与真实控制面相同的替换边界：profile registry/admission、session service 的幂等创建/提交/重试/销毁、短期终端 token 与 `pty-v1` 消息校验、冻结快照、checker timeout、控制器 reconcile、API facade 以及内存指标和审计事件。默认实现只使用内存存储，生产部署应将这些接口接到 PostgreSQL、对象存储、Kubernetes/Kata 和 Terminal Gateway；参与者环境始终要求不可变 profile、只读根文件系统和 `network: none`。
