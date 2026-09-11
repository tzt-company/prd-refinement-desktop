# 修正后回归

日期：2026-09-10。

- `npm test`：12 文件、130 测试通过；含空文档、启动即取消、重复索引不可变、目录冲突/联接、跨包绑定拒绝、CSS/JS背景图、Windows短暂占用重试和持续失败保留旧清单。
- `npm run build`：TypeScript 与 Vite 生产构建成功；`npm run verify:premium` 通过。
- `node docs/acceptance/material-bundle-index/scripts/verify-material-electron.mjs`：生产 file 页面，隔离 profile，真实 File 拖放、目录快照、补充来源检索和项目导出通过。对话框路径由夹具提供，原生对话框另验。
- 实际桌面 `file:///D:/project/prd-refinement-desktop/dist/index.html`：通过真实“选择主 PRD”窗口添加 HTML，通过真实“选择补充资料目录”窗口添加 assets，两个文件均读取，索引 ready。结果在 round-1/native-desktop.json。
- 实际用户 HTML 经原生选择导入：needs-materials，5 处引用缺少 assets/checkbox-checked.svg、assets/arrow-down.svg、assets/filter.svg、assets/copy-document.svg。未自动排除、未启动分析；旧任务仍 failed。
- 真实模型 T-C74B2F93：8阶段完成、8次调用、两来源同时保留，Excel 15444 字节并回读。详见 round-1/real-model/readback.md。
- 顶部缺件列表默认三项、展开十项、收起三项；1100/1440布局、分页、搜索、Escape预览关闭通过。

边界：小样本验证不证明自然语言语义完整性；未做1000文件/500MiB压力基线、DSH图像链或安装包重新发布。DOCX定位仍标为提取文本行而非精确原始段落/页码；动态HTML脚本只作来源数据，无法证明全部交互状态。未知组件和缺失引用继续阻断，需要材料或明确排除依据。

- 真实 Electron 图像索引：PNG 转录“订单备注最多100字”，两次索引 v3/v4 均 ready，缓存内容/mtime及唯一模型会话目录不变，见 round-1/real-vision/evidence.json。
- 最后补充索引最终提交处取消检查，专项15/15重跑通过，生产构建再次成功。
- 实际桌面已重启加载 index-eOcDuXZH.js；恢复用户资料包 needs-materials/5引用、开始分析按钮禁用、顶部3项摘要，旧 T-36AB17B1仍failed；见 round-1/final-desktop.json/png。
