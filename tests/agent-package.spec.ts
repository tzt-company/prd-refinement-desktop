import { afterAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AnalysisTask, PrdProject } from '../src/types';
import { writeAgentPackage } from '../electron/export-agent-package';

const roots:string[]=[];
afterAll(async()=>{await Promise.all(roots.map(root=>rm(root,{recursive:true,force:true})))});
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex');

function fixture(){
  const project:PrdProject={id:'P-1',name:'订单需求',sourceName:'prd.md',sourceHash:'input-hash',revision:2,importedAt:'2026-09-11T00:00:00.000Z',rawText:'提交订单。所有操作需登录。',stage:'review',sourceUnits:[
    {id:'S-1',label:'提交订单',kind:'paragraph',excerpt:'登录用户可以提交订单。',location:'第 1 段',status:'processed'},
    {id:'S-2',label:'通用约束',kind:'paragraph',excerpt:'所有操作需登录。',location:'第 2 段',status:'processed'}
  ],rules:[],features:[
    {id:'F-001',name:'提交订单',goal:'',sourceUnitIds:['S-1'],ruleIds:[],requirementIds:['R-001'],state:'reviewed'},
    {id:'F-900',kind:'constraint',name:'登录约束',goal:'',sourceUnitIds:['S-2'],ruleIds:[],requirementIds:['R-900'],appliesToFeatureIds:['F-001'],state:'reviewed'}
  ],requirements:[
    {id:'R-001',title:'提交订单',behavior:'用户提交订单',conditions:['用户已登录'],constraints:['库存不足时禁止提交'],explicitAcceptanceConditions:['提交成功后返回订单号'],sourceUnitIds:['S-1'],ruleIds:[],state:'reviewed'},
    {id:'R-900',title:'登录约束',behavior:'操作前校验登录状态',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:['S-2'],ruleIds:[],state:'reviewed'}
  ],clarifications:[],audit:{passed:true,issues:[]}};
  const task:AnalysisTask={id:'T-1',project,attempt:3,status:'completed',progress:100,createdAt:1,steps:[]};
  return {project,task};
}

describe('Agent 交付包',()=>{
  it('从同一快照生成、回读并原子发布完整需求包',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'prd-agent-package-'));roots.push(root);
    const {project,task}=fixture();const assetPath=path.join(root,'原始图片.png'),asset=Buffer.from('fixture-image');await writeFile(assetPath,asset);project.sourceUnits[0].asset={path:assetPath,mimeType:'image/png',sha256:hash(asset),readStatus:'read'};const result=await writeAgentPackage(project,task,root,'delivery-1');
    expect(path.basename(result.directory)).toBe('delivery-1');expect(result.manifest.qualityState).toBe('ready');
    const names=(await readdir(result.directory)).sort();expect(names).toEqual(['README.md','features','manifest.json','requirements.json','requirements.xlsx','sources']);
    const requirements=JSON.parse(await readFile(path.join(result.directory,'requirements.json'),'utf8'));
    expect(requirements.requirements.map((item:{id:string})=>item.id)).toEqual(['R-001','R-900']);expect(requirements.delivery.state).toBe('ready');
    expect(requirements.sources[0].asset.path).toBe(`sources/assets/${hash(asset)}.png`);expect(JSON.stringify(requirements)).not.toContain(assetPath);
    const feature=await readFile(path.join(result.directory,'features','F-001.md'),'utf8');
    expect(feature).toContain('用户提交订单');expect(feature).toContain('## 适用的通用约束');expect(feature).toContain('操作前校验登录状态');
    const readme=await readFile(path.join(result.directory,'README.md'),'utf8');expect(readme).toContain('(features/F-001.md)');
    for(const file of result.manifest.files){const data=await readFile(path.join(result.directory,...file.path.split('/')));expect(hash(data)).toBe(file.sha256);expect(data.length).toBe(file.size)}
    expect((await readdir(root)).some(name=>name.endsWith('.tmp'))).toBe(false);
  });

  it('目标目录已存在时不覆盖旧包，并清理临时目录',async()=>{
    const root=await mkdtemp(path.join(os.tmpdir(),'prd-agent-package-'));roots.push(root);
    const {project,task}=fixture();await writeAgentPackage(project,task,root,'stable');
    const original=await readFile(path.join(root,'stable','requirements.json'),'utf8');
    await expect(writeAgentPackage(project,task,root,'stable')).rejects.toThrow();
    expect(await readFile(path.join(root,'stable','requirements.json'),'utf8')).toBe(original);
    expect((await readdir(root)).filter(name=>name.endsWith('.tmp'))).toEqual([]);
  });
});
