# Round 21：真实 Electron 任务工作台闭环

日期：2026-09-13

## 结论

SG19 已通过隔离用户目录中的真实 Electron 闭环验证。验证使用正式 preload、IPC、任务调度持久化、Agent 交付包写盘和 `shell.openPath`；固定任务包含 2 个功能、2 条需求和 1 条阻塞待处理事项，不依赖页面 mock。

## 真实操作与结果

| 操作 | 结果 | 证据 |
| --- | --- | --- |
| 打开已完成任务并生成交付包 | PASS | `01-delivered-with-blocking-item.png`；实际写出的 `requirements.json` 包含 R-1、R-2，`pending.json` 保留 blocking 的 Q-1 |
| 打开当前版本产物目录 | PASS | 页面经真实 IPC 返回“已打开当前版本的产物目录” |
| 批量将“订单提交”标记为本期不做 | PASS | 自动形成第 2 版，页面显示本期 1 条、本期不做 1 条；`02-scope-version-created.png` |
| 归档并恢复整个任务族 | PASS | 已归档列表仅显示一个任务族，且显示第 2 版；`03-archived-family.png` |
| 删除确认与删除 | PASS | 弹窗明确说明删除 2 个结果版本及保留外部文件；删除后任务列表为空；`04-delete-confirmation.png`、`05-deleted.png` |
| 删除持久化 | PASS | `.deleted-T-REALE2E.json` 墓碑存在，任务 JSON 剩余 0 个 |

## 截图发现并修复

首次真实截图发现两个问题：批量成功提示与操作按钮争抢同一行，按钮文字被压缩；底部反馈区使用 sticky 定位遮住第二个功能。现已让工具栏换行并保持操作文案单行，同时取消反馈区覆盖内容的 sticky 定位。重跑后两个功能行的实际位置分别为 479.67–543.67 和 543.67–607.67，未重叠且截图完整可见。

## 自动验证

- `node docs/acceptance/source-reference-integrity/scripts/run-task-workspace-real-e2e.mjs`：PASS。
- `npm test -- --run`：20 个测试文件、181 项测试通过。
- `npm run typecheck`：PASS。
- `npm run build`：PASS，Vite 1585 个模块构建完成。
- `npm run verify:premium -- --strict`：PASS。

## 隔离边界

真实验证使用 `%TEMP%/prd-task-workspace-real-profile`，结束时删除其中测试任务，不读取、归档或删除用户当前桌面实例的真实任务。

## 最终运行态

正式 `npm start` 已启动当前代码。只读回查：Vite PID 104172 监听 127.0.0.1:5173；Electron 主窗口 PID 330872，窗口标题“需求细化平台”，启动时间 2026-09-13 08:56:36。
