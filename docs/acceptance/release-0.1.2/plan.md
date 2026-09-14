# v0.1.2 双平台发布计划

## 需求与修复

- 版本升级到 0.1.2。
- tag build job 仅打包，Release job 通过 `GH_REPO` 明确定位仓库。

## 验证

1. 本地运行测试、类型检查和差异检查。
2. 合并版本 PR，创建 annotated `v0.1.2` 标签。
3. 回查 Windows、macOS 与 Release 三个 job。
4. 下载 Release 资产，重新计算哈希并核对 `SHA256SUMS.txt`。
