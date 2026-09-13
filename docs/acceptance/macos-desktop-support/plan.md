# macOS 桌面端适配验收计划

## 需求

让需求细化平台可在 macOS 上开发运行、识别本机 Codex CLI、导入旧版 DOC，并生成可启动的 Mac 安装产物。

## 方案与改动

- `electron/runtime.ts`：保留 Windows 发现逻辑，macOS/Linux 从 PATH 查找 Codex，macOS 再检查官方 App 和常见安装位置。
- `electron/document-assets.ts`：macOS 使用系统 `textutil` 将 `.doc` 转为 `.docx`，Windows 继续使用 Word COM。
- `package.json`：新增 DMG/ZIP 打包命令与 macOS productivity 分类。
- `README.md` 和 `DESIGN.md`：同步支持平台、打包、DOC 转换与用户数据路径。

## 验证

1. Mac 专项单测覆盖 Codex CLI 发现和真实 `textutil` DOC 转换。
2. 全量测试、TypeScript 检查和生产构建通过。
3. 编译后的 Runtime 真实读取本机 Codex 路径、版本与认证状态。
4. `npm run dist:mac` 生成 `.app`、DMG 和 ZIP，并直接启动 `.app` 检查首页。
