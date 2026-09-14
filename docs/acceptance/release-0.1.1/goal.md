# v0.1.1 双平台发布目标

## 总目标

修复 tag 环境下打包命令误触发自动发布的问题，发布 `v0.1.1`，并独立回查 Windows 与 macOS 安装包及 SHA-256 清单。

## Sub goal matrix

| Sub goal | 状态 | 完成条件 |
| --- | --- | --- |
| 打包发布职责分离 | 已完成 | `dist:*` 显式禁止自动发布，Release job 单独发布 |
| 本地回归 | 已完成 | 测试、类型检查和 Windows 打包通过 |
| 双平台 CI | 已完成 | Windows、macOS 构建及上传成功 |
| Release 发布 | 失败 | Release job 缺少仓库上下文；修复进入不可变的新版本 `v0.1.2` |

## 重大决策

- 不移动或覆盖失败的 `v0.1.0` 标签，修复版本使用 `v0.1.1`。
- 不向 build job 注入发布令牌；权限和发布动作继续集中在 Release job。
- `v0.1.1` 的双平台 artifact 构建成功但 Release 失败，保留标签和证据，不手工拼接发布结果。
