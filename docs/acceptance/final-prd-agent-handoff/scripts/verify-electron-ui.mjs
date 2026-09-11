import { _electron as electron, expect } from '@playwright/test';
import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const evidence=path.resolve('docs/acceptance/final-prd-agent-handoff/round-3');
await mkdir(evidence,{recursive:true});
const profile=path.join(evidence,'electron-profile');await rm(profile,{recursive:true,force:true});await mkdir(path.join(profile,'analysis-tasks'),{recursive:true});
const source={id:'S-7C9F2A19-USER-SHOULD-NOT-SEE',label:'订单空值规则',kind:'paragraph',excerpt:'订单备注参与风控判断，但没有说明空值如何处理。',location:'第 18 行',logicalPath:'主需求/订单.md',fileRevision:3,status:'processed'};
const base={name:'订单需求',sourceName:'订单.md',sourceHash:'ui',revision:3,importedAt:new Date().toISOString(),rawText:source.excerpt,stage:'review',sourceUnits:[source],features:[{id:'F-001',kind:'function',sourceUnitIds:[source.id],sourceRefs:[{sourceUnitId:source.id}],ruleIds:[],requirementIds:['R-0001'],state:'needs-clarification'}],requirements:[{id:'R-0001',title:'处理订单备注',behavior:'订单备注参与风控判断',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:[source.id],ruleIds:[],state:'needs-clarification'}]};
const question=(level,id)=>({id,question:level==='blocking'?'订单备注为空时，风控判断应按哪一种业务规则处理？':level==='suggestion'?'是否需要在本期明确订单备注的字符长度？':'是否统一“订单备注”的文案写法？',reason:'原文口径未完整说明',level,knownFacts:'订单备注参与风控判断',unresolvedPoint:level==='blocking'?'订单备注为空时的风控处理规则':'不影响当前核心处理的补充口径',impact:level==='blocking'?'会改变订单是否通过风控':'不会改变本期核心处理结果',levelReason:level==='blocking'?'开发 Agent 无法从原文确定处理分支':'已有可用的默认口径',...(level==='suggestion'?{defaultResolution:'暂不处理时保持原文现有规则'}:{}),sourceRefs:[{sourceUnitId:source.id}],affectedIds:['R-0001'],state:'open'});
const blocked={id:'P-BLOCKED',...base,clarifications:[question('blocking','Q-B'),question('suggestion','Q-S'),question('ignorable','Q-I')],audit:{passed:false,issues:[{id:'A-P',direction:'reverse',type:'整理遗漏',owner:'runtime-output',sourceUnitIds:[source.id],affectedIds:['R-0001'],detail:'平台整理结果缺少一条原文明示要求'}]},delivery:{state:'blocked',inputHash:'ui',resultHash:'ui',issueIds:['Q-B','A-P'],unverifiedScopeIds:[],policyVersion:2}};
const ready={id:'P-READY',...base,name:'可交付订单需求',clarifications:[question('suggestion','Q-S')],audit:{passed:true,issues:[]},delivery:{state:'ready',inputHash:'ui',resultHash:'ui-ready',issueIds:[],unverifiedScopeIds:[],policyVersion:2}};
for(const [id,project] of [['T-BLOCKED',blocked],['T-READY',ready]]){const task={id,project,attempt:1,status:'completed',progress:100,createdAt:Date.now(),completedAt:Date.now(),steps:[]};await writeFile(path.join(profile,'analysis-tasks',`${id}.json`),JSON.stringify(task),'utf8')}
const app=await electron.launch({args:['.',`--user-data-dir=${profile}`],env:{...process.env,VITE_DEV_SERVER_URL:''}});
try{
  const window=await app.firstWindow();await window.waitForLoadState('domcontentloaded');
  await window.getByRole('button',{name:/打开任务 T-BLOCKED/}).click();await expect(window.getByRole('heading',{name:'暂不能交付'})).toBeVisible();
  await window.getByRole('button',{name:/待处理事项/}).click();
  for(const label of ['阻塞','建议','可忽略','平台整理'])await expect(window.getByRole('button',{name:new RegExp(`^${label}\\d+$`)})).toBeVisible();
  const blockingItem=window.getByRole('button',{name:/阻塞 订单备注为空时/}),platformItem=window.getByRole('button',{name:/阻塞 分析结果未能通过校验/});await expect(blockingItem).toBeVisible();await expect(platformItem).toBeVisible();
  await expect(window.locator('body')).not.toContainText(source.id);await blockingItem.click();await expect(window.getByText('订单备注为空时的风控处理规则')).toBeVisible();await expect(window.getByText('主需求/订单.md · 文件版本 3 · 第 18 行')).toBeVisible();
  await window.screenshot({path:path.join(evidence,'electron-ui.png'),fullPage:true});await window.getByRole('button',{name:'关闭'}).click();await window.getByRole('button',{name:'返回任务中心'}).click();
  await window.getByRole('button',{name:/打开任务 T-READY/}).click();await expect(window.getByRole('heading',{name:'需求检查通过，可以交付'})).toBeVisible();await expect(window.getByText(/另有 1 项建议、0 项可忽略事项，不影响交付/)).toBeVisible();
  console.log('PASS: production Electron 展示三级待处理事项、平台责任、业务可读来源，并允许仅有建议项的任务交付');
}finally{await app.close()}
