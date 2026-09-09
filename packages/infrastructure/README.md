# `@ncuscc/infrastructure`

离线、transport-neutral 的基础设施控制面参考实现。它提供 profile/admission、session service、terminal token/PTY、snapshot、checker、controller、API facade、审计事件和内存指标等替换边界。

当前实现不连接 Kubernetes、PostgreSQL、对象存储或真实终端；这些后端应在不改变公共接口的前提下接入。参与者环境必须保持不可变 profile、只读根文件系统和 `network: none`。

覆盖范围包括：版本化 NodePackage/seed、profile digest/runtime admission、带 generation/lease/finalizer 的 session store、Kata/Firecracker 无关的 runtime connector、agent freeze/heartbeat、PTY token/消息/输出限制、只读快照与 checker timeout、控制器 reconcile、幂等 API、地图结果路由及审计指标。内存实现用于离线验收，真实组件仍需在 staging 集群通过发布门禁和隔离验收。
