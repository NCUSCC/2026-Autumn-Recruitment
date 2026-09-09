# `@ncuscc/infrastructure`

离线、transport-neutral 的基础设施控制面参考实现。它提供 profile/admission、session service、terminal token/PTY、snapshot、checker、controller、API facade、审计事件和内存指标等替换边界。

当前实现不连接 Kubernetes、PostgreSQL、对象存储或真实终端；这些后端应在不改变公共接口的前提下接入。参与者环境必须保持不可变 profile、只读根文件系统和 `network: none`。
