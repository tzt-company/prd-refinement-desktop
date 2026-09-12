import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {AnalysisTaskScheduler} from '../electron/scheduler-v2';
import type {AnalysisTask,PrdProject,RuntimeConfig} from '../src/types';

const config:RuntimeConfig={adapter:'codex-oauth',provider:'openai',model:'test',reasoningEffort:'low',maxParallel:1,maxNodeParallel:1};
const project=():PrdProject=>({id:'P',name:'PRD',sourceName:'prd.md',sourceHash:'H',revision:1,importedAt:'now',rawText:'用户可以提交订单。',stage:'review',sourceUnits:[{id:'S1',label:'S1',kind:'paragraph',excerpt:'用户可以提交订单。',location:'正文',status:'processed'}],features:[{id:'F1',name:'提交订单',sourceUnitIds:['S1'],sourceRefs:[{sourceUnitId:'S1'}],ruleIds:[],requirementIds:['R1'],state:'reviewed'}],requirements:[{id:'R1',title:'提交',behavior:'用户可以提交订单',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:['S1'],evidenceBindings:{behavior:[{sourceUnitId:'S1'}],conditions:[],constraints:[],explicitAcceptanceConditions:[]},ruleIds:[],state:'reviewed'}],clarifications:[],delivery:{state:'ready',inputHash:'H',resultHash:'RH',issueIds:[],unverifiedScopeIds:[],policyVersion:2}});
const task=(id:string,version:number,createdAt=version):AnalysisTask=>({id,rootTaskId:'T-ROOT',resultVersion:version,project:project(),runtimeConfig:{...config,credentialRef:'system-runtime-config'},attempt:1,status:'completed',progress:100,createdAt,completedAt:createdAt,steps:[]});
const root=()=>mkdtemp(path.join(tmpdir(),'prd-adjustment-queue-'));
const save=(directory:string,value:AnalysisTask)=>writeFile(path.join(directory,`${value.id}.json`),JSON.stringify(value),'utf8');

describe('调整任务队列和版本基准',()=>{
  it('相同 operationId 幂等，并在模型调用前持久化原始输入',async()=>{
    const directory=await root();await save(directory,task('T-BASE',1));
    const scheduler=new AnalysisTaskScheduler(directory,async()=>config,()=>{},()=>{throw new Error('测试不启动模型')});await scheduler.initialize();
    const request={operationId:'OP-1',baseTaskId:'T-BASE',baseVersion:1,kind:'feature' as const,scope:'feature' as const,featureId:'F1',instruction:'展开细化'};
    const first=await scheduler.enqueueAdjustment(request),second=await scheduler.enqueueAdjustment(request);
    expect(second.id).toBe(first.id);expect(first.resultVersion).toBeUndefined();expect(first.status).toBe('queued');
    const stored=JSON.parse(await readFile(path.join(directory,`${first.id}.json`),'utf8')) as AnalysisTask;
    expect(stored.operationId).toBe('OP-1');expect(stored.baseResultVersion).toBe(1);expect(stored.adjustment?.instruction).toBe('展开细化');
    await scheduler.cancel(first.id);
  });

  it('只允许基于任务族当前正式版本入队',async()=>{
    const directory=await root();await save(directory,task('T-BASE',1,1));await save(directory,task('T-LATEST',2,2));
    const scheduler=new AnalysisTaskScheduler(directory,async()=>config,()=>{},()=>{throw new Error('测试不启动模型')});await scheduler.initialize();
    await expect(scheduler.enqueueAdjustment({operationId:'OP-STALE',baseTaskId:'T-BASE',baseVersion:1,kind:'feature',scope:'feature',featureId:'F1',instruction:'精简'})).rejects.toThrow('最新版');
  });
});
