import {describe,expect,it} from 'vitest';
import {checksPass,closeIssue,contentFingerprint,projectDependencyHash,registerAuditIssues,requiredChecks} from '../electron/task-execution-state';
import type {AuditIssue,PrdProject} from '../src/types';

const project=():PrdProject=>({id:'P',name:'P',sourceName:'p.md',sourceHash:'input',revision:1,importedAt:'now',rawText:'字段 X 必填',stage:'review',sourceUnits:[{id:'S-001',label:'x',kind:'paragraph',excerpt:'字段 X 必填',location:'1',status:'processed'}],features:[{id:'F-001',name:'字段',sourceUnitIds:['S-001'],ruleIds:[],requirementIds:['R-0001'],state:'reviewed'}],requirements:[{id:'R-0001',title:'字段',behavior:'字段 X 必填',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:['S-001'],ruleIds:[],state:'reviewed'}],clarifications:[]});
const issue=(detail='字段约束遗漏'):AuditIssue=>({id:'LOCAL',direction:'reverse',type:'约束遗漏',category:'detail-mismatch',owner:'requirement-detail',sourceUnitIds:['S-001'],affectedIds:['R-0001'],detail,disposition:'open'});

describe('pipeline 10 任务状态内核',()=>{
  it('审计顺序和说明文字变化不改变问题身份或已关闭状态',()=>{const p=project(),registry:AuditIssue[]=[];registerAuditIssues(registry,[issue()],p);const id=registry[0].id;closeIssue(registry[0],'repaired');registerAuditIssues(registry,[{...issue('换一种表述'),id:'OTHER'}],p);expect(registry).toHaveLength(1);expect(registry[0]).toMatchObject({id,disposition:'repaired'})});
  it('无关实体变化不使问题依赖失效，相关实体变化会失效',()=>{const p=project(),base=projectDependencyHash(p,['R-0001'],['S-001'],true);p.features.push({id:'F-OTHER',name:'其他',sourceUnitIds:[],ruleIds:[],requirementIds:[],state:'reviewed'});expect(projectDependencyHash(p,['R-0001'],['S-001'],true)).toBe(base);p.requirements[0].behavior='字段 X 可空';expect(projectDependencyHash(p,['R-0001'],['S-001'],true)).not.toBe(base)});
  it('最终准入要求五类检查对同一结果版本全部通过',()=>{const p=project(),ledger=requiredChecks(p,3);expect(checksPass(ledger,3)).toBe(false);for(const item of Object.values(ledger))item.status='passed';expect(checksPass(ledger,3)).toBe(true);expect(checksPass(ledger,4)).toBe(false)});
  it('内容指纹覆盖需求、关系、澄清和来源处置',()=>{const p=project(),before=contentFingerprint(p);p.clarifications.push({id:'Q-1',question:'是否允许为空？',reason:'未明确',affectedIds:['R-0001'],state:'open'});expect(contentFingerprint(p)).not.toBe(before)});
});
