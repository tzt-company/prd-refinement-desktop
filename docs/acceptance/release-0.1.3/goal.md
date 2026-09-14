# v0.1.3 双平台发布目标

## 总目标

通过固定版本的 Release Action 发布 `v0.1.3`，并下载回查 Windows 与 macOS 安装包及 SHA-256 清单。

## Sub goal matrix

| Sub goal | 状态 | 完成条件 |
| --- | --- | --- |
| 上传实现修复 | 已完成 | 使用固定 commit 的稳定 Release Action |
| 本地回归 | 已完成 | 测试与类型检查通过 |
| 双平台 CI | 待验证 | Windows、macOS 构建及上传成功 |
| Release 发布 | 待验证 | Release 成功且资产可下载、哈希一致 |

## 重大决策

- 固定 Action commit SHA，避免浮动 tag 改变发布实现。
- 继续保留所有失败 tag 与证据，不覆盖重打。
