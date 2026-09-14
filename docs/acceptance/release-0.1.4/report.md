# v0.1.4 双平台发布验收报告

## 结论

`v0.1.4` 已正式发布。Windows x64 安装版、Windows x64 便携版、macOS arm64 DMG、macOS arm64 ZIP 与 SHA-256 清单均可从 GitHub Release 获取；矩阵全部通过。

## 验证层次

- 本地：203 个测试、类型检查、Windows 原生打包通过；打包文件名与应用中文展示名分别验证。
- CI：同一 tag/SHA 的 Windows 与 macOS 原生 runner 测试、构建、上传全部成功。
- Release：非 draft、非 prerelease，5 个资产均为 uploaded。
- 完整性：下载的 `SHA256SUMS.txt` 与 GitHub 服务端记录的 4 个安装包 digest 全部一致。

## 已知边界

- 安装包未配置 Windows 代码签名或 Apple Developer 签名/公证，系统可能显示未签名应用提示。
- macOS 当前产物由 `macos-latest` arm64 runner 构建，为 arm64 架构；未生成 Intel x64 或 universal 包。
