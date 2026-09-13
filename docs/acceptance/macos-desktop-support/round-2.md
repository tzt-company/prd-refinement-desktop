# Round 2

## 修复结论

macOS 使用 `hiddenInset` 标题栏时，三个窗口按钮会覆盖页面左上角。窗口现改用系统原生标题栏承载控件，Web 内容不再延伸到标题栏；应用顶栏在各平台共用同一套结构和 26px 左右内边距。

## PASS 证据

- UI 契约：`npm run verify:premium` 通过，断言顶栏不再按平台分叉且统一保持 26px 左右内边距。
- 严格 UI 审计：`audit_project.py --mode strict` 返回 0 errors、0 warnings、0 violations，结果见 `round-2/premium-audit.json`。
- 类型与构建：`npm run typecheck` 和 `npm run build` 退出码均为 0。
- Mac 打包：`npm run dist:mac` 退出码为 0，重新生成 x64 `.app`、DMG 和 ZIP。
- 打包应用冒烟：直接启动包内二进制，页面标题和首页主标题正确，Logo 左边界实测为统一的 `26px`；截图见 `round-2/packaged-home.png`。
- 产物完整性：`hdiutil verify` 报告 DMG checksum `VALID`，`unzip -tq` 报告 ZIP 无错误。

## 产物

- DMG：136,743,428 字节，SHA-256 `6412ca1c56d2f59df2e9f754b1b9d554bac3c1aa329cbc174c34ccbe1f4232a0`。
- ZIP：136,846,499 字节，SHA-256 `4dbeae19e63a2efe154d54a3fcb48985cd1497d6aab67e5be28efe12967969ed`。

## 未通过项

- `npm test`：20 个测试文件中 19 个通过；193 个测试中 192 个通过。既有 PDF 渲染用例在本轮耗时 7.393 秒，超过测试配置的 5 秒上限；失败类型为超时，未出现断言错误。本次未修改 PDF 实现或该测试，故不扩大范围调整其超时配置。

## 已知发布限制

当前机器没有有效 Apple Developer ID，所以产物未签名、未公证；项目也尚未提供品牌 `.icns`。
