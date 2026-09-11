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
  materials:{list:async()=>bundle.files.length?[snapshot()]:[],create:async()=>snapshot(),get:async()=>{if(bundle.state==='indexing'&&++polls>=2){bundle.state='ready';bundle.indexedRevision=bundle.revision;bundle.progress.completed=bundle.files.length;bundle.files.forEach(f=>f.status='read');bundle.references=[];bundle.issues=[]}return snapshot()},
  renameBundle:async(id,name)=>{calls.push({rename:name});bundle.name=name;bundle.updatedAt=new Date().toISOString();return snapshot()},deleteBundle:async()=>{calls.push('delete');bundle={id:'bundle-ui',name:'资料识别验收',revision:1,state:'draft',files:[],references:[],issues:[],progress:{completed:0,total:0,phase:''},updatedAt:new Date().toISOString()}},
  add:async(id,options,files)=>{calls.push({kind:options.kind,mount:options.mount,drop:!!files});bundle.files.push({id:`f${bundle.files.length}`,logicalPath:options.role==='primary'?'主文档.html':`${options.mount||'assets'}/补充.txt`,role:options.role,revision:1,size:40,hash:'abc',status:'registered'});return update()},
  updateFile:async(id,fileId,patch)=>{Object.assign(bundle.files.find(f=>f.id===fileId),patch);return update()},removeFile:async(id,fileId)=>{bundle.files=bundle.files.filter(f=>f.id!==fileId);return update()},
  index:async()=>{bundle.state='indexing';polls=0;bundle.progress={completed:0,total:bundle.files.length,phase:'读取资料'};return snapshot()},cancel:async()=>{bundle.state='cancelled';return snapshot()},
  query:async(id,q)=>{calls.push({query:q});const found=units.filter(u=>!q.query||u.excerpt.includes(q.query));return{items:found.slice(q.offset,q.offset+q.limit),total:found.length,revision:bundle.revision}},read:async(id,ids)=>units.filter(u=>ids.includes(u.id)),project:async()=>({id:'p-ui',name:'资料识别验收'})}};
});
try {
 await page.goto(process.env.PRD_UI_URL||'http://127.0.0.1:5173');
 await page.getByRole('button',{name:'新建任务',exact:true}).first().click();
 await page.getByText('选择主 PRD 文件',{exact:true}).waitFor();
 assert.equal(await page.locator('.material-supplements').count(),0,'选择主 PRD 前不应展开资料管理');
 await mkdir('docs/acceptance/material-bundle-index/round-6',{recursive:true});
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-6/prd-entry-1440.png',fullPage:true});
 await page.getByRole('button',{name:'选择 PRD 文件',exact:true}).click();
 await page.getByRole('heading',{name:'主文档.html',exact:true}).waitFor();
 assert.equal(await page.locator('.material-supplements').count(),1,'主 PRD 保存后应展开补充资料');
 await page.getByRole('button',{name:'重命名',exact:true}).click();
 await page.getByLabel('资料包名称').fill('订单需求资料');
 await page.getByRole('button',{name:'保存名称',exact:true}).click();
 assert.match(await page.getByLabel('已有资料包').locator('option:checked').textContent(),/订单需求资料/);
 await page.getByRole('button',{name:'删除资料包',exact:true}).click();
 await page.getByText(/将永久删除“订单需求资料”/).waitFor();
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-6/bundle-delete-confirm-1440.png',fullPage:true});
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await page.getByLabel('目录在资料包中的名称').fill('assets');
 await page.getByRole('button',{name:'添加目录',exact:true}).click();
 await page.getByRole('button',{name:'调整资料',exact:true}).last().click();
 await page.getByLabel('资料包内路径').fill('assets/说明.txt');
 await page.getByRole('button',{name:'保存设置',exact:true}).click();
 await page.getByText('assets/说明.txt',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'引用与缺件',exact:true}).count(),0,'不应显示引用与缺件入口');
 assert.match(await page.locator('.material-index').innerText(),/只读取用户上传的文件/,'应明确资料范围由用户决定');
 assert.equal(await page.locator('.material-intake-selected').evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length),3,'主文档卡片应为三列布局');
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-6/material-preparation-1440.png',fullPage:true});
 await page.setViewportSize({width:1100,height:720});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-6/material-preparation-1100.png',fullPage:true});
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
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-6/material-ui-1440.png',fullPage:true});
 await page.setViewportSize({width:1100,height:720});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:'docs/acceptance/material-bundle-index/round-6/material-ui-1100.png',fullPage:true});
 await page.getByRole('button',{name:'开始需求分析',exact:true}).click();
 await page.getByText('T-ui',{exact:true}).waitFor();
 assert.ok((await page.evaluate(()=>window.__materialCalls)).includes('start'));
 await page.getByRole('button',{name:'返回任务中心',exact:true}).click();
 await page.getByRole('button',{name:'新建任务',exact:true}).first().click();
 await page.getByLabel('已有资料包').selectOption('bundle-ui');
 await page.getByRole('button',{name:'删除资料包',exact:true}).click();
 await page.getByRole('button',{name:'确认删除资料包',exact:true}).click();
 await page.getByText('资料包已删除',{exact:true}).waitFor();
 assert.ok((await page.evaluate(()=>window.__materialCalls)).includes('delete'));
 console.log('PASS: 资料包创建、重命名、删除确认与整体删除、目录挂载、路径保存、仅使用上传文件、索引轮询、ready门禁、分页检索、来源预览、Escape、1440/1100无横向溢出、分析交接。渲染层受控API验证。');
} finally {await browser.close()}
