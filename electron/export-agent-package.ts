import { createHash, randomUUID } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { AnalysisTask, DeliveryAssessment, PrdProject, RequirementDetail, SourceRef, SourceUnit } from '../src/types.js';
import { writeResultWorkbook } from './export-excel.js';
import { activePlatformIssues, affectedLabels, clarificationLevel, clarificationLevelLabel, featureTitle, sourceExcerpt, sourceHeading, sourcePosition } from '../src/result-presentation.js';
import { projectInputHash } from './task-execution-state.js';

type DeliveryState = DeliveryAssessment['state'];
type ExtendedTask = AnalysisTask & { runId?:string };

export interface AgentPackageManifest {
  schemaVersion: 1;
  deliveryId: string;
  taskId: string;
  runId?: string;
  attempt: number;
  materialBundle?: {id:string;revision:number};
  inputHash: string;
  resultHash: string;
  qualityState: DeliveryState;
  runtimeConfig?: AnalysisTask['runtimeConfig'];
  policyVersion: number;
  resultVersion?: number;
  selectedFeatureIds: string[];
  executableFeatureIds: string[];
  blockedFeatureIds: string[];
  pendingItemCount: number;
  unmetDependencyCount: number;
  qualityBoundary: 'evidence-checked-current-scope-with-open-items';
  files: Array<{path:string;sha256:string;size:number}>;
}

export interface AgentPackageResult { directory:string; manifest:AgentPackageManifest }
export interface AgentPackageScope { selectedFeatureIds?: string[] }
interface PendingItem {
  id:string;
  kind:'excluded-feature'|'excluded-requirement'|'clarification'|'platform-issue'|'unmet-dependency';
  featureIds:string[];
  requirementIds?:string[];
  reason:string;
  level?:'blocking'|'suggestion'|'ignorable';
  evidence?:SourceRef[];
  impact?:string;
}
interface DeliveryScope { selectedFeatureIds:string[]; executableFeatureIds:string[]; blockedFeatureIds:string[]; project:PrdProject; pendingItems:PendingItem[] }

const json = (value:unknown) => JSON.stringify(value,null,2)+'\n';
const sha256 = (value:string|Buffer) => createHash('sha256').update(value).digest('hex');
const safeSegment = (value:string,label:string) => {if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value))throw new Error(`${label}包含不安全字符`);return value};
const sourceText = (source:SourceUnit,ref?:SourceRef) => `${sourcePosition(source)}\n${sourceExcerpt(source,ref)}`;
const bullets = (values:string[]) => values.length?values.map(value=>`- ${value}`).join('\n'):'- 无';
const requirementMarkdown = (project:PrdProject,requirement:RequirementDetail) => [
  `### ${requirement.id} ${requirement.title}`,
  '',requirement.behavior,'','条件：','',bullets(requirement.conditions),'','限制与例外：','',bullets(requirement.constraints),
  '','原文明示验收条件：','',bullets(requirement.explicitAcceptanceConditions),'','原文依据：','',requirement.sourceUnitIds.map(id=>project.sourceUnits.find(item=>item.id===id)).filter((item):item is SourceUnit=>!!item).map(item=>`- ${sourceHeading(item)} · ${sourcePosition(item)}`).join('\n')||'- 无'
].join('\n');

function quality(_task:ExtendedTask,project:PrdProject):DeliveryAssessment {
  if(project.delivery)return structuredClone(project.delivery);
  const active=activePlatformIssues(project);
  const open=project.clarifications.filter(item=>item.state==='open'&&(item.level??'blocking')==='blocking');
  const state:DeliveryState=active.length||open.length?'blocked':project.audit?.passed?'ready':'unchecked';
  return {state,inputHash:projectInputHash(project),resultHash:'',issueIds:[...active.map(item=>item.id),...open.map(item=>item.id)],unverifiedScopeIds:[],policyVersion:2};
}

const intersects=(left:Iterable<string>,right:Set<string>)=>Array.from(left).some(value=>right.has(value));
const featureScopeIds=(project:PrdProject,featureId:string)=>{
  const feature=project.features.find(item=>item.id===featureId);
  return new Set(feature?[feature.id,...feature.requirementIds,...feature.sourceUnitIds]:[]);
};

