import type { ModelNodeId } from '../src/types.js';

export type PromptBudgetClass = 'candidate'|'audit'|'repair';
export interface PromptMeasurement {
  characters:number;
  bytes:number;
  estimatedTokens:number;
  estimateMethod:'cjk-and-ascii-v1';
  sections:Record<string,number>;
  budgetClass:PromptBudgetClass;
  targetTokens:number;
  hardTokens:number;
}

const limits:Record<PromptBudgetClass,{target:number;hard:number}>={
  candidate:{target:6_000,hard:12_000},
  audit:{target:10_000,hard:16_000},
  repair:{target:12_000,hard:20_000},
};

export class PromptBudgetExceededError extends Error {
  constructor(readonly measurement:PromptMeasurement){super(`提示词超过 ${measurement.budgetClass} 节点硬预算：预计 ${measurement.estimatedTokens} tokens，限制 ${measurement.hardTokens} tokens`);this.name='PromptBudgetExceededError'}
}

export function budgetClassFor(node:ModelNodeId,purpose:string):PromptBudgetClass{
  if(node==='featureCandidates'||node==='featureCandidateRepair'||node==='featureCoverage'||node==='detailsFast')return'candidate';
  if(node==='repair'||purpose.startsWith('repair-')||purpose.includes('clarification'))return'repair';
  return'audit';
}

/** 不假装是供应商精确 tokenizer；中日韩字符按 1 token，其他字符按 4 字符/token 估算。 */
export function estimateTokens(text:string){let cjk=0,other=0;for(const char of text){if(/[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u.test(char))cjk++;else other++}return cjk+Math.ceil(other/4)}

export function measurePrompt(text:string,budgetClass:PromptBudgetClass,sections:Record<string,string>):PromptMeasurement{
  const limit=limits[budgetClass];return{characters:text.length,bytes:Buffer.byteLength(text,'utf8'),estimatedTokens:estimateTokens(text),estimateMethod:'cjk-and-ascii-v1',sections:Object.fromEntries(Object.entries(sections).map(([key,value])=>[key,value.length])),budgetClass,targetTokens:limit.target,hardTokens:limit.hard};
}

export function assertPromptBudget(measurement:PromptMeasurement){if(measurement.estimatedTokens>measurement.hardTokens)throw new PromptBudgetExceededError(measurement)}
export function attemptTimeoutMs(){return 120_000}
