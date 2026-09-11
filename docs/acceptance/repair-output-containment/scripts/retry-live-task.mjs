import { _electron as electron } from '@playwright/test';
import path from 'node:path';

const executablePath='C:\\Users\\64554\\AppData\\Local\\Programs\\prd-refinement-desktop\\需求细化平台.exe';
const taskId='T-61E0C5FB';
const app=await electron.launch({executablePath});
const window=await app.firstWindow();
await window.waitForLoadState('domcontentloaded');
const task=window.getByText(taskId,{exact:true});
await task.waitFor({timeout:30_000});
await task.click();
const retry=window.getByRole('button',{name:'从检查点重试'});
await retry.waitFor({timeout:30_000});
await retry.click();
console.log(`RETRY_STARTED ${taskId}`);
for(let elapsed=0;elapsed<7_200_000;elapsed+=10_000){
  await window.waitForTimeout(10_000);
  const text=await window.locator('body').innerText();
  const stage=text.match(/(正在执行|任务执行失败|结果已写入 Excel|已完成)/)?.[1]??'运行中';
  const progress=text.match(/(\d+(?:\.\d+)?)%/)?.[1]??'?';
  console.log(`STATUS elapsed=${Math.floor((elapsed+10_000)/1000)}s progress=${progress}% stage=${stage}`);
  if(text.includes('任务执行失败')){console.log(text);await window.screenshot({path:path.resolve('docs/acceptance/repair-output-containment/round-2/live-final.png'),fullPage:true});await app.close();process.exit(2)}
  if(text.includes('结果已写入 Excel')){await window.screenshot({path:path.resolve('docs/acceptance/repair-output-containment/round-2/live-final.png'),fullPage:true});console.log('TASK_COMPLETED');await app.close();process.exit(0)}
}
await app.close();throw new Error('等待真实任务完成超时');
