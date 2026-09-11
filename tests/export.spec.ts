import ExcelJS from 'exceljs';
import { afterAll, describe, expect, it } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { writeResultWorkbook } from '../electron/export-excel';
import type { PrdProject } from '../src/types';

const outputRoot=path.resolve('.runtime-test');
afterAll(()=>rm(outputRoot,{recursive:true,force:true}));
it('直接引用原文的待确认显示在相关功能和需求行，不扩散到同功能其他来源',async()=>{
  await mkdir(outputRoot,{recursive:true});
  const sources=['S-001','S-002'].map(id=>({id,label:id,kind:'paragraph' as const,excerpt:id,location:id,status:'processed' as const}));
  const requirements=sources.map((s,i)=>({id:`R-${i+1}`,title:s.id,behavior:s.id,conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:[s.id],ruleIds:[],state:'draft' as const}));
  const project:PrdProject={id:'source-question',name:'来源澄清',sourceName:'test.md',sourceHash:'x',revision:1,importedAt:'',rawText:'',stage:'review',sourceUnits:sources,rules:[],features:[{id:'F-1',name:'业务',goal:'业务',sourceUnitIds:sources.map(s=>s.id),ruleIds:[],requirementIds:requirements.map(r=>r.id),state:'draft'}],requirements,clarifications:[{id:'Q-1',question:'待确认',reason:'原文未决',affectedIds:['S-001'],state:'open'}]};
  const file=path.join(outputRoot,'source-question.xlsx');await writeResultWorkbook(project,file);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);
  const expected={text:'Q-1',hyperlink:"#'待确认事项'!A2"};
  expect(workbook.getWorksheet('功能清单')!.getCell('E2').value).toEqual(expected);
  expect(workbook.getWorksheet('需求明细')!.getCell('H2').value).toEqual(expected);
  expect(workbook.getWorksheet('需求明细')!.getCell('H3').value).toBe('');
});
it('导出明确的约束适用关系，并保留直接引用原文的待确认来源',async()=>{
  await mkdir(outputRoot,{recursive:true});
  const project:PrdProject={id:'relations',name:'约束与澄清',sourceName:'test.md',sourceHash:'x',revision:1,importedAt:'',rawText:'是否支持多域名？',stage:'review',
    sourceUnits:[{id:'S-001',label:'域名问题',kind:'paragraph',excerpt:'是否支持多域名？',context:'发布设置',location:'第 20 行',status:'processed'}],
    sourceDispositions:[{sourceUnitId:'S-001',kind:'clarification',reason:'原文未决问题',featureIds:[]}],
    features:[
      {id:'F-001',kind:'function',name:'发布',goal:'发布数据',sourceUnitIds:['S-001'],ruleIds:[],requirementIds:[],state:'draft'},
      {id:'F-002',kind:'function',name:'查询',goal:'查询数据',sourceUnitIds:['S-001'],ruleIds:[],requirementIds:[],state:'draft'},
      {id:'F-003',kind:'constraint',name:'权限约束',goal:'仅适用于发布',sourceUnitIds:['S-001'],appliesToFeatureIds:['F-001'],ruleIds:[],requirementIds:[],state:'draft'},
    ],requirements:[],clarifications:[{id:'Q-001',question:'是否支持多域名？',reason:'原文未决',affectedIds:['S-001'],state:'open'}]};
  const file=path.join(outputRoot,'relations.xlsx');await writeResultWorkbook(project,file);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);
  const features=workbook.getWorksheet('功能清单')!,questions=workbook.getWorksheet('待确认事项')!;
  expect(features.getCell('H1').value).toBe('条目类型');expect(features.getCell('I1').value).toBe('适用功能');
  expect(features.getCell('H2').value).toBe('业务功能');expect(features.getCell('H4').value).toBe('跨功能约束');
  expect(features.getCell('I4').value).toBe('发布');expect(features.getCell('I4').value).not.toContain('查询');
  expect(questions.getCell('G2').value).toContain('第 20 行');expect(questions.getCell('G2').value).toContain('是否支持多域名？');expect(questions.getCell('G2').value).toContain('发布设置');
  expect(workbook.worksheets.filter(sheet=>sheet.state==='visible')).toHaveLength(5);
  expect(workbook.worksheets.filter(sheet=>sheet.state==='hidden').map(sheet=>sheet.name)).toEqual(['来源处置','原文追踪','审查历史']);
});
describe('Excel 结果工作簿',()=>{it('生成五张业务主表，隐藏追溯并保留可读来源与内部链接',async()=>{await mkdir(outputRoot,{recursive:true});const project:PrdProject={id:'test',name:'测试需求',sourceName:'test.md',sourceHash:'x',revision:1,importedAt:new Date().toISOString(),rawText:'',stage:'review',sourceUnits:[{id:'S-001',label:'规则',kind:'paragraph',excerpt:'用户可以提交',location:'第1段',status:'processed'}],sourceDispositions:[{sourceUnitId:'S-001',kind:'requirement',reason:'明确业务要求',featureIds:['F-01']}],rules:[],features:[{id:'F-01',name:'提交',goal:'提交数据',sourceUnitIds:['S-001'],ruleIds:[],requirementIds:['R-001'],state:'reviewed'}],requirements:[{id:'R-001',title:'提交数据',behavior:'用户提交有效数据',conditions:['已登录'],constraints:[],explicitAcceptanceConditions:['提交成功后显示编号'],sourceUnitIds:['S-001'],ruleIds:[],state:'reviewed'}],clarifications:[],audit:{passed:false,issues:[{id:'A-001',direction:'forward',type:'语义缺口',sourceUnitIds:['S-001'],affectedIds:['R-001'],detail:'需要确认'}]}};project.sourceUnits[0].asset={path:'image.png',mimeType:'image/png',sha256:'fixture',readStatus:'read',extractedText:'图片中的必填条件'};project.audit!.issues.push({id:'A-FIXED',direction:'forward',type:'旧问题',sourceUnitIds:['S-001'],affectedIds:['R-001'],detail:'已修复，不再交给用户处理',disposition:'repaired'});const file=path.join(outputRoot,'result.xlsx');await writeResultWorkbook(project,file);const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);expect(workbook.worksheets.map(s=>s.name)).toEqual(['阅读说明与汇总','功能清单','需求明细','待确认事项','需求审查问题','来源处置','原文追踪','审查历史']);expect(workbook.getWorksheet('来源处置')?.getCell('B2').value).toBe('requirement');expect(workbook.getWorksheet('需求明细')?.getCell('G2').value).toBe('提交成功后显示编号');expect(workbook.getWorksheet('需求审查问题')?.getCell('A2').value).toBe('A-001');expect(workbook.getWorksheet('需求审查问题')?.rowCount).toBe(2);expect(workbook.getWorksheet('审查历史')?.rowCount).toBe(3);expect(workbook.worksheets.filter(s=>s.state==='visible')).toHaveLength(5);expect(workbook.getWorksheet('需求明细')?.getCell('J2').value).toContain('第1段');expect(workbook.getWorksheet('需求明细')?.getCell('J2').value).toContain('图片中的必填条件');expect(workbook.getWorksheet('需求明细')?.getCell('I2').value).toBe('机器整理，待人工审阅');expect(workbook.getWorksheet('需求明细')?.getCell('B2').value).toEqual({text:'提交',hyperlink:"#'功能清单'!A2"})})});
it('多文件同名标题在主表与追溯中保留独立路径、版本及资料角色',async()=>{
  await mkdir(outputRoot,{recursive:true});
  const sourceUnits=['primary','supplement'].map((role,i)=>({id:`S-file-${i}`,fileId:`FILE-${i}`,fileRevision:i+2,logicalPath:`${i===0?'主需求':'补充'}/需求.md`,sourceRole:role as 'primary'|'supplement',label:'相同标题',kind:'paragraph' as const,excerpt:`原文${i}`,location:'第 1 行',status:'processed' as const}));
  const project:PrdProject={id:'bundle',name:'资料包',sourceName:'需求.md',sourceHash:'x',revision:1,importedAt:'',rawText:'',stage:'review',materialBundle:{id:'B-1',revision:8},sourceDocuments:sourceUnits.map(s=>({fileId:s.fileId,revision:s.fileRevision,logicalPath:s.logicalPath,role:s.sourceRole,rawText:s.excerpt})),sourceUnits,features:[{id:'F-1',name:'功能',goal:'功能',sourceUnitIds:sourceUnits.map(s=>s.id),ruleIds:[],requirementIds:[],state:'draft'}],requirements:[],clarifications:[]};
  const file=path.join(outputRoot,'bundle.xlsx');await writeResultWorkbook(project,file);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);
  const main=workbook.getWorksheet('功能清单')!.getCell('G2').value;
  expect(main).toContain('主需求/需求.md · 文件版本 2');expect(main).toContain('补充/需求.md · 文件版本 3');
  const trace=workbook.getWorksheet('原文追踪')!;
  expect(trace.getCell('G2').value).toBe('主需求/需求.md');expect(trace.getCell('H3').value).toBe(3);expect(trace.getCell('I3').value).toBe('补充资料');
  const summary=workbook.getWorksheet('阅读说明与汇总')!.getSheetValues();
  expect(JSON.stringify(summary)).toContain('资料包版本');expect(JSON.stringify(summary)).toContain('补充/需求.md · 文件版本 3 · 补充资料');
  expect(workbook.worksheets.filter(s=>s.state==='visible')).toHaveLength(5);
});
