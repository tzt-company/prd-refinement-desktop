// 真实 Electron IPC 验证；原生对话框返回值由夹具代入，原生窗口交互另验。
import { _electron as electron } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('docs/acceptance/material-bundle-index/round-1/electron-ui');
await mkdir(path.join(root,'assets'),{recursive:true});
await writeFile(path.join(root,'主文档.html'),'<html><body><h1>订单合并提醒</h1><p>同名活动合并前必须确认。</p></body></html>');
await writeFile(path.join(root,'assets','补充.md'),'# 补充规则\n取消合并后保留原始关联。');
const profile=path.join(root,'profile');
const app=await electron.launch({args:['.',`--user-data-dir=${profile}`],env:{...process.env,VITE_DEV_SERVER_URL:process.env.PRD_UI_URL||''}});
try {
 const actual=await app.evaluate(({app})=>app.getPath('userData'));assert.equal(path.resolve(actual),profile,'必须使用隔离profile');
 const page=await app.firstWindow();await page.getByRole('button',{name:'新建任务',exact:true}).click();
 await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files})},[path.join(root,'主文档.html')]);
 await page.getByRole('button',{name:'选择 PRD 文件',exact:true}).click();
 await page.getByRole('heading',{name:'主文档.html',exact:true}).waitFor();
 await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files})},[path.join(root,'assets')]);
 await page.getByRole('button',{name:'添加目录',exact:true}).click();
 await page.getByText('assets/补充.md',{exact:true}).waitFor();
 // 使用真实本地 File 对象触发拖放，验证 preload webUtils.getPathForFile。
 await writeFile(path.join(root,'拖放.txt'),'关联成功后展示来源活动名称。');
 await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='verify-drop';input.hidden=true;document.body.append(input)});
 await page.locator('#verify-drop').setInputFiles(path.join(root,'拖放.txt'));
 await page.evaluate(()=>{const transfer=new DataTransfer();transfer.items.add(document.querySelector('#verify-drop').files[0]);document.querySelector('.material-page').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}))});
 await page.getByText('拖放.txt',{exact:true}).waitFor();
 await page.getByRole('button',{name:'识别与建立索引',exact:true}).click();
 await page.getByText('索引就绪',{exact:true}).first().waitFor({timeout:30000});
 const result=await page.evaluate(async()=>{const bundles=await window.prdApp.materials.list();const b=bundles[0];return{bundle:b,project:await window.prdApp.materials.project(b.id),query:await window.prdApp.materials.query(b.id,{query:'取消合并',limit:25})}});
 assert.equal(result.bundle.files.length,3);assert.equal(result.bundle.state,'ready');assert.ok(result.query.total>0);assert.ok(result.project.sourceUnits.length>=3);
 await page.getByRole('button',{name:'内容索引',exact:true}).click();
 await page.getByLabel('搜索原文内容').fill('取消合并');
 await page.getByText('1–1 / 1',{exact:true}).waitFor();
 await page.screenshot({path:path.join(root,'real-electron.png'),fullPage:true});
 await writeFile(path.join(root,'result.json'),JSON.stringify(result,null,2));
 const persisted=JSON.parse(await readFile(path.join(root,'result.json'),'utf8'));assert.equal(persisted.bundle.state,'ready');
 console.log('PASS: 真实Electron隔离profile、主HTML选择IPC、目录快照、真实File拖放、索引就绪、补充资料检索与project来源导出；未调用模型，未操作原生对话框。');
}finally{await app.close()}
