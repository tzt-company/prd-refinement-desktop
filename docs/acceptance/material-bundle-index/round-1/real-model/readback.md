# 真实 Codex CLI 双文档验收

日期：2026-09-10。执行生产编译产物 `dist-electron/electron/material-bundle.js` 与 `scheduler-v2.js`，使用隔离目录，不操作桌面 GUI、不修改生产配置。

命令：`node docs/acceptance/material-bundle-index/scripts/verify-material-real-model.mjs`

## 输入与结果

- 主 PRD `main.txt`：新增订单备注功能，备注最多100字。
- 补充资料 `supplement.txt`：订单备注保存后重新打开仍显示。
- 任务 `T-C74B2F93` 最终持久化状态 `completed`，进度 100，8 个阶段全部完成。
- 8 次真实模型调用：Luna 3 次、Terra 1 次、Sol 4 次，沿用桌面 low 配置。没有复制或打印 API key、加密凭据。
- `R-0001` 的要求是“新增订单备注功能，备注最多100字；订单备注保存后重新打开订单仍显示。”，同时引用两个文件的来源编号。
- 最终机器审查 `passed: true`、问题为空、待澄清为空。这不等同人工语义确认。
- 真实读取 `tasks/T-C74B2F93/result/main-需求细化.xlsx`：需求明细同时包含两个文件路径、100 字约束、重新打开要求；原文追踪路径恰为 `main.txt` 和 `supplement.txt`。
- 独立 PowerShell 再次读取 `evidence.json` 确认 completed、审查通过和双文件追溯，确认 Excel 文件存在。

## 未通过的首次启动

第一次运行在 `add(main.txt)` 的 `bundle.json` 原子 rename 操作出现 Windows `EPERM`，尚未调用模型。失败目录为 `materials/B-168e3a48-18ec-446f-8f00-57903e84b17a/`，保留现场。未改源码、未添加绕过逻辑，第二次原样运行才得到上述成功结果。根因尚未确认，不能用第二次成功证明该间歇性文件系统问题已解决。

## 验证边界

仅验证两个短 TXT 的真实模型闭环和最终 Excel，未验证 HTML/PDF/DOC/图像识别及大资料包性能。详细任务、模型调用指标及 Excel 回读断言见 `evidence.json`；命令脚本可再次生成产物。
