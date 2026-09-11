import { describe, expect, it } from 'vitest';
import { acceptCandidateClassificationIssues, acceptDirectDetails, acceptDirectFeatureBatch, acceptDirectFeatures, acceptFeatureUnification, validateDirectGraph } from '../electron/domain';
import type { Feature, RequirementDetail, SourceDisposition, SourceUnit } from '../src/types';

const sources:SourceUnit[]=['S1','S2','S3'].map(id=>({id,label:id,kind:'paragraph',excerpt:'字段 X 必填',location:id,status:'processed'}));
const feature=(id:string,sourceUnitIds:string[],requirementIds:string[]=[]):Feature=>({id,name:id,goal:id,sourceUnitIds,requirementIds,ruleIds:[],state:'draft'});
const requirement:RequirementDetail={id:'R1',title:'字段 X',behavior:'字段 X 必填',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:['S1'],ruleIds:[],state:'draft'};
const dispositions:SourceDisposition[]=sources.map((unit,i)=>({sourceUnitId:unit.id,kind:i===0?'requirement':'context',reason:'原文分类',featureIds:i===0?['F1']:[]}));
const graph=(features:Feature[],requirements:RequirementDetail[]=[requirement],ds=dispositions)=>validateDirectGraph(sources,ds,features,requirements,[]);

