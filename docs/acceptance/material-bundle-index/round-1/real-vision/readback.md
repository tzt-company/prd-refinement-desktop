# 真实视觉 IPC 与缓存验收

2026-09-10 执行 `node docs/acceptance/material-bundle-index/scripts/verify-material-real-vision.mjs`，退出码 0。

- 使用最新生产 `dist-electron`、Electron 本地 file 入口、隔离 profile，全部资料操作经过实际 preload 与 main 的 materials IPC。
- 主 TXT 为“新增订单备注功能。”；PNG 是 Canvas 绘制的测试夹具，内容为“订单备注最多100字”。
- 实际 main `readImage` 回调调用 Codex CLI / gpt-5.6-luna / low，未使用模拟模型。
- 资料包 `B-89b5d51c-ffda-4234-a4d8-69c237bbc827` 首次索引版本 3，状态 ready；图片 `readStatus=read`，真实转录为“订单备注最多100字”。
- 第二次索引生成版本 4，状态 ready。vision 缓存内容及 mtime 均未改变；实际模型会话目录前后均为 1 个且名称相同；重新读回项目的图像转录一致，证明缓存复用。
- 独立 PowerShell 读取 `evidence.json` 再确认两个 ready、版本 3→4、实际转录、缓存与会话数量一致。

边界：原生文件选择框返回值由夹具代入，未验证 native 操作；没有启动需求分析。未修改应用源码或生产 profile，配置只复制无凭据字段。PNG、配置快照及完整读回结果均由上述脚本生成。
