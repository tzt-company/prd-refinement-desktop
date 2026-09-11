// 运行前启动 Vite；此脚本验证渲染层状态和交互，不替代真实文件/目录 IPC 验收。
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
await page.addInitScript(() => {
  let bundle = {id:'bundle-ui',name:'资料识别验收',revision:1,state:'draft',files:[],references:[],issues:[],progress:{completed:0,total:0,phase:''},updatedAt:new Date().toISOString()};
  let polls=0; const calls=[]; window.__materialCalls=calls;
  const snapshot=()=>structuredClone(bundle);
  const update=()=>{bundle.revision++;bundle.state='draft';return snapshot()};
  const units=Array.from({length:30},(_,i)=>({id:`S-${i}`,label:`原文单元 ${i}`,location:'主文档.html / 第1段',kind:'paragraph',excerpt:`合并提醒 原文内容 ${i}`,status:'unprocessed'}));
  window.prdApp={inspectRuntime:async()=>({available:true,adapter:'codex-oauth',version:'test'}),loadAnalysisTasks:async()=>[],onAnalysisTaskUpdate:()=>()=>{},
  startAnalysis:async()=>{calls.push('start');return{id:'T-ui',project:{name:'资料识别验收',sourceName:'主文档.html'},status:'running',steps:[],progress:0,createdAt:Date.now()}},
  materials:{list:async()=>[],create:async()=>snapshot(),get:async()=>{if(bundle.state==='indexing'&&++polls>=2){bundle.state='ready';bundle.indexedRevision=bundle.revision;bundle.progress.completed=bundle.files.length;bundle.files.forEach(f=>f.status='read');bundle.references=[];bundle.issues=[]}return snapshot()},
  add:async(id,options,files)=>{calls.push({kind:options.kind,mount:options.mount,drop:!!files});bundle.files.push({id:`f${bundle.files.length}`,logicalPath:options.role==='primary'?'主文档.html':`${options.mount||'assets'}/补充.txt`,role:options.role,revision:1,size:40,hash:'abc',status:'registered'});if(options.role!=='primary'){bundle.references=[{id:'r1',fileId:'f0',reference:'流程图.png',location:'第3段',state:'missing'},{id:'r2',fileId:'f0',reference:'流程图.png',location:'第5段',state:'missing'},{id:'r3',fileId:'f0',reference:'字段说明.xlsx',location:'第8段',state:'missing'}];bundle.issues=bundle.references.map(reference=>({id:`i-${reference.id}`,fileId:reference.fileId,referenceId:reference.id,message:`引用未读取：${reference.reference}`}));}return update()},
  updateFile:async(id,fileId,patch)=>{Object.assign(bundle.files.find(f=>f.id===fileId),patch);return update()},removeFile:async(id,fileId)=>{bundle.files=bundle.files.filter(f=>f.id!==fileId);return update()},
  index:async()=>{bundle.state='indexing';polls=0;bundle.progress={completed:0,total:bundle.files.length,phase:'读取资料'};return snapshot()},cancel:async()=>{bundle.state='cancelled';return snapshot()},
  query:async(id,q)=>{calls.push({query:q});const found=units.filter(u=>!q.query||u.excerpt.includes(q.query));return{items:found.slice(q.offset,q.offset+q.limit),total:found.length,revision:bundle.revision}},read:async(id,ids)=>units.filter(u=>ids.includes(u.id)),project:async()=>({id:'p-ui',name:'资料识别验收'}),resolveReference:async()=>snapshot()}};
});
try {
 await page.goto(process.env.PRD_UI_URL||'http://127.0.0.1:5173');
 await page.getByRole('button',{name:'新建任务',exact:true}).click();
 await page.getByText('选择主 PRD 文件',{exact:true}).waitFor();
 assert.equal(await page.locator('.material-supplements').count(),0,'选择主 PRD 前不应展开资料管理');
 await mkdir('docs/acceptance/material-bundle-index/round-3',{recursive:true});
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-3/prd-entry-1440.png',fullPage:true});
 await page.getByRole('button',{name:'选择 PRD 文件',exact:true}).click();
 await page.getByRole('heading',{name:'主文档.html',exact:true}).waitFor();
 assert.equal(await page.locator('.material-supplements').count(),1,'主 PRD 保存后应展开补充资料');
 await page.getByLabel('目录在资料包中的名称').fill('assets');
 await page.getByRole('button',{name:'添加目录',exact:true}).click();
 await page.getByRole('button',{name:'调整资料',exact:true}).last().click();
 await page.getByLabel('资料包内路径').fill('assets/说明.txt');
 await page.getByRole('button',{name:'保存设置',exact:true}).click();
 await page.getByText('assets/说明.txt',{exact:true}).waitFor();
 await page.getByText('还缺 2 个文件',{exact:true}).waitFor();
 assert.match(await page.getByLabel('缺少资料摘要').innerText(),/3 处引用尚未读取/,'缺件数与引用次数必须分别汇总');
 assert.equal(await page.locator('.material-intake-selected').evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length),3,'主文档卡片应为三列布局');
 await mkdir('docs/acceptance/material-bundle-index/round-4',{recursive:true});
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-4/material-preparation-1440.png',fullPage:true});
 await page.setViewportSize({width:1100,height:720});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-4/material-preparation-1100.png',fullPage:true});
 await page.setViewportSize({width:1440,height:900});
 assert.equal(await page.getByRole('button',{name:'开始需求分析',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'识别与建立索引',exact:true}).click();
 await page.getByRole('button',{name:'取消索引',exact:true}).waitFor();
 await page.getByText('索引就绪',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'内容索引',exact:true}).click();
 await page.getByText('原文单元 0',{exact:true}).waitFor();
 await page.getByRole('button',{name:'下一页',exact:true}).click();
 await page.getByText('原文单元 25',{exact:true}).waitFor();
 await page.getByLabel('搜索原文内容').fill('内容 2');
 await page.getByText('原文单元 2',{exact:true}).waitFor();
 await page.getByText('原文单元 2',{exact:true}).click();
 await page.getByLabel('来源原文').waitFor();
 await page.keyboard.press('Escape');
 assert.equal(await page.getByLabel('来源原文').count(),0);
 await mkdir('docs/acceptance/material-bundle-index/round-1',{recursive:true});
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-1/material-ui-1440.png',fullPage:true});
 await page.setViewportSize({width:1100,height:720});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-1/material-ui-1100.png',fullPage:true});
 await page.getByRole('button',{name:'开始需求分析',exact:true}).click();
 await page.getByText('T-ui',{exact:true}).waitFor();
 assert.ok((await page.evaluate(()=>window.__materialCalls)).includes('start'));
 console.log('PASS: 资料包创建、目录挂载、路径保存、索引轮询、ready门禁、分页检索、来源预览、Escape、1440/1100无横向溢出、分析交接。渲染层受控API验证。');
} finally {await browser.close()}
