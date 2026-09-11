import { auditCategories } from './audit-repair.js';
import type { Clarification, Feature, RequirementDetail, RequirementRule, SourceDisposition, SourceUnit } from '../src/types.js';

const ruleKinds = new Set(['behavior','condition','constraint','exception','data','permission','nonfunctional','state','validation','migration','dependency','unknown']);
const reviewStates = new Set(['draft','needs-clarification','reviewed']);
const text = (value: unknown, path: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} 必须是非空文本`);
  return value.trim();
};
const strings = (value: unknown, path: string, allowEmpty = true) => {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim()) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${path} 必须是${allowEmpty ? '' : '非空'}文本数组`);
  }
  return value.map(item => item.trim());
};
const uniqueIds = (items: Array<{id:string}>, path: string) => {
  const seen = new Set<string>();
  for (const item of items) { if (seen.has(item.id)) throw new Error(`${path} 存在重复 ID：${item.id}`); seen.add(item.id); }
};
const refs = (ids: string[], known: Set<string>, path: string) => {
  const missing = ids.filter(id => !known.has(id));
  if (missing.length) throw new Error(`${path} 引用了不存在的 ID：${missing.join('、')}`);
};

export function acceptRules(value: unknown, sourceUnits: SourceUnit[]) {
  if (!Array.isArray(value)) throw new Error('rules 必须是数组');
  const sourceIds = new Set(sourceUnits.map(unit => unit.id));
  const rules = value.map((raw, index) => {
    const item = raw as Record<string,unknown>, kind = text(item.kind, `rules[${index}].kind`), status = text(item.status, `rules[${index}].status`);
    if (!ruleKinds.has(kind)) throw new Error(`rules[${index}].kind 非法：${kind}`);
    if (status !== 'explicit' && status !== 'unknown') throw new Error(`rules[${index}].status 非法`);
    if (kind === 'unknown' && status !== 'unknown') throw new Error(`rules[${index}] 只有 status=unknown 时才允许 kind=unknown`);
    const rule: RequirementRule = { id:text(item.id,`rules[${index}].id`), statement:text(item.statement,`rules[${index}].statement`), sourceUnitIds:strings(item.sourceUnitIds,`rules[${index}].sourceUnitIds`,false), conditions:strings(item.conditions,`rules[${index}].conditions`), kind:kind as RequirementRule['kind'], status:status as RequirementRule['status'] };
    refs(rule.sourceUnitIds, sourceIds, `rules[${index}].sourceUnitIds`);
    return rule;
  });
  uniqueIds(rules, 'rules');
  return rules;
}

export function acceptFeatures(value: unknown, rules: RequirementRule[], sourceUnits: SourceUnit[]) {
  if (!Array.isArray(value)) throw new Error('features 必须是数组');
  const ruleIds = new Set(rules.map(rule => rule.id)), sourceIds = new Set(sourceUnits.map(unit => unit.id));
  const features = value.map((raw,index) => {
    const item=raw as Record<string,unknown>, state=text(item.state,`features[${index}].state`);
    if(!reviewStates.has(state))throw new Error(`features[${index}].state 非法`);
    const feature:Feature={id:text(item.id,`features[${index}].id`),name:text(item.name,`features[${index}].name`),goal:text(item.goal,`features[${index}].goal`),sourceUnitIds:strings(item.sourceUnitIds,`features[${index}].sourceUnitIds`,false),ruleIds:strings(item.ruleIds,`features[${index}].ruleIds`,false),requirementIds:[],state:state as Feature['state']};
    refs(feature.ruleIds,ruleIds,`features[${index}].ruleIds`);refs(feature.sourceUnitIds,sourceIds,`features[${index}].sourceUnitIds`);return feature;
  });
  uniqueIds(features,'features'); return features;
}

