# Round 22：真实任务列表列对齐修复

日期：2026-09-13

## 结论

用户真实桌面截图推翻了 round 21 的任务中心验收结论：表头是 7 列网格，任务数据行使用嵌套的 6 列按钮和 2 列外层网格；真实长名称触发两套网格独立计算，操作按钮因此进入进度列。现在任务单元格直接位于统一的 7 列网格中，整行点击由透明按钮承载，操作菜单保持独立交互。

## 真实数据验证

验证脚本只读复制 `%APPDATA%/prd-refinement-desktop/analysis-tasks` 到隔离用户目录，并用真实 Electron 加载当前 6 条任务。

- 表头和首行 7 列的最大水平偏移：`0px`。
- 进度列右边界：`1070.33px`；操作列左边界：`1276.33px`，无覆盖。
- 表头与数据行计算后的网格均为 `556.667px 80px 130px 150px 90px 80px 72px`。
- 真实点击“更多”可展开归档/删除菜单；提高打开菜单的层级后，下一行按钮不再穿透覆盖。
- 真实点击任务主体可进入详情页。

## 证据

- `round-22/01-current-tasks-columns.png`：当前 6 条真实任务全部列对齐。
- `round-22/02-current-task-menu.png`：操作菜单展开状态无遮挡。
- `round-22/result.json`：列坐标、网格轨道和重叠断言。
- `scripts/verify-task-center-real-data.mjs`：复制真实任务数据并驱动 Electron 的可重复脚本。

## 自动验证

- 真实数据 Electron 脚本：PASS。
- `npm test -- --run`：20 个测试文件、181 项测试通过。
- `npm run typecheck`：PASS。
- `npm run build`：PASS。
- `npm run verify:premium -- --strict`：PASS。