function deliveryScope(project:PrdProject,requested?:AgentPackageScope):DeliveryScope {
  const business=project.features.filter(item=>item.kind!=='constraint');
  const known=new Set(business.map(item=>item.id));
  const requestedIds=requested?.selectedFeatureIds;
  if(requestedIds&&new Set(requestedIds).size!==requestedIds.length)throw new Error('交付范围包含重复功能');
  const unknown=(requestedIds??[]).filter(id=>!known.has(id));
  if(unknown.length)throw new Error(`交付范围包含不存在或不可单独交付的功能：${unknown.join('、')}`);
  // 本期范围是结果的一部分，导出时不再根据待处理事项或临时勾选推断范围。
  // selectedFeatureIds 仅保留旧调用的参数校验；旧结果没有 deliveryScope 时全部视为本期。
  const requirementById=new Map(project.requirements.map(item=>[item.id,item]));
  const includedRequirementIds=new Set<string>();
  const includedBusiness=business.filter(feature=>{
    if(feature.deliveryScope==='excluded')return false;
    for(const id of feature.requirementIds){const requirement=requirementById.get(id);if(requirement&&requirement.deliveryScope!=='excluded')includedRequirementIds.add(id)}
    return feature.requirementIds.some(id=>includedRequirementIds.has(id));
  });
  const selected=includedBusiness.map(item=>item.id),selectedSet=new Set(selected);
  const ownerByRequirement=new Map<string,string>();
  for(const feature of business)for(const requirementId of feature.requirementIds)ownerByRequirement.set(requirementId,feature.id);
  const includedConstraints=project.features.filter(item=>item.kind==='constraint'&&item.deliveryScope!=='excluded'&&(item.appliesToFeatureIds??[]).some(id=>selectedSet.has(id))).map(feature=>{
    for(const id of feature.requirementIds){const requirement=requirementById.get(id);if(requirement&&requirement.deliveryScope!=='excluded')includedRequirementIds.add(id)}
    return feature;
  }).filter(feature=>feature.requirementIds.some(id=>includedRequirementIds.has(id)));
  if(!includedRequirementIds.size)throw new Error('本期范围没有可交付需求，请先调整需求范围');
  const includedFeatures=[...includedBusiness,...includedConstraints].map(feature=>({...structuredClone(feature),requirementIds:feature.requirementIds.filter(id=>includedRequirementIds.has(id)),appliesToFeatureIds:feature.appliesToFeatureIds?.filter(id=>selectedSet.has(id))}));
  const includedFeatureIds=new Set(includedFeatures.map(item=>item.id));
  const includedRequirements=project.requirements.filter(item=>includedRequirementIds.has(item.id));
  const currentScopeIds=new Set([...includedFeatureIds,...includedRequirementIds,...includedFeatures.flatMap(item=>item.sourceUnitIds),...includedRequirements.flatMap(item=>item.sourceUnitIds)]);
  const includedRelations=(project.relations??[]).filter(item=>includedRequirementIds.has(item.sourceRequirementId)&&includedRequirementIds.has(item.targetRequirementId));
  const activeIssues=activePlatformIssues(project);
  const relatesToCurrent=(affectedIds:string[],sourceUnitIds:string[]=[])=>affectedIds.some(id=>currentScopeIds.has(id))||sourceUnitIds.some(id=>currentScopeIds.has(id));
  const scopedClarifications=project.clarifications.filter(item=>item.state==='open'&&relatesToCurrent(item.affectedIds));
  const scopedIssues=activeIssues.filter(item=>relatesToCurrent(item.affectedIds,item.sourceUnitIds));
  const unmetDependencies=(project.relations??[]).filter(item=>item.kind==='depends-on'&&includedRequirementIds.has(item.sourceRequirementId)&&!includedRequirementIds.has(item.targetRequirementId));
  const pendingItems:PendingItem[]=[
    ...business.filter(item=>item.deliveryScope==='excluded'||!selectedSet.has(item.id)).map(item=>({id:item.id,kind:'excluded-feature' as const,featureIds:[item.id],requirementIds:item.requirementIds,reason:'该功能已排除在本期范围外'})),
    ...business.filter(item=>item.deliveryScope!=='excluded').flatMap(feature=>feature.requirementIds.map(id=>requirementById.get(id)).filter((item):item is RequirementDetail=>!!item&&item.deliveryScope==='excluded').map(item=>({id:item.id,kind:'excluded-requirement' as const,featureIds:[feature.id],requirementIds:[item.id],reason:'该需求已排除在本期范围外'}))),
    ...scopedClarifications.map(item=>({id:item.id,kind:'clarification' as const,featureIds:business.filter(feature=>intersects(item.affectedIds,featureScopeIds(project,feature.id))).map(feature=>feature.id),requirementIds:item.affectedIds.filter(id=>requirementById.has(id)),reason:item.question,level:item.level??'blocking',evidence:item.sourceRefs??[],impact:item.impact??item.reason})),
    ...scopedIssues.map(item=>({id:item.id,kind:'platform-issue' as const,featureIds:business.filter(feature=>intersects(item.affectedIds,featureScopeIds(project,feature.id))||intersects(item.sourceUnitIds,featureScopeIds(project,feature.id))).map(feature=>feature.id),requirementIds:item.affectedIds.filter(id=>requirementById.has(id)),reason:item.detail,level:'blocking' as const,evidence:item.sourceUnitIds.map(sourceUnitId=>({sourceUnitId})),impact:item.detail})),
    ...unmetDependencies.map(item=>({id:item.id,kind:'unmet-dependency' as const,featureIds:[ownerByRequirement.get(item.sourceRequirementId)].filter((id):id is string=>!!id),requirementIds:[item.sourceRequirementId,item.targetRequirementId],reason:`本期需求 ${item.sourceRequirementId} 依赖已排除需求 ${item.targetRequirementId}`,level:'blocking' as const,evidence:item.sourceRefs,impact:'开发 Agent 需要自行确认或补齐该依赖后再实施相关需求'}))
  ];
  const issueIds=[...scopedClarifications.map(item=>item.id),...scopedIssues.map(item=>item.id),...unmetDependencies.map(item=>item.id)];
  const scoped:PrdProject={...structuredClone(project),features:includedFeatures,requirements:includedRequirements,relations:includedRelations,clarifications:scopedClarifications,audit:{passed:scopedIssues.length===0,issues:scopedIssues},delivery:{state:'ready',inputHash:project.delivery?.inputHash??projectInputHash(project),resultHash:'',issueIds,unverifiedScopeIds:project.delivery?.unverifiedScopeIds.filter(id=>includedRequirementIds.has(id)||includedFeatureIds.has(id))??[],policyVersion:project.delivery?.policyVersion??2}};
  return {selectedFeatureIds:selected,executableFeatureIds:selected,blockedFeatureIds:[],project:scoped,pendingItems};
}

