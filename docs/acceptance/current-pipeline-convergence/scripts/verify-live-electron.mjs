import { _electron as electron } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root=path.resolve('docs/acceptance/current-pipeline-convergence/round-1');
const profile=path.join(os.tmpdir(),`prd-pipeline-18-${process.pid}`);
const fixture=path.join(root,'sample-final-prd.md');
await mkdir(root,{recursive:true});await rm(profile,{recursive:true,force:true});
await writeFile(fixture,`# 活动查询\n\n用户可以输入活动名称查询活动。活动名称需要去除首尾空格后完全一致匹配。查询结果展示活动名称、活动状态和创建时间。\n\n# 活动导出\n\n用户可以导出当前查询结果。\n`,'utf8');

const env={...process.env,VITE_DEV_SERVER_URL:'http://127.0.0.1:5173'};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[`--user-data-dir=${profile}`,'--no-sandbox','.'],env,timeout:20000});
try{
  await app.evaluate(async({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},fixture);
  const first=await app.firstWindow({timeout:15000});await first.waitForLoadState('domcontentloaded');
  const page=app.windows().find(value=>value.url().includes('127.0.0.1:5173'))??first;
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:/新建/}).first().click();
  await page.getByRole('button',{name:'选择文件'}).click();
  await page.getByRole('heading',{name:'补充说明与调整'}).waitFor();
  await page.getByLabel('本次分析的补充说明与调整').fill('本期只做活动查询，活动导出本期不做。\n查询功能请细化到输入、匹配规则和结果字段。');
  await page.locator('.draft-state.saved').waitFor({timeout:10000});
  await page.screenshot({path:path.join(root,'01-prepared-input.png'),fullPage:true});
  await page.getByRole('button',{name:'开始分析'}).click();
  await page.screenshot({path:path.join(root,'02-running.png'),fullPage:true});
  const started=Date.now();let task;
  while(Date.now()-started<15*60*1000){
    const tasks=await page.evaluate(()=>window.prdApp.loadAnalysisTasks());task=tasks.sort((a,b)=>b.createdAt-a.createdAt)[0];
    if(task&&['completed','needs-attention','failed'].includes(task.status))break;
    await page.waitForTimeout(3000);
  }
  if(!task||!['completed','needs-attention'].includes(task.status))throw new Error(`真实任务未完成：${task?.status??'not-found'} ${task?.error??''}`);
  await page.getByRole('button',{name:/执行记录/}).click();
  await page.screenshot({path:path.join(root,'03-execution-and-cost.png'),fullPage:true});
  const inputSummary=page.locator('.task-input-summary>summary');if(await inputSummary.count())await inputSummary.click();
  await page.screenshot({path:path.join(root,'04-input-applications.png'),fullPage:true});
  const result={taskId:task.id,status:task.status,pipelineVersion:task.checkpoint?.pipelineVersion,elapsedMs:(task.completedAt??Date.now())-(task.requestedAt??task.createdAt),steps:task.steps.map(value=>({id:value.id,status:value.status})),promptMetrics:task.checkpoint?.promptMetrics?.length??0,runtimeMetrics:task.runtimeMetrics?.length??0,inputApplications:task.project.analysisInputApplications,delivery:task.project.delivery};
  await writeFile(path.join(root,'live-result.json'),JSON.stringify(result,null,2),'utf8');console.log(JSON.stringify(result));
}finally{await app.close();await rm(profile,{recursive:true,force:true})}
