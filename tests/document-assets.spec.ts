import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import JSZip from 'jszip';
import { extractDocument } from '../electron/document-assets';
import { sourceCoverage } from '../electron/source-units';

const directories:string[]=[];
afterEach(async()=>{for(const directory of directories.splice(0))await rm(directory,{recursive:true,force:true})});
async function fixture(name:string,buffer:Buffer){const directory=await mkdtemp(path.join(os.tmpdir(),'prd-assets-'));directories.push(directory);const file=path.join(directory,name);await writeFile(file,buffer);return {file,directory}}

it('DOCX原文和全部包内媒体分别建账，不支持图片与嵌入附件保持blocked',async()=>{
  const zip=new JSZip();
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>字段X必填</w:t></w:r></w:p></w:body></w:document>');
  zip.file('word/media/image1.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6OtAAAAAASUVORK5CYII=','base64'));
  zip.file('word/media/image2.emf','unsupported');zip.file('word/embeddings/object1.bin','attachment');
  const {file,directory}=await fixture('sample.docx',await zip.generateAsync({type:'nodebuffer'}));
  const result=await extractDocument(file,path.join(directory,'assets'));
  expect(result.rawText).toContain('字段X必填');expect(sourceCoverage(result.rawText,result.sourceUnits).complete).toBe(true);
  const images=result.sourceUnits.filter(unit=>unit.kind==='image');expect(images).toHaveLength(2);
  expect(images[0].asset?.readStatus).toBe('pending');expect(images[1].status).toBe('blocked');
  expect((await readFile(images[0].asset!.path)).length).toBeGreaterThan(20);
  expect(result.sourceUnits.find(unit=>unit.kind==='attachment')?.status).toBe('blocked');
});

