# 第 1 轮验证

日期：2026-09-11。

## 结果

- `npm test -- --run`：14 个测试文件、160 项测试全部通过。
- `npm run typecheck`：通过。
- `npm run build`：通过，Vite 转换 1584 个模块并生成桌面端资源。
- 真实冻结 HTML 使用新版解析器只读重建：来源单元由旧版 375 个收敛为 228 个；`Included Version 表示该数据集被加入的全部版本，不读取 tw_processes.version；` 保持为一个完整来源单元；iframe 标题未污染父文档后续章节。

## 覆盖

本轮通过 SRC-01 至 SRC-03、REF-01 至 REF-05、OUT-01、DIAG-01。E2E-01 与 E2E-02 等待本地 Electron 新任务完整执行后判定。
