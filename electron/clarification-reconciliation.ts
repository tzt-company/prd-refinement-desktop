import type { Clarification, ClarificationAction, PrdProject, SourceUnit } from '../src/types.js';
import { assertPromptBudget, type PromptMeasurement } from './prompt-budget.js';

type Requirements = PrdProject['requirements'];
interface Context {
  project: PrdProject;
  instruction: string;
  units(ids: Iterable<string>): SourceUnit[];
  measure(title: string, instruction: string, input: unknown): PromptMeasurement;
  ask(title: string, purpose: string, instruction: string, input: unknown, accept: (value: Record<string, unknown>) => ClarificationAction[]): Promise<ClarificationAction[]>;
  accept(value: unknown, questions: Clarification[], requirements: Requirements, units: SourceUnit[]): ClarificationAction[];
  apply(actions: ClarificationAction[]): void;
  parallel<T, R>(items: T[], work: (item: T) => Promise<R>): Promise<R[]>;
}

const title = '待澄清事项全局有效性与一致性检查';
const describe = ({id,question,reason,knownFacts,unresolvedPoint,impact,level,levelReason,defaultResolution,affectedIds,sourceRefs}: Clarification) =>
  ({id,question,reason,knownFacts,unresolvedPoint,impact,level,levelReason,defaultResolution,affectedIds,sourceUnitIds:[...new Set(sourceRefs?.map(ref=>ref.sourceUnitId)??[])]});
const keep = (question: Clarification, reason: string): ClarificationAction => ({action:'keep',clarificationIds:[question.id],reason,satisfiedRequirementIds:[]});

