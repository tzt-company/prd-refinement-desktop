# Round 2：v0.1.2 tag 发布验证

日期：2026-09-14

## PASS 证据

- GitHub Actions run `34798915610` 绑定 tag `v0.1.2` 和源码 `b888a62e621a78e427453629567f95f1ade7813e`。
- macOS job 用时 1 分 54 秒，Windows job 用时 4 分 12 秒；两者测试、构建和 artifact 上传全部通过。
- Release job 下载双平台 artifact 并生成 `SHA256SUMS.txt` 成功。

## FAIL 证据

- runner 内置 GitHub CLI 创建 Release 后，上传第一个 attachment 时由 `uploads.github.com` 返回 HTTP 404；CLI 清理了失败 Release。
- 独立执行 `gh release view v0.1.2` 与 REST tag 查询均为 404，确认没有遗留不完整 Release。

## 后续处理

- 使用最新稳定 `softprops/action-gh-release` 并固定到 commit `3d0d9888cb7fd7b750713d6e236d1fcb99157228`；该版本包含上传传输加固。
- 修复进入新版本 `v0.1.3`，不覆盖已有 tag。
