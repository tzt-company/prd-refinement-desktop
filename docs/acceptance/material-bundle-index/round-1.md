# 首轮实现与验证

日期：2026-09-10。范围为主 PRD + 补充文件/目录、识别索引、分析来源与 Excel，不接入业务代码和数据库。

已通过：资料包快照/引用/取消测试，HTML/CSS/SVG/PDF/DOCX解析，真实 Word DOC 转换与主动取消；受控 API UI、隔离 Electron 真 File 拖放；真实桌面原生 HTML/目录选择；双 TXT 的真实 Codex CLI 八节点与 Excel 回读。

本轮发现并保留的问题：
- 空文档可错误就绪；索引启动与取消竞态；重复索引覆盖同一版本；重复添加配额计数不正确。已补反例和修正。
- data SVG、inline style URL、独立 CSS/JS 读取缺口；已修正并添加测试。
- 真实双文档首次保存发生 EPERM，第二次原样成功。无法据此确认具体占用进程；后续对 Windows EPERM/EBUSY 原子改名增加最多 500ms 有界等待，不移走或删掉旧清单。持续失败保持失败。
- 生产 CDP 连接的 setInputFiles 得到无本地路径的 File，被 preload 拒绝；这是该测试注入路径不能代表系统拖放。真实 File 拖放改由 Playwright Electron 通道验证，生产原生对话框另行验证，未放宽路径检查。
- 原始 HTML 实际缺 4 个 SVG、5 处引用，正确进入 needs-materials，不改写旧失败任务为成功。

首次真实模型现场：round-1/real-model/readback.md；Word现场：round-1/word-verification/result.json；桌面读回：round-1/native-desktop.json、original-html.json；UI截图同目录。修正后的最终回归见 round-2.md。