export function acceptDetails(requirementsValue: unknown, questionsValue: unknown, rules: RequirementRule[], sourceUnits: SourceUnit[]) {
  if(!Array.isArray(requirementsValue)||!Array.isArray(questionsValue))throw new Error('需求细化必须同时返回 requirements 与 clarifications 数组');
  const ruleIds=new Set(rules.map(rule=>rule.id)),sourceIds=new Set(sourceUnits.map(unit=>unit.id));
  const parsedRequirements=requirementsValue.map((raw,index)=>{const item=raw as Record<string,unknown>,state=text(item.state,`requirements[${index}].state`);if(!reviewStates.has(state))throw new Error(`requirements[${index}].state 非法`);const requirement:RequirementDetail={id:text(item.id,`requirements[${index}].id`),title:text(item.title,`requirements[${index}].title`),behavior:text(item.behavior,`requirements[${index}].behavior`),conditions:strings(item.conditions,`requirements[${index}].conditions`),constraints:strings(item.constraints,`requirements[${index}].constraints`),explicitAcceptanceConditions:strings(item.explicitAcceptanceConditions,`requirements[${index}].explicitAcceptanceConditions`),sourceUnitIds:strings(item.sourceUnitIds,`requirements[${index}].sourceUnitIds`,false),ruleIds:strings(item.ruleIds,`requirements[${index}].ruleIds`,false),state:state as RequirementDetail['state']};refs(requirement.ruleIds,ruleIds,`requirements[${index}].ruleIds`);refs(requirement.sourceUnitIds,sourceIds,`requirements[${index}].sourceUnitIds`);return requirement});
  uniqueIds(parsedRequirements,'requirements');
  const downgraded=new Map(parsedRequirements.filter(requirement=>!rules.some(rule=>requirement.ruleIds.includes(rule.id)&&rule.status==='explicit')).map(requirement=>[requirement.id,requirement]));
  const requirements=parsedRequirements.filter(requirement=>!downgraded.has(requirement.id));
  const normalize=(value:string)=>value.replace(/\s/g,'').toLocaleLowerCase('en-US');
  for(const requirement of requirements){
    const originals=sourceUnits.filter(unit=>requirement.sourceUnitIds.includes(unit.id)).map(unit=>normalize([unit.excerpt,unit.context??'',unit.asset?.extractedText??''].join('\n')));
    requirement.explicitAcceptanceConditions=requirement.explicitAcceptanceConditions.filter(condition=>originals.some(original=>original.includes(normalize(condition))));
  }
  const localIds=new Set(parsedRequirements.map(item=>item.id));
  const clarifications=questionsValue.map((raw,index)=>{const item=raw as Record<string,unknown>,state=text(item.state,`clarifications[${index}].state`);if(state!=='open')throw new Error(`clarifications[${index}] 模型不得自动解决待确认事项`);const affected=strings(item.affectedIds,`clarifications[${index}].affectedIds`,false);refs(affected,new Set([...ruleIds,...localIds]),`clarifications[${index}].affectedIds`);const affectedIds=Array.from(new Set(affected.flatMap(id=>downgraded.get(id)?.ruleIds??[id])));const question:Clarification={id:text(item.id,`clarifications[${index}].id`),question:text(item.question,`clarifications[${index}].question`),reason:text(item.reason,`clarifications[${index}].reason`),affectedIds,state:state as Clarification['state']};return question});
  for(const requirement of downgraded.values())if(!clarifications.some(question=>question.affectedIds.some(id=>requirement.ruleIds.includes(id))))clarifications.push({id:`AUTO-Q-${requirement.id}`,question:`请确认“${requirement.title}”的具体业务要求。`,reason:`模型将待确认规则整理为确定需求，平台已降级；原描述：${requirement.behavior}`,affectedIds:requirement.ruleIds,state:'open'});
  uniqueIds(clarifications,'clarifications');return{requirements,clarifications};
}

