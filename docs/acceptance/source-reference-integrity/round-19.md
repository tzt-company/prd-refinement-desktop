# Round 19：任务级自然语言批量调整

## 结论

通过。结果页使用一个共享输入区承接多条意见、业务补充和澄清回答；用户不需要逐功能或逐澄清填写表单。后台按反馈原文片段形成操作，歧义不修改结果，同一功能只生成一次，关联操作整体回滚，独立操作允许部分成功。

## 自动化验证

- `npm test -- --run`：19 个测试文件、173 项测试全部通过。
- `npm run typecheck`：通过。
- `npm run build`：通过，Vite 生产构建成功。
- `npm run verify:premium`：UI 契约检查通过。
- `audit_project.py ... --mode strict`：0 个发现；结果见 `round-19/premium-audit.json`。
- `npx -p @google/design.md designmd lint DESIGN.md`：0 error，6 个既有未引用 token warning。

## 桌面与页面证据

- 停止 2026-09-12 23:31 启动的旧进程后，通过 `npm start` 启动新实例；Electron 主进程 PID 343136，创建时间 2026-09-13 00:17:07。
- Playwright 使用当前 5173 页面执行 `scripts/verify-adjustment-ui.mjs`：调整输入框 1 个、提交按钮 1 个、旧逐项入口 0 个；草稿跨“待处理事项/功能与需求”标签保留；Agent 包交付复选框 8 个仍只服务交付范围。
- 页面截图：`round-19/task-feedback.png`。
- Codex CUA 当前返回 `nodeRepl.fetch request failed`，无法直接附着 Electron 窗口；因此桌面实例由新 PID/启动时间确认，页面行为由同一 `npm start` Vite 进程上的 Edge 自动化独立验证。

## 关键反例

- 一段反馈跨两个功能时只修改命中范围；同一功能的多条意见合并为一次生成。
- 整理指令不作为业务事实来源；明确业务口径才写入用户事实证据。
- 目标有歧义时只生成待确认结果，项目内容不变。
- 一个明确答案可以处理多个关联澄清；`defer` 保持原问题开放。
- 同一原子组第二个功能失败时，第一个功能的候选修改一并回滚；独立意见一成一败时保留成功部分。
- 相同 `operationId` 幂等，旧基准版本禁止覆盖最新结果。

## 边界

验证确认了交互、协议、事务和证据约束。自然语言目标匹配的语义质量仍取决于模型，平台以“歧义不执行、结果逐项可见”限制误改，不声称自动识别所有相关需求。
