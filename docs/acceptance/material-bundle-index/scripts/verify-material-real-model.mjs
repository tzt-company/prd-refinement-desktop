import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { MaterialBundleStore } from '../../../../dist-electron/electron/material-bundle.js';
import { AnalysisTaskScheduler } from '../../../../dist-electron/electron/scheduler-v2.js';
import { inspectRuntime } from '../../../../dist-electron/electron/runtime.js';

const root=path.resolve('docs/acceptance/material-bundle-index/round-1/real-model');
await mkdir(root,{recursive:true});
const raw=JSON.parse(await readFile(path.join(process.env.APPDATA,'prd-refinement-desktop','runtime-config.json'),'utf8'));
assert.equal(raw.adapter,'codex-oauth');
// 只取无凭据配置字段，不复制任何 API key 或加密凭据。
const config={adapter:raw.adapter,provider:raw.provider,model:raw.model,reasoningEffort:raw.reasoningEffort,fastModel:raw.fastModel,fastReasoningEffort:raw.fastReasoningEffort,nodeProfiles:raw.nodeProfiles,maxParallel:1,maxNodeParallel:2};
const runtime=await inspectRuntime(config);
assert.equal(runtime.authStatus,'authenticated');
const main=path.join(root,'main.txt'),extra=path.join(root,'supplement.txt');
await writeFile(main,'新增订单备注功能，备注最多100字。','utf8');
await writeFile(extra,'订单备注保存后重新打开仍显示。','utf8');
const store=new MaterialBundleStore(path.join(root,'materials'));
await store.initialize();
const bundle=await store.create();
await store.add(bundle.id,[main],{kind:'files',role:'primary'});
await store.add(bundle.id,[extra],{kind:'files',role:'supplement'});
await store.index(bundle.id);
const ready=await store.wait(bundle.id);
assert.equal(ready.state,'ready');
const project=await store.project(bundle.id);
assert.equal(project.sourceDocuments.length,2);
const tasksRoot=path.join(root,'tasks');
let last='';
const scheduler=new AnalysisTaskScheduler(tasksRoot,async()=>config,task=>{
  const current=`${task.status}: ${task.steps.find(s=>s.status==='running')?.name??task.error??task.progress}`;
  if(current!==last){last=current;console.log(current)}
});
await scheduler.initialize();
const created=await scheduler.create(project);
await writeFile(path.join(root,'run.json'),JSON.stringify({taskId:created.id,bundleId:bundle.id,startedAt:new Date().toISOString(),runtime,config},null,2));
const deadline=Date.now()+15*60_000;
let task;
while(Date.now()<deadline){
  try{task=JSON.parse(await readFile(path.join(tasksRoot,`${created.id}.json`),'utf8'));}catch{}
  if(task&&['completed','failed'].includes(task.status))break;
  await new Promise(r=>setTimeout(r,1000));
}
if(!task||!['completed','failed'].includes(task.status)){await scheduler.cancel(created.id);throw new Error('真实模型验收超过15分钟，已取消，不能记为通过')}
const evidence={taskId:task.id,status:task.status,error:task.error,steps:task.steps,materialBundle:task.project.materialBundle,sourceDocuments:task.project.sourceDocuments.map(({rawText,...item})=>item),metrics:task.runtimeMetrics,requirements:task.project.requirements,clarifications:task.project.clarifications,audit:task.project.audit};
if(task.status==='completed'){
  const file=path.join(tasksRoot,task.id,'result',`${task.project.name}-需求细化.xlsx`);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);
  const trace=workbook.getWorksheet('原文追踪');
  const tracePaths=[];trace.eachRow((row,n)=>{if(n>1)tracePaths.push(row.getCell(7).value)});
  assert.deepEqual([...new Set(tracePaths)].sort(),['main.txt','supplement.txt']);
  const details=JSON.stringify(workbook.getWorksheet('需求明细').getSheetValues());
  assert.ok(details.includes('100'));
  assert.ok(details.includes('重新打开'));
  assert.ok(details.includes('main.txt')&&details.includes('supplement.txt'));
  assert.ok((task.runtimeMetrics??[]).length>0);
  assert.deepEqual(new Set(task.project.requirements.flatMap(r=>r.sourceUnitIds)),new Set(task.project.sourceUnits.map(u=>u.id)));
  Object.assign(evidence,{excel:file,tracePaths,excelChecks:'两文件路径、100字约束、重新打开要求均真实回读通过'});
}
await writeFile(path.join(root,'evidence.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({taskId:task.id,status:task.status,error:task.error,calls:task.runtimeMetrics?.length,excel:evidence.excel,checks:evidence.excelChecks}));
assert.equal(task.status,'completed');
