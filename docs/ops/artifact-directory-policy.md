# 文件目录与留存规范

适用范围：本仓库开发、调试、验收、打包产生的临时文件、过程记录和交付产物，以及应用持久数据的边界。2026-09-14 起新增内容遵循本规范；存量分布和整改入口见 [目录盘点](../acceptance/artifact-directory-governance/inventory.md)。本文件是持续维护的操作规范，盘点文档是当日快照。

2026-09-14 起，构建、测试和 E2E 默认输出已统一到 `docs/tmp/`；历史分布仍以盘点快照为准。应用正式数据继续使用 Electron userData，不随仓库临时目录迁移。

## 1. 分类原则

先判断用途、再选择目录，不能靠扩展名或“被 Git 忽略”判断能否删除：

1. **临时工作文件**：可重新生成、不承担验收或恢复职责的草稿、日志、缓存、探测数据。按主题和执行批次隔离，用后处置。
2. **中间过程与证据**：方案、决策、失败记录、轮次验证、复现脚本和脱敏样本。需要支撑后续判断，按特性长期保留。
3. **最终产物**：验收报告、用户说明、安装包及用户需求交付包。保留版本、来源、验证记录；不能与草稿混淆。
4. **应用持久数据**：原始资料、冻结输入、任务检查点、业务草稿、运行配置。由应用生命周期管理，不能随开发临时目录清理。

源码、测试代码、工具配置及约定入口（如 README、DESIGN、UX-CONTRACT）属于维护输入。依赖和 Git 元数据由工具管理。其余仓库内非源码输出统一放 `docs/` 的指定子目录，不新增根级 `tmp/`、`artifacts/`、`output/` 或隐藏实验目录，也不直接散放到 `docs/` 根。

## 2. 唯一落点与 Git 策略

| 内容 | 规范落点 | 是否入 Git | 留存条件 |
| --- | --- | --- | --- |
| 临时 PR 正文、临时分析、一次性脚本与日志 | `docs/tmp/<topic>/<run-id>/` | 否 | 当前工作结束后提取有价值内容；PR 合入后转存或清理，不跨特性堆积 |
| 临时桌面 profile、模型会话、测试任务副本 | 同上，分别用 `profile/`、`runtime/`、`logs/` | 否 | 进程退出且无需恢复后才可清理；先保存最小失败证据 |
| 前置分析、方案与实施计划 | `docs/spec/<topic>.md` | 是 | 保留开工前决策，不回写为事后复盘 |
| 长期目标与进展 | `docs/acceptance/<feature>/goal.md` | 是 | 同一个目标只有一份 sub goal matrix；其他入口链接到它 |
| 验收计划、状态、轮次说明 | `docs/acceptance/<feature>/{plan.md,matrix.csv,round-N.md}` | 是 | 轮次新增不覆盖，失败也保留 |
| 本轮截图、脱敏结果与采样 | `docs/acceptance/<feature>/round-N/` | 有选择地入 Git | 只保留证明断言所需的最小内容，记录产生方式 |
| 必须在某轮保留的完整运行态 | `docs/acceptance/<feature>/round-N/runtime/` | 否 | 先设置该路径的忽略规则；需要长期复现则提取样本和配方 |
| 特性复现或跨轮验收脚本 | `docs/acceptance/<feature>/scripts/` | 是 | 两个及以上特性确实复用后，才提升至 `acceptance/_shared/` |
| 跨轮静态样本 | `docs/acceptance/<feature>/fixtures/` | 脱敏后入 Git | 单轮样本用 `round-N/fixtures/`；单元测试 fixture 继续放 `tests/fixtures/` |
| 全绿后的验收结论 | `docs/acceptance/<feature>/report.md` | 是 | 汇总 matrix 与证据；有 FAIL/UNKNOWN 不写全绿报告 |
| 事后复盘 | `docs/acceptance/<feature>/retrospective.md` | 是 | 只在确有复盘内容时创建，不放 `spec/` |
| 用户手册、运维规范 | `docs/manual/`、`docs/ops/` | 是 | 随用户行为、操作入口变化同步维护 |
| 原始需求、第三方资料 | `docs/reference/` | 依来源权限决定 | 保留原文件名、来源与版本，敏感原文不因“参考资料”而自动入库 |
| 编译缓存、展开包与打包临时结果 | `docs/tmp/desktop-build/current/{dist,dist-electron,dist-release}/` | 否 | `current` 是可反复覆盖的构建工作区；发布证据必须提取到带轮次的位置 |
| 单元测试工作目录 | `docs/tmp/test-run/vitest/` | 否 | 测试应在 teardown 删除自己的子目录；异常退出残留由清理脚本处理 |
| E2E 默认任务目录 | `docs/tmp/e2e-pipeline/current/` | 否 | 并行或需长期对比时必须显式传入独立目录，并将证据提取到验收轮次 |
| 已验收安装包的本地留存 | `docs/acceptance/<release-feature>/round-N/artifacts/` | 二进制不入 Git | 在轮次说明记录 commit、版本、平台、架构、SHA-256、构建/验证命令及实际发布地址（如有） |

