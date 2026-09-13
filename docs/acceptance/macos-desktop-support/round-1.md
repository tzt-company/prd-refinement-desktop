# Round 1

## PASS 证据

- Mac 专项回归：`npm test -- --run tests/runtime-errors.spec.ts tests/document-assets.spec.ts`，2 个文件、30 个测试通过；其中真实 `textutil` DOC 转换通过。
- 全量回归：`npm test`，20 个文件、193 个测试通过。
- 类型与构建：`npm run typecheck` 和 `npm run build` 退出码均为 0。
- 真实 Runtime 检查：发现 `/Applications/ChatGPT.app/Contents/Resources/codex`，版本 `0.154.0-alpha.6.2`，认证状态 `authenticated`。
- Mac 打包：`npm run dist:mac` 退出码为 0，生成 x64 `.app`、DMG 和 ZIP。
- 产物完整性：`hdiutil verify` 报告 DMG checksum `VALID`，`unzip -tq` 报告 ZIP 无错误。
- 打包应用冒烟：直接启动 `.app/Contents/MacOS/需求细化平台`，页面标题为“需求细化平台”，首页含“需求分析任务”与“Runtime 配置”。截图见 `round-1/packaged-home.png`。

## 产物

- DMG：136,743,406 字节，SHA-256 `eeb1f720e8b7a382695043f6148928e3e82501d2e7d2346f360f75d7190dd519`。
- ZIP：136,846,538 字节，SHA-256 `81fede68030273aeec26030db4bdf7be7886b8e072529789b165368d52ac1142`。

## 已知发布限制

当前机器没有有效 Apple Developer ID，所以本轮产物未签名、未公证；可用于本机验证，对外分发前需配置证书与 notarization。项目也尚未提供品牌 `.icns`，本轮沿用 Electron 默认图标。