export function validateGraph(sourceUnits:SourceUnit[],rules:RequirementRule[],features:Feature[],requirements:RequirementDetail[],clarifications:Clarification[]){
  if(sourceUnits.some(unit=>unit.status!=='processed'))throw new Error('仍有未读取的原文单元');
  if(sourceUnits.some(unit=>unit.excerpt.trim())&&rules.length===0)throw new Error('原文包含内容但规则提取为空');
  const sourceIds=new Set(sourceUnits.map(x=>x.id)),ruleIds=new Set(rules.map(x=>x.id)),requirementIds=new Set(requirements.map(x=>x.id));
  for(const rule of rules)refs(rule.sourceUnitIds,sourceIds,`${rule.id}.sourceUnitIds`);
  for(const feature of features){refs(feature.ruleIds,ruleIds,`${feature.id}.ruleIds`);refs(feature.requirementIds,requirementIds,`${feature.id}.requirementIds`)}
  for(const requirement of requirements){refs(requirement.ruleIds,ruleIds,`${requirement.id}.ruleIds`);refs(requirement.sourceUnitIds,sourceIds,`${requirement.id}.sourceUnitIds`)}
  for(const question of clarifications)refs(question.affectedIds,new Set([...ruleIds,...requirementIds]),`${question.id}.affectedIds`);
  const assigned=new Set(features.flatMap(feature=>feature.ruleIds));const implemented=new Set(requirements.flatMap(requirement=>requirement.ruleIds));
  return{unassigned:rules.filter(rule=>!assigned.has(rule.id)),unimplemented:rules.filter(rule=>rule.status==='explicit'&&!implemented.has(rule.id)),unknown:rules.filter(rule=>rule.status==='unknown')};
}

export function acceptAuditIssues(value:unknown,sourceUnits:SourceUnit[],rules:RequirementRule[],features:Feature[],requirements:RequirementDetail[],clarifications:Clarification[]){
  if(!Array.isArray(value))throw new Error('issues 必须是数组');
  const sourceIds=new Set(sourceUnits.map(item=>item.id)),affectedIds=new Set([...sourceUnits,...rules,...features,...requirements,...clarifications].map(item=>item.id));
  const issues=value.map((raw,index)=>{const item=raw as Record<string,unknown>,direction=text(item.direction,`issues[${index}].direction`);if(!['forward','reverse','cross'].includes(direction))throw new Error(`issues[${index}].direction 非法`);const sourceUnitIds=strings(item.sourceUnitIds,`issues[${index}].sourceUnitIds`,false),affected=strings(item.affectedIds,`issues[${index}].affectedIds`,false);refs(sourceUnitIds,sourceIds,`issues[${index}].sourceUnitIds`);refs(affected,affectedIds,`issues[${index}].affectedIds`);if(item.category!==undefined&&!auditCategories.has(item.category as never))throw new Error('审计问题分类非法');return{category:item.category as import('../src/types.js').AuditCategory|undefined,id:text(item.id,`issues[${index}].id`),direction,type:text(item.type,`issues[${index}].type`),sourceUnitIds,affectedIds:affected,detail:text(item.detail,`issues[${index}].detail`)}});uniqueIds(issues,'issues');return issues;
}

const dispositionKinds=new Set(['requirement','clarification','context','example','summary','out-of-scope']);
const featureKind=(value:unknown):Feature['kind']=>{if(value===undefined)return 'function';if(value!=='function'&&value!=='constraint')throw new Error('功能 kind 仅允许 function 或 constraint，待澄清事项不能作为功能');return value};
function acceptConstraintTargets(features:Feature[],rawFeatures:unknown[]){
  const known=new Set(features.map(item=>item.id));
  features.forEach((feature,index)=>{
    const raw=rawFeatures[index] as Record<string,unknown>;
    if(raw.appliesToFeatureIds===undefined)return;
    const ids=strings(raw.appliesToFeatureIds,`${feature.id}.appliesToFeatureIds`);
    if(new Set(ids).size!==ids.length)throw new Error(`${feature.id}.appliesToFeatureIds 存在重复目标`);
    refs(ids,known,`${feature.id}.appliesToFeatureIds`);
    if(ids.includes(feature.id))throw new Error(`${feature.id}.appliesToFeatureIds 禁止自引用`);
    if(feature.kind!=='constraint'&&ids.length)throw new Error(`${feature.id} 仅 constraint 可声明适用功能`);
    feature.appliesToFeatureIds=ids;
  });
}

