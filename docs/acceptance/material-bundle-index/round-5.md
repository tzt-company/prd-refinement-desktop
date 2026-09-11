# Round 5：只使用用户上传资料

本轮将资料范围改为由用户决定。资料包不会扫描 HTML、CSS、Markdown 或 DOCX 中的路径来判断缺件，也不会因未上传的引用目标阻断索引或分析。

验证结果：

- `npm test`：12 个测试文件、129 项测试全部通过。
- `npm run build`：TypeScript、Vite 和 Electron 主进程构建通过。
- `npm run verify:premium`：UI contract smoke check 通过。
- frontend-design-premium strict audit：0 errors、0 warnings、0 violations。
- 资料包浏览器流程：主 PRD、补充目录、索引、分页、来源预览和分析交接通过；页面不存在“引用与缺件”入口；1440×900 和 1100×720 均无横向溢出。
- 反向用例：HTML 中的缺失相对图片、相邻但未上传的文件和外部 iframe 均不生成引用或缺件问题，已上传正文仍可进入分析。

边界：用户直接上传的文件仍需通过格式、签名和可读性检查；内嵌在已上传文件中的 data 图片及 iframe `srcdoc` 仍作为该文件内容读取。索引就绪不代表用户已经提供全部业务资料，也不代表自然语言语义完整。
