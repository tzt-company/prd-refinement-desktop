import type { SourceUnit } from '../src/types.js';
import type { MaterialQuery, MaterialSearchResult } from '../src/material-types.js';

const normalize = (text: string) => text.normalize('NFKC').toLowerCase();
const responseBudget = 1_000_000;
function grams(text: string) {
  const result = new Set<string>();
  for (const word of normalize(text).match(/[\p{L}\p{N}]+/gu) ?? []) {
    const chars = Array.from(word);
    for (let i = 0; i < chars.length; i++) {
      result.add(chars[i]);
      if (i + 1 < chars.length) result.add(chars[i] + chars[i + 1]);
    }
  }
  return result;
}

/** 只读定位索引；检索命中不代表来源覆盖，覆盖核对仍遍历完整台账。 */
export class SourceIndex {
  private readonly units = new Map<string, SourceUnit>();
  private readonly postings = new Map<string, Set<string>>();
  private readonly texts = new Map<string, string>();
  private readonly titles = new Map<string, string>();

  constructor(units: SourceUnit[], private readonly revision: number) {
    for (const original of units) {
      if (this.units.has(original.id)) throw new Error(`来源编号重复：${original.id}`);
      const unit = structuredClone(original);
      this.units.set(unit.id, unit);
      const text = normalize([unit.label, unit.context, unit.excerpt, unit.asset?.extractedText].filter(Boolean).join('\n'));
      this.texts.set(unit.id, text);
      this.titles.set(unit.id, normalize(unit.label));
      for (const gram of grams(text)) {
        let posting = this.postings.get(gram);
        if (!posting) this.postings.set(gram, posting = new Set());
        posting.add(unit.id);
      }
    }
  }

  query(query: MaterialQuery): MaterialSearchResult {
    if ((query.query?.length ?? 0) > 1000) throw new Error('检索词不能超过 1000 字符');
    const terms = normalize(query.query ?? '').trim().split(/\s+/u).filter(Boolean);
    const keys = [...new Set(terms.flatMap(term => [...grams(term)]))];
    const lists = keys.map(key => this.postings.get(key) ?? new Set<string>()).sort((a, b) => a.size - b.size);
    const candidates = lists.length ? [...lists[0]].filter(id => lists.every(list => list.has(id))) : [...this.units.keys()];
    const matches = candidates.filter(id => (!query.fileId || this.units.get(id)!.fileId === query.fileId) && terms.every(term => this.texts.get(id)!.includes(term)));
    const score = (id: string) => terms.filter(term => this.titles.get(id)!.includes(term)).length;
    matches.sort((a, b) => score(b) - score(a) || (a < b ? -1 : a > b ? 1 : 0));
    const offset = Number.isFinite(query.offset) ? Math.max(0, Math.floor(query.offset!)) : 0;
    const limit = Number.isFinite(query.limit) ? Math.min(100, Math.max(1, Math.floor(query.limit!))) : 30;
    const items: SourceUnit[] = [];
    let size = 0;
    for (const id of matches.slice(offset, offset + limit)) {
      const unit = this.units.get(id)!;
      const unitSize = JSON.stringify(unit).length;
      if (size + unitSize > responseBudget) {
        if (!items.length) throw new Error(`来源单元过大，无法返回：${id}`);
        break;
      }
      items.push(structuredClone(unit));
      size += unitSize;
    }
    const next = offset + items.length;
    return { items, total: matches.length, revision: this.revision, ...(next < matches.length ? { nextOffset: next } : {}) };
  }

  read(ids: string[]): SourceUnit[] {
    if (ids.length > 100) throw new Error('每次最多读取 100 个来源单元');
    let size = 0;
    return ids.map(id => {
      const unit = this.units.get(id);
      if (!unit) throw new Error(`未知来源编号：${id}`);
      size += JSON.stringify(unit).length;
      if (size > responseBudget) throw new Error('来源读取超过单次预算，请减少来源编号数量');
      return structuredClone(unit);
    });
  }
}
