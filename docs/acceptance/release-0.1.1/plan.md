# v0.1.1 双平台发布计划

## 症状与根因

tag runner 中 Windows 与 macOS 均生成安装包后失败，错误为缺少 `GH_TOKEN`。`electron-builder` 根据 tag 环境自动尝试发布，导致打包 job 越过职责边界。

## 修复

- 将应用版本升级到 0.1.1。
- `dist:win` 与 `dist:mac` 显式传入 `--publish never`。
- 保持 Release job 在双平台资产上传后统一创建 Release。

## 验证

1. 本地执行测试、类型检查和 Windows 打包。
2. PR 合并后创建 annotated `v0.1.1` 标签。
3. 回查两个 build job 与 Release job。
4. 下载全部 Release 资产，核对文件类型、大小和 SHA-256 清单。
