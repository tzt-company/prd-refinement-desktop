# Round 2：真实模型链路与可携带交付包

日期：2026-09-11。

## 本轮结论

使用冻结的定版 PRD `fixtures/finalized-prd.md` 跑通当前 production build 的八节点真实 Codex 模型链路。最终任务为 `completed`，需求交付状态为 `ready`，生成 3 个功能原文分组、7 条唯一需求、0 个待确认、0 个未解决审查问题和 2 条有来源的业务关系。交付包搬移到另一目录后独立回读通过。

这次运行证明新契约能够被真实模型消费并生成可回读产物。单一样本不能证明任意自然语言 PRD 都不会发生语义遗漏；A01–A04、A07–A08、A10、A12、A16、A18 的专用对抗夹具仍保持 PENDING。

## 真实链路

命令：

```powershell
npm run build
node scripts/run-pipeline-e2e.mjs docs/acceptance/final-prd-agent-handoff/fixtures/finalized-prd.md docs/acceptance/final-prd-agent-handoff/round-2/runtime
```

任务 `T-DEA0C834` 在 attempt 5 完成。八节点进度到 100%；累计 24 次模型调用，输入 354566、缓存输入 194688、输出 7377 tokens。前序 attempt 真实暴露并修复了已移除 CLI feature flag、相对工作目录二次拼接以及模型证据绑定外壳差异；失败均未发布正式交付包。

最终快照：

- `qualityState=ready`；`issueIds=[]`；`unverifiedScopeIds=[]`。
- F-001 登录生成 R-0001、R-0002；F-002 报表导出生成 R-0004–R-0007；F-004 通用时区约束生成 R-0003。
- 一条来源由两条或四条需求组合覆盖后，独立审计没有制造重复条目，覆盖 A06。
- 关系 REL-0001 表达报表导出依赖登录，REL-0002 表达时区约束影响 CSV 格式；两端需求及来源均可回读，覆盖 A11 的明确联动正例。
- 非功能章节标题只作为来源处置，不生成第二份功能描述。

## 发布与搬移回读

命令：

```powershell
node docs/acceptance/final-prd-agent-handoff/scripts/verify-delivery-package.mjs <任务正式交付目录>
Copy-Item -LiteralPath <任务正式交付目录> -Destination docs/acceptance/final-prd-agent-handoff/round-2/portable-copy -Recurse
node docs/acceptance/final-prd-agent-handoff/scripts/verify-delivery-package.mjs docs/acceptance/final-prd-agent-handoff/round-2/portable-copy
```

两次均 PASS：3 个功能、7 条需求、7 个 manifest 文件跨 JSON、Markdown、Excel 一致。manifest 回读得到 `attempt=5`、`qualityState=ready`、`fileCount=7`；搬移后的目录不依赖本机绝对路径，覆盖 A13、A14。

## 运行时根因修复

- 删除 Codex CLI 已移除的 `view_image` feature flag。
- Runtime 将工作目录先解析为绝对路径，避免相对目录同时用于进程 cwd 和 `-C` 时被重复拼接。
- CLI 非结构化错误经过脱敏后进入失败原因，避免只显示退出码。
- 证据绑定接受数组和等价 `sourceRefs` 外壳，但最终仍编译为同一严格结构。

## 未验证边界

- 本轮没有运行开发 Agent，也没有接入目标代码仓库；这是产品范围决定。
- 专用语义对抗用例未全绿，因此不创建 `report.md`，也不声称自然语言语义零遗漏。
