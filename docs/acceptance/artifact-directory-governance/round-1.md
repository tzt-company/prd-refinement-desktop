# Round 1：历史任务清理与目录收敛

日期：2026-09-14，环境：Windows 11 / PowerShell 7。

## 清理结果

先执行 `pwsh -NoProfile -File scripts/clean-local-history.ps1 -Check`，零副作用清单识别出仓库临时数据、历史构建输出、正式 userData 任务目录和验收目录的忽略 profile。随后执行清理并独立回读：

- `%APPDATA%/prd-refinement-desktop/analysis-tasks`、`materials`、`projects`、`validation-pipeline12` 均不存在；`runtime-config.json` 仍存在。
- 根目录原有 `.codex-*`、`.e2e-*`、`.runtime-*`、`.tmp-*`、`.unified-*`、`dist/`、`dist-electron/` 和 `test-results/` 均不存在。
- `docs/tmp/` 原有 535 个文件、25,477,059 字节被清理；历史验收 `profile`、`electron-profile`、`runtime`、`package-fixture` 和 `portable-copy` 已清理。
- 最终 smoke 产生的 `round-1/user-data` 使用 `-Scope AcceptanceRuntime` 再次清理，回执为“1 个受控目标均不存在”。截图作为最小可见证据保留：[packaged-home.png](round-1/packaged-home.png)。

旧根目录 `dist-release/` 删除时有一个 `win-unpacked/resources/app.asar` 被 Windows 外部进程占用，未能删除；其余可删除内容已被清理。它是旧打包输出，不是历史任务数据。新构建已经不再写入该目录，`.gitignore` 用过渡注释保留精确忽略，后续文件占用解除后可执行 `-Scope LegacyBuild` 清理。

## 根因与修改

- 构建入口统一为 `docs/tmp/desktop-build/current/`；`package.json`、Vite、Electron TypeScript 输出、应用加载入口和 E2E 编译产物导入路径同时修改。
- 单元测试通过 `tests/test-workspace.ts` 在 `docs/tmp/test-run/vitest/` 创建工作区，并补齐两个原来没有清理的测试文件 teardown。E2E 默认任务目录改为 `docs/tmp/e2e-pipeline/current/`。
- 清理脚本只处理固定工作区、受控验收目录名和明确 userData 子目录，校验真实子路径，检测本项目活动进程；支持 `All`、`UserData`、`AcceptanceRuntime`、`LegacyBuild` 四种范围及 `-Check`。
- 首次空 profile smoke 仍显示 `T-0001 / 交易中心 3.0`。反查 `src/App.tsx` 发现前端初始 state 硬编码演示任务，IPC 回读前会短暂展示；删除演示数据后，真实任务只从持久化存储载入。

## 验证

- `npm test`：20 个测试文件、203 项测试全部通过；包含“持久化任务回读前不注入演示任务”回归测试。
- `npm run typecheck`：退出码 0。
- `npm run verify:premium`：`UI contract smoke check passed`。
- `npm run dist:win`：退出码 0；实际生成安装版和便携版：
  - 安装版 103,786,625 字节，SHA-256 `E5B6ABD7C0395ECC7BCF9666B5ACD8AC7C324F7AA9654F4C3A930A7A051148A9`。
  - 便携版 103,556,776 字节，SHA-256 `6EC945138DE79DCB01A5AA50A36160778A8597BB8B00D79229B3DE1550ACA287`。
- `node scripts/packaged-smoke.mjs <win-unpacked exe> docs/acceptance/artifact-directory-governance/round-1`：`passed:true`；标题“需求细化平台”，首屏“当前任务 0 / 已归档 0 / 还没有需求分析任务”，顶部左边界 26。

本轮没有安装新安装包到正式安装目录，也没有验证真实模型任务执行；这些行为不属于历史任务数据清理和输出目录收敛结论。
