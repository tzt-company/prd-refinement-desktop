import crypto from 'node:crypto';
export const normalize = value => String(value).normalize('NFKC').replace(/[\s\\*]/g, '').toLowerCase();
/** 只评估可定位产物正文的词面保真；原文引用、规则账本不能代替需求明细。 */
export function evaluateGold(gold, source, project) {
  if (crypto.createHash('sha256').update(source).digest('hex') !== gold.sourceSha256) throw new Error('原始PRD指纹不一致，必须重审gold');
  if (!Array.isArray(project.requirements) || !Array.isArray(project.clarifications)) throw new Error('待测产物缺少需求明细或待确认事项');
  const lines = source.split(/\r?\n/);
  const ids = new Set();
  const results = gold.cases.map(item => {
    if (ids.has(item.id)) throw new Error('重复gold ID'); ids.add(item.id);
    if (lines[item.source.line - 1] !== item.source.quote) throw new Error('gold来源定位不一致：' + item.id);
    if (!item.facets.length || item.facets.some(f => !f.length || f.some(t => !normalize(t)))) throw new Error('空gold判据');
    const records = item.target === 'clarifications' ? project.clarifications : project.requirements;
    const sourceIds = new Set((project.sourceUnits ?? []).filter(unit => normalize(unit.excerpt) === normalize(item.source.quote)).map(unit => unit.id));
    const entities = [...(project.rules ?? []), ...(project.requirements ?? []), ...(project.features ?? [])];
    const related = record => (record.sourceUnitIds ?? []).some(id => sourceIds.has(id)) || (record.affectedIds ?? []).some(id => sourceIds.has(id) || entities.some(entity => entity.id === id && (entity.sourceUnitIds ?? []).some(s => sourceIds.has(s))));
    const candidates = (records ?? []).filter(record => related(record)).map(record => {
      const text = item.target === 'clarifications'
        ? [record.question, record.reason].join(' ')
        : [record.title, record.behavior, ...(record.conditions ?? []), ...(record.constraints ?? []), ...(record.explicitAcceptanceConditions ?? [])].join(' ');
      // 不拼接不同条目，避免条件/行为在无关记录中碰巧出现即通过。
      const hits = item.facets.map(alternatives => alternatives.some(term => normalize(text).includes(normalize(term))));
      return { id: record.id, hits, score: hits.filter(Boolean).length };
    }).sort((a,b) => b.score - a.score);
    const best = candidates[0];
    return { id:item.id, category:item.category, title:item.title, sourceLine:item.source.line,
      status: best?.score === item.facets.length ? 'LEXICAL_MATCH' : 'REVIEW_REQUIRED',
      matchedRecordId:best?.id ?? null, missingFacets:item.facets.filter((_,i)=>!best?.hits[i]) };
  });
  return { evaluatorVersion:2, metric:'样本条目词面保真匹配率（不是语义precision/recall）', total:results.length,
    matched:results.filter(x=>x.status==='LEXICAL_MATCH').length, results,
    limitations:['同义转述可能漏报；含否定或错误关系的文本可能误报。','匹配仍需审阅角色、条件、否定、关联关系；不证明无遗漏。','样本定向选择且无真人独立复核，不代表总体质量。','评测器 v2 支持待确认事项直接引用原文单元；旧版遗漏该关联，历史分数不可直接比较，应以同版评测器重新计算。'] };
}
