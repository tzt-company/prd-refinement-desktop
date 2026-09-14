# v0.1.0 双平台发布目标

## 总目标

发布 `v0.1.0`，GitHub Release 同时提供 Windows 安装版、Windows 便携版、macOS DMG、macOS ZIP 和 SHA-256 校验清单。

## Sub goal matrix

| Sub goal | 状态 | 完成条件 |
| --- | --- | --- |
| 发布说明 | 已完成 | `CHANGELOG.md` 记录 0.1.0 主要变更 |
| Windows 构建 | 已完成 | 本地测试、打包与打包应用 smoke 通过 |
| 双平台 CI | 待验证 | tag workflow 的 Windows、macOS 构建 job 均成功 |
| Release 发布 | 待验证 | Release 与 5 类资产可下载，校验清单与下载文件一致 |

## 重大决策

- 版本沿用仓库当前 `package.json` 与 `package-lock.json` 中尚未发布的 `0.1.0`，首个标签为 `v0.1.0`。
- Windows 与 macOS 必须在各自原生 GitHub runner 构建；本地 Windows 结果不替代 macOS 验证。
