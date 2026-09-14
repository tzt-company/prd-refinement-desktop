# 更新日志

本文件记录需求细化平台各版本的重要变更。

## [0.1.1] - 2026-09-14

### 修复

- 明确分离安装包构建与 GitHub Release 发布，避免 tag 构建时 `electron-builder` 因自动发布且缺少令牌而中断资产上传。

## [0.1.0] - 2026-09-14

### 新增

- 提供 Windows 与 macOS 桌面端应用及安装包。
- 支持 HTML、DOC、DOCX、PDF、Markdown、TXT、图片及目录资料导入。
- 提供多任务并行、检查点恢复、失败续跑和任务归档管理。
- 支持 Codex CLI 与 DSH Runtime，并可按执行节点配置模型和推理深度。
- 生成带来源追溯的 JSON、Markdown、Excel 和原文索引交付包。

### 完善

- 收敛为原文建账、功能候选识别、功能清单统一、逐功能细化、产物依据核查、有据修正、交付七阶段流程。
- 区分阻塞、建议、可忽略三级澄清，并将执行状态与需求交付状态分开。
- 完善来源证据绑定、输入预算、审计返工、并发调度和模型用量展示。
- 统一本地临时产物、验收证据和正式应用数据的目录边界。

[0.1.1]: https://github.com/tzt-company/prd-refinement-desktop/releases/tag/v0.1.1
[0.1.0]: https://github.com/tzt-company/prd-refinement-desktop/releases/tag/v0.1.0
