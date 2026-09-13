# Round 1

## PASS 证据

- 细化与展示专项：`tests/direct-domain.spec.ts`、`tests/app.spec.ts` 共 41 个测试通过。
- 空字段绑定：没有 conditions、constraints 或显式验收条件时，模型返回的空占位组被确定性归一为 `[]`。
- 非空字段绑定：字段存在但绑定组数量不符时仍拒绝，错误同时给出期望组数与实际组数。
- 进度展示：`42.85714285714286` 显示为 `43%`，内部进度值不变。
- 全量回归：20 个测试文件、199 个测试全部通过。
- `npm run typecheck`、`npm run build`、`npm run verify:premium` 均通过。
- 严格 UI 审计返回 0 errors、0 warnings、0 violations。
- macOS 目录包重新生成并直接启动，首页冒烟通过；截图见 `round-1/packaged-home.png`。
