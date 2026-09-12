# Round 18：有依据调整与范围交付

## 目标

按 `docs/spec/evidence-adjustment-repair.md` 把功能粒度调整、业务澄清处置、补充后重生成和所选范围交付接入同一任务、证据、版本与发布路径。

## 实现证据

- 调整请求在模型调用前保存 operationId、基础版本、原始输入和用户依据；调整任务走统一调度并受单任务节点并发及提示预算约束。
- 功能、需求、澄清和关系使用显式 create/update/delete/keep/resolve/dismiss 动作；模型未提及的澄清不再删除，澄清只有在答案进入有效需求且独立依据复核通过后关闭。
- 同一任务族发布在锁内核对最新版本；冲突、失败和取消保留输入与候选，不占用新结果版本。
- Agent 包接受明确的功能选择；阻塞、未验证和范围外内容进入 `pending.json`，JSON、Markdown、Excel 与 manifest 共用同一版本和范围。
- 功能页提供勾选范围、“调整细化”和生成所选 Agent 包；澄清提交显式携带 answered、supplemented 或 not-applicable。

## 自动验证

- `npm test`：19 个测试文件、175 项 PASS，0 跳过。
- `npm run typecheck`：PASS。
- `npm run build`：PASS；Vite 产物为 `index-B0CtWHD4.js` 与 `index-Bkllx4lv.css`。
- `npm run verify:premium`：PASS。
- `git diff --check`：PASS，仅有仓库既有的 LF/CRLF 提示。
- long-goal 校验：PASS。

## 本地桌面与页面

最终构建后，`npm start` 已停止旧进程并启动新实例。新 Electron 主进程 PID 975684，创建时间 2026-09-12 23:31:32 +08:00；Vite 在 5173 端口监听。自动页面检查确认标题“需求细化平台”、8 个功能选择框、8 个“调整细化”入口及“生成所选 Agent 包（8）”。截图见 `round-18/feature-delivery-scope.png`。

CUA 本轮返回 surfaces 为空并报告其内部网络请求失败，因此没有把 CUA 回执当作桌面可见性证据；桌面证据由新 Electron 进程和页面检查分别记录。没有运行真实开发 Agent，也没有把演示数据导出当作业务验收。

## 边界

程序能确定引用存在、范围闭合、版本原子性和产物一致性；“主张是否被原文语义支持”仍由独立模型复核判断，不宣称自然语言语义 100% 完整。真实 PRD 的首轮与局部调整耗时需在用户下一次实际运行后记录。
