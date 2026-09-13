// 只读审查真实任务；合成运行仅使用假模型，数据写入 docs/tmp，不调用远端模型。
// 先编译当前代码：node node_modules/typescript/bin/tsc -p electron/tsconfig.json
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {AnalysisTaskScheduler} from '../../../../dist-electron/electron/scheduler-v2.js';
import {acceptRequirementPatch,planDetailRepairs} from '../../../../dist-electron/electron/audit-repair.js';
import {validateDirectGraph} from '../../../../dist-electron/electron/domain.js';
import {sourceCoverageDecisionValid} from '../../../../dist-electron/electron/task-execution-state.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot=path.resolve('docs/tmp/current-implementation-review',new Date().toISOString().replaceAll(':','-'));
const config={adapter:'dsh',provider:'fake',fastModel:'fast',model:'fake',reasoningEffort:'low',maxParallel:1,maxNodeParallel:3};
const project=()=>({id:'P-review',name:'审查样例',sourceName:'review.md',sourceHash:'review',revision:1,importedAt:new Date().toISOString(),rawText:'字段 X 必填。',stage:'inventory',sourceUnits:[],rules:[],features:[],requirements:[],clarifications:[]});
const requirement=(id,sources)=>({id,title:'字段要求',behavior:'字段 X 必填',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:sources,ruleIds:[],state:'draft'});
const emptyPatch=()=>({requirements:[],clarifications:[],deleteRequirementIds:[],deleteClarificationIds:[]});
const input=prompt=>JSON.parse(prompt.slice(prompt.lastIndexOf('节点输入：')+5));
function answer(prompt){
  const v=input(prompt);
  if(prompt.includes('“功能候选识别”'))return{features:[{id:'LOCAL-F1',name:'字段维护',sourceUnitIds:v.sourceUnits.map(u=>u.id),state:'draft'}],sourceDispositions:v.sourceUnits.map(u=>({sourceUnitId:u.id,contentRole:'requirement',reason:'明确业务要求',featureIds:['LOCAL-F1']}))};
  if(prompt.includes('“功能候选完整性检查'))return{issues:[]};
  if(prompt.includes('“功能清单统一”'))return{features:v.candidates,candidateMappings:v.candidates.map(f=>({candidateId:f.id,featureIds:[f.id]}))};
  if(prompt.includes('“逐功能细化”'))return{requirements:[requirement('LOCAL-R1',v.sourceUnits.map(u=>u.id))],clarifications:[]};
  if(prompt.includes('“审计问题成立性确认”'))return{results:v.issues.map(i=>({issueId:i.id,status:'confirmed',reason:'明确缺口'}))};
  if(prompt.includes('“完整性与忠实性检查·局部复核”'))return{originalIssueResults:v.originalIssues.map(i=>({issueId:i.id,status:'resolved',reason:'指定缺口已解决'})),introducedIssues:[],discoveredIssues:[]};
  if(prompt.includes('“原文正向完整性检查”')||prompt.includes('“完整性与忠实性检查”'))return{issues:[]};
  if(prompt.includes('“待澄清事项全局一致性检查”'))return{actions:[]};
  if(prompt.includes('“局部修正”'))return emptyPatch();
  throw new Error('合成样例未处理节点：'+prompt.slice(0,180));
}
async function runCase(name,respond,onUpdate=()=>{}){
  const calls=[];
  const scheduler=new AnalysisTaskScheduler(path.join(runtimeRoot,name),async()=>config,onUpdate,()=>({start:async()=>{},stop:async()=>{},diagnostics:()=>'',promptAndWait:async(_id,prompt)=>{calls.push(prompt);return JSON.stringify(respond(prompt));}}));
  await scheduler.initialize();await scheduler.create(project());
  for(let n=0;n<800;n++){
    const task=scheduler.list()[0];
    if(task&&['completed','needs-attention','failed'].includes(task.status))return{task,calls};
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error('合成样例未结束：'+name);
}
if(process.argv.includes('--spin')){
  let marked=false;
  await runCase('spin',prompt=>{
    const v=input(prompt);
    if(prompt.includes('“功能候选识别”'))return{features:['A','B'].map(id=>({id,name:id,sourceUnitIds:v.sourceUnits.map(u=>u.id),state:'draft'})),sourceDispositions:v.sourceUnits.map(u=>({sourceUnitId:u.id,contentRole:'requirement',reason:'两个功能共享来源',featureIds:['A','B']}))};
    if(prompt.includes('“完整性与忠实性检查”'))return{issues:[{id:'LOCAL-ORPHAN',direction:'reverse',type:'要求缺失',category:'detail-mismatch',owner:'requirement-detail',sourceUnitIds:[v.sourceUnits[0].id],affectedIds:[v.sourceUnits[0].id],detail:'共享来源中的一项要求需要补齐'}]};
    return answer(prompt);
  },task=>{
    if(!marked&&task.steps.find(s=>s.id==='repair')?.status==='running'){
      marked=true;
      const open=task.checkpoint.auditIssues.filter(i=>i.disposition==='open');
      process.stdout.write(JSON.stringify({marker:'repair-entered',plans:planDetailRepairs(open,task.project).length,openOwners:open.map(i=>i.owner)})+'\n');
    }
  });
  process.exit(0);
}

const taskPath=path.join(process.env.APPDATA,'prd-refinement-desktop/validation-pipeline12/2026-09-12T01-54-59.017Z/T-223E5C71.json');
const real=JSON.parse(await fs.readFile(taskPath,'utf8'));
const unresolved=validateDirectGraph(real.project.sourceUnits,real.project.sourceDispositions,real.project.features,real.project.requirements,real.project.clarifications).uncovered.filter(item=>{
  const d=real.checkpoint.sourceCoverageDecisions[item.sourceUnitId];return!d||!sourceCoverageDecisionValid(real.project,item.sourceUnitId,d);
});
assert.equal(real.checkpoint.checks.source.status,'failed');assert.equal(unresolved.length,1);assert(unresolved[0].sourceUnitId.endsWith('0227'));
const p=project();p.stage='review';p.sourceUnits=['S1','S2'].map((id,i)=>({id,label:id,excerpt:i?'仅管理员可修改。':'字段 X 必填。',kind:'paragraph',location:id,status:'processed'}));
p.requirements=[{...requirement('R-0001',['S1','S2']),constraints:['仅管理员可修改'],evidenceBindings:{behavior:[{sourceUnitId:'S1'}],conditions:[],constraints:[[{sourceUnitId:'S2'}]],explicitAcceptanceConditions:[]}}];
p.features=[{id:'F1',name:'字段维护',sourceUnitIds:['S1','S2'],requirementIds:['R-0001'],ruleIds:[],state:'draft'}];
const scope={key:'A',issues:[],featureIds:['F1'],requirementIds:['R-0001'],clarificationIds:[],sourceUnitIds:['S1','S2'],requiredSourceUnitIds:[]};
const accepted=acceptRequirementPatch({...emptyPatch(),requirements:p.requirements},p,scope).requirements[0];
assert.deepEqual(accepted.evidenceBindings.behavior.map(r=>r.sourceUnitId),['S1','S2']);assert.deepEqual(accepted.evidenceBindings.constraints[0].map(r=>r.sourceUnitId),['S1','S2']);

const stale=await runCase('stale-confirmation',prompt=>{
  const v=input(prompt);
  if(prompt.includes('“逐功能细化”'))return{...answer(prompt),clarifications:[{id:'LOCAL-Q1',question:'字段 X 是否必须填写？',reason:'是否必填待确认',level:'blocking',knownFacts:'表单含字段 X',unresolvedPoint:'字段 X 是否必填',impact:'影响表单校验',levelReason:'决定校验行为',sourceRefs:[{sourceUnitId:v.sourceUnits[0].id}],affectedIds:['LOCAL-R1'],state:'open'}]};
  if(prompt.includes('“完整性与忠实性检查”'))return{issues:[{id:'LOCAL-STALE',direction:'cross',type:'待确认事项与已明确需求不一致',category:'detail-mismatch',owner:'requirement-detail',sourceUnitIds:v.requirements[0].sourceUnitIds,affectedIds:['Q-0001',v.requirements[0].id],detail:'明确需求已回答该澄清，应删除过时澄清'}]};
  if(prompt.includes('“审计问题成立性确认”'))return{results:v.issues.map(i=>({issueId:i.id,status:'already-satisfied',satisfiedRequirementIds:[v.requirements[0].id],reason:'该需求已明确字段 X 必填'}))};
  return answer(prompt);
});
assert.equal(stale.task.project.clarifications.length,1);assert.equal(stale.task.project.audit.issues[0].disposition,'dismissed');assert.equal(stale.task.status,'needs-attention');
let reviewProjection;
const added=await runCase('new-requirement-owner',prompt=>{
  const v=input(prompt);
  if(prompt.includes('“完整性与忠实性检查·局部复核”')){reviewProjection={featureRequirementIds:v.features.flatMap(f=>f.requirementIds),candidateRequirementIds:v.requirements.map(r=>r.id)};return answer(prompt);}
  if(prompt.includes('“完整性与忠实性检查”'))return{issues:[{id:'LOCAL-ADD',direction:'reverse',type:'明细缺项',category:'detail-mismatch',owner:'requirement-detail',sourceUnitIds:v.requirements[0].sourceUnitIds,affectedIds:[v.requirements[0].id],detail:'应新增一个独立要求'}]};
  if(prompt.includes('“局部修正”'))return{...emptyPatch(),requirements:[{...requirement('LOCAL-ADDED',v.sourceUnits.map(u=>u.id)),featureId:v.features[0].id,title:'新增要求'}]};
  return answer(prompt);
});
assert(reviewProjection.candidateRequirementIds.includes('LOCAL-ADDED'));assert(!reviewProjection.featureRequirementIds.includes('LOCAL-ADDED'));assert.equal(added.task.status,'completed');

let boundaryRework=0;
const late=await runCase('late-boundary',prompt=>{
  const v=input(prompt);
  if(prompt.includes('定点返工'))boundaryRework++;
  if(prompt.includes('“完整性与忠实性检查·局部复核”'))return{...answer(prompt),discoveredIssues:[{id:'LOCAL-BOUNDARY',direction:'cross',type:'功能边界错误',category:'feature-boundary',owner:'feature-grouping',sourceUnitIds:v.requirements[0].sourceUnitIds,affectedIds:[v.features[0].id],detail:'既有功能边界需重新核对'}]};
  if(prompt.includes('“完整性与忠实性检查”'))return{issues:[{id:'LOCAL-DETAIL',direction:'reverse',type:'明细缺项',category:'detail-mismatch',owner:'requirement-detail',sourceUnitIds:v.requirements[0].sourceUnitIds,affectedIds:[v.requirements[0].id],detail:'需求标题需要修正'}]};
  if(prompt.includes('“局部修正”'))return{...emptyPatch(),requirements:[{...v.currentRequirements[0],featureId:v.features[0].id,title:'已修正标题'}]};
  return answer(prompt);
});
assert.equal(boundaryRework,0);assert(late.task.project.audit.issues.some(i=>i.owner==='feature-grouping'&&i.disposition==='open'));assert.equal(late.task.status,'needs-attention');
const spin=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--spin'],{encoding:'utf8',timeout:10000});
assert.equal(spin.error?.code,'ETIMEDOUT');assert(spin.stdout.includes('"plans":0'));assert(spin.stdout.includes('requirement-detail'));
const result={generatedAt:new Date().toISOString(),taskPath,realTask:{id:real.id,status:real.status,checks:real.checkpoint.checks,unresolved,delivery:real.project.delivery,error:real.error},reproductions:{evidenceBinding:{before:p.requirements[0].evidenceBindings,after:accepted.evidenceBindings},staleClarification:{status:stale.task.status,issueDisposition:stale.task.project.audit.issues[0].disposition,remainingQuestions:stale.task.project.clarifications.map(q=>q.question),repairCalls:stale.calls.filter(c=>c.includes('“局部修正”')).length},newRequirementOwner:reviewProjection,lateBoundary:{boundaryRework,status:late.task.status,openOwners:late.task.project.audit.issues.filter(i=>i.disposition==='open').map(i=>i.owner)},unplannableIssue:{processError:spin.error.code,stdout:spin.stdout.trim()}},note:'断言通过表示缺陷已复现，并非业务验收通过。合成运行全部使用本地假模型。'};
await fs.writeFile(path.join(here,'review-evidence.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({evidenceFile:path.join(here,'review-evidence.json'),reproduced:Object.keys(result.reproductions),realSourceCheck:real.checkpoint.checks.source.status}));
