import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Progress, RuntimeCost, runtimeTiming } from '../src/App.js';
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
    expect(progress).toContain('首次识别');
    expect(progress).toContain('逐份候选内容提取功能候选');
    expect(progress).toContain('gpt-5.6-luna');
    expect(progress).toContain('定点返工');
    expect(progress).toContain('只修订检查发现问题的候选');
    expect(progress).toContain('gpt-5.6-terra');
    expect(progress).toContain('推理 高');
    expect(cost).toContain('gpt-5.6-luna');
    expect(cost).toContain('推理深度');
    expect(cost).toContain('<td>低</td>');
  });

  it('逐功能细化明确区分简单功能、复杂功能与补漏模型的职责', () => {
    const task={runtimeConfig:{adapter:'codex-oauth',provider:'openai-codex',model:'gpt-5.6-terra',reasoningEffort:'low',fastModel:'gpt-5.6-luna',fastReasoningEffort:'low',nodeProfiles:{detailsFast:{model:'gpt-5.6-luna',reasoningEffort:'low'},details:{model:'gpt-5.6-terra',reasoningEffort:'medium'}},maxParallel:1},status:'running',progress:62.5,startedAt:1000,steps:[{id:'details',name:'逐功能细化',note:'已细化 1/2 个功能',runs:3,status:'running',startedAt:1000}],project:{}} as AnalysisTask;
    const progress=renderToStaticMarkup(React.createElement(Progress,{task,now:3000}));
    expect(progress).toContain('累计业务调用 3 次');
    expect(progress).not.toContain('运行 3 轮');
    expect(progress).toContain('简单功能细化');
    expect(progress).toContain('处理短小且无复杂联动的功能');
    expect(progress).toContain('复杂功能与补漏');
    expect(progress).toContain('处理状态、权限、依赖、例外及定点补漏');
  });
  it('区分模型活跃耗时、等待重试与墙钟耗时',()=>{
    const task={status:'failed',startedAt:1000,completedAt:13000,steps:[],runtimeMetrics:[
      {sessionId:'prd-T-a1-candidate-1-try1',startedAt:1000,completedAt:4000,durationMs:3000,adapter:'codex-oauth',model:'fast',reasoningEffort:'low'},
      {sessionId:'prd-T-a1-coverage-2-try1',startedAt:2000,completedAt:5000,durationMs:3000,adapter:'codex-oauth',model:'sol',reasoningEffort:'low'},
      {sessionId:'prd-T-a2-unify-3-try1',startedAt:10000,completedAt:13000,durationMs:3000,adapter:'codex-oauth',model:'sol',reasoningEffort:'low'},
    ],project:{}} as AnalysisTask;
    expect(runtimeTiming(task)).toEqual({active:7000,retryWait:5000});
    const cost=renderToStaticMarkup(React.createElement(RuntimeCost,{task}));
    expect(cost).toContain('模型活跃耗时');expect(cost).toContain('墙钟耗时');expect(cost).toContain('等待重试');expect(cost).toContain('7 秒');expect(cost).toContain('12 秒');expect(cost).toContain('5 秒');
  });
});
