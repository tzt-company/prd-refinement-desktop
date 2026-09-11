import {describe,expect,it} from 'vitest';
import {assertPromptBudget,budgetClassFor,estimateTokens,measurePrompt,PromptBudgetExceededError} from '../electron/prompt-budget';

describe('提示词预算',()=>{
  it('分别统计字符、字节、估算 token 和分区长度',()=>{const value=measurePrompt('中文 abc','candidate',{instruction:'中文',input:'abc'});expect(value).toMatchObject({characters:6,bytes:10,estimateMethod:'cjk-and-ascii-v1',sections:{instruction:2,input:3},targetTokens:6000,hardTokens:12000});expect(value.estimatedTokens).toBe(3)});
  it('超出节点硬预算时在模型调用前失败',()=>{const value=measurePrompt('中'.repeat(12001),'candidate',{input:'中'.repeat(12001)});expect(()=>assertPromptBudget(value)).toThrow(PromptBudgetExceededError)});
  it('按节点用途选择预算级别',()=>{expect(budgetClassFor('featureCandidates','candidate')).toBe('candidate');expect(budgetClassFor('audit','audit-1')).toBe('audit');expect(budgetClassFor('repair','repair-1')).toBe('repair');expect(estimateTokens('abcd')).toBe(1)});
});
