import { _electron as electron } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('docs/acceptance/unified-analysis-input/round-1');
const profile=path.join(root,'electron-profile');
const fixture=path.join(root,'fixtures','sample-prd.md');
await rm(profile,{recursive:true,force:true});
await mkdir(path.dirname(fixture),{recursive:true});
await writeFile(fixture,'# 活动查询\n\n用户可以按活动名称查询。\n','utf8');
const seedTask={id:'T-UIEDIT',rootTaskId:'T-UIEDIT',resultVersion:1,attempt:1,status:'needs-attention',progress:100,createdAt:Date.now()-60000,completedAt:Date.now()-30000,checkpoint:{pipelineVersion:17,detailedFeatureIds:['F-1'],auditIssues:[],validationFailures:[]},steps:[],project:{id:'P-UIEDIT',name:'建议编辑验收任务',sourceName:'suggestion-prd.md',sourceHash:'ui-edit',revision:1,importedAt:new Date().toISOString(),rawText:'导出任务超时时间需要统一。',stage:'review',sourceUnits:[{id:'S-1',label:'导出规则',kind:'paragraph',excerpt:'导出任务超时时间需要统一。',location:'第 1 段',status:'processed'}],rules:[],features:[{id:'F-1',name:'批量导出',sourceUnitIds:['S-1'],sourceRefs:[{sourceUnitId:'S-1'}],ruleIds:[],requirementIds:['R-1'],state:'needs-clarification'}],requirements:[{id:'R-1',featureId:'F-1',title:'控制导出超时',behavior:'系统执行批量导出。',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:['S-1'],sourceRefs:[{sourceUnitId:'S-1'}],ruleIds:[],state:'needs-clarification'}],clarifications:[{id:'Q-1',question:'批量导出的超时时长是多少？',reason:'原文只要求统一，没有给出具体时长。',level:'blocking',knownFacts:'导出任务需要统一超时时间。',unresolvedPoint:'具体超时时长尚未定义。',impact:'Agent 无法实现确定的超时和失败提示。',levelReason:'缺少实现所需的确定参数。',sourceRefs:[{sourceUnitId:'S-1'}],affectedIds:['R-1'],state:'open',resolutionProposal:{recommendation:'批量导出任务统一按 30 分钟超时处理。',rationale:'采用单一时长可避免不同入口行为不一致。',impact:'Agent 将据此实现计时、终止和失败提示。',confirmation:'请确认是否采纳 30 分钟。',alternatives:['统一为 15 分钟。'],sourceRefs:[{sourceUnitId:'S-1'}]}}],delivery:{state:'blocked',inputHash:'seed',resultHash:'seed',issueIds:['Q-1'],unverifiedScopeIds:[],policyVersion:1}}};
await mkdir(path.join(profile,'analysis-tasks'),{recursive:true});
await writeFile(path.join(profile,'analysis-tasks','T-UIEDIT.json'),JSON.stringify(seedTask,null,2),'utf8');

const env={...process.env,VITE_DEV_SERVER_URL:'http://127.0.0.1:5173'};delete env.ELECTRON_RUN_AS_NODE;
console.log('launching electron');
const app=await electron.launch({args:['--user-data-dir='+profile,'.'],env,timeout:15000});
try{
  console.log('electron launched');
  await app.evaluate(async({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},fixture);
  const page=await app.firstWindow({timeout:10000});console.log('window ready');await page.setViewportSize({width:1440,height:900});await page.waitForLoadState('domcontentloaded');
  console.log((await page.locator('body').innerText()).slice(0,1000));
  await page.getByRole('button',{name:/新建/}).first().click({timeout:5000});
  await page.screenshot({path:path.join(root,'01-empty.png'),fullPage:true});
  await page.getByRole('button',{name:'选择文件'}).click();
  await page.getByRole('heading',{name:'补充说明与调整'}).waitFor();
  const note=page.getByLabel('本次分析的补充说明与调整');
  await note.fill('本期只做查询，自动合并暂不做。\n同名判断以活动名称去除首尾空格后完全一致为准。\n查询部分细化到字段和交互。');
  await page.locator('.draft-state.saved').waitFor({timeout:5000});
  await page.screenshot({path:path.join(root,'02-prepared-with-note.png'),fullPage:true});
  await page.getByText('目录选项').click();
  await page.screenshot({path:path.join(root,'03-directory-options.png'),fullPage:true});
  await page.getByRole('button',{name:/资料明细与读取记录/}).click();
  await page.screenshot({path:path.join(root,'04-material-details.png'),fullPage:true});
  const state=await page.evaluate(()=>({title:document.querySelector('h1')?.textContent,note:(document.querySelector('#material-analysis-text'))?.value,startDisabled:(document.querySelector('.material-start-action .primary'))?.disabled,bodyWidth:document.body.scrollWidth,viewport:window.innerWidth}));
  console.log(JSON.stringify(state));
  await page.getByRole('button',{name:'开始分析'}).click();
  await page.getByText(/Runtime 正在分析需求|Runtime 未完成本次任务|Runtime 已完成需求分析/).waitFor({timeout:15000});
  await page.screenshot({path:path.join(root,'05-task-input-collapsed.png'),fullPage:true});
  const summary=page.locator('.task-input-summary>summary');if(await summary.count()){await summary.click();await page.screenshot({path:path.join(root,'06-task-input-expanded.png'),fullPage:true})}
  await page.getByText('返回任务中心').click();
  await page.locator('.task-row-managed').filter({hasText:'建议编辑验收任务'}).locator('.task-row-open').click();
  await page.getByRole('button',{name:/待处理事项/}).click();
  await page.getByRole('button',{name:'修改'}).click();
  await page.screenshot({path:path.join(root,'07-proposal-edit.png'),fullPage:true});
  const proposal=page.getByLabel('修改建议方案：批量导出的超时时长是多少？');
  await proposal.fill('批量导出任务统一按 15 分钟超时处理，并展示剩余时间。');
  await page.getByRole('button',{name:'保存并加入本次调整'}).click();
  await page.screenshot({path:path.join(root,'08-unified-adjustment.png'),fullPage:true});
}finally{await app.close();await rm(profile,{recursive:true,force:true})}
