# v0.1.2 双平台发布目标

## 总目标

用已修复的 tag workflow 发布 `v0.1.2`，并从 GitHub Release 下载回查 Windows 与 macOS 安装包及 SHA-256 清单。

## Sub goal matrix

| Sub goal | 状态 | 完成条件 |
| --- | --- | --- |
| 版本准备 | 已完成 | package、lockfile 与 CHANGELOG 均为 0.1.2 |
| 本地回归 | 已完成 | 测试与类型检查通过 |
| 双平台 CI | 已完成 | Windows、macOS 构建及上传成功 |
| Release 发布 | 失败 | runner 内置 GitHub CLI 上传 attachment 返回 HTTP 404；修复进入 `v0.1.3` |

## 重大决策

- 不手工补发旧标签；使用包含完整 workflow 修复的新版本验证可重复发布链路。
- `v0.1.2` 保留失败标签且不创建不完整 Release。