export function acceptDirectFeatureBatch(featuresValue:unknown,dispositionsValue:unknown,sourceUnits:SourceUnit[]){
  if(!Array.isArray(featuresValue)||!Array.isArray(dispositionsValue))throw new Error('功能识别必须同时返回 features 与 sourceDispositions 数组');
  const sourceIds=new Set(sourceUnits.map(unit=>unit.id));
  const features=featuresValue.map((raw,index)=>{const item=raw as Record<string,unknown>,state=text(item.state,`features[${index}].state`);if(!reviewStates.has(state))throw new Error(`features[${index}].state 非法`);const feature:Feature={id:text(item.id,`features[${index}].id`),name:text(item.name,`features[${index}].name`),goal:text(item.goal,`features[${index}].goal`),sourceUnitIds:strings(item.sourceUnitIds,`features[${index}].sourceUnitIds`,false),ruleIds:[],requirementIds:[],kind:featureKind(item.kind),state:state as Feature['state']};refs(feature.sourceUnitIds,sourceIds,`features[${index}].sourceUnitIds`);return feature});
  uniqueIds(features,'features');acceptConstraintTargets(features,featuresValue);const featureIds=new Set(features.map(feature=>feature.id));
  const dispositions=dispositionsValue.map((raw,index)=>{const item=raw as Record<string,unknown>,kind=text(item.kind,`sourceDispositions[${index}].kind`);if(!dispositionKinds.has(kind))throw new Error(`sourceDispositions[${index}].kind 非法：${kind.slice(0,80)}；允许：${[...dispositionKinds].join("、")}`);const disposition:SourceDisposition={sourceUnitId:text(item.sourceUnitId,`sourceDispositions[${index}].sourceUnitId`),kind:kind as SourceDisposition['kind'],reason:text(item.reason,`sourceDispositions[${index}].reason`),featureIds:strings(item.featureIds,`sourceDispositions[${index}].featureIds`)};refs([disposition.sourceUnitId],sourceIds,`sourceDispositions[${index}].sourceUnitId`);refs(disposition.featureIds,featureIds,`sourceDispositions[${index}].featureIds`);return disposition});
  const seen=new Set(dispositions.map(item=>item.sourceUnitId)),missing=sourceUnits.filter(unit=>!seen.has(unit.id));if(seen.size!==dispositions.length)throw new Error('sourceDispositions 存在重复来源');if(missing.length)throw new Error(`sourceDispositions 遗漏 ${missing.map(unit=>unit.id).join('、')}`);
  return{features,dispositions};
}

export function acceptDirectFeatures(value:unknown,sourceUnits:SourceUnit[]){
  if(!Array.isArray(value))throw new Error('features 必须是数组');const sourceIds=new Set(sourceUnits.map(unit=>unit.id));
  const features=value.map((raw,index)=>{const item=raw as Record<string,unknown>,state=text(item.state,`features[${index}].state`);if(!reviewStates.has(state))throw new Error(`features[${index}].state 非法`);const feature:Feature={id:text(item.id,`features[${index}].id`),name:text(item.name,`features[${index}].name`),goal:text(item.goal,`features[${index}].goal`),sourceUnitIds:strings(item.sourceUnitIds,`features[${index}].sourceUnitIds`,false),ruleIds:[],requirementIds:[],kind:featureKind(item.kind),state:state as Feature['state']};refs(feature.sourceUnitIds,sourceIds,`features[${index}].sourceUnitIds`);return feature});uniqueIds(features,'features');acceptConstraintTargets(features,value);return features;
}

/** 统一节点仅报告分类错误，由控制器返回候选识别，不在此删除原文。 */
export function acceptCandidateClassificationIssues(value:unknown,candidates:Feature[],sourceUnits:SourceUnit[]){
  if(!Array.isArray(value))throw new Error('classificationIssues 必须是数组');
  const candidateById=new Map(candidates.map(item=>[item.id,item])),sourceIds=new Set(sourceUnits.map(item=>item.id));
  return value.map((raw,index)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error(`classificationIssues[${index}] 必须是对象`);
    const item=raw as Record<string,unknown>,candidateIds=strings(item.candidateIds,`classificationIssues[${index}].candidateIds`,false),sourceUnitIds=strings(item.sourceUnitIds,`classificationIssues[${index}].sourceUnitIds`,false),detail=text(item.detail,`classificationIssues[${index}].detail`);
    refs(candidateIds,new Set(candidateById.keys()),`classificationIssues[${index}].candidateIds`);refs(sourceUnitIds,sourceIds,`classificationIssues[${index}].sourceUnitIds`);
    const candidateSources=new Set(candidateIds.flatMap(id=>candidateById.get(id)!.sourceUnitIds));
    if(sourceUnitIds.some(id=>!candidateSources.has(id)))throw new Error(`classificationIssues[${index}] 来源超出所列候选范围`);
    return{candidateIds,sourceUnitIds,detail};
  });
}

