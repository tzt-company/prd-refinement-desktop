import {afterAll,describe,expect,it} from 'vitest';
import {readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {AnalysisTaskScheduler,compactPromptInput,schedulerConcurrency} from '../electron/scheduler-v2';
import type {AnalysisRuntime} from '../electron/runtime';
import type {PrdProject,RuntimeConfig,SourceUnit} from '../src/types';

const root=path.resolve('.runtime-test-scheduler-17',randomUUID());
afterAll(()=>rm(root,{recursive:true,force:true}));
const config:RuntimeConfig={adapter:'dsh',provider:'fake',fastModel:'fast',fastReasoningEffort:'low',model:'model',reasoningEffort:'low',maxParallel:1,maxNodeParallel:3};
const project=():PrdProject=>({id:'P',name:'测试',sourceName:'test.md',sourceHash:'H',revision:1,importedAt:'now',rawText:'字段 X 必填。',stage:'inventory',sourceUnits:[],features:[],requirements:[],clarifications:[]});
const input=(prompt:string)=>JSON.parse(prompt.slice(prompt.lastIndexOf('节点输入：')+5));
const terminal=async(scheduler:AnalysisTaskScheduler)=>{for(let index=0;index<300;index++){const task=scheduler.list()[0];if(task&&['completed','needs-attention','failed'].includes(task.status))return task;await new Promise(resolve=>setTimeout(resolve,10))}throw new Error('任务未结束')};

function runtime(prompts:string[]):AnalysisRuntime{return{start:async()=>{},stop:async()=>{},diagnostics:()=>'',promptAndWait:async(_id,prompt)=>{prompts.push(prompt);const value=input(prompt);
  if(prompt.includes('“功能候选识别”'))return JSON.stringify({features:[{id:'LOCAL-F1',name:'字段维护',kind:'function',appliesToFeatureIds:[],sourceUnitIds:value.sourceUnits.map((unit:SourceUnit)=>unit.id),state:'draft'}],sourceDispositions:value.sourceUnits.map((unit:SourceUnit)=>({sourceUnitId:unit.id,contentRole:'requirement',reason:'明确要求',featureIds:['LOCAL-F1']}))});
  if(prompt.includes('“功能清单统一”'))return JSON.stringify({features:value.candidates,candidateMappings:value.candidates.map((item:{id:string})=>({candidateId:item.id,featureIds:[item.id]}))});
  if(prompt.includes('“逐功能细化”')){const evidence=value.evidenceCatalog[0];return JSON.stringify({requirements:[{id:'LOCAL-R1',title:'字段要求',behavior:'字段 X 必填',conditions:[],constraints:[],explicitAcceptanceEvidenceIds:[],sourceUnitIds:[evidence.sourceUnitId],evidenceBindings:{behavior:[evidence.id],conditions:[],constraints:[],explicitAcceptanceConditions:[]},state:'draft'}],clarifications:[]})}
  if(prompt.includes('“产物依据核查”'))return JSON.stringify({issues:[]});
  throw new Error(`未处理节点：${prompt.slice(0,80)}`);
}}}

describe('Pipeline 17 调度不变量',()=>{
  it('默认并发为五任务、每任务十节点',()=>{expect(schedulerConcurrency({maxParallel:5,maxNodeParallel:10})).toEqual({taskLimit:5,nodeLimit:10,slotLimit:50})});
  it('提示输入裁剪保留业务字段并移除显示元数据',()=>{expect(compactPromptInput({id:'S1',excerpt:'要求',location:'第1段',label:'标题'})).toMatchObject({id:'S1',excerpt:'要求'})});
  it('首轮只核查已有产物，不调用全文补漏节点，且运行配置不落密钥',async()=>{const prompts:string[]=[],directory=path.join(root,'initial'),secret={...config,apiKey:'DO-NOT-PERSIST'};const scheduler=new AnalysisTaskScheduler(directory,async()=>secret,()=>{},()=>runtime(prompts));await scheduler.initialize();const created=await scheduler.create(project()),done=await terminal(scheduler);expect(done.status,done.error).toBe('completed');expect(prompts.some(item=>item.includes('原文正向完整性检查')||item.includes('定点补漏')||item.includes('功能候选完整性检查'))).toBe(false);expect(prompts.some(item=>item.includes('“产物依据核查”'))).toBe(true);expect(await readFile(path.join(directory,`${created.id}.json`),'utf8')).not.toContain('DO-NOT-PERSIST')});
  it('取消排队任务后不能发布正式结果',async()=>{const directory=path.join(root,'cancel'),scheduler=new AnalysisTaskScheduler(directory,async()=>config,()=>{},()=>{throw new Error('不应启动')});await scheduler.initialize();const created=await scheduler.create(project());await scheduler.cancel(created.id);const cancelled=scheduler.get(created.id);expect(cancelled?.status).toBe('failed');expect(cancelled?.error).toBe('用户已取消任务')});
});
