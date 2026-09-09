# 贡献指南

感谢参与 NCUSCC 招新考核平台建设。贡献可以是平台代码、题目内容、设计文档、测试或公开资料整理。

## 开始之前

1. 查看现有 [Issues](https://github.com/NCUSCC/2026-Autumn-Recruitment/issues)，避免重复工作。
2. 内容设计先建立或认领 Issue；较大的代码改动先说明方案和兼容性。
3. 阅读 `docs/design/` 中的题目、Sandbox 和基础设施边界。

## 本地开发

```bash
npm install
npm run dev
npm run check
```

`npm run check` 必须完成类型检查、测试和生产构建。

## 提交规范

- 使用清晰的 Conventional Commits 前缀，例如 `feat:`, `fix:`, `docs:`, `test:`, `chore:`。
- 一个提交尽量只解决一个主题；平台代码和题目内容尽量分开。
- 不提交构建产物、个人配置、token、参考答案、隐藏测试或未授权的第三方资源。
- 新增题目必须说明适用 profile、输入输出、提示策略、通关条件和离线复现方式。

## Pull Request

Pull Request 需要说明目标、主要变更、验证命令和已知限制。涉及题目内容时，必须确认公开版本不泄露答案或内部凭据。
