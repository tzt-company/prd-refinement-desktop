# v0.1.3 双平台发布计划

## 修复

- 将 Release 上传从 runner 内置旧版 GitHub CLI 切换为固定 commit 的稳定 Release Action。
- 应用版本升级为 0.1.3。

## 验证

1. 本地测试、类型检查、diff 检查。
2. 合并并创建 annotated `v0.1.3` 标签。
3. 回查双平台 build 与 Release job。
4. 下载 Release 资产，核对文件清单、大小与 SHA-256。
