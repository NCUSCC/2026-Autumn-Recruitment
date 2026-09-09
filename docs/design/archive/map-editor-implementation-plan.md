# 招新考核地图编辑器实现计划

**目标：** 搭建一个面向组织者的可视化地图编辑器骨架，支持空节点的拖拽编排、连线、元数据编辑、结构校验和 JSON 导入导出。

**架构：** 使用 Vite + React + TypeScript 构建单页编辑器，React Flow 负责画布节点、端口和连线交互，应用状态转换为稳定的 `MapDocument` JSON。仓库中的 `data/maps`、`data/nodes` 和 `data/catalog` 分别表达拓扑、节点资源和分类目录；第一版界面以内存状态和浏览器本地草稿为主，导入导出是正式文件协作入口。

**技术栈：** React 18、TypeScript、Vite、`@xyflow/react`、`lucide-react`、原生 File API 和 CSS design tokens。

---

## 任务 1：建立仓库数据骨架与前端工程

文件：

- 新建 `package.json`、`tsconfig.json`、`tsconfig.node.json`、`vite.config.ts`、`index.html`
- 新建 `src/main.tsx`、`src/App.tsx`、`src/types.ts`、`src/styles.css`
- 新建 `data/maps/recruitment-map/map.json`
- 新建 `data/catalog/categories.json`

步骤：

- 创建 Vite React TypeScript 工程配置，依赖 React、React DOM、`@xyflow/react` 和 `lucide-react`。
- 定义 `MapDocument`、`MapNode`、`MapEdge`、节点元数据、分类目录和校验消息类型。
- 提供版本为 `1.0.0` 的空地图 JSON 和空分类 JSON，不加入具体关卡内容。
- 建立应用入口和全局样式 token，确保页面以工具型三栏布局启动。
- 运行 `npm install` 和 `npm run build`，确认工程能够编译。

## 任务 2：实现地图状态与校验逻辑

文件：

- 新建 `src/lib/map.ts`
- 新建 `src/lib/validation.ts`

步骤：

- 编写稳定 ID 生成、空节点创建、节点复制和地图文档序列化函数。
- 编写 React Flow 节点/边与 `MapDocument` 互相转换的函数，确保坐标和元数据不丢失。
- 实现结构错误、配置警告和待补充项三类校验：起点/终点、悬空引用、不可达节点、分支条件、空元数据等。
- 为导入数据做最小 schema 检查；错误时返回可读消息并保留当前编辑状态。

## 任务 3：实现画布和节点面板

文件：

- 新建 `src/components/EditorCanvas.tsx`
- 新建 `src/components/NodePalette.tsx`
- 新建 `src/components/MapNode.tsx`
- 新建 `src/components/Toolbar.tsx`

步骤：

- 使用 React Flow 渲染网格画布、缩放、平移、选择、节点拖动和连线。
- 左侧按节点类型提供空节点模板，支持拖入画布创建节点。
- 节点卡片仅显示类型、标题、方向标签和待补充状态，不嵌入长文本。
- 工具栏提供新建、保存草稿、导入、导出、校验和适应画布按钮。
- 连接时自动生成稳定边 ID，支持删除和重新连接。

## 任务 4：实现属性编辑和校验面板

文件：

- 新建 `src/components/PropertiesPanel.tsx`
- 新建 `src/components/ValidationPanel.tsx`

步骤：

- 选中节点时编辑标题、方向标签、任务说明、提示列表、通关条件、重试配置和 sandbox 引用。
- 选中连线时编辑触发方式、条件描述和显示标签。
- 空选择时展示当前地图摘要和下一步提示。
- 底部按错误、警告、待补充分组展示校验结果，并支持点击消息定位对象。
- 所有输入修改即时更新内存地图并标记未保存状态。

## 任务 5：实现文件协作入口和验证

文件：

- 修改 `src/App.tsx`、`src/lib/map.ts`、`src/styles.css`
- 新建 `README.md`

步骤：

- 实现 JSON 导入导出、浏览器本地草稿保存和恢复。
- 导出文件保持稳定字段顺序和 `schemaVersion`，文件名包含地图 ID。
- 在 README 中说明启动、构建、数据目录职责和第一版边界。
- 运行 `npm run build`，检查 TypeScript 编译和 Vite 产物。
- 启动 `npm run dev -- --host 0.0.0.0`，通过浏览器手动验证拖拽节点、连接、编辑属性、校验和导出流程。

## 自检清单

- 未提交任何 `docs/superpowers` 文档。
- `data` 中没有具体关卡题目或答案。
- 地图拓扑、节点资源和分类目录边界在文档与代码中一致。
- 第一版不启动 sandbox、不执行判题、不实现参与者端。
