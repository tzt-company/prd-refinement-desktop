import { createHash } from 'node:crypto';
import type { SourceRef, SourceUnit } from '../src/types.js';

export interface SourceEvidence {
  id: string;
  sourceUnitId: string;
  start: number;
  end: number;
  text: string;
}

const sourceText = (unit: SourceUnit) => unit.asset?.extractedText ?? unit.excerpt;

function boundaries(text: string) {
  const ranges: Array<[number, number]> = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!/[。！？；\n]/u.test(text[index])) continue;
    const end = index + 1;
    if (text.slice(start, end).trim()) { ranges.push([start, end]); start = end; }
  }
  if (text.slice(start).trim()) ranges.push([start, text.length]);
  else if (ranges.length) ranges[ranges.length - 1][1] = text.length;
  return ranges;
}

/** 证据位置完全由冻结来源生成；模型只选择 id，不复制文字或计算偏移。 */
export function buildEvidenceCatalog(units: SourceUnit[]): SourceEvidence[] {
  const result: SourceEvidence[] = [];
  for (const unit of units) {
    const text = sourceText(unit);
    if (!text.length) continue;
    // 同一文字只发送一次。多句来源按不重叠句段提供，避免“整段 + 分句”重复放大提示词。
    const sentenceRanges=boundaries(text);
    const ranges: Array<[number, number]> = sentenceRanges.length ? sentenceRanges : [[0,text.length]];
    const seen = new Set<string>();
    for (const [start, end] of ranges) {
      const key = `${start}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const digest = createHash('sha256').update(`${unit.id}\0${start}\0${end}`).digest('hex').slice(0, 12);
      result.push({ id: `E-${digest}`, sourceUnitId: unit.id, start, end, text: text.slice(start, end) });
    }
  }
  return result;
}

export function resolveEvidenceIds(ids: unknown, catalog: SourceEvidence[], path: string): SourceRef[] {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !id.trim())) throw new Error(`${path} 必须是非空证据编号数组`);
  const byId = new Map(catalog.map(item => [item.id, item]));
  return ids.map((raw, index) => {
    const evidence = byId.get(raw as string);
    if (!evidence) throw new Error(`${path}[${index}] 引用了未提供或过期的证据编号：${String(raw)}`);
    return { sourceUnitId: evidence.sourceUnitId, start: evidence.start, end: evidence.end };
  });
}

export function materializeEvidenceSelections(value: Record<string, unknown>, catalog: SourceEvidence[]) {
  const visit = (current: unknown, path: string): unknown => {
    if (Array.isArray(current)) return current.map((item, index) => visit(item, `${path}[${index}]`));
    if (!current || typeof current !== 'object') return current;
    const item = { ...(current as Record<string, unknown>) };
    if (catalog.length && Array.isArray(item.sourceRefs) && item.sourceRefs.some(raw => raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'quote'))) throw new Error(`${path}.sourceRefs 不得包含模型抄写的 quote，请选择 evidenceIds`);
    if (Object.prototype.hasOwnProperty.call(item, 'evidenceIds')) {
      item.sourceRefs = resolveEvidenceIds(item.evidenceIds, catalog, `${path}.evidenceIds`);
      delete item.evidenceIds;
    }
    if (item.evidenceIdsByFeature && typeof item.evidenceIdsByFeature === 'object' && !Array.isArray(item.evidenceIdsByFeature)) {
      item.sourceRefsByFeature = Object.fromEntries(Object.entries(item.evidenceIdsByFeature as Record<string, unknown>).map(([key, ids]) => [key, resolveEvidenceIds(ids, catalog, `${path}.evidenceIdsByFeature.${key}`)]));
      delete item.evidenceIdsByFeature;
    }
    if (Object.prototype.hasOwnProperty.call(item, 'explicitAcceptanceEvidenceIds')) {
      if (!Array.isArray(item.explicitAcceptanceEvidenceIds)) throw new Error(`${path}.explicitAcceptanceEvidenceIds 必须是证据编号数组`);
      const selected = item.explicitAcceptanceEvidenceIds.length ? resolveEvidenceIds(item.explicitAcceptanceEvidenceIds, catalog, `${path}.explicitAcceptanceEvidenceIds`) : [];
      const byUnit = new Map(catalog.map(evidence => [evidence.id, evidence]));
      const ids = item.explicitAcceptanceEvidenceIds as string[];
      item.explicitAcceptanceConditions = ids.map(id => byUnit.get(id)!.text);
      const bindings = item.evidenceBindings && typeof item.evidenceBindings === 'object' && !Array.isArray(item.evidenceBindings) ? { ...(item.evidenceBindings as Record<string, unknown>) } : {};
      bindings.explicitAcceptanceConditions = selected.map(ref => [ref]);
      item.evidenceBindings = bindings;
      delete item.explicitAcceptanceEvidenceIds;
    }
    if (item.evidenceBindings && typeof item.evidenceBindings === 'object' && !Array.isArray(item.evidenceBindings)) {
      const bindings = { ...(item.evidenceBindings as Record<string, unknown>) };
      for (const key of ['behavior', 'conditions', 'constraints', 'explicitAcceptanceConditions']) {
        const raw = bindings[key];
        if (!Array.isArray(raw)) continue;
        if (key === 'behavior') {
          if (raw.every(value => typeof value === 'string')) bindings[key] = resolveEvidenceIds(raw, catalog, `${path}.evidenceBindings.${key}`);
        } else bindings[key] = raw.map((ids, index) => Array.isArray(ids) && ids.every(value => typeof value === 'string') ? resolveEvidenceIds(ids, catalog, `${path}.evidenceBindings.${key}[${index}]`) : ids);
      }
      item.evidenceBindings = bindings;
      const collect = (value: unknown): SourceRef[] => Array.isArray(value) ? value.flatMap(collect) : value && typeof value === 'object' && typeof (value as SourceRef).sourceUnitId === 'string' ? [value as SourceRef] : [];
      const selected = Object.values(bindings).flatMap(collect);
      if (selected.length) item.sourceUnitIds = [...new Set(selected.map(ref => ref.sourceUnitId))];
    }
    for (const [key, child] of Object.entries(item)) item[key] = visit(child, `${path}.${key}`);
    return item;
  };
  return visit(value, 'response') as Record<string, unknown>;
}

export function evidencePromptInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { input, catalog: [] as SourceEvidence[] };
  const result = structuredClone(input) as Record<string, unknown>;
  const units = Array.isArray(result.sourceUnits) ? result.sourceUnits as SourceUnit[] : [];
  const allowedRefs=Array.isArray(result.evidenceSourceRefs)?result.evidenceSourceRefs as SourceRef[]:undefined;
  const candidateRefs=Array.isArray(result.candidateEvidenceRefs)?result.candidateEvidenceRefs as Array<{candidateId:string;refs:SourceRef[]}>:undefined;
  delete result.evidenceSourceRefs;
  delete result.candidateEvidenceRefs;
  const catalog = buildEvidenceCatalog(units).filter(item=>!allowedRefs||allowedRefs.some(ref=>ref.sourceUnitId===item.sourceUnitId&&item.start>=(ref.start??0)&&item.end<=(ref.end??Number.MAX_SAFE_INTEGER))).map((item,index)=>({...item,id:`E${index+1}`}));
  if (catalog.length) {
    result.sourceUnits = units.map(unit => ({id:unit.id,label:unit.label,kind:unit.kind,location:unit.location,...(unit.logicalPath?{logicalPath:unit.logicalPath}:{}),...(unit.sourceRole?{sourceRole:unit.sourceRole}:{}),...(unit.context?{context:unit.context}:{}),...(unit.asset?{asset:{mimeType:unit.asset.mimeType,readStatus:unit.asset.readStatus}}:{})}));
    result.evidenceCatalog = candidateRefs?catalog.map(evidence=>({...evidence,candidateIds:candidateRefs.filter(item=>item.refs.some(ref=>ref.sourceUnitId===evidence.sourceUnitId&&evidence.start>=(ref.start??0)&&evidence.end<=(ref.end??Number.MAX_SAFE_INTEGER))).map(item=>item.candidateId)})):catalog;
  }
  return { input: result, catalog };
}