/** 统一节点只能通过显式候选映射合并或拆分，来源不能按相似度补回。 */
export function acceptFeatureUnification(value:unknown,candidates:Feature[],sourceUnits:SourceUnit[]):Feature[]{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('功能统一必须返回 features 与 candidateMappings');
  const payload=value as Record<string,unknown>;
  if(!Array.isArray(payload.features))throw new Error('features 必须是数组');
  if(!Array.isArray(payload.candidateMappings))throw new Error('candidateMappings 必须是数组');
  uniqueIds(candidates,'candidates');
  const omitted=payload.features.map(raw=>!!raw&&typeof raw==='object'&&!Object.prototype.hasOwnProperty.call(raw,'sourceUnitIds'));
  if(omitted.some(Boolean)&&!omitted.every(Boolean))throw new Error('features 不允许混用省略来源与显式来源');
  let featureValues=payload.features;
  if(omitted.length&&omitted.every(Boolean)){
    const candidateMap=new Map(candidates.map(item=>[item.id,item])),compiled=new Map<string,Set<string>>();
    for(const raw of featureValues){const item=raw as Record<string,unknown>,id=text(item.id,'features.id');if(compiled.has(id))throw new Error(`features 存在重复 ID：${id}`);compiled.set(id,new Set())}
    for(const raw of payload.candidateMappings){
      if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('candidateMappings 必须包含对象');
      const item=raw as Record<string,unknown>,candidateId=text(item.candidateId,'candidateMappings.candidateId'),targets=strings(item.featureIds,'candidateMappings.featureIds',false);
      refs([candidateId],new Set(candidateMap.keys()),'candidateMappings.candidateId');refs(targets,new Set(compiled.keys()),'candidateMappings.featureIds');
      const candidate=candidateMap.get(candidateId)!;
      if(targets.length===1){candidate.sourceUnitIds.forEach(id=>compiled.get(targets[0])!.add(id));continue}
      const allocation=item.sourceUnitIdsByFeature;
      if(!allocation||typeof allocation!=='object'||Array.isArray(allocation))throw new Error(`${candidateId} 多目标映射必须提供 sourceUnitIdsByFeature`);
      const entries=allocation as Record<string,unknown>,keys=Object.keys(entries);
      if(keys.length!==targets.length||keys.some(id=>!targets.includes(id)))throw new Error(`${candidateId} sourceUnitIdsByFeature 键必须恰为目标集合`);
      const covered=new Set<string>();
      for(const id of targets){const ids=strings(entries[id],`${candidateId}.sourceUnitIdsByFeature.${id}`,false);refs(ids,new Set(candidate.sourceUnitIds),`${candidateId}.sourceUnitIdsByFeature.${id}`);ids.forEach(source=>{covered.add(source);compiled.get(id)!.add(source)})}
      const missing=candidate.sourceUnitIds.filter(id=>!covered.has(id));if(missing.length)throw new Error(`${candidateId} 来源分配遗漏：${missing.join('、')}`);
    }
    featureValues=featureValues.map(raw=>{const item=raw as Record<string,unknown>;return{...item,sourceUnitIds:[...compiled.get(item.id as string)!]}});
  }
  const features=acceptDirectFeatures(featureValues,sourceUnits);
  const candidateById=new Map(candidates.map(item=>[item.id,item])),featureById=new Map(features.map(item=>[item.id,item])),sourceIds=new Set(sourceUnits.map(item=>item.id));
  for(const candidate of candidates)refs(candidate.sourceUnitIds,sourceIds,`${candidate.id}.sourceUnitIds`);
  const mappedCandidates=new Set<string>(),allowedSources=new Map<string,Set<string>>();
  for(const [index,raw] of payload.candidateMappings.entries()){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error(`candidateMappings[${index}] 必须是对象`);
    const item=raw as Record<string,unknown>,candidateId=text(item.candidateId,`candidateMappings[${index}].candidateId`),targets=strings(item.featureIds,`candidateMappings[${index}].featureIds`,false);
    refs([candidateId],new Set(candidateById.keys()),'candidateMappings.candidateId');refs(targets,new Set(featureById.keys()),'candidateMappings.featureIds');
    if(mappedCandidates.has(candidateId))throw new Error(`candidateMappings 候选重复映射：${candidateId}`);
    if(new Set(targets).size!==targets.length)throw new Error(`candidateMappings ${candidateId} 存在重复目标`);
    mappedCandidates.add(candidateId);const candidate=candidateById.get(candidateId)!;
    const retained=new Set(targets.flatMap(id=>featureById.get(id)!.sourceUnitIds));
    const missing=candidate.sourceUnitIds.filter(id=>!retained.has(id));if(missing.length)throw new Error(`${candidateId} 映射目标遗漏候选来源：${missing.join('、')}`);
    for(const id of targets){const allowed=allowedSources.get(id)??new Set<string>();candidate.sourceUnitIds.forEach(sourceId=>allowed.add(sourceId));allowedSources.set(id,allowed)}
  }
  const missingCandidates=candidates.filter(item=>!mappedCandidates.has(item.id));if(missingCandidates.length)throw new Error(`candidateMappings 遗漏候选：${missingCandidates.map(item=>item.id).join('、')}`);
  for(const feature of features){const allowed=allowedSources.get(feature.id);if(!allowed)throw new Error(`${feature.id} 没有候选映射`);const invented=feature.sourceUnitIds.filter(id=>!allowed.has(id));if(invented.length)throw new Error(`${feature.id} 包含映射候选之外的来源：${invented.join('、')}`)}
  return features;
}

