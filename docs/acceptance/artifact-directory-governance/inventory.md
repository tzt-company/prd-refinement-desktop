# 文件目录盘点

盘点日期：2026-09-14。范围：当前检出的文件系统、Git 跟踪清单、输出路径配置和写入代码。未递归统计 `.git/`、`node_modules/`，未读取正式用户数据的内容；应用数据结构根据当前源码核对。体积按文件 Length 相加，不是磁盘实际占用。

本轮交付为目录盘点和规范，不执行历史文件搬迁、删除、构建路径改造或自动清理。后续执行依据见 [文件目录与留存规范](../../ops/artifact-directory-policy.md)。

## 1. 文件系统快照

| 位置 | 文件数 | MiB | Git 跟踪文件数 | 分类与发现 |
| --- | ---: | ---: | ---: | --- |
| `docs/tmp/` | 513 | 23.91 | 0 | 临时草稿、脚本、日志、桌面 profile、真实任务副本混存；直接子级有 36 个文件、11 个目录 |
| `docs/acceptance/` | 516 | 25.79 | 240 | 13 个特性目录；既有轮次证据，也有浏览器 profile、资料包和任务运行态 |
| `docs/spec/` | 25 | 0.27 | 22 | 前置方案；3 份既有未跟踪文件，本轮不纳入提交 |
| `dist-release/` | 92 | 694.85 | 0 | 安装包、便携版和打包展开目录；最大的一组生成文件 |
| `dist/` | 3 | 0.33 | 0 | Vite 编译结果 |
| `dist-electron/` | 23 | 0.44 | 0 | Electron TypeScript 编译结果 |
| `test-results/` | 1 | <0.01 | 0 | 测试工具输出 |

根目录另有 23 个探测、实验或临时目录。空目录也列出，因为 `git status` 不显示它们：

| 目录组 | 实际目录 | 文件数 |
| --- | --- | ---: |
| Codex 探测 | `.codex-init-probe`、`.codex-live-probe`、`.codex-live-probe-2`、`.codex-probe`、`.codex-probe-2`、`.codex-probe-3` | 7 |
| ILCD 实验 | `.e2e-ilcd`、`.e2e-ilcd-v2`、`-v3`、`-v4`、`-v5`、`-v6`、`-v8`、`-v10`、`-v11`、`-v12` | 19 |
| Runtime 探测与测试 | `.runtime-adapter-probe`、`.runtime-probe`、`.runtime-test-evidence-flow`、`.runtime-test-scheduler`、`.runtime-test-scheduler-17` | 31 |
| 其他 | `.tmp-diff-contract-0913`、`.unified-runtime-e2e` | 3 |

根目录还存在生成的 `premium-audit.json`、`tsconfig.app.tsbuildinfo`，以及跟踪中的 `goal.md`。`DESIGN.md`、`UX-CONTRACT.md`、`premium-ui.json` 是设计契约及配置输入，不能按生成报告处理。

## 2. 具体偏差与生成入口

| 偏差 | 可核验位置 | 建议处置（尚未执行） |
| --- | --- | --- |
| 根目录实验文件持续再生 | `scripts/run-pipeline-e2e.mjs:6` 默认 `.e2e-pipeline-v2`；`tests/export.spec.ts:8` 默认 `.runtime-test`；`tests/scheduler.spec.ts:9` 默认 `.runtime-test-scheduler-17/<uuid>` | 先统一生产入口，再处理旧目录；现有 E2E 可显式传第三个位置参数指定任务目录 |
| 构建输出在根目录 | `package.json` 的 `main`、`build.directories.output`、`build.files`；`electron/tsconfig.json:8`；Vite 默认输出 | 后续同步迁移编译、启动、打包、验收脚本的路径，不能只移动磁盘目录 |
| `docs/tmp/` 无任务隔离 | 顶层有多个 `pr-10-body*.md`、`npm-start*.log` 和 `review-pipeline*.mjs` | 按主题及本轮执行标识分组；被结论引用的内容先晋升为验收证据 |
| 原子写入残留已入 Git | `docs/acceptance/material-bundle-index/round-1/real-model/materials/B-168e3a48-18ec-446f-8f00-57903e84b17a/bundle.json.e1745355-fcd8-4761-abeb-3bf8daf7825d.tmp` | 先核对正式清单与历史证据用途，再决定移出跟踪；加忽略规则不会移除已经跟踪的文件 |
| 验收证据混入运行态 | `docs/acceptance/material-bundle-index/round-1/real-model/` 中的 `materials/`、`tasks/`、缓存及生成 Excel | 保留最小脱敏证据和再生成方法；完整运行态使用统一的忽略目录 |
| 特性证据没有轮次归属 | `docs/acceptance/html-source-recovery/` 下直接放 `project-before.json`、`task-before.json`、`reparsed.json`、`task-after.png` | 确认引用后整理为 `round-N/`，补足轮次说明；不凭文件名猜测验收已通过 |
| 忽略规则依赖命名习惯 | 根 `.gitignore:16-19` 忽略若干 profile 名；`final-prd-agent-handoff/.gitignore` 另行忽略 `electron-profile`、`runtime` 等 | 新内容统一固定路径；历史规则在调用方迁移完后收敛 |
| 系统临时目录也产生任务数据 | `tests/scheduler-adjustment-queue.spec.ts:92`、`tests/scheduler-lifecycle-scope.spec.ts:92` 使用 `os.tmpdir()`；两文件未检出 teardown 删除 | 后续统一生命周期和故障保留方式；本轮没有扫描或清理系统 Temp |
| 长期目标文件落在根目录 | `goal.md`；多个独立特性已有自己的 `goal.md` | 总体目标迁至归属特性的验收目录并更新入口；保留不同目标间的父子关系，不复制同一 sub goal matrix |

