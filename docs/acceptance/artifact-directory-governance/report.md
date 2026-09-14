# 历史任务清理与目录收敛验收报告

`matrix.csv` 的 9 个用例在 round 1 全部通过。

正式 userData 的历史任务、资料、项目快照和旧验证数据已清空，Runtime 配置保留；验收目录中被忽略的历史运行 profile 已清空。应用从空数据启动时不再显示硬编码演示任务。

构建、单元测试和 E2E 默认输出已分别收敛到 `docs/tmp/desktop-build/current/`、`docs/tmp/test-run/vitest/` 和 `docs/tmp/e2e-pipeline/current/`。清理脚本提供零副作用检查、范围选择、路径边界校验、活动进程检查和删除后回读。

验证覆盖 203 项单元测试、TypeScript 检查、UI 契约检查、Windows 安装版/便携版打包及打包应用真实启动。详细命令、输出、哈希和边界见 [round-1.md](round-1.md)。