export function acceptDirectDetails(requirementsValue:unknown,questionsValue:unknown,sourceUnits:SourceUnit[]){
  if(!Array.isArray(requirementsValue)||!Array.isArray(questionsValue))throw new Error('需求细化必须同时返回 requirements 与 clarifications 数组');const sourceIds=new Set(sourceUnits.map(unit=>unit.id));
  const requirements=requirementsValue.map((raw,index)=>{const item=raw as Record<string,unknown>,state=text(item.state,`requirements[${index}].state`);if(!reviewStates.has(state))throw new Error(`requirements[${index}].state 非法`);const requirement:RequirementDetail={id:text(item.id,`requirements[${index}].id`),title:text(item.title,`requirements[${index}].title`),behavior:text(item.behavior,`requirements[${index}].behavior`),conditions:strings(item.conditions,`requirements[${index}].conditions`),constraints:strings(item.constraints,`requirements[${index}].constraints`),explicitAcceptanceConditions:strings(item.explicitAcceptanceConditions,`requirements[${index}].explicitAcceptanceConditions`),sourceUnitIds:strings(item.sourceUnitIds,`requirements[${index}].sourceUnitIds`,false),ruleIds:[],state:state as RequirementDetail['state']};refs(requirement.sourceUnitIds,sourceIds,`requirements[${index}].sourceUnitIds`);return requirement});uniqueIds(requirements,'requirements');
  const normalize=(value:string)=>value.replace(/\s/g,'').toLocaleLowerCase('en-US');for(const requirement of requirements){const originals=sourceUnits.filter(unit=>requirement.sourceUnitIds.includes(unit.id)).map(unit=>normalize([unit.excerpt,unit.context??'',unit.asset?.extractedText??''].join('\n')));const splitExact=(condition:string)=>{if(originals.some(original=>original.includes(normalize(condition))))return[condition];const clauses=condition.split('；').map(value=>value.trim()).filter(Boolean),memo=new Map<number,string[]|undefined>();const visit=(start:number):string[]|undefined=>{if(start===clauses.length)return[];if(memo.has(start))return memo.get(start);for(let end=clauses.length;end>start;end--){const candidate=clauses.slice(start,end).join('；');if(!originals.some(original=>original.includes(normalize(candidate))))continue;const rest=visit(end);if(rest){const result=[candidate,...rest];memo.set(start,result);return result}}memo.set(start,undefined);return undefined};return clauses.length>1?visit(0):undefined};const accepted:string[]=[],unsupported:string[]=[];for(const condition of requirement.explicitAcceptanceConditions){const exact=splitExact(condition);exact?accepted.push(...exact):unsupported.push(condition)}if(unsupported.length)throw new Error(`${requirement.id}.explicitAcceptanceConditions 必须逐字引用关联原文，不得推导或静默丢弃：${unsupported.join('；')}`);requirement.explicitAcceptanceConditions=accepted}
  const localIds=new Set(requirements.map(item=>item.id));const clarifications=questionsValue.map((raw,index)=>{const item=raw as Record<string,unknown>,state=text(item.state,`clarifications[${index}].state`);if(state!=='open')throw new Error(`clarifications[${index}] 模型不得自动解决待确认事项`);const affectedIds=strings(item.affectedIds,`clarifications[${index}].affectedIds`,false);refs(affectedIds,new Set([...sourceIds,...localIds]),`clarifications[${index}].affectedIds`);return{id:text(item.id,`clarifications[${index}].id`),question:text(item.question,`clarifications[${index}].question`),reason:text(item.reason,`clarifications[${index}].reason`),affectedIds,state:'open' as const}});uniqueIds(clarifications,'clarifications');return{requirements,clarifications};
}

