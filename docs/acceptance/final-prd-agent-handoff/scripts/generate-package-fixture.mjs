import path from 'node:path';
import { rm } from 'node:fs/promises';
import { writeAgentPackage } from '../../../../dist-electron/electron/export-agent-package.js';

const output=path.resolve(process.argv[2]??'docs/acceptance/final-prd-agent-handoff/round-1/package-fixture');
await rm(output,{recursive:true,force:true});
const project={id:'P-ACCEPTANCE',name:'订单提交',sourceName:'prd.md',sourceHash:'fixture-input',revision:1,importedAt:'2026-09-11T00:00:00.000Z',rawText:'登录用户可以提交订单。所有操作需登录。',stage:'review',sourceUnits:[
  {id:'S-001',label:'订单提交',kind:'paragraph',excerpt:'登录用户可以提交订单。',location:'第 1 段',status:'processed'},
  {id:'S-002',label:'通用登录约束',kind:'paragraph',excerpt:'所有操作需登录。',location:'第 2 段',status:'processed'}
],sourceDispositions:[{sourceUnitId:'S-001',kind:'requirement',reason:'明确行为',featureIds:['F-001']},{sourceUnitId:'S-002',kind:'requirement',reason:'跨功能约束',featureIds:['F-900']}],features:[
  {id:'F-001',kind:'function',sourceUnitIds:['S-001'],sourceRefs:[{sourceUnitId:'S-001'}],ruleIds:[],requirementIds:['R-0001'],state:'reviewed'},
  {id:'F-900',kind:'constraint',sourceUnitIds:['S-002'],sourceRefs:[{sourceUnitId:'S-002'}],ruleIds:[],requirementIds:['R-0900'],appliesToFeatureIds:['F-001'],state:'reviewed'}
],requirements:[
  {id:'R-0001',title:'提交订单',behavior:'登录用户可以提交订单',conditions:['用户已登录'],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:['S-001'],ruleIds:[],state:'reviewed'},
  {id:'R-0900',title:'通用登录约束',behavior:'所有操作需登录',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:['S-002'],ruleIds:[],state:'reviewed'}
],clarifications:[],relations:[],audit:{passed:true,issues:[]},delivery:{state:'ready',inputHash:'fixture-input',resultHash:'fixture-result',issueIds:[],unverifiedScopeIds:[],policyVersion:1}};
const task={id:'T-ACCEPTANCE',project,attempt:1,status:'completed',progress:100,createdAt:1,steps:[]};
const result=await writeAgentPackage(project,task,path.dirname(output),path.basename(output));
console.log(JSON.stringify({directory:result.directory,qualityState:result.manifest.qualityState,files:result.manifest.files.length}));
