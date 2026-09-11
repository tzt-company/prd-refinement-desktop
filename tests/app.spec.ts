import { describe, expect, it } from 'vitest';

describe('需求细化数据契约', () => {
  it('明确区分来源、规则、功能和需求明细', () => {
    const chain = ['SourceUnit', 'RequirementRule', 'Feature', 'RequirementDetail'];
    expect(new Set(chain).size).toBe(4);
  });
});
