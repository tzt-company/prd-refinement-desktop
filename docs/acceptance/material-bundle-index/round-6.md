# 第 6 轮：资料包管理

## 结论

PASS。已有资料包可重命名和整体删除；删除需要内联二次确认，原始磁盘文件不受影响。索引处理中，后端拒绝重命名和删除。

## 验证

- `tests/material-bundle.spec.ts`：验证重命名不改变内容 revision 或 indexedRevision；整体删除后清单、manifest 与索引均不可再读；空名称和超长名称被拒绝；索引处理中删除被拒绝。
- `docs/acceptance/material-bundle-index/scripts/verify-material-ui.mjs`：验证选择器旁直接可见的重命名与删除动作、名称保存、删除确认取消、最终删除、成功反馈，以及 1440px / 1100px 无横向溢出。
- `npm test`、`npm run typecheck`、`npm run build`、`npm run verify:premium`：结果记录以本轮最终命令输出为准。

## 边界

本轮没有删除真实用户资料包。真实磁盘删除由临时目录集成测试覆盖，桌面渲染与交互由受控 IPC 验证。
