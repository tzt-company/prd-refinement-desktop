import { _electron as electron } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const bundleId=process.argv[2];
const retryTaskId=process.argv[3];
if(!/^B-[a-zA-Z0-9-]+$/.test(bundleId??''))throw new Error('用法：node run-live-closure.mjs <资料包ID>');
const evidence=path.resolve('docs/acceptance/source-reference-integrity/round-5');
await mkdir(evidence,{recursive:true});
const app=await electron.launch({args:['.'],env:{...process.env,VITE_DEV_SERVER_URL:''}});
try{
  const window=await app.firstWindow();await window.waitForLoadState('domcontentloaded');
  if(retryTaskId){await window.getByRole('button',{name:new RegExp(`打开任务 ${retryTaskId}`)}).click();const retry=window.getByRole('button',{name:/从检查点重试|继续平台整理/});if(await retry.count())await retry.click()}
  else{await window.getByRole('button',{name:'新建任务'}).click();const selector=window.getByLabel('已有资料包');await selector.selectOption(bundleId);await window.getByText('准备分析资料').waitFor();const reindex=window.getByRole('button',{name:/重新识别与索引|识别与建立索引/}).first();if(await reindex.isEnabled())await reindex.click();await window.getByText('资料已就绪').waitFor({timeout:20*60*1000});await window.getByRole('button',{name:'开始需求分析'}).click()}
  const taskCode=window.locator('.task-title code');await taskCode.waitFor({timeout:60_000});const taskId=(await taskCode.textContent())?.trim();
  if(!taskId)throw new Error('未读取到新任务编号');console.log('TASK_STARTED '+taskId);
  await window.locator('.task-status.completed,.task-status.needs-attention,.task-status.failed').waitFor({timeout:60*60*1000});
  const summary={taskId,status:(await window.locator('.task-status').first().textContent())?.trim(),heading:(await window.locator('.audit h2,.results-hero h2').first().textContent())?.trim()};
  await window.screenshot({path:path.join(evidence,'live-final.png'),fullPage:true});await writeFile(path.join(evidence,'live-summary.json'),JSON.stringify(summary,null,2),'utf8');console.log(JSON.stringify(summary));
}finally{await app.close()}
