import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { _electron as electron } from '@playwright/test';

const [executablePath,evidenceRoot]=process.argv.slice(2);
if(!executablePath||!evidenceRoot)throw new Error('用法: node scripts/packaged-smoke.mjs <exe> <证据目录>');
await mkdir(evidenceRoot,{recursive:true});
const app=await electron.launch({executablePath,args:[`--user-data-dir=${path.join(evidenceRoot,'user-data')}`]});
try{
  const window=await app.firstWindow({timeout:30_000});
  await window.waitForLoadState('domcontentloaded');
  const result=await window.evaluate(()=>({title:document.title,heading:document.querySelector('h1')?.textContent??'',body:document.body.innerText.slice(0,1000)}));
  if(!result.body.includes('需求分析任务')||!result.body.includes('Runtime 配置'))throw new Error(`打包应用首页内容异常：${JSON.stringify(result)}`);
  await window.screenshot({path:path.join(evidenceRoot,'packaged-home.png'),fullPage:true});
  console.log(JSON.stringify({passed:true,...result}));
}finally{await app.close()}
