import { afterAll, describe, expect, it } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AnalysisTaskScheduler, compactPromptInput } from '../electron/scheduler-v2';
import type { AnalysisRuntime } from '../electron/runtime';
import type { PrdProject, RuntimeConfig, SourceUnit } from '../src/types';

const root=path.resolve('.runtime-test-scheduler');
const config:RuntimeConfig={adapter:'dsh',provider:'fake',fastModel:'fast',fastReasoningEffort:'low',model:'sol',reasoningEffort:'low',nodeProfiles:{imageReading:{model:'sol',reasoningEffort:'low'},featureCandidates:{model:'fast',reasoningEffort:'low'},featureCandidateRepair:{model:'sol',reasoningEffort:'low'},featureGlobal:{model:'sol',reasoningEffort:'low'},featureCoverage:{model:'sol',reasoningEffort:'low'},detailsFast:{model:'fast',reasoningEffort:'low'},details:{model:'sol',reasoningEffort:'low'},audit:{model:'sol',reasoningEffort:'low'},repair:{model:'sol',reasoningEffort:'low'}},maxParallel:1,maxNodeParallel:3};
const project=(rawText='字段 X 必填。'):PrdProject=>({id:'P-test',name:'测试',sourceName:'test.md',sourceHash:'hash',revision:1,importedAt:new Date().toISOString(),rawText,stage:'inventory',sourceUnits:[],rules:[],features:[],requirements:[],clarifications:[]});
const caseRoot=()=>path.join(root,randomUUID());
afterAll(()=>rm(root,{recursive:true,force:true}));
function input(prompt:string){return JSON.parse(prompt.slice(prompt.lastIndexOf('节点输入：')+5))}
function answer(prompt:string){
  const value=input(prompt);
  if(prompt.includes('“功能候选识别”')){const units=value.sourceUnits as SourceUnit[];return{features:[{id:'LOCAL-F1',name:'功能 '+units[0].id,goal:'落实原文明示要求',sourceUnitIds:units.map(u=>u.id),state:'draft'}],sourceDispositions:units.map(u=>({sourceUnitId:u.id,kind:'requirement',reason:'包含明确业务要求',featureIds:['LOCAL-F1']}))}}
  if(prompt.includes('“功能清单统一”'))return{features:value.candidates,candidateMappings:value.candidates.map((f:{id:string})=>({candidateId:f.id,featureIds:[f.id]}))};
  if(prompt.includes('“功能候选完整性检查'))return{issues:[]};
  if(prompt.includes('“逐功能细化”'))return{requirements:[{id:'LOCAL-R1',title:'字段要求',behavior:'字段 X 必填',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:value.sourceUnits.map((u:SourceUnit)=>u.id),state:'draft'}],clarifications:[]};
  if(prompt.includes('“完整性与忠实性检查'))return{issues:[]};
  if(prompt.includes('“局部修正”'))return{requirements:[],clarifications:[],deleteRequirementIds:[],deleteClarificationIds:[]};
  throw new Error('未处理的提示词');
}
function runtime(fn:(prompt:string)=>unknown=answer,gate?:(prompt:string)=>Promise<void>):AnalysisRuntime{return{start:async()=>{},stop:async()=>{},diagnostics:()=>'',promptAndWait:async(_id,prompt)=>{await gate?.(prompt);return JSON.stringify(fn(prompt))}}}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r});return{promise,resolve}}
const emptyPatch=()=>({requirements:[],clarifications:[],deleteRequirementIds:[],deleteClarificationIds:[]});
function twoFeatures(prompt:string){
  if(!prompt.includes('“功能候选识别”'))return answer(prompt);
  const units=input(prompt).sourceUnits as SourceUnit[];
  return{features:['A','B'].map(id=>({id,name:id,goal:id,sourceUnitIds:units.map(u=>u.id),state:'draft'})),sourceDispositions:units.map(u=>({sourceUnitId:u.id,kind:'requirement',reason:'明确要求',featureIds:['A','B']}))};
}
function twoIssues(prompt:string){const value=input(prompt);return{issues:value.requirements.map((r:{id:string;sourceUnitIds:string[]})=>({id:'A-'+r.id,direction:'reverse',type:'误读',category:'detail-mismatch',sourceUnitIds:r.sourceUnitIds,affectedIds:[r.id],detail:'修正 '+r.id}))}}
function boundaryAnswer(p:string){
  const v=input(p);
  if(p.includes('“功能候选识别·定点返工”'))return{features:[{id:'LOCAL-REVISED',name:'修订功能',goal:'正确边界',sourceUnitIds:v.sourceUnits.map((u:SourceUnit)=>u.id),state:'draft'}],sourceDispositions:v.sourceUnits.map((u:SourceUnit)=>({sourceUnitId:u.id,kind:'requirement',reason:'明确要求',featureIds:['LOCAL-REVISED']}))};
  if(p.includes('“功能清单统一·定点返工”')){expect(v.sourceDispositions[0].featureIds).toEqual(['LOCAL-REVISED']);return{features:v.candidates,candidateMappings:v.candidates.map((f:{id:string})=>({candidateId:f.id,featureIds:[f.id]}))}};
  if(p.includes('“完整性与忠实性检查”'))return{issues:v.features.some((f:{name:string})=>f.name==='修订功能')?[]:[{id:'A',direction:'cross',type:'边界错误',category:'feature-boundary',sourceUnitIds:['S-001'],affectedIds:[v.features[0].id],detail:'需调整功能边界'}]};
  if(p.includes('“逐功能细化”'))return{...answer(p),clarifications:[{id:'LOCAL-Q',question:'确认业务口径',reason:'原文未说明',affectedIds:['LOCAL-R1'],state:'open'}]};
  return answer(p);
}
async function terminal(s:AnalysisTaskScheduler){for(let i=0;i<300;i++){const task=s.list()[0];if(task&&['completed','failed'].includes(task.status))return task;await new Promise(r=>setTimeout(r,10))}throw new Error('任务未结束')}

