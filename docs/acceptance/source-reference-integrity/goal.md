# 原文引用完整性修复

> 状态：COMPLETE  
> Goal ID：source-reference-integrity  
> 最近维护：2026-09-11T19:17:00+08:00  
> 权威目标：D:\project\prd-refinement-desktop\docs\acceptance\source-reference-integrity\goal.md

## 总目标

消除模型抄写 quote 导致的来源定位失败，修复 HTML 行内结构和引用选区在统一、返工、展示、导出中的丢失，并以当前真实 PRD 快照完整跑通八节点证明修复有效。

## 完成条件

- 模型只选择程序提供的证据标识，不再输出自由文本 quote 或字符位置。
- HTML 列表、段落、表格行及 iframe 上下文保持正确结构。
- 同段多功能、非连续及共享证据经过统一、返工、重启后不扩大、不丢失。
- 页面、JSON、Markdown、Excel 使用一致的选区文本。
- 失败诊断包含节点、批次和具体非法证据；平台错误不转成业务澄清。
- 单元测试、类型检查、构建、真实 Electron 和当前真实 PRD 新任务均通过。

## 范围与约束

- 复用现有 SourceIndex、SourceRef、任务输入快照和八节点流程。
- 升级检查点协议，不迁移旧选区；从任务保存的原文件快照重建。
- 不运行开发 Agent，不改业务 PRD，不覆盖工作区原有未跟踪文档。

## sub goal matrix

| ID | 子目标 | 完成判据 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| SG1 | 建立复现与证据目录 | 当前真实输入及最小反例稳定复现；证据 ID 可确定解析 | 完成 | tests/source-evidence.spec.ts |
| SG2 | 修复 HTML 来源结构 | 行内节点合并、表格行与 iframe 作用域测试通过 | 完成 | tests/document-assets.spec.ts |
| SG3 | 切换模型证据协议 | 全部来源字段只接受已提供证据 ID | 完成 | 160 项测试通过 |
| SG4 | 保留并校验选区 | 统一、拆分、返工、恢复和最终图校验不丢范围 | 完成 | tests/direct-domain.spec.ts、tests/scheduler.spec.ts |
| SG5 | 统一展示与交付 | 页面、JSON、Markdown、Excel 读取同一 SourceRef | 完成 | tests/export.spec.ts、npm run build |
| SG6 | 真实桌面验收 | 当前固定 HTML 新任务完成且关键规则反查通过 | 完成 | T-C5E8F68D、round-2.md |

## 当前检查点

- 当前子目标：SG6
- 唯一下一步：无；保持本地 Electron 运行供用户查看结果。
- 未闭环项：无。任务交付评估因 2 项真实阻塞澄清为 blocked，属于业务结果，不是平台执行失败。

## 进展

- 2026-09-11：确认提示重试仍失败；确认 HTML 行内拆碎、iframe 标题串用，以及已解析区间在统一流程中丢失。
- 2026-09-11：证据目录、HTML 结构、全节点证据协议、区间传递、展示与导出完成；160 项测试、类型检查和构建通过。
- 2026-09-11：桌面端从旧任务原材料创建 T-C5E8F68D，pipeline 7 完整执行到 100%；228 个来源单元、3 个功能、24 条需求、3 条分级澄清，引用文字错误为 0。关键规则反查全部命中。

## 重大决策

- 取消模型自由输出 quote；模型只选择程序生成且绑定快照的证据 ID。
- 非法引用不自动退回整块，不做模糊匹配。
- 协议升级后从保存的原文件重新建账，不拼接旧检查点。

## 重要信息

- 真实失败任务：T-7466A157，attempt=2，候选/检查完成 15/17，失败批次为第 13、15 批。
- 输入快照仍位于任务 project.inputSnapshotPath；无需用户重新选择文件。