上述模板仅在需要时建立。`<topic>`、`<feature>`、`<release-feature>` 先复用已有归属，不能每次运行新建一个特性。API 契约和查询/修复 SQL 继续分别归 `docs/api/`、`docs/sql/`；框架 migration 留在源码树。

### 命名

- 主题目录与描述性文件名使用 3–6 个英文小写词和连字符，例如 `artifact-directory-governance`。固定协议名 `goal.md`、`matrix.csv`、`round-N.md`、工具生成文件名和外部原文件名按各自契约保留。
- `<run-id>` 使用 `yyyyMMdd-HHmmss-<short-id>`，同一执行共用一个标识，并行执行不可复用。日期采用本地时区，跨机器证据写明时区。
- 验收重跑使用下一个 `round-N`，不能用 `final-final`、`v2-new` 表达验证状态。构建版本、pipeline 版本、taskId 在轮次记录中单列，不能代替轮次。
- 截图使用顺序和场景，例如 `01-task-center.png`；日志区分 `stdout.log`、`stderr.log`。PR 草稿使用当前执行目录下的 `pr-body.md`。

### Git 与二进制

- 忽略规则应先于生成动作落实。当前 `docs/tmp/` 已整体忽略；`round-N/runtime/` 和 `artifacts/` 尚无全仓统一规则，新使用前先补精确规则。不能全局忽略 JSON 或整个验收目录，否则会隐藏正式证据。
- 浏览器缓存、完整模型会话、凭据/加密配置、原子写入 `.tmp`/`.bak`、依赖、安装包、展开程序不入 Git。
- 小型截图或不可替代的二进制测试样本可以入库，但必须能解释用途。规范定义单个二进制达到 **5 MiB** 或同轮二进制合计达到 **20 MiB** 时，不直接入 Git，保留摘要、哈希和再生成方法；不能拆文件规避限制。
- 业务原文、任务 JSON、模型响应即使很小也可能敏感；先脱敏，再核对保留内容仍能证明断言。完整用户 profile 不能作为验收附件提交。
- `.gitignore` 不改变已跟踪文件。处理存量时先查 `git ls-files`，必要的移出跟踪与磁盘删除是两件不同的操作，不重写历史来掩盖问题。

## 3. 应用数据与业务交付

应用数据根由 Electron `app.getPath('userData')` 决定，测试可显式传 `--user-data-dir`。正式数据保留在应用数据根，不迁入 `docs/tmp/`。测试 profile 必须独立；目录名包含 `profile` 不能证明它属于测试。

```text
<userData>/
├── runtime-config.json
├── projects/
├── materials/<bundleId>/
│   ├── bundle.json
│   ├── blobs/
│   ├── revisions/<revision>/
│   ├── cache/
│   ├── parsed/
│   └── vision/
├── analysis-tasks/
│   ├── <taskId>.json
│   ├── <projectId>.project.json
│   ├── input-snapshots/
│   └── <taskId>/
│       ├── diagnostics/
│       └── result/
│           ├── drafts/<deliveryId>/
│           └── deliveries/<deliveryId>/
├── material-vision/
└── runtime-probe/
```

这是当前主要结构，不穷举 Electron 缓存和适配器文件。任务工作区还可能含会话与配置补丁。