describe('直接需求域契约',()=>{
  it('紧凑统一按显式单目标映射确定性合并全部来源',()=>{
    const {sourceUnitIds:_,...compact}=feature('F1',['S1']);
    const result=acceptFeatureUnification({features:[compact],candidateMappings:[{candidateId:'C1',featureIds:['F1']},{candidateId:'C2',featureIds:['F1']}]},[feature('C1',['S1']),feature('C2',['S2'])],sources);
    expect(result[0].sourceUnitIds).toEqual(['S1','S2']);
  });
  it('紧凑多目标仅按完整有效来源分配编译',()=>{
    const compact=(id:string)=>{const {sourceUnitIds:_,...f}=feature(id,[]);return f};
    const payload={features:[compact('F1'),compact('F2')],candidateMappings:[{candidateId:'C1',featureIds:['F1','F2'],sourceUnitIdsByFeature:{F1:['S1'],F2:['S2']}}]};
    const candidates=[feature('C1',['S1','S2'])];expect(acceptFeatureUnification(payload,candidates,sources).map(f=>f.sourceUnitIds)).toEqual([['S1'],['S2']]);
    for(const allocation of [undefined,{F1:['S1'],F2:['S1']},{F1:['S1'],F2:['S3']},{F1:['S1']},{F1:['S1'],F2:[]}])expect(()=>acceptFeatureUnification({...payload,candidateMappings:[{...payload.candidateMappings[0],sourceUnitIdsByFeature:allocation}]},candidates,sources)).toThrow();
  });
  it('紧凑与显式来源不可混用，显式遗漏不能被脚本补齐',()=>{
    const {sourceUnitIds:_,...compact}=feature('F1',[]),candidateMappings=[{candidateId:'C1',featureIds:['F1']},{candidateId:'C2',featureIds:['F2']}],candidates=[feature('C1',['S1','S2']),feature('C2',['S3'])];
    expect(()=>acceptFeatureUnification({features:[compact,feature('F2',['S3'])],candidateMappings},candidates,sources)).toThrow('不允许混用');
    expect(()=>acceptFeatureUnification({features:[feature('F1',['S1']),feature('F2',['S3'])],candidateMappings},candidates,sources)).toThrow('遗漏候选来源');
  });
  it('统一检查可报告有明确候选和来源的分类问题',()=>{
    const issues=[{candidateIds:['C1','C2'],sourceUnitIds:['S1','S2'],detail:'文档说明被误判业务功能'}];
    expect(acceptCandidateClassificationIssues(issues,[feature('C1',['S1']),feature('C2',['S2'])],sources)).toEqual(issues);
  });
  it('分类问题拒绝空说明、空或非法引用及候选范围外来源',()=>{
    const candidates=[feature('C1',['S1'])],issue={candidateIds:['C1'],sourceUnitIds:['S1'],detail:'需重分类'};
    for(const patch of [{candidateIds:[]},{sourceUnitIds:[]},{detail:''},{candidateIds:['BAD']},{sourceUnitIds:['BAD']},{sourceUnitIds:['S2']}])expect(()=>acceptCandidateClassificationIssues([{...issue,...patch}],candidates,sources)).toThrow();
    expect(()=>acceptCandidateClassificationIssues({},candidates,sources)).toThrow('必须是数组');
  });
  it('允许显式合并与拆分并保留来源',()=>{
    const candidates=[feature('C1',['S1','S2']),feature('C2',['S3'])];
    const result=acceptFeatureUnification({features:[feature('F1',['S1']),feature('F2',['S2','S3'])],candidateMappings:[{candidateId:'C1',featureIds:['F1','F2']},{candidateId:'C2',featureIds:['F2']}]},candidates,sources);
    expect(result.map(item=>item.sourceUnitIds)).toEqual([['S1'],['S2','S3']]);
  });
  it('拒绝遗漏或重复候选映射、未被映射功能及无效引用',()=>{
    const candidates=[feature('C1',['S1'])],features=[feature('F1',['S1'])];
    const mapping={candidateId:'C1',featureIds:['F1']};
    expect(()=>acceptFeatureUnification({features,candidateMappings:[]},candidates,sources)).toThrow('遗漏候选');
    expect(()=>acceptFeatureUnification({features,candidateMappings:[mapping,mapping]},candidates,sources)).toThrow('重复映射');
    expect(()=>acceptFeatureUnification({features:[...features,feature('F2',['S2'])],candidateMappings:[mapping]},candidates,sources)).toThrow('没有候选映射');
    expect(()=>acceptFeatureUnification({features,candidateMappings:[{...mapping,featureIds:['BAD']}]},candidates,sources)).toThrow('不存在的 ID');
  });
  it('拒绝漏掉候选来源以及从未映射候选借用来源',()=>{
    expect(()=>acceptFeatureUnification({features:[feature('F1',['S1'])],candidateMappings:[{candidateId:'C1',featureIds:['F1']}]},[feature('C1',['S1','S2'])],sources)).toThrow('遗漏候选来源');
    expect(()=>acceptFeatureUnification({features:[feature('F1',['S1','S2']),feature('F2',['S2'])],candidateMappings:[{candidateId:'C1',featureIds:['F1']},{candidateId:'C2',featureIds:['F2']}]},[feature('C1',['S1']),feature('C2',['S2'])],sources)).toThrow('映射候选之外');
  });
  it('待澄清事项不能伪装成功能，跨功能约束类型保留',()=>{
    expect(()=>acceptDirectFeatures([{...feature('F1',['S1']),kind:'clarification'}],sources)).toThrow('待澄清事项不能作为功能');
    expect(acceptDirectFeatures([{...feature('F1',['S1']),kind:'constraint'}],sources)[0].kind).toBe('constraint');
  });
  it('跨功能约束显式保留适用关系，缺省时不推断',()=>{
    const values=[feature('F1',['S1']),{...feature('C1',['S2']),kind:'constraint',appliesToFeatureIds:['F1']},{...feature('C2',['S3']),kind:'constraint'}];
    const result=acceptDirectFeatures(values,sources);expect(result[1].appliesToFeatureIds).toEqual(['F1']);expect(result[2].appliesToFeatureIds).toBeUndefined();
    const batch=acceptDirectFeatureBatch(values,sources.map(u=>({sourceUnitId:u.id,kind:'requirement',reason:'明确要求',featureIds:[]})),sources);expect(batch.features[1].appliesToFeatureIds).toEqual(['F1']);
  });
  it('适用关系拒绝不存在的功能、自引用及普通功能声明',()=>{
    expect(()=>acceptDirectFeatures([{...feature('C1',['S1']),kind:'constraint',appliesToFeatureIds:['BAD']}],sources)).toThrow('不存在的 ID');
    expect(()=>acceptDirectFeatures([{...feature('C1',['S1']),kind:'constraint',appliesToFeatureIds:['C1']}],sources)).toThrow('禁止自引用');
    expect(()=>acceptDirectFeatures([{...feature('F1',['S1']),appliesToFeatureIds:['F2']},feature('F2',['S2'])],sources)).toThrow('仅 constraint');
    expect(()=>graph([{...feature('F1',['S1'],['R1']),kind:'constraint',appliesToFeatureIds:['DELETED']}])).toThrow('不存在的 ID');
    expect(()=>graph([{...feature('F1',['S1'],['R1']),kind:'constraint',appliesToFeatureIds:['F1']}])).toThrow('禁止自引用');
  });
  it('统一输出的约束关系必须引用统一后的功能编号',()=>{
    const candidates=[feature('OLD',['S1']),{...feature('C',['S2']),kind:'constraint' as const}];
    const payload={features:[feature('NEW',['S1']),{...feature('NC',['S2']),kind:'constraint',appliesToFeatureIds:['OLD']}],candidateMappings:[{candidateId:'OLD',featureIds:['NEW']},{candidateId:'C',featureIds:['NC']}]};
    expect(()=>acceptFeatureUnification(payload,candidates,sources)).toThrow('不存在的 ID');payload.features[1].appliesToFeatureIds=['NEW'];expect(acceptFeatureUnification(payload,candidates,sources)[1].appliesToFeatureIds).toEqual(['NEW']);
  });
  it('拒绝全局重复编号、悬空引用、孤儿需求和多主归属',()=>{
    expect(()=>graph([feature('F1',['S1'],['R1'])],[requirement,{...requirement}])).toThrow('重复 ID');
    expect(()=>graph([feature('F1',['S1'],['BAD'])])).toThrow('不存在的 ID');
    expect(()=>graph([feature('F1',['S1'])])).toThrow('没有主所属功能');
    expect(()=>graph([feature('F1',['S1'],['R1']),feature('F2',['S1'],['R1'])])).toThrow('仅有一个主所属');
    expect(()=>graph([feature('R1',['S1'],['R1'])])).toThrow('重复 ID');
  });
  it('每个原文单元必须有且仅有合法处置',()=>{
    const features=[feature('F1',['S1'],['R1'])];
    expect(()=>graph(features,[requirement],[...dispositions,dispositions[0]])).toThrow('重复 ID');
    expect(()=>graph(features,[requirement],dispositions.slice(1))).toThrow('未分类原文单元');
    expect(()=>graph(features,[requirement],[...dispositions,{...dispositions[0],sourceUnitId:'BAD'}])).toThrow('不存在的 ID');
  });
  it('需求与待澄清来源都进入覆盖检查，澄清无需伪造功能',()=>{
    const ds=dispositions.map(item=>item.sourceUnitId==='S2'?{...item,kind:'clarification' as const}:item);
    const features=[feature('F1',['S1'],['R1'])];
    expect(graph(features,[requirement],ds).uncovered.map(item=>item.sourceUnitId)).toEqual(['S2']);
    expect(validateDirectGraph(sources,ds,features,[requirement],[{id:'Q1',question:'待确认',reason:'未明确',affectedIds:['S2'],state:'open'}]).uncovered).toEqual([]);
    expect(validateDirectGraph(sources,dispositions,features,[requirement],[{id:'Q1',question:'待确认',reason:'未明确',affectedIds:['R1'],state:'open'}]).uncovered).toEqual([]);
  });
  it('拒绝无原文依据的验收条件且不修改输入',()=>{
    const invalid={...requirement,explicitAcceptanceConditions:['缺少 X 时显示红色提示']};
    expect(()=>acceptDirectDetails([invalid],[],sources)).toThrow('不得推导或静默丢弃');
    expect(invalid.explicitAcceptanceConditions).toEqual(['缺少 X 时显示红色提示']);
    expect(acceptDirectDetails([{...requirement,explicitAcceptanceConditions:['字段 X 必填']}],[],sources).requirements[0].explicitAcceptanceConditions).toEqual(['字段 X 必填']);
  });
  it('将跨关联原文单元合并的验收条件无损拆回逐字片段',()=>{
    const first='基于当时的当前版本数据检查一次；无候选或检查失败时不展示合并提醒，进入原有生成版本确认弹窗',second='移除空格并忽略字母大小写；其他字符和符号按原值比较';
    const linked=[{...sources[0],excerpt:first},{...sources[1],excerpt:second}];
    const combined={...requirement,sourceUnitIds:['S1','S2'],explicitAcceptanceConditions:[`${first}；${second}`]};
    expect(acceptDirectDetails([combined],[],linked).requirements[0].explicitAcceptanceConditions).toEqual([first,second]);
    expect(()=>acceptDirectDetails([{...combined,explicitAcceptanceConditions:[`${first}；${second}。新增推导`]}],[],linked)).toThrow('不得推导或静默丢弃');
  });
  it('验收条件匹配移除空格并忽略字母大小写，但不忽略其他字符',()=>{
    const linked=[{...sources[0],excerpt:'合并后统一使用关联 ID；完成后询问是否生成版本。'}];
    expect(acceptDirectDetails([{...requirement,explicitAcceptanceConditions:['合并后统一使用关联 id']}],[],linked).requirements[0].explicitAcceptanceConditions).toEqual(['合并后统一使用关联 id']);
    expect(()=>acceptDirectDetails([{...requirement,explicitAcceptanceConditions:['合并后统一使用关联-ID']}],[],linked)).toThrow('不得推导或静默丢弃');
  });
});
