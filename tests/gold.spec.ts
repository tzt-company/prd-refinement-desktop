import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { evaluateGold } from '../scripts/gold-evaluation.mjs';
const source='X 必填，提交时检查';
const gold={sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),cases:[{id:'G1',category:'校验',title:'X提交校验',target:'requirements',source:{line:1,quote:source},facets:[['X'],['必填'],['提交']]}]};
const project=(requirements:any[])=>({requirements:requirements.map(r=>({...r,sourceUnitIds:['S1']})),clarifications:[],sourceUnits:[{id:'S1',excerpt:source}]});
describe('独立gold保真检查',()=>{
 it('完整单条命中',()=>expect(evaluateGold(gold,source,project([{id:'R1',behavior:source}])).matched).toBe(1));
 it('删除关键条件不能命中',()=>expect(evaluateGold(gold,source,project([{id:'R1',behavior:'X 必填'}])).matched).toBe(0));
 it('不拼接不同明细凑齐条件',()=>expect(evaluateGold(gold,source,project([{id:'R1',behavior:'X 必填'},{id:'R2',behavior:'提交'}])).matched).toBe(0));
 it('原文引用与规则账本不能代替明细',()=>expect(evaluateGold(gold,source,{...project([]),rawText:source,rules:[{statement:source}]}).matched).toBe(0));
 it('原文变化拒绝旧gold',()=>expect(()=>evaluateGold(gold,source+'!',project([]))).toThrow('指纹'));
 it('错误来源行拒绝',()=>expect(()=>evaluateGold({...gold,cases:[{...gold.cases[0],source:{line:2,quote:source}}]},source,project([]))).toThrow('来源定位'));
 it('缺产物拒绝而不返回虚假零分',()=>expect(()=>evaluateGold(gold,source,{})).toThrow('待测产物'));
 it('明确呈现词面局限，否定文本亦可能命中',()=>{const r=evaluateGold(gold,source,project([{id:'R1',behavior:'提交时X不必填'}]));expect(r.matched).toBe(1);expect(r.limitations.join()).toContain('误报')});
 it('待确认事项直接引用匹配原文时参与词面检查',()=>{
   const questionGold={...gold,cases:[{...gold.cases[0],target:'clarifications'}]};
   const result=evaluateGold(questionGold,source,{...project([]),clarifications:[{id:'Q1',question:source,reason:'待确认',affectedIds:['S1']}]});
   expect(result.matched).toBe(1);expect(result.results[0].matchedRecordId).toBe('Q1');expect(result.evaluatorVersion).toBe(2);expect(result.limitations.join()).toContain('历史分数不可直接比较');
 });
 it('直接引用错误原文不能凭相同词面命中，缺失facet也不能通过',()=>{
   const questionGold={...gold,cases:[{...gold.cases[0],target:'clarifications'}]};
   const wrong={...project([]),sourceUnits:[...project([]).sourceUnits,{id:'S2',excerpt:'无关来源'}],clarifications:[{id:'Q1',question:source,reason:'待确认',affectedIds:['S2']}]};
   expect(evaluateGold(questionGold,source,wrong).matched).toBe(0);
   expect(evaluateGold(questionGold,source,{...project([]),clarifications:[{id:'Q1',question:'X必填',reason:'待确认',affectedIds:['S1']}]}).matched).toBe(0);
 });
 it('原有待确认事项经需求引用原文仍可命中',()=>{
   const questionGold={...gold,cases:[{...gold.cases[0],target:'clarifications'}]};
   expect(evaluateGold(questionGold,source,{...project([{id:'R1',behavior:source}]),clarifications:[{id:'Q1',question:source,reason:'待确认',affectedIds:['R1']}]}).matched).toBe(1);
 });
});