it('PDF即使没有文字也渲染完整页面，不能将扫描或矢量页面视为已读取',async()=>{
  const stream='0 0 1 rg 20 20 40 40 re f';
  const pdf=Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >> endobj\n4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\ntrailer << /Root 1 0 R >>\n%%EOF`);
  const {file,directory}=await fixture('vector.pdf',pdf);const result=await extractDocument(file,path.join(directory,'assets'));
  const images=result.sourceUnits.filter(unit=>unit.kind==='image');expect(images).toHaveLength(1);expect(images[0].status).toBe('pending');
  expect((await readFile(images[0].asset!.path)).subarray(1,4).toString()).toBe('PNG');expect(sourceCoverage(result.rawText,result.sourceUnits).complete).toBe(true);
});

it('HTML解析标题、表格及实体，动态内容和外部图片不静默丢失',async()=>{
 const html='<html><head><meta charset="utf-8"></head><body><h1>订单要求</h1><table><tr><th>字段</th><th>规则</th></tr><tr><td>名称</td><td>A &amp; B 必填</td></tr></table><img src="https://example.invalid/a.png"><script>ignored()</script></body></html>';
 const {file,directory}=await fixture('sample.html',Buffer.from(html));const result=await extractDocument(file,path.join(directory,'assets'));
 expect(result.rawText).toContain('# 订单要求');expect(result.rawText).toContain('A & B 必填');expect(result.rawText).not.toContain('<td>');expect(result.rawText).toContain('ignored()');expect(result.sourceUnits.filter(x=>x.status==='blocked')).toHaveLength(1);
});
it('HTML内嵌图片独立建账',async()=>{
 const {file,directory}=await fixture('image.htm',Buffer.from('<p>示意图</p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6OtAAAAAASUVORK5CYII=">'));
 const result=await extractDocument(file,path.join(directory,'assets'));expect(result.sourceUnits.some(x=>x.asset?.mimeType==='image/png'&&x.status==='pending')).toBe(true);
});
it('未知二进制格式拒绝导入',async()=>{
 const {file,directory}=await fixture('bad.bin',Buffer.from([0,255]));await expect(extractDocument(file,path.join(directory,'assets'))).rejects.toThrow('不支持的文档格式');
});

it('内嵌HTML递归读取正文和脚本，普通样式不阻断，外部iframe仍阻断',async()=>{
 const inner='<h2>合并提醒</h2><script>const message="选择目标关联ID";</script>';
 const html='<style>body{color:red}</style><table><col style="width:50%"><tr><td>规则</td></tr></table><iframe src="data:text/html;base64,'+Buffer.from(inner).toString('base64')+'"></iframe><iframe src="https://example.invalid"></iframe>';
 const {file,directory}=await fixture('nested.html',Buffer.from(html));const result=await extractDocument(file,path.join(directory,'assets'));
 expect(result.rawText).toContain('合并提醒');expect(result.rawText).toContain('选择目标关联ID');expect(result.rawText).toContain('width:50%');expect(result.sourceUnits.filter(x=>x.status==='blocked')).toHaveLength(1);expect(result.sourceUnits.find(x=>x.status==='blocked')?.label).toContain('外部 iframe');
});

it('资料包 resolver 不回退读取未提交的相邻图片，并记录排除理由',async()=>{
 const {file,directory}=await fixture('source.html',Buffer.from('<p>正文</p><img src="secret.png"><script src="ignored.js"></script>'));
 await writeFile(path.join(directory,'secret.png'),Buffer.from('private'));
 const calls:string[]=[];
 const result=await extractDocument(file,path.join(directory,'assets'),{resolveReference:async(reference,location)=>{calls.push(reference);expect(location).toContain('HTML 第 1 行第');return reference==='ignored.js'?{excludedReason:'仅装饰效果，由用户排除'}:{error:'未提交资料'}}});
 expect(calls).toEqual(['secret.png','ignored.js']);expect(result.sourceUnits.filter(x=>x.status==='blocked')).toHaveLength(1);
 expect(result.rawText).toContain('未提交资料');expect(result.rawText).toContain('仅装饰效果');expect(result.sourceUnits.some(x=>x.asset)).toBe(false);
});
it('内嵌 iframe 保留父定位，源码以 attachment 标记且覆盖可核对',async()=>{
 const {file,directory}=await fixture('source.html',Buffer.from('<h1>标题</h1>\n<iframe srcdoc="&lt;p&gt;内文&lt;/p&gt;&lt;script&gt;const n=1&lt;/script&gt;"></iframe>'));
 const result=await extractDocument(file,path.join(directory,'assets'));
 expect(result.sourceUnits.find(x=>x.excerpt==='内文')?.location).toContain('HTML 第 2 行第 1 列 / iframe srcdoc / HTML 第 1 行');
 expect(result.sourceUnits.find(x=>x.excerpt==='const n=1')?.kind).toBe('attachment');expect(sourceCoverage(result.rawText,result.sourceUnits).complete).toBe(true);
});
it('独立 SVG 受控栅格化，活动内容和尺寸超限拒绝',async()=>{
 const safe=await fixture('safe.svg',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M1 1h20v20H1z"/></svg>'));
 const result=await extractDocument(safe.file,path.join(safe.directory,'assets'));
 expect(result.sourceUnits[0].asset?.mimeType).toBe('image/png');expect(result.sourceUnits[0].status).toBe('pending');
 const unsafe=await fixture('unsafe.svg',Buffer.from('<svg width="24" height="24"><image href="https://example.invalid/a.png"/></svg>'));
 await expect(extractDocument(unsafe.file,path.join(unsafe.directory,'assets'))).rejects.toThrow('活动内容或外部资源');
 const huge=await fixture('huge.svg',Buffer.from('<svg width="99999" height="99999"></svg>'));
 await expect(extractDocument(huge.file,path.join(huge.directory,'assets'))).rejects.toThrow('尺寸超过');
});
it('伪装图片拒绝，预取消不生成解析资产',async()=>{
 const {file,directory}=await fixture('fake.png',Buffer.from('<html>fake</html>'));
 await expect(extractDocument(file,path.join(directory,'assets'))).rejects.toThrow('文件签名');
 const controller=new AbortController();controller.abort();await expect(extractDocument(file,path.join(directory,'assets'),{signal:controller.signal})).rejects.toThrow();
});

it('外部 iframe 中图片引用按初始文档规范化，资源仅来自 resolver',async()=>{
 const {file,directory}=await fixture('root.html',Buffer.from('<iframe src="pages/prototype.html"></iframe>'));
 const nested=path.join(directory,'nested.html'),svg=path.join(directory,'icon.svg');
 await writeFile(nested,'<img src="../assets/icon.svg">');await writeFile(svg,'<svg width="10" height="10"></svg>');
 const refs:string[]=[];
 const result=await extractDocument(file,path.join(directory,'assets'),{resolveReference:async(reference)=>{refs.push(reference);return {path:reference==='pages/prototype.html'?nested:svg}}});
 // resolver 的返回 path 是不可变快照位置，嵌套引用必须基于逻辑父目录而非快照目录。
 expect(refs).toEqual(['pages/prototype.html','assets/icon.svg']);expect(result.sourceUnits.some(x=>x.asset?.mimeType==='image/png')).toBe(true);
});
it('Markdown 图片引用经 resolver 读取并保留覆盖，缺件不回退',async()=>{
 const {file,directory}=await fixture('document.md',Buffer.from('# 标题\n\n![图](icon.svg)\n\n![缺图](missing.png)'));
 const svg=path.join(directory,'icon.svg');await writeFile(svg,'<svg width="10" height="10"></svg>');
 const result=await extractDocument(file,path.join(directory,'assets'),{resolveReference:async(ref)=>ref==='icon.svg'?{path:svg}:{error:'未提供'}});
 expect(result.sourceUnits.filter(x=>x.status==='blocked')).toHaveLength(1);expect(result.sourceUnits.some(x=>x.asset?.mimeType==='image/png')).toBe(true);expect(sourceCoverage(result.rawText,result.sourceUnits).complete).toBe(true);
});

it('data SVG 与独立 SVG 一致，安全栅格化后交给视觉读取',async()=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="M0 0h10v10z"/></svg>';
 const {file,directory}=await fixture('data.html',Buffer.from('<img src="data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')+'">'));
 const result=await extractDocument(file,path.join(directory,'assets'));
 expect(result.sourceUnits[0].asset?.mimeType).toBe('image/png');expect(result.sourceUnits[0].status).toBe('pending');
});

it('inline style 的背景图片不能漏登记，已提供图片仍需视觉读取',async()=>{
 const {file,directory}=await fixture('background.html',Buffer.from('<p style="background-image:url(missing.png)">需求</p><div style="background:url(icon.svg)"></div>'));
 const svg=path.join(directory,'icon.svg');await writeFile(svg,'<svg width="10" height="10"></svg>');const refs:string[]=[];
 const result=await extractDocument(file,path.join(directory,'assets'),{resolveReference:async(ref)=>{refs.push(ref);return ref==='icon.svg'?{path:svg}:{error:'未提交'}}});
 expect(refs).toEqual(['missing.png','icon.svg']);expect(result.sourceUnits.filter(x=>x.status==='blocked')).toHaveLength(1);expect(result.sourceUnits.some(x=>x.asset?.readStatus==='pending')).toBe(true);
});

it('独立 CSS 登记来源数据并读取背景图，缺件可定位',async()=>{
 const {file,directory}=await fixture('theme.css',Buffer.from('.a{background:url(icon.svg)}\n.b{background:url(missing.png)}'));
 const svg=path.join(directory,'icon.svg');await writeFile(svg,'<svg width="12" height="12"></svg>');const refs:string[]=[];
 const result=await extractDocument(file,path.join(directory,'assets'),{resolveReference:async(ref)=>{refs.push(ref);return ref==='icon.svg'?{path:svg}:{error:'未提交'}}});
 expect(refs).toEqual(['icon.svg','missing.png']);expect(result.sourceUnits[0].kind).toBe('attachment');expect(result.sourceUnits[0].context).toContain('不是普通业务需求');expect(result.sourceUnits[0].location).toBe('theme.css 第 1-2 行');expect(result.sourceUnits.some(x=>x.asset?.readStatus==='pending')).toBe(true);expect(result.sourceUnits.filter(x=>x.status==='blocked')).toHaveLength(1);
});
it('独立 JS 原样保留为脚本数据，不执行或抽取成业务段落',async()=>{
 const code='throw new Error("不得执行");\nconst label="确认合并";';const {file,directory}=await fixture('prototype.js',Buffer.from(code));
 const result=await extractDocument(file,path.join(directory,'assets'));
 expect(result.rawText).toBe(code);expect(result.sourceUnits).toHaveLength(1);expect(result.sourceUnits[0].kind).toBe('attachment');expect(result.sourceUnits[0].status).toBe('processed');expect(result.sourceUnits[0].context).toContain('未执行');
});
