# 定版 PRD Agent 交付目标

## 总目标

将定版 PRD 整理为可追溯、可检查、可搬移的 Agent 需求交付包；正式包只有在最终数据检查通过且磁盘回读一致后才可发布。本验收不运行真实开发 Agent，也不验证下游业务代码实现。

## Sub goal matrix

| Sub goal | 状态 | 证据 |
|---|---|---|
| 功能分组只保留原文范围，不生成第二份业务描述 | COMPLETE | 类型、提示词、Excel、UI 及真实 F-001/F-002/F-004 回读；round-2.md |
| 需求字段具备来源绑定，关系具备两端来源和独立复核 | COMPLETE | direct-domain 测试及真实 REL-0001/REL-0002；round-2.md |
| 整理错误、业务问题、技术选择按不同规则处理 | COMPLETE | scheduler 问题责任与非法输出阻断测试；专用语义对抗仍在 matrix 保留 PENDING |
| 最终快照检查完整且可计算 ready/blocked/unchecked | COMPLETE | scheduler 状态测试及真实 ready 交付；round-1.md、round-2.md |
| JSON、Markdown、Excel 和 manifest 从同一快照生成并可独立回读 | COMPLETE | agent-package 测试、真实包及搬移回读；round-2.md |
| 当前 Electron 正确展示检查与发布状态 | COMPLETE | production Electron 独立 profile；round-1.md；双态视觉验收仍在 matrix 保留 PENDING |

## 重大决策

- `requirements.json` 是唯一结构化业务快照，Markdown 与 Excel 是确定性视图。
- 一期整包交付；存在有效未决问题时不发布正式包。
- 自动检查只能证明结构、引用和跨格式一致性，不能证明自然语言语义零遗漏。
- 本验收截止于需求产物，不以真实开发实施作为完成门槛。

## Sub goal 进展

- Round 1：建立 18 项产品验收用例及确定性交付包回读脚本；只验证脚本帮助和缺参行为，业务实现均未判定通过。
- Round 2：完成代码实现和真实 Codex 八节点链路；任务 T-DEA0C834 在 attempt 5 生成 ready 正式包，搬移后独立回读通过。专用语义对抗矩阵未全绿，因此不创建最终报告。
