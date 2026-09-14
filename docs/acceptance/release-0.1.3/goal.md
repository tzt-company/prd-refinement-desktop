# v0.1.3 双平台发布目标

## 总目标

通过固定版本的 Release Action 发布 `v0.1.3`，并下载回查 Windows 与 macOS 安装包及 SHA-256 清单。

## Sub goal matrix

| Sub goal | 状态 | 完成条件 |
| --- | --- | --- |
| 上传实现修复 | 已完成 | 使用固定 commit 的稳定 Release Action |
| 本地回归 | 已完成 | 测试与类型检查通过 |
| 双平台 CI | 已完成 | Windows、macOS 构建及上传成功 |
| Release 发布 | 失败 | 中文 attachment 名被改写且标签恢复失败；不完整 draft 已删除 |

## 重大决策

- 固定 Action commit SHA，避免浮动 tag 改变发布实现。
- 继续保留所有失败 tag 与证据，不覆盖重打。
- 安装包文件名修复进入 `v0.1.4`，应用中文展示名保持不变。