function snapshot(project:PrdProject,task:ExtendedTask,assessment:DeliveryAssessment,scope?:Pick<DeliveryScope,'selectedFeatureIds'|'executableFeatureIds'|'blockedFeatureIds'>) {
  return {
    schemaVersion:1,
    project:{id:project.id,name:project.name,revision:project.revision,sourceName:project.sourceName,sourceHash:project.sourceHash,materialBundle:project.materialBundle,sourceDocuments:project.sourceDocuments,analysisInput:project.analysisInput,analysisInputApplications:project.analysisInputApplications},
    task:{id:task.id,runId:task.runId,attempt:task.attempt,resultVersion:(task as AnalysisTask&{resultVersion?:number}).resultVersion},
    delivery:{state:assessment.state,inputHash:assessment.inputHash,issueIds:assessment.issueIds,unverifiedScopeIds:assessment.unverifiedScopeIds,policyVersion:assessment.policyVersion,...scope},
    features:project.features,
    requirements:project.requirements,
    relations:project.relations??[],
    sources:project.sourceUnits.map(unit=>({...unit,asset:unit.asset?{...unit.asset,path:`sources/assets/${unit.asset.sha256}${path.extname(unit.asset.path).toLowerCase()}`}:undefined})),
    sourceDispositions:project.sourceDispositions??[],
    clarifications:project.clarifications,
    audit:project.audit??{passed:false,issues:[]}
  };
}

