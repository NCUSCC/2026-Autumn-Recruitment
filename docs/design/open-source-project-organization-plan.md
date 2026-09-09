# NCUSCC 招新考核平台开源整理实施计划

> 本计划对应 [NCUSCC 招新考核平台开源项目整理设计](./open-source-project-organization.md)，采用渐进迁移，保持现有编辑器和离线 Sandbox 的行为不变。

## 目标

将当前 React/Vite 原型整理为 NCUSCC 招新考核题目平台的正式开源仓库：代码、题目内容、设计文档和协作配置分层，且在干净环境中可构建、可测试。

## 文件边界

- `apps/editor/`：编辑器入口、React 组件、样式和 React Flow 适配。
- `packages/assessment-schema/`：题目文档类型和通用操作。
- `packages/map-runtime/`：地图校验。
- `packages/sandbox-contracts/`：现有 `src/sandbox` 的契约、状态机、Mock 和测试。
- `content/`：现有地图与 catalog 示例。
- `docs/design/`：正式设计和本实施计划；不创建 `docs/superpowers/` 文档。
- `.github/`、根目录规范文件和 `package.json`：开源协作与 CI。

## 实施任务

### 任务 1：建立工程边界

- 创建 `apps/editor`、`packages/assessment-schema`、`packages/map-runtime`、`packages/sandbox-contracts`、`content/catalogs`、`content/maps`、`content/nodes`、`content/checkers`、`docs/architecture`、`docs/authoring`、`docs/operations`、`docs/references` 和 `infra`。
- 将前端入口和组件移入 `apps/editor/src`，将 `index.html` 移入 `apps/editor/index.html`。
- 将 schema 类型与通用文档操作移入 `packages/assessment-schema/src`。
- 将地图校验移入 `packages/map-runtime/src`。
- 将 `src/sandbox` 移入 `packages/sandbox-contracts/src`，保留测试并修正导出。
- 将 `data/catalog` 和 `data/maps` 移入 `content/catalogs` 和 `content/maps`。

### 任务 2：配置 TypeScript、Vite 和 npm workspace

- 根 `package.json` 使用 `@ncuscc/recruitment-platform` 项目名，保留 `dev`、`build`、`test`，增加 `typecheck` 和 `check`。
- 使用 npm workspaces 声明 `apps/editor` 与 `packages/*`；各 workspace 提供自己的 package name 和 source export。
- `vite.config.ts` 将编辑器根目录设为 `apps/editor`，通过 alias 指向 packages 的 source，构建输出仍写入根 `dist/`。
- `tsconfig.app.json` 包含 `apps/editor/src` 和 `packages/*/src`，配置 `@ncuscc/*` paths。
- Vitest 扫描 `apps/**/*.test.ts` 和 `packages/**/*.test.ts`。

### 任务 3：重写项目说明和内容命名

- 重写 README，明确 NCUSCC、平台目标、当前能力、快速开始、题目模型、目录结构和路线图。
- 将示例 JSON 的显示名称改为清晰的 NCUSCC 示例名称，移除乱码和“地图编辑器”作为项目主标题的表述。
- 在 `content/README.md` 说明公开示例与私有考核答案的边界。
- 在 `docs/authoring/` 添加题目节点和地图编写入口，在 `docs/operations/` 添加本地开发和发布说明。

### 任务 4：补齐开源协作文件

- 添加 `.editorconfig`、`.gitattributes`、`.github/workflows/ci.yml`。
- 添加 `.github/ISSUE_TEMPLATE/bug-report.yml`、`.github/ISSUE_TEMPLATE/content-design.yml` 和 `.github/PULL_REQUEST_TEMPLATE.md`。
- 添加 `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`SECURITY.md`、`CHANGELOG.md`。
- 在 README 和贡献规范中声明 Apache-2.0、第三方资料链接规则和不得提交敏感考核答案的要求。

### 任务 5：验证和交付

- 运行 `npm install` 更新 lockfile，再运行 `npm run typecheck`、`npm test` 和 `npm run build`。
- 使用 `git diff --check` 检查空白和冲突标记。
- 确认临时 DOCX、构建产物和本地配置未被纳入提交。
- 汇总目录迁移、验证命令和未纳入范围，形成提交说明。
