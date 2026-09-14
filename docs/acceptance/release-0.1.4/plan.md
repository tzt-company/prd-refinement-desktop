# v0.1.4 双平台发布计划

## 修复

- Windows 安装版、便携版和 macOS 包改用 ASCII artifactName。
- 版本升级为 0.1.4，并同步 README 与 CHANGELOG。

## 验证

1. 本地测试、类型检查和 Windows 打包，读取实际文件名。
2. 合并并创建 annotated `v0.1.4` 标签。
3. 回查双平台 build 与 Release job。
4. 下载 5 个 Release 资产，核对文件名、大小与 SHA-256。
