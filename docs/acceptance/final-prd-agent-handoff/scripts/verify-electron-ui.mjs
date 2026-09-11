import { _electron as electron, expect } from '@playwright/test';
import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const evidence=path.resolve('docs/acceptance/final-prd-agent-handoff/round-1');
await mkdir(evidence,{recursive:true});
const profile=path.join(evidence,'electron-profile');await rm(profile,{recursive:true,force:true});await mkdir(path.join(profile,'analysis-tasks'),{recursive:true});
const project={id:'P-UI',name:'定版订单需求',sourceName:'prd.md',sourceHash:'ui',revision:1,importedAt:new Date().toISOString(),rawText:'登录用户提交订单。',stage:'review',sourceUnits:[{id:'S-001',label:'订单',kind:'paragraph',excerpt:'登录用户提交订单。',location:'第 1 段',status:'processed'}],features:[{id:'F-001',kind:'function',sourceUnitIds:['S-001'],sourceRefs:[{sourceUnitId:'S-001'}],ruleIds:[],requirementIds:['R-0001'],state:'reviewed'}],requirements:[{id:'R-0001',title:'提交订单',behavior:'登录用户提交订单',conditions:['已登录'],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:['S-001'],ruleIds:[],state:'reviewed'}],clarifications:[],audit:{passed:false,issues:[]},delivery:{state:'unchecked',inputHash:'ui',resultHash:'ui',issueIds:[],unverifiedScopeIds:['audit'],policyVersion:1}};
const task={id:'T-UI',project,attempt:1,status:'completed',progress:100,createdAt:Date.now(),completedAt:Date.now(),steps:[]};await writeFile(path.join(profile,'analysis-tasks','T-UI.json'),JSON.stringify(task),'utf8');
const app=await electron.launch({args:['.',`--user-data-dir=${profile}`],env:{...process.env,VITE_DEV_SERVER_URL:''}});
try{
  const window=await app.firstWindow();await window.waitForLoadState('domcontentloaded');
  await window.getByRole('button',{name:/打开任务 T-UI/}).click();
  await expect(window.getByRole('heading',{name:'需求检查未完成'})).toBeVisible();
  await expect(window.getByRole('heading',{name:'整理草稿已生成'})).toBeVisible();
  await window.getByRole('button',{name:/功能清单/}).click();
  await expect(window.getByRole('heading',{name:/功能原文分组/})).toBeVisible();
  await expect(window.locator('.data-table.features')).not.toContainText('目标与边界');
  await window.screenshot({path:path.join(evidence,'electron-ui.png'),fullPage:true});
  console.log('PASS: production Electron 显示需求交付状态、整理草稿和功能原文分组');
}finally{await app.close()}
