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
