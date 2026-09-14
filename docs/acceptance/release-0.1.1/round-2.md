# Round 2：v0.1.1 tag 双平台构建验证

日期：2026-09-14

## PASS 证据

- GitHub Actions run `34798116788` 绑定 tag `v0.1.1` 和源码 `133820db52e37b5dccbc5bc9170d172e09a4a0f1`。
- Windows 与 macOS runner 的版本校验、203 个测试、安装包构建和 artifact 上传全部通过。
- macOS job 用时 2 分 27 秒，Windows job 用时 4 分 15 秒；首轮缺少 `GH_TOKEN` 的自动发布错误没有复现。

## FAIL 证据

- Release job 成功下载双平台 artifact 并生成校验清单，但 `gh release create` 报 `fatal: not a git repository`。
- 根因是 Release job 未签出仓库，同时没有通过 `GH_REPO` 提供仓库上下文；GitHub Release 未创建。

## 后续处理

- 为 Release 命令显式提供 `${{ github.repository }}`，不再依赖本地 `.git` 上下文。
- 从本 run 下载已成功构建并上传的双平台 artifact，使用修正后的显式仓库上下文完成 `v0.1.1` Release；下载后重新计算哈希。
