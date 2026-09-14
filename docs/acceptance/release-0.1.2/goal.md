# v0.1.2 双平台发布目标

## 总目标

用已修复的 tag workflow 发布 `v0.1.2`，并从 GitHub Release 下载回查 Windows 与 macOS 安装包及 SHA-256 清单。

## Sub goal matrix

| Sub goal | 状态 | 完成条件 |
| --- | --- | --- |
| 版本准备 | 已完成 | package、lockfile 与 CHANGELOG 均为 0.1.2 |
| 本地回归 | 已完成 | 测试与类型检查通过 |
| 双平台 CI | 待验证 | Windows、macOS 构建及上传成功 |
| Release 发布 | 待验证 | Release 成功且 5 类资产可下载、哈希一致 |

## 重大决策

- 不手工补发旧标签；使用包含完整 workflow 修复的新版本验证可重复发布链路。
