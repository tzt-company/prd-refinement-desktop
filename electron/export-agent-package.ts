import { createHash, randomUUID } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { AnalysisTask, DeliveryAssessment, PrdProject, RequirementDetail, SourceRef, SourceUnit } from '../src/types.js';
import { writeResultWorkbook } from './export-excel.js';
import { activePlatformIssues, affectedLabels, clarificationLevel, clarificationLevelLabel, featureTitle, sourceExcerpt, sourceHeading, sourcePosition } from '../src/result-presentation.js';

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
  files: Array<{path:string;sha256:string;size:number}>;
}

export interface AgentPackageResult { directory:string; manifest:AgentPackageManifest }

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
  return {state,inputHash:project.sourceHash,resultHash:'',issueIds:[...active.map(item=>item.id),...open.map(item=>item.id)],unverifiedScopeIds:[],policyVersion:2};
}

function snapshot(project:PrdProject,task:ExtendedTask,assessment:DeliveryAssessment) {
  return {
    schemaVersion:1,
    project:{id:project.id,name:project.name,revision:project.revision,sourceName:project.sourceName,sourceHash:project.sourceHash,materialBundle:project.materialBundle,sourceDocuments:project.sourceDocuments},
    task:{id:task.id,runId:task.runId,attempt:task.attempt},
    delivery:{state:assessment.state,inputHash:assessment.inputHash,issueIds:assessment.issueIds,unverifiedScopeIds:assessment.unverifiedScopeIds,policyVersion:assessment.policyVersion},
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
    ...clarifications.map(item=>`- ${item.id}【${clarificationLevelLabel[clarificationLevel(item)]}】${item.question}\n  - 已知事实：${item.knownFacts??'旧任务未记录'}\n  - 未决点：${item.unresolvedPoint??item.reason}\n  - 影响：${item.impact??item.reason}${item.defaultResolution?`\n  - 暂不处理时：${item.defaultResolution}`:''}`),
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
export async function writeAgentPackage(project:PrdProject,task:AnalysisTask,outputRoot:string,requestedDeliveryId?:string):Promise<AgentPackageResult> {
  const extendedProject=project,extendedTask=task as ExtendedTask;
  const assessment=quality(extendedTask,project),beforeAttempt=task.attempt,beforeFingerprint=sha256(json(snapshot(extendedProject,extendedTask,assessment)));
  const deliveryId=safeSegment(requestedDeliveryId??`${task.id}-a${task.attempt}-${beforeFingerprint.slice(0,12)}`,'交付编号');
  const finalDirectory=path.join(outputRoot,deliveryId),temporaryDirectory=path.join(outputRoot,`.${deliveryId}.${randomUUID()}.tmp`);
  await mkdir(outputRoot,{recursive:true});await mkdir(path.join(temporaryDirectory,'features'),{recursive:true});
  try {
    const requirements=snapshot(extendedProject,extendedTask,assessment),requirementsText=json(requirements),resultHash=sha256(requirementsText);
    await writeFile(path.join(temporaryDirectory,'requirements.json'),requirementsText,'utf8');
    const featureLinks=project.features.map(feature=>`- [${featureTitle(project,feature)}](features/${feature.id}.md)`).join('\n');
    await writeFile(path.join(temporaryDirectory,'README.md'),[
      `# ${project.name} Agent 需求交付包`,'',`需求交付状态：${assessment.state}`,'',
      '本目录以 requirements.json 为唯一结构化业务快照。按功能阅读以下文件；requirements.xlsx 用于人工查阅。','',
      '## 功能入口','',featureLinks||'- 无','',
      '## 完整性边界','',assessment.state==='ready'?'需求检查已通过平台交付条件；这不表示已在真实业务仓库验证实施结果。':'当前包存在阻断或未完成检查，仅供整理审阅。',''
    ].join('\n'),'utf8');
    for(const feature of project.features){safeSegment(feature.id,'功能编号');await writeFile(path.join(temporaryDirectory,'features',`${feature.id}.md`),featureMarkdown(extendedProject,feature.id,assessment.state),'utf8')}
    const sourceRoot=path.join(temporaryDirectory,'sources');await mkdir(sourceRoot,{recursive:true});
    if(project.inputSnapshotPath){const input=path.join(project.inputSnapshotPath,'input');try{if((await stat(input)).isDirectory())await cp(input,path.join(sourceRoot,'files'),{recursive:true,errorOnExist:true,force:false})}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}}
    if(!project.inputSnapshotPath&&project.sourceDocuments?.length){for(const document of project.sourceDocuments){const directory=path.join(sourceRoot,safeSegment(document.fileId,'来源文件编号'));await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'extracted.txt'),document.rawText,'utf8')}}
    const assetRoot=path.join(sourceRoot,'assets');for(const unit of project.sourceUnits.filter(item=>item.asset)){const asset=unit.asset!;await mkdir(assetRoot,{recursive:true});const extension=path.extname(asset.path).toLowerCase();const target=path.join(assetRoot,`${asset.sha256}${extension}`);try{await copyFile(asset.path,target,1)}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error}}
    await writeFile(path.join(sourceRoot,'index.json'),json(project.sourceUnits.map(unit=>({id:unit.id,fileId:unit.fileId,logicalPath:unit.logicalPath,location:unit.location,sourceRole:unit.sourceRole,asset:unit.asset?{mimeType:unit.asset.mimeType,sha256:unit.asset.sha256,readStatus:unit.asset.readStatus}:undefined}))),'utf8');
    await writeResultWorkbook(project,path.join(temporaryDirectory,'requirements.xlsx'),task.checkpoint);
    const outputFiles=await relativeFiles(temporaryDirectory);
    const files=[] as AgentPackageManifest['files'];
    for(const relative of outputFiles){if(relative==='manifest.json')continue;const data=await readFile(path.join(temporaryDirectory,...relative.split('/')));files.push({path:relative,sha256:sha256(data),size:data.length})}
    const manifest:AgentPackageManifest={schemaVersion:1,deliveryId,taskId:task.id,runId:extendedTask.runId,attempt:task.attempt,materialBundle:project.materialBundle,inputHash:assessment.inputHash,resultHash,qualityState:assessment.state,runtimeConfig:task.runtimeConfig,policyVersion:assessment.policyVersion,files};
    await writeFile(path.join(temporaryDirectory,'manifest.json'),json(manifest),'utf8');
    await verifyPackage(temporaryDirectory,manifest,requirements);
    const manifestReadback=JSON.parse(await readFile(path.join(temporaryDirectory,'manifest.json'),'utf8')) as AgentPackageManifest;
    if(JSON.stringify(manifestReadback)!==JSON.stringify(manifest))throw new Error('manifest.json 回读内容不一致');
    if(task.attempt!==beforeAttempt||sha256(json(snapshot(extendedProject,extendedTask,quality(extendedTask,project))))!==beforeFingerprint)throw new Error('导出期间任务或需求数据已变化');
    await publishDirectory(temporaryDirectory,finalDirectory);
    return {directory:finalDirectory,manifest};
  } catch(error) {
    await rm(temporaryDirectory,{recursive:true,force:true});throw error;
  }
}

export async function listPublishedPackageFiles(directory:string){return (await readdir(directory,{recursive:true})).map(String).sort()}
