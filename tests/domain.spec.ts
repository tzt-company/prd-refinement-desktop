import { describe, expect, it } from 'vitest';
import { acceptAuditIssues, acceptDetails, acceptRules, validateGraph } from '../electron/domain';
import { selectRuleRepairBatch } from '../electron/audit-repair';
import type { Feature, RequirementDetail, RequirementRule, SourceUnit } from '../src/types';

const sources:SourceUnit[]=[{id:'S-001',label:'要求',kind:'paragraph',excerpt:'字段 X 必填',location:'第 1 行',status:'processed'}];
const rules:RequirementRule[]=[{id:'RL-0001',statement:'字段 X 必填',sourceUnitIds:['S-001'],conditions:[],kind:'data',status:'explicit'}];
const requirements:RequirementDetail[]=[{id:'R-0001',title:'校验 X',behavior:'提交时字段 X 必须有值',conditions:['提交时'],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:['S-001'],ruleIds:['RL-0001'],state:'reviewed'}];
const features:Feature[]=[{id:'F-001',name:'提交校验',goal:'阻止缺失必要数据',sourceUnitIds:['S-001'],ruleIds:['RL-0001'],requirementIds:['R-0001'],state:'reviewed'}];

describe('领域候选验收',()=>{
  it('规则定点返工只选择小型来源连通簇',()=>{
    const issue=(id:string,sources:string[])=>({id,direction:'forward',type:'遗漏',category:'rule-extraction' as const,sourceUnitIds:sources,affectedIds:['RL-0001'],detail:id});
    const batch=selectRuleRepairBatch([issue('wide',Array.from({length:13},(_,i)=>`S-${i}`)),issue('a',['S-1']),issue('b',['S-1','S-2']),issue('c',['S-9'])]);
    expect(batch.map(item=>item.id)).toEqual(['a','b']);
  });
  it('剔除模型根据必填规则自行推导的验收描述',()=>{
    const result=acceptDetails([{...requirements[0],explicitAcceptanceConditions:['X已填写时满足该必填规则；未填写时不满足。']}],[],rules,sources);
    expect(result.requirements[0].explicitAcceptanceConditions).toEqual([]);
  });
  it('待确认规则不得伪装成确定需求，模型也不得自动标记问题已解决',()=>{
    const downgraded=acceptDetails(requirements,[],[{...rules[0],status:'unknown'}],sources);
    expect(downgraded.requirements).toEqual([]);expect(downgraded.clarifications[0].affectedIds).toEqual(['RL-0001']);
    expect(()=>acceptDetails(requirements,[{id:'q',question:'?',reason:'?',affectedIds:['R-0001'],state:'resolved'}],rules,sources)).toThrow('不得自动解决');
  });
  it('拒绝不存在的来源引用',()=>expect(()=>acceptRules([{...rules[0],id:'LOCAL',sourceUnitIds:['S-404']}],sources)).toThrow('不存在的 ID'));
  it('接受不生成测试场景的需求并保留原文验收条件',()=>{const result=acceptDetails([{...requirements[0],id:'LOCAL-R',explicitAcceptanceConditions:['提交后显示错误']}],[{id:'LOCAL-Q',question:'错误文案是什么？',reason:'原文未说明',affectedIds:['LOCAL-R'],state:'open'}],rules,[{...sources[0],excerpt:'字段 X 必填。验收条件：提交后显示错误'}]);expect(result.requirements[0].explicitAcceptanceConditions).toEqual(['提交后显示错误']);expect(result.clarifications[0].affectedIds).toEqual(['LOCAL-R'])});
  it('拒绝悬空问题引用',()=>expect(()=>validateGraph(sources,rules,features,requirements,[{id:'Q-001',question:'?',reason:'?',affectedIds:['TEMP-404'],state:'open'}])).toThrow('不存在的 ID'));
  it('有明确内容但规则为空时不允许通过',()=>expect(()=>validateGraph(sources,[],[],[],[])).toThrow('规则提取为空'));
  it('unknown 规则进入待澄清而不强制生成实现内容',()=>{const unknown:RequirementRule={...rules[0],id:'RL-0002',statement:'域名取值未明确',status:'unknown',kind:'unknown'};const graph=validateGraph(sources,[...rules,unknown],[{...features[0],ruleIds:['RL-0001','RL-0002']}],requirements,[]);expect(graph.unimplemented).toEqual([]);expect(graph.unknown).toEqual([unknown])});
  it('拒绝审计结果中的悬空来源和影响对象',()=>expect(()=>acceptAuditIssues([{id:'LOCAL-A',direction:'forward',type:'遗漏',sourceUnitIds:['S-404'],affectedIds:['R-404'],detail:'缺少规则'}],sources,rules,features,requirements,[])).toThrow('不存在的 ID'));
});
