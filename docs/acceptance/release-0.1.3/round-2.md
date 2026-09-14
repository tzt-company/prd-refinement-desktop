# Round 2：v0.1.3 tag 发布验证

日期：2026-09-14

## PASS 证据

- GitHub Actions run `34799427344` 的 Windows/macOS 测试、构建和 artifact 上传全部通过。
- Release Action 成功上传校验清单、Windows 安装版、macOS DMG 和 ZIP 的数据。

## FAIL 证据

- GitHub attachment 接口将中文资产实际名称改写为缺失中文前缀的名称；Action 回写中文 label 时返回 `Not Found`。
- Windows 便携版未出现在 draft 中，资产集合不完整。
- 不完整 draft 已删除；`gh release view v0.1.3` 返回 `release not found`，未对外发布残缺版本。

## 后续处理

- 安装包 artifactName 改为 ASCII，应用 `productName` 继续保持“需求细化平台”。
- 使用新版本 `v0.1.4` 验证完整发布。