describe('八节点需求细化调度器',()=>{
  it('提示词将重复来源上下文无损提取为共享字典',()=>{
    const context='资料角色：主 PRD。冲突需记录待澄清。\n<source-structure-context>\n章节路径：需求说明 → 目标与范围 → 业务规则\n</source-structure-context>';
    const sourceUnits=Array.from({length:10},(_,index)=>({id:`S-${index+1}`,excerpt:`要求${index+1}`,context,kind:'paragraph',location:String(index+1),status:'processed'})) as SourceUnit[];
    const compact=compactPromptInput({sourceUnits}) as {sourceUnits:Array<SourceUnit&{contextRef:string}>;sourceContexts:Record<string,string>};
    expect(compact.sourceContexts).toEqual({'CTX-1':context});expect(compact.sourceUnits.map(u=>u.contextRef)).toEqual(Array(10).fill('CTX-1'));expect(compact.sourceUnits.every(u=>u.context===undefined)).toBe(true);
    expect(compact.sourceUnits.map(u=>compact.sourceContexts[u.contextRef])).toEqual(sourceUnits.map(u=>u.context));
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify({sourceUnits}).length);
  });
  it.each([true,false])('补漏未覆盖来源必须进入审计且仅修复后可交付（修复=%s）',async fix=>{
    let audits=0,repairs=0;const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(p=>{
      const v=input(p);
      if(p.includes('“逐功能细化”')){const result=answer(p);result.requirements[0].sourceUnitIds=['S-001'];return result}
      if(p.includes('“逐功能细化·定点补漏”'))return{requirements:[],clarifications:[]};
      if(p.includes('“完整性与忠实性检查”')){audits++;expect(v.uncoveredSourceUnits.map((d:{sourceUnitId:string})=>d.sourceUnitId)).toEqual(['S-002']);return{issues:[]}}
      if(p.includes('“局部修正”')){repairs++;expect(v.issues.some((i:{type:string})=>i.type==='原文来源未落实')).toBe(true);if(!fix)return emptyPatch();return{...emptyPatch(),requirements:[{id:'LOCAL-MISSING',featureId:v.features[0].id,title:'第二项要求',behavior:'第二项要求',sourceUnitIds:['S-002'],conditions:[],constraints:[],explicitAcceptanceConditions:[],state:'draft'}]}}
      return answer(p);
    }));await s.initialize();await s.create(project('第一项要求\n\n第二项要求'));const done=await terminal(s);expect(audits).toBe(1);expect(repairs).toBe(1);expect(done.status,done.error).toBe(fix?'completed':'failed');
    if(fix){expect(done.project.requirements.flatMap(r=>r.sourceUnitIds)).toContain('S-002');expect(done.project.audit?.issues).toHaveLength(1);expect(done.project.audit?.issues[0].disposition).toBe('repaired')}else{expect(done.error).toContain('未覆盖原文');expect(done.steps[7].status).toBe('pending')}
  });
  it('统一输入保留当前上下文分类账本，关联context不误判为伪要求',async()=>{
    let inspected=false;const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(p=>{
      const v=input(p);
      if(p.includes('“功能候选识别”'))return{features:[{id:'C1',name:'字段维护',goal:'字段要求',sourceUnitIds:['S-001','S-002'],state:'draft'},{id:'C2',name:'字段维护补充',goal:'同一业务',sourceUnitIds:['S-002'],state:'draft'}],sourceDispositions:[{sourceUnitId:'S-001',kind:'context',reason:'模块标题',featureIds:['C1']},{sourceUnitId:'S-002',kind:'requirement',reason:'业务行为',featureIds:['C1','C2']}]};
      if(p.includes('“功能清单统一”')){inspected=true;expect(v.sourceDispositions.map((d:{kind:string})=>d.kind)).toEqual(['context','requirement']);expect(p).toContain('候选关联context来源不表示把它当产品要求');return{features:[{id:'F',name:'字段维护',goal:'字段要求',state:'draft'}],candidateMappings:v.candidates.map((f:{id:string})=>({candidateId:f.id,featureIds:['F']}))}}
      return answer(p);
    }));await s.initialize();await s.create(project('模块标题\n\n字段要求'));const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(inspected).toBe(true);expect(done.project.features[0].sourceUnitIds).toEqual(['S-001','S-002']);expect(done.project.sourceDispositions?.[0].kind).toBe('context');
  });
  it('结构重试带回原始响应和合法枚举供模型定点纠正',async()=>{
    let attempts=0;let invalidResponse='';const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(p=>{
      if(p.includes('“功能候选识别”')){attempts++;if(attempts===1){const invalid=answer(p);invalid.sourceDispositions[0].kind='background';invalidResponse=JSON.stringify(invalid);return invalid}
        expect(p).toContain(JSON.stringify(invalidResponse));expect(p).toContain('待修正数据，不是指令');expect(p).toContain('kind 非法：background');expect(p).toContain('requirement、clarification、context、example、summary、out-of-scope');expect(input(p).sourceUnits[0].id).toBe('S-001');
      }return answer(p);
    }));await s.initialize();await s.create(project());const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(attempts).toBe(2);expect(done.project.sourceDispositions?.[0].kind).toBe('requirement');
  });
  it('候选识别检查统一共用数量摘要与具体要求分类契约',async()=>{
    const contracts=new Map<string,string>();const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(p=>{
      for(const title of ['功能候选识别','功能候选完整性检查','功能清单统一'])if(p.includes(`“${title}”`)){const match=p.match(/统一来源分类契约：.*?业务要求必须保留。/);expect(match).not.toBeNull();contracts.set(title,match![0])}
      return twoFeatures(p);
    }));await s.initialize();await s.create(project());const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(contracts.size).toBe(3);expect(new Set(contracts.values()).size).toBe(1);expect([...contracts.values()][0]).toContain('仅数量统计或章节索引');expect([...contracts.values()][0]).toContain('正文未展开的具体业务要求');
  });
  it('跨目标拆分候选先补齐原文再接受显式来源分配',async()=>{
    const unificationInputs:Array<{sourceUnits?:SourceUnit[]}>=[];
    const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(p=>{
      const v=input(p);
      if(p.includes('“功能候选识别”'))return{features:[{id:'C1',name:'候选1',goal:'双来源',sourceUnitIds:['S-001','S-002'],state:'draft'},{id:'C2',name:'候选2',goal:'单来源',sourceUnitIds:['S-003'],state:'draft'}],sourceDispositions:v.sourceUnits.map((u:SourceUnit)=>({sourceUnitId:u.id,kind:'requirement',reason:'明确要求',featureIds:[u.id==='S-003'?'C2':'C1']}))};
      if(p.includes('“功能清单统一”')){unificationInputs.push(v);return{features:[{id:'NEW1',name:'功能1',goal:'第一项',state:'draft'},{id:'NEW2',name:'功能2',goal:'第二项',state:'draft'}],candidateMappings:[{candidateId:v.candidates[0].id,featureIds:['NEW1','NEW2'],sourceUnitIdsByFeature:{NEW1:['S-001'],NEW2:['S-002']}},{candidateId:v.candidates[1].id,featureIds:['NEW2']}]}}
      return answer(p);
    }));
    await s.initialize();await s.create(project('要求一\n\n要求二\n\n要求三'));const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(unificationInputs).toHaveLength(2);expect(unificationInputs[0].sourceUnits).toBeUndefined();expect(unificationInputs[1].sourceUnits?.map(u=>u.id)).toEqual(['S-001','S-002']);expect(done.project.features.map(f=>f.sourceUnitIds)).toEqual([['S-001'],['S-002','S-003']]);
  });
  it('严格执行八个节点并直接由原文细化需求',async()=>{const directory=caseRoot();await mkdir(directory,{recursive:true});const s=new AnalysisTaskScheduler(directory,async()=>config,()=>{},()=>runtime());await s.initialize();await s.create(project());const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(done.steps.map(x=>x.name)).toEqual(['原文建账','功能候选识别','功能候选完整性检查','功能清单统一','逐功能细化','完整性与忠实性检查','局部修正','交付']);expect(done.project.rules).toEqual([]);expect(done.project.sourceDispositions).toHaveLength(1);expect(done.project.requirements[0].sourceUnitIds).toEqual(['S-001'])});
  it('功能候选必须逐个处置原文单元，遗漏则失败',async()=>{const directory=caseRoot();await mkdir(directory,{recursive:true});const s=new AnalysisTaskScheduler(directory,async()=>config,()=>{},()=>runtime(prompt=>prompt.includes('“功能候选识别”')?{features:[],sourceDispositions:[]}:answer(prompt)));await s.initialize();await s.create(project());const done=await terminal(s);expect(done.status).toBe('failed');expect(done.error).toContain('sourceDispositions 遗漏')});
  it('完整性检查只报告问题，由控制器定点退回候选识别后复核',async()=>{const directory=caseRoot();await mkdir(directory,{recursive:true});let checks=0,repairs=0;const s=new AnalysisTaskScheduler(directory,async()=>config,()=>{},()=>runtime(prompt=>{if(prompt.includes('“功能候选完整性检查'))return{issues:checks++===0?[{sourceUnitIds:['S-001'],detail:'遗漏字段校验功能'}]:[]};if(prompt.includes('“功能候选识别·定点返工”')){repairs++;return{features:[{id:'LOCAL-F2',name:'字段校验',goal:'校验字段 X',sourceUnitIds:['S-001'],state:'draft'}],sourceDispositions:[{sourceUnitId:'S-001',kind:'requirement',reason:'明确要求',featureIds:['LOCAL-F2']}]}}return answer(prompt)}));await s.initialize();await s.create(project());const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(checks).toBe(2);expect(repairs).toBe(1);expect(done.steps[1].runs).toBe(2);expect(done.steps[2].runs).toBe(2)});
  it('候选内容使用有界并行',async()=>{const directory=caseRoot(),raw=Array.from({length:50},(_,i)=>'要求 '+(i+1)+'。').join('\n\n');const allStarted=deferred();let active=0,peak=0;const s=new AnalysisTaskScheduler(directory,async()=>config,()=>{},()=>runtime(answer,async prompt=>{if(prompt.includes('“功能候选识别”')){active++;peak=Math.max(peak,active);if(active===3)allStarted.resolve();await allStarted.promise;active--}}));await s.initialize();await s.create(project(raw));const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(done.checkpoint?.featureCandidateBatchCount).toBe(3);expect(peak).toBeGreaterThan(1);expect(peak).toBeLessThanOrEqual(3)});
  it('复杂功能使用 Sol 轻度推理，候选使用快速模型',async()=>{const directory=caseRoot(),created:RuntimeConfig[]=[];const s=new AnalysisTaskScheduler(directory,async()=>config,()=>{},c=>{created.push(c);return runtime()});await s.initialize();await s.create(project('字段 X 必填，状态变化时需要权限校验并处理例外。'));const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(created.some(c=>c.model==='sol'&&c.reasoningEffort==='low')).toBe(true);expect(created.some(c=>c.model==='fast')).toBe(true)});
  it('审计问题只触发受影响功能的局部修正并回到审计复核',async()=>{const directory=caseRoot();let repaired=0,reviews=0;const s=new AnalysisTaskScheduler(directory,async()=>config,()=>{},()=>runtime(prompt=>{if(prompt.includes('“完整性与忠实性检查·局部复核”')){reviews++;return{issues:[]}}if(prompt.includes('“完整性与忠实性检查”'))return{issues:[{id:'A',direction:'reverse',type:'误读',category:'detail-mismatch',sourceUnitIds:['S-001'],affectedIds:['R-0001'],detail:'误读'}]};if(prompt.includes('“局部修正”')){repaired++;return{requirements:[],clarifications:[],deleteRequirementIds:[],deleteClarificationIds:[]}}return answer(prompt)}));await s.initialize();await s.create(project());const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(repaired).toBe(1);expect(reviews).toBe(1);expect(done.project.audit?.issues[0].disposition).toBe('repaired')});
  it('运行配置不持久化密钥',async()=>{const directory=caseRoot(),secretConfig={...config,apiKey:'FAKE-SECRET'};const s=new AnalysisTaskScheduler(directory,async()=>secretConfig,()=>{},()=>runtime());await s.initialize();const created=await s.create(project());const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(await readFile(path.join(directory,created.id+'.json'),'utf8')).not.toContain('FAKE-SECRET')});
  it('同源的两个功能各自只拥有本功能产生的需求',async()=>{
    const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(twoFeatures));await s.initialize();await s.create(project());const done=await terminal(s);
    expect(done.status,done.error).toBe('completed');expect(done.project.features.map(f=>f.requirementIds)).toEqual([['R-0001'],['R-0002']]);
  });
  it.each([false,true])('统一分类反馈退回识别检查且断点恢复不重复发现（取消=%s）',async cancelAtFeedback=>{
    const stopped=deferred();let feedbacks=0,repairs=0,checks=0,fired=false,cancellation:Promise<void>|undefined;let s:AnalysisTaskScheduler;
    s=new AnalysisTaskScheduler(caseRoot(),async()=>config,t=>{if(cancelAtFeedback&&!fired&&t.checkpoint?.unificationFeedback?.some(x=>x?.length)){fired=true;cancellation=s.cancel(t.id)}},()=>{const r=runtime(p=>{
      const v=input(p);
      if(p.includes('“功能清单统一”')){if(v.candidates.some((f:{name:string})=>f.name==='A')){feedbacks++;return{classificationIssues:[{candidateIds:[v.candidates[0].id],sourceUnitIds:['S-001'],detail:'文档写法应归上下文'}]}}return answer(p)}
      if(p.includes('“功能候选识别·定点返工”')){repairs++;return{features:[{id:'FIXED',name:'实际业务功能',goal:'字段要求',sourceUnitIds:['S-001'],state:'draft'}],sourceDispositions:[{sourceUnitId:'S-001',kind:'requirement',reason:'实际要求仍保留',featureIds:['FIXED']}]}}
      if(p.includes('“功能候选完整性检查'))checks++;
      return twoFeatures(p);
    });r.stop=async()=>{stopped.resolve()};return r});
    await s.initialize();const created=await s.create(project());if(cancelAtFeedback){await stopped.promise;await cancellation;expect(s.list()[0].checkpoint?.unificationFeedback?.some(x=>x?.length)).toBe(true);await s.retry(created.id)}
    const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(feedbacks).toBe(1);expect(repairs).toBe(1);expect(checks).toBe(2);expect(done.project.features.map(f=>f.name)).toEqual(['实际业务功能']);expect(done.project.sourceUnits.map(u=>u.id)).toEqual(['S-001']);expect(done.project.requirements[0].sourceUnitIds).toEqual(['S-001']);
  });
  it('A 包进入候选检查时 B 包候选识别仍未完成',async()=>{
    const blocked=deferred(),inspected=deferred();let bStarted=false,bFinished=false;
    const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(answer,async p=>{const v=input(p);if(p.includes('“功能候选识别”')&&v.sourceUnits[0].id!=='S-001'){bStarted=true;await blocked.promise;bFinished=true}if(p.includes('“功能候选完整性检查')&&v.sourceUnits[0].id==='S-001'){expect(bFinished).toBe(false);inspected.resolve()}}));
    await s.initialize();await s.create(project(Array.from({length:25},(_,i)=>`要求 ${i}`).join('\n\n')));await inspected.promise;expect(bStarted).toBe(true);blocked.resolve();expect((await terminal(s)).status).toBe('completed');
  });
  it('并发增量新增使用独立全局编号，澄清映射到各自新增需求',async()=>{
    const both=deferred();let entered=0;
    const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(p=>{
      if(p.includes('“完整性与忠实性检查”'))return twoIssues(p);
      if(p.includes('“局部修正”')){const v=input(p);return{...emptyPatch(),requirements:[{...v.currentRequirements[0],id:'LOCAL-NEW',title:'新增 '+v.features[0].id,featureId:v.features[0].id}],clarifications:[{id:'LOCAL-Q',question:v.features[0].id,reason:'未明确',affectedIds:['LOCAL-NEW'],state:'open'}]}}
      return twoFeatures(p);
    },async p=>{if(p.includes('“局部修正”')){if(++entered===2)both.resolve();await both.promise}}));
    await s.initialize();await s.create(project());const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(entered).toBe(2);
    expect(new Set(done.project.requirements.map(r=>r.id)).size).toBe(4);expect(new Set(done.project.clarifications.map(q=>q.id)).size).toBe(2);
    for(const q of done.project.clarifications){const f=done.project.features.find(f=>f.id===q.question)!;expect(f.requirementIds).toContain(q.affectedIds[0]);expect(q.affectedIds[0]).toMatch(/^R-000[34]$/)}
  });
  it('取消后迟到的候选结果不能提交',async()=>{
    const entered=deferred(),release=deferred(),stopped=deferred();const r=runtime(answer,async p=>{if(p.includes('“功能候选识别”')){entered.resolve();await release.promise}});let stopCalls=0;r.stop=async()=>{if(++stopCalls===2)stopped.resolve()};
    const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>r);await s.initialize();const created=await s.create(project());await entered.promise;await s.cancel(created.id);release.resolve();await stopped.promise;
    const done=s.list()[0];expect(done.error).toBe('用户已取消任务');expect(done.checkpoint?.featureCandidateBatches).toEqual([]);expect(done.project.requirements).toEqual([]);
  });
  it('失败重试不重复修正已经提交的独立问题范围',async()=>{
    const committed=deferred();const counts=new Map<string,number>();let fail=true;
    const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,t=>{if(t.checkpoint?.repairIssueIds?.includes('A-0001'))committed.resolve()},()=>runtime(p=>{if(p.includes('“完整性与忠实性检查”'))return twoIssues(p);if(p.includes('“局部修正”'))return emptyPatch();return twoFeatures(p)},async p=>{if(p.includes('“局部修正”')){const id=input(p).issues[0].id;counts.set(id,(counts.get(id)??0)+1);if(id==='A-0002'&&fail){await committed.promise;throw new Error('可重试故障')}}}));
    await s.initialize();const created=await s.create(project());expect((await terminal(s)).status).toBe('failed');fail=false;await s.retry(created.id);const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(counts.get('A-0001')).toBe(1);expect(counts.get('A-0002')).toBe(2);
  });
  it('候选两轮修正预算跨 retry 保留',async()=>{
    let repairs=0;const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(p=>{if(p.includes('“功能候选完整性检查'))return{issues:[{sourceUnitIds:['S-001'],detail:'仍遗漏'}]};if(p.includes('“功能候选识别·定点返工”')){repairs++;return answer(p.replace('功能候选识别·定点返工','功能候选识别'))}return answer(p)}));
    await s.initialize();const created=await s.create(project());expect((await terminal(s)).error).toContain('两轮返工上限');expect(repairs).toBe(2);await s.retry(created.id);expect((await terminal(s)).error).toContain('两轮返工上限');expect(repairs).toBe(2);
  });
  it('未分类问题保持开放，不自动执行条目修正',async()=>{
    let repairs=0;const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(p=>{if(p.includes('“完整性与忠实性检查”'))return{issues:[{id:'A',direction:'cross',type:'待定位',category:'unclassified',sourceUnitIds:['S-001'],affectedIds:['S-001'],detail:'性质尚未确定'}]};if(p.includes('“局部修正”'))repairs++;return answer(p)}));await s.initialize();await s.create(project());const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(repairs).toBe(0);expect(done.project.audit?.issues[0].disposition).toBe('open');
  });
  it.each(['candidate','check','unify'])('边界 %s 临时异常恢复保留前序子检查点和返工预算',async failureAt=>{
    const counts={candidate:0,check:0,unify:0};let failed=false,inBoundary=false;
    const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(boundaryAnswer,async p=>{
      let node:keyof typeof counts|undefined;
      if(p.includes('“功能候选识别·定点返工”')){inBoundary=true;node='candidate'}
      else if(inBoundary&&p.includes('“功能候选完整性检查'))node='check';
      else if(p.includes('“功能清单统一·定点返工”'))node='unify';
      if(node){counts[node]++;if(node===failureAt&&!failed){failed=true;throw new Error('临时runtime故障')}}
    }));
    await s.initialize();const created=await s.create(project());const first=await terminal(s);expect(first.status).toBe('failed');expect(first.checkpoint?.featureRepairRounds??0).toBe(0);
    if(failureAt!=='candidate')expect(first.checkpoint?.boundaryCandidate).toBeDefined();if(failureAt==='unify')expect(first.checkpoint?.boundaryChecked).toBe(true);
    await s.retry(created.id);const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(done.checkpoint?.featureRepairRounds).toBe(1);expect(done.checkpoint?.boundaryUnified).toBeDefined();
    expect(counts).toEqual({candidate:failureAt==='candidate'?2:1,check:failureAt==='check'?2:1,unify:failureAt==='unify'?2:1});
  });
  it('边界修改替换旧澄清且复用调用后八节点均完成',async()=>{
    const s=new AnalysisTaskScheduler(caseRoot(),async()=>config,()=>{},()=>runtime(boundaryAnswer));await s.initialize();await s.create(project());const done=await terminal(s);
    expect(done.status,done.error).toBe('completed');expect(done.project.features[0].name).toBe('修订功能');expect(done.project.clarifications).toHaveLength(1);expect(done.project.clarifications[0].affectedIds).toEqual(done.project.features[0].requirementIds);expect(done.steps.every(step=>step.status==='completed')).toBe(true);expect(done.steps[1].runs).toBe(2);expect(done.steps[2].runs).toBe(2);expect(done.steps[3].runs).toBe(1);
  });
  it('统一结果检查点已保存后中断，重试直接提交而不再次调用模型',async()=>{
    const stopped=deferred();let fired=false,unifies=0,cancellation:Promise<void>|undefined;let s:AnalysisTaskScheduler;
    s=new AnalysisTaskScheduler(caseRoot(),async()=>config,t=>{if(t.checkpoint?.boundaryUnified&&!fired){fired=true;cancellation=s.cancel(t.id)}},()=>{const r=runtime(p=>{if(p.includes('“功能清单统一·定点返工”'))unifies++;return boundaryAnswer(p)});r.stop=async()=>{stopped.resolve()};return r});
    await s.initialize();const created=await s.create(project());await stopped.promise;await cancellation;expect(s.list()[0].checkpoint?.featureRepairRounds??0).toBe(0);await s.retry(created.id);const done=await terminal(s);expect(done.status,done.error).toBe('completed');expect(unifies).toBe(1);expect(done.project.features[0].name).toBe('修订功能');
  });
  it.each(['candidate','detail'])('最后 %s worker 发布触发取消后不落实需求或完成阶段',async where=>{
    const stopped=deferred();let cancellation:Promise<void>|undefined,fired=false;let s:AnalysisTaskScheduler;
    s=new AnalysisTaskScheduler(caseRoot(),async()=>config,t=>{
      const ready=where==='candidate'?t.checkpoint?.featureCandidateBatchCount===1:Object.keys(t.checkpoint?.detailResults??{}).length===1;
      if(ready&&!fired){fired=true;cancellation=s.cancel(t.id)}
    },()=>{const r=runtime();r.stop=async()=>{stopped.resolve()};return r});
    await s.initialize();await s.create(project());await stopped.promise;await cancellation;const done=s.list()[0];expect(fired).toBe(true);expect(done.error).toBe('用户已取消任务');expect(done.project.requirements).toEqual([]);expect(done.checkpoint?.materializedFeatureIds??[]).toEqual([]);expect(done.steps[where==='candidate'?1:4].status).not.toBe('completed');
  });
});
