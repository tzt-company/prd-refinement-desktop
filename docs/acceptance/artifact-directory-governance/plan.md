# 历史任务清理与目录收敛

## 目标

不迁移本机历史任务数据，直接清空已知任务、资料包、项目快照和历史验证 profile；保留 Runtime 配置和浏览器基础缓存。后续构建、单元测试和 E2E 默认输出进入 `docs/tmp/`，不再向仓库根目录产生隐藏任务目录或构建目录。

## 改动

- `scripts/clean-local-history.ps1`：固定列举工作区旧输出和 userData 历史任务目录，执行前校验真实子路径及活动进程，支持 `-Check` 零副作用检查。
- 构建配置：Vite、Electron TypeScript、electron-builder 和应用入口统一使用 `docs/tmp/desktop-build/current/`。
- 测试与 E2E：共享 `tests/test-workspace.ts` 创建 `docs/tmp/test-run/vitest/` 子目录；补齐原来缺失的 teardown；流水线脚本默认使用 `docs/tmp/e2e-pipeline/current/`。
- 文档和忽略规则：README、运维规范及 `.gitignore` 与实际路径保持一致。

## 验证

1. 清理脚本先以 `-Check` 输出精确文件数和字节数，再执行并回读历史任务目标不存在，确认 `runtime-config.json` 仍存在。
2. 运行 `npm test`、`npm run typecheck`、`npm run build`、`npm run verify:premium`。
3. 运行 Windows 打包和 packaged smoke，核对应用能从新构建位置启动。
4. 复核运行后根目录不再产生旧 `.e2e-*`、`.runtime-*`、`dist*` 和 `test-results/`；允许 `docs/tmp/` 产生当前运行工作文件。