/** 业务文本不截断；仅在完整问题、需求、来源之间拆分。调用与检查点由调度器负责。 */
export async function reconcileClarifications(context: Context) {
  const {project,instruction} = context;
  let leafCount = 0;
  const scope = (questions: Clarification[]) => {
    const ids = new Set(questions.flatMap(question=>[...(question.sourceRefs??[]).map(ref=>ref.sourceUnitId),...question.affectedIds.filter(id=>id.startsWith('S-'))]));
    const requirements = project.requirements.filter(requirement=>questions.some(question=>question.affectedIds.includes(requirement.id))||requirement.sourceUnitIds.some(id=>ids.has(id)));
    return {requirements,units:context.units([...ids,...requirements.flatMap(requirement=>requirement.sourceUnitIds)])};
  };
  const inspect = async (questions: Clarification[], requirements: Requirements, units: SourceUnit[], shard = false) => {
    leafCount++;
    const contract = shard ? instruction+' 本次只提供该问题的一部分证据。仅当本片足以完整回答原问题时才可 remove-answered；缺少答案或存在冲突应 keep 并写出具体事实，不能把未提供的证据判为不存在。' : instruction;
    return context.ask(title,'clarification-reconciliation',contract,{sourceUnits:units,requirements,clarifications:questions},value=>context.accept(value.actions,questions,requirements,units));
  };
  const shardInstruction = instruction+' 本次只提供该问题的一部分证据。仅当本片足以完整回答原问题时才可 remove-answered；缺少答案或存在冲突应 keep 并写出具体事实，不能把未提供的证据判为不存在。';
  const inspectOne = async (question: Clarification, requirements: Requirements, units: SourceUnit[]) => {
    const referenced = new Set(requirements.flatMap(requirement=>requirement.sourceUnitIds));
    const atoms = [...requirements.map(requirement=>({requirements:[requirement],units:context.units(requirement.sourceUnitIds)})),...units.filter(unit=>!referenced.has(unit.id)).map(unit=>({requirements:[] as Requirements,units:[unit]}))];
    const merge = (parts: typeof atoms) => ({requirements:parts.flatMap(part=>part.requirements),units:[...new Map(parts.flatMap(part=>part.units).map(unit=>[unit.id,unit])).values()]});
    const measure = (parts: typeof atoms) => context.measure(title,shardInstruction,{sourceUnits:merge(parts).units,requirements:merge(parts).requirements,clarifications:[question]});
    const packs: typeof atoms[] = []; let current: typeof atoms = [];
    for(const atom of atoms){const candidate=[...current,atom],size=measure(candidate);if(current.length&&size.estimatedTokens>size.targetTokens){packs.push(current);current=[]}current.push(atom);assertPromptBudget(measure(current))}
    if(current.length)packs.push(current);
    if(!packs.length){assertPromptBudget(context.measure(title,instruction,{sourceUnits:units,requirements,clarifications:[question]}));return inspect([question],requirements,units)}
    const decisions=(await context.parallel(packs,async pack=>{const part=merge(pack);return inspect([question],part.requirements,part.units,true)})).flat();
    if(decisions.every(decision=>decision.action==='keep'))return [keep(question,'全部证据分片均未得到唯一答案，保留业务确认。')];
    if(decisions.length===1)return decisions;
    // 所有分片理由必须一起参与裁决；不以票数或任一片的删除建议覆盖其他片的冲突。
    const contract='同一个澄清的全部证据分片已检查，逐项核对 evidenceDecisions。选中候选前必须解释其他分片的缺证或冲突；存在未消除的矛盾或信息不足时选 keep。不能把多个无结论分片拼成确定答案。只允许选择已校验候选，不得重写问题或伪造证据。输出 {"selectedIndex":0,"reason":"综合全部分片的理由"}，selectedIndex=-1 表示保留原问题。';
    const input={clarification:describe(question),evidenceDecisions:decisions.map((decision,index)=>({index,action:decision.action,reason:decision.reason,satisfiedRequirementIds:decision.satisfiedRequirementIds,revisedClarification:decision.revisedClarification?describe(decision.revisedClarification):undefined}))};
    assertPromptBudget(context.measure('待澄清事项证据分片汇总',contract,input));
    return context.ask('待澄清事项证据分片汇总','clarification-evidence-summary',contract,input,value=>{
      const index=value.selectedIndex;
      if(typeof index!=='number'||!Number.isInteger(index)||index < -1||index>=decisions.length||typeof value.reason!=='string'||!value.reason.trim())throw new Error('澄清分片汇总必须选择有效候选并说明综合依据');
      return [index===-1?keep(question,value.reason):{...decisions[index],reason:value.reason}];
    });
  };
  const inspectGroup = async (questions: Clarification[]): Promise<ClarificationAction[]> => {
    const {requirements,units}=scope(questions),size=context.measure(title,instruction,{sourceUnits:units,requirements,clarifications:questions});
    if(size.estimatedTokens<=size.targetTokens)return inspect(questions,requirements,units);
    if(questions.length===1)return inspectOne(questions[0],requirements,units);
    const middle=Math.ceil(questions.length/2);
    return (await context.parallel([questions.slice(0,middle),questions.slice(middle)],inspectGroup)).flat();
  };
  const open=project.clarifications.filter(question=>question.state==='open');
  if(!open.length)return;
  context.apply(await inspectGroup(open));
  const remaining=project.clarifications.filter(question=>question.state==='open');
  if(leafCount===1||remaining.length<2)return;

  const contract='跨批检查待澄清事项是否要求用户作同一个业务决定。完整问题、已知事实、未决点、影响与来源身份均已提供。只有业务对象、触发条件、待决定规则一致时才 merge；同名字段、相同问法、不同业务对象不能合并；依据不足应 keep。仅输出 {"actions":[{"action":"merge|keep|keep-distinct","clarificationIds":["输入ID"],"reason":"具体业务依据"}]}，每个输入问题必须恰好出现一次。不得删除已回答项、改级别或重写问题。';
  const globalTitle='待澄清事项跨批一致性检查';
  const inputFor=(questions: Clarification[])=>({clarifications:questions.map(describe)});
  const groups: Clarification[][]=[];let current: Clarification[]=[];
  for(const question of remaining){const candidate=[...current,question],size=context.measure(globalTitle,contract,inputFor(candidate));if(current.length&&size.estimatedTokens>size.targetTokens/2){groups.push(current);current=[]}current.push(question);assertPromptBudget(context.measure(globalTitle,contract,inputFor(current)))}
  if(current.length)groups.push(current);
  const parents=new Map(remaining.map(question=>[question.id,question.id])),distinct:Array<[string,string]>=[];
  const root=(id:string):string=>{const parent=parents.get(id)!;if(parent===id)return id;const result=root(parent);parents.set(id,result);return result};
  const compare=async(questions: Clarification[])=>{
    const input=inputFor(questions);assertPromptBudget(context.measure(globalTitle,contract,input));
    const actions=await context.ask(globalTitle,'clarification-cross-batch',contract,input,value=>{
      const accepted=context.accept(value.actions,questions,[],[]);
      if(accepted.some(action=>!['merge','keep','keep-distinct'].includes(action.action)))throw new Error('跨批一致性检查只允许合并或保留');
      return accepted;
    });
    const membership=new Map<string,number>();
    for(const [index,action] of actions.entries())for(const id of action.clarificationIds)membership.set(id,action.action==='merge'?index:-1);
    for(let left=0;left<questions.length;left++)for(let right=left+1;right<questions.length;right++){
      const a=questions[left].id,b=questions[right].id;
      if(membership.get(a)!>=0&&membership.get(a)===membership.get(b))parents.set(root(b),root(a));else distinct.push([a,b]);
    }
  };
  const comparisons: Clarification[][]=[];
  if(groups.length===1)comparisons.push(groups[0]);
  else for(let left=0;left<groups.length;left++)for(let right=left+1;right<groups.length;right++)comparisons.push([...groups[left],...groups[right]]);
  await context.parallel(comparisons,compare);
  if(distinct.some(([a,b])=>root(a)===root(b)))throw new Error('跨批澄清合并与保持独立的判定互相矛盾，尚未通过一致性检查');
  const components=new Map<string,string[]>();for(const question of remaining){const key=root(question.id),ids=components.get(key)??[];ids.push(question.id);components.set(key,ids)}
  context.apply([...components.values()].filter(ids=>ids.length>1).map(ids=>({action:'merge',clarificationIds:ids,reason:'跨批一致性检查确认属于同一个业务决定',satisfiedRequirementIds:[]})));
}
