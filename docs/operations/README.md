# 运维与发布

当前阶段采用本地开发和离线 Mock。发布前至少执行：

```bash
npm ci
npm run check
```

真实 Sandbox、镜像和在线 checker 启用后，必须为 profile、节点和 checker 锁定版本与 digest，并通过 `docs/design/infrastructure-design.md` 中的发布门禁。
