# Round 1 验证记录

## 结论

全部用例通过。真实 Electron 任务 `T-03864379` 使用 Pipeline 18，在 77.11 秒内完成七个阶段，交付状态为 `ready`。

## 自动验证

- `npm run typecheck`：通过。
- `npm test`：20 个测试文件、191 项测试全部通过。
- `npm run build`：TypeScript、Vite 生产构建和 Electron 编译通过。
- `npm run verify:premium`：`UI contract smoke check passed`。
- `git diff --check`：通过。

## 真实桌面任务

- 输入：`round-1/sample-final-prd.md`，并填写“活动查询本期做、活动导出本期不做”和查询细化要求。
- 结果：7/7 步骤 completed；9 条 Prompt 指标、9 条 Runtime 指标；点击到结果 77,110 ms；交付 `ready`。
- 混合范围语句先拆成两条原话单元。输入应用记录分别保存查询 `current`、导出 `excluded`，没有把相反范围压成一个值。
- 原始结构化结果见 `round-1/live-result.json`。

## 截图检查

- `round-1/01-prepared-input.png`：主 PRD、补充资料、统一输入区和唯一主操作在同一阅读轴，无遮挡或错位。
- `round-1/02-running.png`：任务创建后进入真实执行页。
- `round-1/03-execution-and-cost.png`：七阶段均完成；提示词估算、Runtime Token、模型活跃、点击到结果、排队和格式重试可见。
- `round-1/04-input-applications.png`：展开后显示用户原话及三条业务化应用记录，不显示内部来源编号。

## 验证边界

本轮样例没有生成阻塞事项，因此建议方案生成路径由单元测试验证其预算、并发、提示词指标、Runtime 指标和失败状态持久化；阻塞事项编辑交互沿用既有真实截图验收。