function featureMarkdown(project:PrdProject,featureId:string,qualityState:DeliveryState) {
  const feature=project.features.find(item=>item.id===featureId)!;
  const own=project.requirements.filter(item=>feature.requirementIds.includes(item.id));
  const constraints=project.features.filter(item=>item.kind==='constraint'&&(item.appliesToFeatureIds??[]).includes(feature.id))
    .flatMap(item=>project.requirements.filter(requirement=>item.requirementIds.includes(requirement.id)));
  const ownIds=new Set(own.map(item=>item.id));
  const relations=(project.relations??[]).filter(item=>ownIds.has(item.sourceRequirementId)||ownIds.has(item.targetRequirementId));
  const directIds=new Set(relations.flatMap(item=>[item.sourceRequirementId,item.targetRequirementId]).filter(id=>!ownIds.has(id)));
  const related=project.requirements.filter(item=>directIds.has(item.id));
  const affected=new Set([feature.id,...feature.requirementIds,...feature.sourceUnitIds]);
  const clarifications=project.clarifications.filter(item=>item.affectedIds.some(id=>affected.has(id)));
  const issues=activePlatformIssues(project).filter(item=>item.affectedIds.some(id=>affected.has(id)));
  const refs=feature.sourceRefs?.length?feature.sourceRefs:feature.sourceUnitIds.map(sourceUnitId=>({sourceUnitId}));
  const sections=[
    `# ${featureTitle(project,feature)}`,'',`> 需求交付状态：${qualityState}`,'',
    '## 原文位置','',refs.length?refs.map(ref=>{const item=project.sourceUnits.find(unit=>unit.id===ref.sourceUnitId)!;return`### ${sourceHeading(item)}\n\n${sourceText(item,ref)}`}).join('\n\n'):'无','',
    '## 本功能需求','',own.length?own.map(item=>requirementMarkdown(project,item)).join('\n\n'):'无'
  ];
  if(constraints.length)sections.push('','## 适用的通用约束','',constraints.map(item=>requirementMarkdown(project,item)).join('\n\n'));
  if(relations.length)sections.push('','## 直接关系','',relations.map(item=>`- ${item.sourceRequirementId} ${item.kind} ${item.targetRequirementId}（来源：${item.sourceRefs.map(ref=>ref.sourceUnitId).join('、')}）`).join('\n'));
  if(related.length)sections.push('','## 直接关联需求','',related.map(item=>requirementMarkdown(project,item)).join('\n\n'));
  if(clarifications.length||issues.length)sections.push('','## 相关问题','',[
    ...clarifications.map(item=>`- ${item.id}【${clarificationLevelLabel[clarificationLevel(item)]}】${item.question}\n  - 已知事实：${item.knownFacts??'旧任务未记录'}\n  - 未决点：${item.unresolvedPoint??item.reason}\n  - 影响：${item.impact??item.reason}${item.defaultResolution?`\n  - 暂不处理时：${item.defaultResolution}`:''}${item.resolutionProposal?`\n  - 建议方案（仅供参考，尚未确认）：${item.resolutionProposal.recommendation}\n  - 建议依据：${item.resolutionProposal.rationale}\n  - 采纳影响：${item.resolutionProposal.impact}\n  - 需要确认：${item.resolutionProposal.confirmation}`:''}`),
    ...issues.map(item=>`- ${item.id}【平台处理】${item.detail}\n  - 影响：${affectedLabels(project,item.affectedIds).join('、')}`)
  ].join('\n'));
  return sections.join('\n')+'\n';
}

async function verifyPackage(directory:string,manifest:AgentPackageManifest,requirements:ReturnType<typeof snapshot>) {
  const parsed=JSON.parse(await readFile(path.join(directory,'requirements.json'),'utf8')) as typeof requirements;
  if(sha256(json(parsed))!==manifest.resultHash)throw new Error('requirements.json 回读哈希不一致');
  const expectedIds=requirements.requirements.map(item=>item.id).sort();
  if(JSON.stringify(parsed.requirements.map(item=>item.id).sort())!==JSON.stringify(expectedIds))throw new Error('requirements.json 回读内容不一致');
  const readme=await readFile(path.join(directory,'README.md'),'utf8');
  for(const feature of requirements.features)if(!readme.includes(`features/${feature.id}.md`))throw new Error(`README 缺少功能链接：${feature.id}`);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(path.join(directory,'requirements.xlsx'));
  const ids=(workbook.getWorksheet('需求明细')?.getColumn(1).values.slice(2)??[]).map(String).sort();
  if(JSON.stringify(ids)!==JSON.stringify(expectedIds))throw new Error('requirements.xlsx 回读需求不一致');
  for(const file of manifest.files){const full=path.join(directory,...file.path.split('/'));const data=await readFile(full);if(data.length!==file.size||sha256(data)!==file.sha256)throw new Error(`文件回读校验失败：${file.path}`)}
}
async function relativeFiles(root:string,current=root):Promise<string[]>{const out:string[]=[];for(const entry of await readdir(current,{withFileTypes:true})){const full=path.join(current,entry.name);if(entry.isDirectory())out.push(...await relativeFiles(root,full));else if(entry.isFile())out.push(path.relative(root,full).split(path.sep).join('/'))}return out}
async function publishDirectory(source:string,target:string){
  try { await rename(source,target); return; }
  catch(error) {
    const code=(error as NodeJS.ErrnoException).code;
    if(!['EPERM','EACCES','EBUSY'].includes(code??''))throw error;
  }
  await cp(source,target,{recursive:true,errorOnExist:true,force:false});
  await rm(source,{recursive:true,force:true});
}