export function validateDirectGraph(sourceUnits:SourceUnit[],dispositions:SourceDisposition[],features:Feature[],requirements:RequirementDetail[],clarifications:Clarification[]){
  if(sourceUnits.some(unit=>unit.status!=='processed'))throw new Error('仍有未读取的原文单元');
  uniqueIds([...sourceUnits,...features,...requirements,...clarifications],'全局实体');
  acceptConstraintTargets(features.map(feature=>({...feature})),features);
  const sourceIds=new Set(sourceUnits.map(unit=>unit.id)),requirementIds=new Set(requirements.map(item=>item.id)),featureIds=new Set(features.map(item=>item.id));
  uniqueIds(dispositions.map(item=>({id:item.sourceUnitId})),'原文处置');
  for(const item of dispositions){refs([item.sourceUnitId],sourceIds,'sourceDispositions.sourceUnitId');if(!dispositionKinds.has(item.kind))throw new Error(`${item.sourceUnitId} 原文处置分类非法`);text(item.reason,`${item.sourceUnitId}.reason`);refs(item.featureIds,featureIds,`${item.sourceUnitId}.featureIds`)}
  const disposed=new Set(dispositions.map(item=>item.sourceUnitId));const undisposed=sourceUnits.filter(unit=>!disposed.has(unit.id));if(undisposed.length)throw new Error(`仍有未分类原文单元：${undisposed.slice(0,10).map(unit=>unit.id).join('、')}`);
  const owners=new Map<string,string>();
  for(const feature of features){refs(strings(feature.sourceUnitIds,`${feature.id}.sourceUnitIds`,false),sourceIds,`${feature.id}.sourceUnitIds`);refs(feature.requirementIds,requirementIds,`${feature.id}.requirementIds`);for(const id of feature.requirementIds){if(owners.has(id))throw new Error(`${id} 必须有且仅有一个主所属功能，重复归属 ${owners.get(id)}、${feature.id}`);owners.set(id,feature.id)}}
  for(const requirement of requirements){refs(strings(requirement.sourceUnitIds,`${requirement.id}.sourceUnitIds`,false),sourceIds,`${requirement.id}.sourceUnitIds`);if(!owners.has(requirement.id))throw new Error(`${requirement.id} 没有主所属功能`)}
  for(const question of clarifications)refs(strings(question.affectedIds,`${question.id}.affectedIds`,false),new Set([...sourceIds,...requirementIds]),`${question.id}.affectedIds`);
  const requirementById=new Map(requirements.map(item=>[item.id,item]));
  const detailed=new Set(requirements.flatMap(item=>item.sourceUnitIds)),questioned=new Set(clarifications.flatMap(item=>item.affectedIds.flatMap(id=>requirementById.get(id)?.sourceUnitIds??[id])));
  const uncovered=dispositions.filter(item=>(item.kind==='requirement'||item.kind==='clarification')&&!detailed.has(item.sourceUnitId)&&!questioned.has(item.sourceUnitId));return{uncovered};
}

export function acceptDirectAuditIssues(value:unknown,sourceUnits:SourceUnit[],features:Feature[],requirements:RequirementDetail[],clarifications:Clarification[]){return acceptAuditIssues(value,sourceUnits,[],features,requirements,clarifications)}