反例：不是所有“中间结果”都可删除。`materials/.../parsed/` 的图像可能仍被索引引用；`analysis-tasks/input-snapshots/` 用于冻结原文与重新开始；`drafts/` 是可以查看的业务草稿。测试中已有正确 teardown：`tests/export.spec.ts:9`、`tests/scheduler.spec.ts:10`。

## 3. 当前应用数据与交付路径

`electron/main.ts:16-17` 支持显式 `--user-data-dir`；默认使用 Electron `app.getPath('userData')`。README 记录的 Windows 默认位置为 `%APPDATA%/prd-refinement-desktop/`。这是应用数据位置，不属于仓库临时目录。本轮未核实正在运行实例所使用的绝对路径。

| 数据 | 当前相对 userData 的位置 | 依据 |
| --- | --- | --- |
| 项目及项目结果 | `projects/<projectId>.json`、`projects/<projectId>/result/` | `electron/main.ts:25-34` |
| 任务与恢复状态 | `analysis-tasks/<taskId>.json`、`<projectId>.project.json`、`<taskId>/` | `electron/scheduler-v2.ts:431,721,771` |
| 冻结输入 | `analysis-tasks/input-snapshots/` | `electron/main.ts` 创建任务、重新开始；`scheduler-v2.ts:353` 删除时检查引用 |
| 原文、解析与索引 | `materials/<bundleId>/{bundle.json,blobs,revisions,cache,parsed,vision}` | `electron/material-bundle.ts:37-40,96-139` |
| 模型会话与失败响应 | 任务工作区的 `sessions/`、`runtime.patch.yml`、`diagnostics/`；另有 `material-vision/`、`runtime-probe/` | `electron/runtime.ts:101`、`scheduler-v2.ts:459`、`main.ts:59,124` |
| 需求包 | `analysis-tasks/<taskId>/result/{drafts,deliveries}/<deliveryId>/` | `electron/scheduler-v2.ts:718-720` |
| Runtime 配置 | `runtime-config.json` | `electron/main.ts:37,51-52`；可能含加密凭据，仍不入 Git |

自动分析依质量状态选择 `drafts` 或 `deliveries`；手动生成交付包入口直接写 `deliveries`（`electron/main.ts:185`）。因此目录名不能单独证明可交付，必须查看 manifest 中的 `qualityState`、待处理事项和未满足依赖。

需求包由 `electron/export-agent-package.ts:194-230` 写临时目录、回读校验后发布，包含 `requirements.json`、`requirements.xlsx`、`README.md`、`pending.json`、`features/`、`sources/`、`manifest.json`。原子 `.tmp` 目录是发布阶段的工作文件，不能和成功发布的完整包等同。

## 4. 复核方法与边界

本轮实际执行：`Get-ChildItem -Force`；对上述目录使用 `Get-ChildItem -Recurse -File -Force` 统计数量、Length；`git ls-files` 检查跟踪状态；`git check-ignore -v --no-index` 检查忽略匹配；`rg -n` 核对写入与清理入口。`.tmp` 残留未命中当前忽略规则，且明确出现在 `git ls-files '*.tmp'` 中。

以上是 2026-09-14 编辑文档前的快照，新建本盘点文档后数量会变化。没有逐份判定业务内容的敏感性、证据价值、引用完整性或可删除性；没有验证构建迁移、自动清理、任务恢复或正式桌面运行行为。这里的建议不是已执行的整改结果。