/** 从同一需求快照确定性编译文件，独立回读通过后发布到唯一目录。 */
export async function writeAgentPackage(project:PrdProject,task:AnalysisTask,outputRoot:string,requestedDeliveryId?:string,requestedScope?:AgentPackageScope):Promise<AgentPackageResult> {
  const extendedTask=task as ExtendedTask,scope=deliveryScope(project,requestedScope),extendedProject=scope.project;
  const assessment=quality(extendedTask,extendedProject),scopeRecord={selectedFeatureIds:scope.selectedFeatureIds,executableFeatureIds:scope.executableFeatureIds,blockedFeatureIds:scope.blockedFeatureIds};
  const packageFingerprint=(resolved:DeliveryScope,resolvedAssessment:DeliveryAssessment)=>sha256(json({requirements:snapshot(resolved.project,extendedTask,resolvedAssessment,{selectedFeatureIds:resolved.selectedFeatureIds,executableFeatureIds:resolved.executableFeatureIds,blockedFeatureIds:resolved.blockedFeatureIds}),pendingItems:resolved.pendingItems}));
  const beforeAttempt=task.attempt,beforeFingerprint=packageFingerprint(scope,assessment);
  const deliveryId=safeSegment(requestedDeliveryId??`${task.id}-a${task.attempt}-${beforeFingerprint.slice(0,12)}`,'交付编号');
  const finalDirectory=path.join(outputRoot,deliveryId),temporaryDirectory=path.join(outputRoot,`.${deliveryId}.${randomUUID()}.tmp`);
  await mkdir(outputRoot,{recursive:true});await mkdir(path.join(temporaryDirectory,'features'),{recursive:true});
  try {
    const requirements=snapshot(extendedProject,extendedTask,assessment,scopeRecord),requirementsText=json(requirements),resultHash=sha256(requirementsText);
    await writeFile(path.join(temporaryDirectory,'requirements.json'),requirementsText,'utf8');
    await writeFile(path.join(temporaryDirectory,'pending.json'),json({schemaVersion:1,resultVersion:(task as AnalysisTask&{resultVersion?:number}).resultVersion,...scopeRecord,items:scope.pendingItems}),'utf8');
    const featureLinks=extendedProject.features.map(feature=>`- [${featureTitle(extendedProject,feature)}](features/${feature.id}.md)`).join('\n');
    await writeFile(path.join(temporaryDirectory,'README.md'),[
      `# ${project.name} Agent 需求交付包`,'',`需求交付状态：${assessment.state}`,'',
      `结果版本：${(task as AnalysisTask&{resultVersion?:number}).resultVersion??'未编号'}`,'',
      `本次选择功能：${scope.selectedFeatureIds.join('、')||'无'}`,'',
      `可执行功能：${scope.executableFeatureIds.join('、')||'无'}`,'',
      `范围外功能：${scope.pendingItems.filter(item=>item.kind==='excluded-feature').length}`,'',
      `本期相关待处理事项：${scope.pendingItems.filter(item=>item.kind==='clarification'||item.kind==='platform-issue').length}`,'',
      `未满足依赖：${scope.pendingItems.filter(item=>item.kind==='unmet-dependency').length}`,'',
      '本目录以 requirements.json 为本期可实施业务快照。requirements.xlsx 使用同一范围；范围外内容、相关待处理事项和未满足依赖见 pending.json。待处理事项不会自动删除已经列入本期的需求。','',
      '## 功能入口','',featureLinks||'- 无','',
      '## 质量边界','','本包只承诺本期需求保留可追溯依据，并完整暴露相关待处理事项和跨范围依赖。ready 表示存在可实施的本期需求，不表示待处理事项为零，也不表示已在真实业务仓库验证实施结果。',''
    ].join('\n'),'utf8');
    for(const feature of extendedProject.features){safeSegment(feature.id,'功能编号');await writeFile(path.join(temporaryDirectory,'features',`${feature.id}.md`),featureMarkdown(extendedProject,feature.id,assessment.state),'utf8')}
    const sourceRoot=path.join(temporaryDirectory,'sources');await mkdir(sourceRoot,{recursive:true});
    if(project.inputSnapshotPath){const input=path.join(project.inputSnapshotPath,'input');try{if((await stat(input)).isDirectory())await cp(input,path.join(sourceRoot,'files'),{recursive:true,errorOnExist:true,force:false})}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}}
    if(!project.inputSnapshotPath&&project.sourceDocuments?.length){for(const document of project.sourceDocuments){const directory=path.join(sourceRoot,safeSegment(document.fileId,'来源文件编号'));await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'extracted.txt'),document.rawText,'utf8')}}
    const assetRoot=path.join(sourceRoot,'assets');for(const unit of project.sourceUnits.filter(item=>item.asset)){const asset=unit.asset!;await mkdir(assetRoot,{recursive:true});const extension=path.extname(asset.path).toLowerCase();const target=path.join(assetRoot,`${asset.sha256}${extension}`);try{await copyFile(asset.path,target,1)}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error}}
    await writeFile(path.join(sourceRoot,'index.json'),json(project.sourceUnits.map(unit=>({id:unit.id,fileId:unit.fileId,logicalPath:unit.logicalPath,location:unit.location,sourceRole:unit.sourceRole,asset:unit.asset?{mimeType:unit.asset.mimeType,sha256:unit.asset.sha256,readStatus:unit.asset.readStatus}:undefined}))),'utf8');
    await writeResultWorkbook(extendedProject,path.join(temporaryDirectory,'requirements.xlsx'),task.checkpoint,{resultVersion:(task as AnalysisTask&{resultVersion?:number}).resultVersion,...scopeRecord});
    const outputFiles=await relativeFiles(temporaryDirectory);
    const files=[] as AgentPackageManifest['files'];
    for(const relative of outputFiles){if(relative==='manifest.json')continue;const data=await readFile(path.join(temporaryDirectory,...relative.split('/')));files.push({path:relative,sha256:sha256(data),size:data.length})}
    const manifest:AgentPackageManifest={schemaVersion:1,deliveryId,taskId:task.id,runId:extendedTask.runId,attempt:task.attempt,materialBundle:project.materialBundle,inputHash:assessment.inputHash,resultHash,qualityState:assessment.state,runtimeConfig:task.runtimeConfig,policyVersion:assessment.policyVersion,resultVersion:(task as AnalysisTask&{resultVersion?:number}).resultVersion,...scopeRecord,pendingItemCount:scope.pendingItems.length,unmetDependencyCount:scope.pendingItems.filter(item=>item.kind==='unmet-dependency').length,qualityBoundary:'evidence-checked-current-scope-with-open-items',files};
    await writeFile(path.join(temporaryDirectory,'manifest.json'),json(manifest),'utf8');
    await verifyPackage(temporaryDirectory,manifest,requirements);
    const manifestReadback=JSON.parse(await readFile(path.join(temporaryDirectory,'manifest.json'),'utf8')) as AgentPackageManifest;
    if(JSON.stringify(manifestReadback)!==JSON.stringify(manifest))throw new Error('manifest.json 回读内容不一致');
    const currentScope=deliveryScope(project,requestedScope),currentAssessment=quality(extendedTask,currentScope.project);
    if(task.attempt!==beforeAttempt||packageFingerprint(currentScope,currentAssessment)!==beforeFingerprint)throw new Error('导出期间任务或需求数据已变化');
    await publishDirectory(temporaryDirectory,finalDirectory);
    return {directory:finalDirectory,manifest};
  } catch(error) {
    await rm(temporaryDirectory,{recursive:true,force:true});throw error;
  }
}

export async function listPublishedPackageFiles(directory:string){return (await readdir(directory,{recursive:true})).map(String).sort()}
