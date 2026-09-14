# Round 1：Windows 本地发布验证

日期：2026-09-14

## PASS 证据

- `npm test`：20 个测试文件、203 个测试全部通过。
- `npm run typecheck`：退出码 0。
- `npm run dist:win`：退出码 0，生成 x64 安装版和便携版。
- `node scripts/packaged-smoke.mjs <win-unpacked executable> <evidence directory>`：返回 `passed: true`，读取到窗口标题“需求细化平台”和首页标题“需求分析任务”。
- Windows 安装版：103,786,626 bytes，SHA-256 `0A1DE5F589DC4F01A2447B83B998287838F15B4F8E3E82F0126C620EC24A61BA`。
- Windows 便携版：103,556,776 bytes，SHA-256 `D94B3FC6AA462F0F20DBF924ACA9C0EB44B8B4E134E11D0A2C732F485D1E28A2`。

## 未验证

- macOS 安装包尚未构建；等待 tag 触发 macOS runner。
- GitHub Release 尚未创建；等待 PR 合并和 tag 推送。
