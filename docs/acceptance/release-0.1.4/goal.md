# v0.1.4 双平台发布目标

## 总目标

以稳定 ASCII 安装包文件名发布 `v0.1.4`，并下载回查 Windows 与 macOS 资产及 SHA-256 清单。

## Sub goal matrix

| Sub goal | 状态 | 完成条件 |
| --- | --- | --- |
| 资产名修复 | 已完成 | 安装包名使用 ASCII，应用展示名不变 |
| 本地回归 | 已完成 | 测试、类型检查和 Windows 打包通过 |
| 双平台 CI | 待验证 | Windows、macOS 构建及上传成功 |
| Release 发布 | 待验证 | Release 成功且 5 个资产可下载、哈希一致 |

## 重大决策

- Release 文件名使用 `prd-refinement-desktop-*`；不再依赖中文 asset label 恢复。
