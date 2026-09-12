import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {AnalysisTaskScheduler} from '../../../../dist-electron/electron/scheduler-v2.js';

const appData=process.env.APPDATA;
if(!appData)throw new Error('APPDATA 未设置');
const desktopRoot=path.join(appData,'prd-refinement-desktop');
const sourceTaskId=process.argv[2]??'T-DD1D9FB1';
const outputFile=path.resolve(process.argv[3]??'docs/acceptance/source-reference-integrity/round-10/results.json');
const singleUnlimited=process.argv[4]==='--single-unlimited';
const runRoot=path.join(desktopRoot,'validation-pipeline12',new Date().toISOString().replaceAll(':','-'));
const sourceTask=JSON.parse(await readFile(path.join(desktopRoot,'analysis-tasks',`${sourceTaskId}.json`),'utf8'));
const config={...JSON.parse(await readFile(path.join(desktopRoot,'runtime-config.json'),'utf8')),maxParallel:5,maxNodeParallel:10};
const events=[];
const scheduler=new AnalysisTaskScheduler(runRoot,async()=>config,task=>events.push({id:task.id,status:task.status,progress:task.progress,at:Date.now()}));
await scheduler.initialize();

const terminal=new Set(['completed','needs-attention','failed']);
async function waitFor(ids){
  const started=Date.now();
  while(true){
    const tasks=ids.map(id=>scheduler.get(id));
    if(tasks.every(task=>task&&terminal.has(task.status)))return tasks;
    if(!singleUnlimited&&Date.now()-started>22*60_000)throw new Error(`验证等待超过 22 分钟：${ids.join(',')}`);
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
}
function summarize(task,wave,index){
  const wallMs=(task.completedAt??Date.now())-(task.startedAt??task.createdAt);
  const platformIssues=(task.project.audit?.issues??[]).filter(issue=>issue.disposition==='open');
  const blocking=(task.project.clarifications??[]).filter(item=>item.state==='open'&&(item.level??'blocking')==='blocking');
  const prompts=task.checkpoint?.promptMetrics??[];
  const runtime=task.runtimeMetrics??[];
  return {wave,index,id:task.id,status:task.status,error:task.error,wallMs,within20Minutes:wallMs<=20*60_000,pipelineVersion:task.checkpoint?.pipelineVersion,deliveryState:task.project.delivery?.state,platformOpen:platformIssues.length,blockingClarifications:blocking.length,features:task.project.features.length,requirements:task.project.requirements.length,relations:task.project.relations?.length??0,promptAttempts:prompts.length,promptEstimatedTokens:prompts.reduce((sum,item)=>sum+item.estimatedTokens,0),maxPromptEstimatedTokens:Math.max(0,...prompts.map(item=>item.estimatedTokens)),hardBudgetViolations:prompts.filter(item=>item.estimatedTokens>item.hardTokens).length,runtimeCalls:runtime.length,inputTokens:runtime.reduce((sum,item)=>sum+(item.inputTokens??0),0),cachedInputTokens:runtime.reduce((sum,item)=>sum+(item.cachedInputTokens??0),0),outputTokens:runtime.reduce((sum,item)=>sum+(item.outputTokens??0),0),sourceHash:task.project.sourceHash};
}

const results=[];
const sequentialCount=singleUnlimited?1:3;
for(let index=1;index<=sequentialCount;index++){
  const task=await scheduler.create(structuredClone(sourceTask.project));
  const [done]=await waitFor([task.id]);
  const result=summarize(done,'sequential',index);results.push(result);console.log(JSON.stringify(result));
}
if(!singleUnlimited){
  const concurrent=[];
  for(let index=1;index<=5;index++)concurrent.push(await scheduler.create(structuredClone(sourceTask.project)));
  const completed=await waitFor(concurrent.map(task=>task.id));
  for(let index=0;index<completed.length;index++){const result=summarize(completed[index],'concurrent',index+1);results.push(result);console.log(JSON.stringify(result))}
}
const report={startedAt:new Date(events[0]?.at??Date.now()).toISOString(),completedAt:new Date().toISOString(),sourceTaskId,sourceHash:sourceTask.project.sourceHash,config:{adapter:config.adapter,provider:config.provider,fastModel:config.fastModel,model:config.model,reasoningEffort:config.reasoningEffort,maxParallel:5,maxNodeParallel:10,taskDeadline:singleUnlimited?'none':'20m'},runRoot,results,passed:results.length===(singleUnlimited?1:8)&&results.every(item=>(singleUnlimited||item.within20Minutes)&&item.pipelineVersion===12&&item.hardBudgetViolations===0&&item.platformOpen===0&&['completed','needs-attention'].includes(item.status))};
await mkdir(path.dirname(outputFile),{recursive:true});
await writeFile(outputFile,JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({outputFile,passed:report.passed}));
process.exitCode=report.passed?0:1;
