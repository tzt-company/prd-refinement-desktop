import { describe, expect, it } from 'vitest';
import { buildSourceUnits, enrichSourceContext, sourceCoverage } from '../electron/source-units';

describe('Markdown 原文建账',()=>{it('逐字保留标题、段落并把表格数据行独立建账',()=>{const text='# 标题\n\n说明文字。\n\n| 字段 | 要求 |\n|---|---|\n| X | 必填 |';const units=buildSourceUnits(text);expect(units.map(x=>x.kind)).toEqual(['heading','paragraph','table','table']);expect(units[3].excerpt).toBe('| X | 必填 |');expect(units[3].context).toContain('| 字段 | 要求 |');expect(sourceCoverage(text,units).complete).toBe(true)})});

it('识别加粗章节并在表格结束后恢复正文边界',()=>{const text='**1. 新增字段**\n\n| 字段 | 要求 |\n|---|---|\n| X | 必填 |\n提交后不允许修改。';const units=buildSourceUnits(text);expect(units.map(x=>x.kind)).toEqual(['heading','table','table','paragraph']);expect(units[3].excerpt).toBe('提交后不允许修改。');expect(sourceCoverage(text,units).complete).toBe(true)});

it('图片引用没有视觉读取证据时保持阻断',()=>{const units=buildSourceUnits('按下图显示。\n\n![错误文案](missing.png)');expect(units[1].kind).toBe('image');expect(units[1].status).toBe('blocked')});

it('图片后的正文行号准确且合成资产不会污染文本覆盖率',()=>{const text='前文\n![图](missing.png)\n后文';const units=buildSourceUnits(text);expect(units[2].location).toBe('第 3 行');expect(sourceCoverage(text,[...units,{id:'asset',kind:'image',label:'asset',excerpt:'额外图片',location:'DOCX',status:'pending',synthetic:true}]).complete).toBe(true)});

it('跨空行枚举项保留章节和引导语，正文与下一章节不继承枚举语义', () => {
  const text = '# 过程管理\n\n**1. 新增字段**\n\n**1.5 数据完整性**\n\n每类的 value 枚举：\n\n* Relevant flows missing（相关流存在缺失）\n\n* No statement（未声明）\n\n保存后提示成功。\n\n**2. 待确认事项**\n\n* 是否支持多域名？';
  const units = buildSourceUnits(text);
  for (const value of ['Relevant flows missing', 'No statement']) {
    const unit = units.find(item => item.excerpt.includes(value))!;
    expect(unit.context).toContain('过程管理');
    expect(unit.context).toContain('1. 新增字段');
    expect(unit.context).toContain('1.5 数据完整性');
    expect(unit.context).toContain('列表引导原文 [S-004]：每类的 value 枚举：');
  }
  expect(units.find(item => item.excerpt === '保存后提示成功。')!.context).not.toContain('列表引导原文');
  const next = units.find(item => item.excerpt.includes('是否支持多域名'))!;
  expect(next.context).toContain('2. 待确认事项');
  expect(next.context).not.toContain('1.5 数据完整性');
  expect(next.context).not.toContain('列表引导原文');
  expect(sourceCoverage(text, units).complete).toBe(true);
});

it('上下文持久化后重复补充幂等，保留表头且不改原文与编号', () => {
  const text = '# 字段调整\n\n| 字段 | 要求 |\n|---|---|\n| X | 必填 |';
  const units = buildSourceUnits(text);
  const restored = JSON.parse(JSON.stringify(units));
  const enriched = enrichSourceContext(restored);
  expect(enriched).toEqual(units);
  expect(enriched[2].context).toContain('| 字段 | 要求 |\n|---|---|');
  expect(enriched[2].context).toContain('章节路径：[S-001] 字段调整');
  expect(enriched.map(({ id, excerpt, location }) => ({ id, excerpt, location }))).toEqual(units.map(({ id, excerpt, location }) => ({ id, excerpt, location })));
  expect(sourceCoverage(text, enriched).complete).toBe(true);
});

it('引导语只提供给紧接的列表，不跨普通正文或表格传播', () => {
  const text = '可选值：\n\n这里是另一个要求。\n\n* 独立条目\n\n下一组：\n\n| 名称 |\n|---|\n| A |\n\n* 其他条目';
  const units = buildSourceUnits(text);
  for (const unit of units.filter(item => item.excerpt.startsWith('*'))) expect(unit.context ?? '').not.toContain('列表引导原文');
});
