# v0.1.0 双平台发布计划

## 需求

- 新建更新日志。
- 创建版本标签并发布。
- 发布产物包含 Windows 与 macOS 安装包。

## 方案

1. 新建 `CHANGELOG.md`，记录首发版本能力。
2. 新增 tag 触发的发布工作流，在 Windows 与 macOS runner 分别执行测试和原生打包。
3. 汇总 `.exe`、`.dmg`、`.zip`，生成 SHA-256 清单并创建 GitHub Release。
4. 本地验证 Windows 构建与打包应用；tag 后回查 Actions、Release 资产和下载文件哈希。

## 风险与边界

- 安装包未配置开发者代码签名。构建时禁用自动证书发现，避免 CI 因 runner 环境差异选择未知证书；系统可能显示未签名应用提示。
- macOS 构建只能由 macOS runner 验证，不能由 Windows 本地构建替代。
