# Round 1：修复版 Windows 本地验证

日期：2026-09-14

## PASS 证据

- `npm test`：20 个测试文件、203 个测试全部通过。
- `npm run typecheck`：退出码 0。
- `npm run dist:win`：实际命令包含 `electron-builder --win nsis portable --publish never`，退出码 0，不再因 tag 发布令牌进入失败路径。
- Windows 安装版：103,786,487 bytes，SHA-256 `3E218E4DF13C1C80073F5CC200E5DBAB6AB04CD386DB4C1F623781987F374895`。
- Windows 便携版：103,556,645 bytes，SHA-256 `F64C789B7330780AF273527E0C7867F94198420417019B413504E876AD2B1C6E`。

## 未验证

- macOS 打包、双平台上传与 Release 创建等待 `v0.1.1` tag runner 验证。
