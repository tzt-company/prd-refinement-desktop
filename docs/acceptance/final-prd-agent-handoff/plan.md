# 定版 PRD Agent 交付验收计划

## 范围

依据 `docs/spec/final-prd-agent-handoff.md` 验证需求组织、审计状态、问题分类、确定性编译、交付发布和桌面入口。不接入目标业务仓库，不调用开发 Agent，不验证业务代码实现结果。

## 验证分层

1. 域契约：功能来源、字段证据绑定、需求关系、问题关联及 DeliveryAssessment 状态计算。
2. 审计行为：正反向完整性、组合覆盖、模态忠实、关系复核、检查点指纹失效和 UNKNOWN 关闭失败。
3. 交付编译：以 `requirements.json` 为唯一数据源生成 manifest、功能 Markdown 和 Excel；验证中断、陈旧 attempt 与原子发布。
4. 独立回读：运行 `scripts/verify-delivery-package.mjs <交付目录>`，核对清单哈希、文件边界、功能/需求编号及 JSON、Markdown、Excel 的关键业务文本。
5. 用户界面：在当前实际 Electron 中分别检查 ready、blocked、unchecked、草稿和正式包入口。

## 确定性脚本判据

脚本要求交付目录含 `requirements.json`、`manifest.json`、`requirements.xlsx` 和 `features/`。它会：

- 拒绝 manifest 文件路径逃逸、重复路径、缺失文件和 SHA-256 不一致；
- 要求 manifest 不列出自身，并覆盖三个根文件（README 若存在也必须入清单）及 `features/*.md`；
- 从 JSON 读取 `features`、`requirements`，校验编号唯一以及功能引用的需求真实存在；
- 要求每个功能有同名 Markdown，且包含自身编号、所属需求编号和对应需求的非空业务字段；
- 读取 Excel 所有单元格，要求每个功能编号、需求编号和需求的非空业务字段可检索到；
- 拒绝 JSON、Markdown、Excel 或 manifest 中出现 Windows 盘符绝对路径。

脚本是结构与跨格式一致性门禁，不判断文本是否忠实于 PRD，也不据此将 A01–A12 等语义用例标为通过。

## 计划执行

- 代码层：`npm test`、`npm run typecheck`、`npm run build`、`npm run verify:premium`。
- 语义层：用冻结 ILCD 原文和边界夹具逐项执行 A01–A12、A16、A18，保留 PASS/FAIL/UNKNOWN。
- 发布层：对 ready、blocked、中断、搬移后的真实交付目录执行回读脚本。
- 桌面层：使用当前用户实际运行的 Electron 执行 A17。

全绿后才创建 `report.md`；当前不创建报告。
