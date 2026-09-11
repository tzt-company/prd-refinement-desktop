import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Progress, RuntimeCost } from '../src/App.js';
import type { AnalysisTask } from '../src/types.js';

describe('需求细化数据契约', () => {
  it('明确区分来源、规则、功能和需求明细', () => {
    const chain = ['SourceUnit', 'RequirementRule', 'Feature', 'RequirementDetail'];
    expect(new Set(chain).size).toBe(4);
  });

  it('执行节点和成本分布显示任务实际模型与推理深度', () => {
    const task={runtimeConfig:{adapter:'codex-oauth',provider:'openai-codex',model:'gpt-5.6-terra',reasoningEffort:'medium',fastModel:'gpt-5.6-luna',fastReasoningEffort:'low',nodeProfiles:{featureCandidates:{model:'gpt-5.6-luna',reasoningEffort:'low'},featureCandidateRepair:{model:'gpt-5.6-terra',reasoningEffort:'high'}},maxParallel:1},status:'running',progress:12.5,startedAt:1000,steps:[{id:'candidates',name:'功能候选识别',note:'已识别 1/2 份候选内容',status:'running',startedAt:1000}],runtimeMetrics:[{sessionId:'prd-T-a1-candidate-0-1-try1',adapter:'codex-oauth',model:'gpt-5.6-luna',reasoningEffort:'low',startedAt:1000,completedAt:2000,durationMs:1000,inputTokens:10,outputTokens:2}],project:{}} as AnalysisTask;
    const progress=renderToStaticMarkup(React.createElement(Progress,{task,now:3000}));
    const cost=renderToStaticMarkup(React.createElement(RuntimeCost,{task}));
    expect(progress).toContain('识别 gpt-5.6-luna · 推理 低');
    expect(progress).toContain('返工 gpt-5.6-terra · 推理 高');
    expect(cost).toContain('gpt-5.6-luna');
    expect(cost).toContain('推理深度');
    expect(cost).toContain('<td>低</td>');
  });
});
