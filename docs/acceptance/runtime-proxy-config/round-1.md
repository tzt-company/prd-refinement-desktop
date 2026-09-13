# Round 1

## PASS 证据

- 本机代理环境：终端配置为 `http://127.0.0.1:7890`；macOS Finder 启动的应用不依赖继承该环境。
- 代理单测：`tests/runtime-errors.spec.ts` 14/14 通过，覆盖 HTTP 环境变量注入、协议校验、认证信息拒绝和 Codex 子进程参数。
- 全量回归：20 个测试文件、196 个测试全部通过。
- 类型与构建：`npm run typecheck`、`npm run build`、`npm run verify:premium` 均通过。
- 严格 UI 审计：0 errors、0 warnings、0 violations。
- 编译代码直连验证：显式传入 `http://127.0.0.1:7890` 后，Luna/low 返回 `routeReady: true`。
- 打包应用验证：在 Runtime 设置页填写并保存同一代理，单次 Runtime 连接检测通过，冒烟结果为 `proxyReady: true`。截图见 `round-1/packaged-home.png`。

## 边界

代理地址支持 `http`、`https` 和 `socks5`。当前不接受 URL 中的用户名或密码，防止认证信息明文持久化。