- `blobs/`、`revisions/`、冻结输入和检查点是恢复与溯源依据；不能以“已生成 Excel”为由删掉。`parsed/`、`vision/`、`cache/` 也不默认视为可删除，因为索引/任务可能引用图像路径，重算可能调用模型。
- `drafts/` 是持久化业务草稿。自动流程根据交付评估选择草稿或交付目录，但手动导出也会写 `deliveries/`；必须同时检查 `manifest.json` 中的 `qualityState`、`resultVersion`、`pendingItemCount`、`unmetDependencyCount` 和 `pending.json`，目录名不能证明质量达标。
- 需求包整体保留 `manifest.json`、`requirements.json`、`requirements.xlsx`、`README.md`、`pending.json`、`features/`、`sources/`。复制交付包后核对 manifest 的文件大小和哈希，不能仅保留 Excel 后宣称完整交付。
- 业务数据通过应用已有归档/删除入口处理，并遵守其确认与引用检查。归档不是删除。手工清缓存、清会话或检查点必须另行核实依赖及运行状态。
- 原子写入需要与目标文件位于同一父目录，以支持发布和替换；不强行把这种短生命周期 `.tmp` 移到统一 scratch。异常残留先检查对应正式文件、写入进程与恢复用途，再处置。

## 4. 从临时到证据再到交付

1. **开工**：确认主题和现有归属，选择本轮目录；检查忽略规则。需要多轮证据时先列 `matrix.csv`，需要持续目标时维护唯一 `goal.md`。
2. **执行**：输出路径通过脚本/函数参数传递；不要增加同名环境变量兜底。已有参数可直接指定新目录；只有根路径写死的入口才安排代码修改。
3. **记录**：在 `round-N.md` 写源码 commit、实际命令、输入版本/哈希、运行目录、断言与输出。过程中的 FAIL/UNKNOWN 如实入 matrix，不用“命令退出 0”代替业务通过。
4. **晋升**：临时内容被最终结论引用前，提取脱敏文本、必要截图/样本和复现步骤到 `round-N/`；更新引用并独立回读。长期文档不能只链接忽略目录中的文件。
5. **交付**：matrix 全绿才写 `report.md`；安装包另记产物 SHA-256 与构建来源，需求包按自身 manifest 校验。构建通过、安装通过、真实业务通过分开记。
6. **收尾**：临时草稿用后归档或列入清理清单；未收敛证据和待恢复任务保留并注明原因。7 天未更新的临时目录应复核归属，30 天未更新的残留应明确保留理由；日期只触发复核，不触发自动删除。

无多轮或风险验证需求的纯文档盘点可以只保留 `inventory.md`，不为形式创建空矩阵和全绿报告。

## 5. 存量迁移与安全清理

迁移顺序固定为：**识别归属与引用 → 修改生成入口 → 验证新路径 → 提取历史证据 → 核准并执行搬迁/清理 → 独立回读**。本轮清单中的存量均尚未搬迁。

- **入口现状**：E2E 默认目录、单元测试工作区和桌面构建输出已经改到上述规范落点；打包验证证据仍由调用者显式传入验收轮次。新增入口继续遵守同一规则。
- **再整理历史**：根目录 `goal.md` 归到唯一总体目标；根目录探测数据和 `docs/tmp/` 散文件逐项关联主题；已有验收引用更新后再移动；既有未跟踪方案不顺手纳入提交。
- **明确清理清单**：列源绝对路径、目标路径（若搬迁）、文件数/字节、用途、引用、运行进程、保留副本或再生成方法。不按 `.*`、`*.tmp`、年龄或“Git 干净”直接批量删除。
- **破坏性脚本先自检**：后续清理/迁移脚本必须提供 `--check`，零写入、零删除地检查上述清单，标出未知归属、活动任务和链接路径。执行前先运行自检；本规范不代表已经提供该脚本或已经获得未列明数据的删除授权。
- **Windows 路径**：全程使用 PowerShell 7 和 `-LiteralPath`；递归移动/删除前验证解析后的绝对路径确实位于预期工作区或明确目标目录，检查 junction/symlink 的真实指向，拒绝跨界和工作区根本身。
- **回读与恢复**：搬迁后逐文件比较相对路径、数量、字节及 SHA-256，更新并检查引用；删除后分别检查磁盘不存在和 Git 状态，不能用工具成功回执代替。发布文件保留来源 commit，手工清理前准备可验证的恢复副本。

## 6. 提交前复核

新增输出全部有目录归属；持久证据未只留在 `docs/tmp/`；完整运行态与大二进制未进入暂存区；轮次与目标没有重复；文档没有将计划迁移写成已实现。使用 `git status --short`、`git diff --cached --name-status`、`git ls-files` 和磁盘读取分别核实。

当前提供 `scripts/clean-local-history.ps1` 清理已知历史任务与旧输出；它默认执行删除，`-Check` 只输出清单且零副作用。脚本不做自动留存、不清浏览器缓存、不删除 Runtime 配置，也不替代验收证据晋升。目录归属仍需在评审中检查，不能仅以脚本存在宣称后续输出都已合规。
