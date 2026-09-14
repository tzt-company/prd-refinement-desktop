# Round 1：ASCII 安装包名本地验证

日期：2026-09-14

## PASS 证据

- `npm test`：20 个测试文件、203 个测试全部通过。
- `npm run typecheck` 与 `git diff --check`：通过。
- `npm run dist:win`：退出码 0，未触发自动发布。
- 安装版实际文件名 `prd-refinement-desktop-setup-0.1.4-x64.exe`，103,786,487 bytes，SHA-256 `4FEA1AA32383EFA389431A506CDD93088FED3D3F685E2CA719D4BFDE7C526E2F`。
- 便携版实际文件名 `prd-refinement-desktop-portable-0.1.4-x64.exe`，103,556,739 bytes，SHA-256 `CCA5D6FD39942F975C5466D27E71927E16977DD664002E225CCA844F7B6BA7D3`。
- 打包应用内部可执行文件仍为“需求细化平台.exe”，应用中文展示名未改变。
