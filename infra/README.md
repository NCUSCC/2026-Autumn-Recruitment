# 运行基础设施

本目录保存基础设施层的 Kubernetes policy、CRD 和不可变 profile 基线。它们只描述平台能力，不包含参与者题目内容、secret、hostPath 或 floating image tag。

## 目录

- `kubernetes/`：控制面、运行面和 checker 面的 namespace、quota、network policy、RuntimeClass 约束与 `SandboxSession` CRD。
- `profiles/`：可审查、版本化的 Sandbox profile 示例。

当前 TypeScript 控制面参考实现位于 `packages/infrastructure/`，默认使用内存存储。应用到 staging 集群前，需要由部署方替换 controller 镜像、配置 Kata `RuntimeClass`，并通过正式发布门禁验证 profile digest、网络隔离和资源限制。
