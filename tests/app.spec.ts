import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { clearFeedbackDraft, featureScope, loadFeedbackDraft, Progress, RuntimeCost, saveFeedbackDraft, shouldSubmitFeedback, TaskFeedback, TaskPage, runtimeTiming } from '../src/App.js';
import { ResultIssues } from '../src/ResultIssues.js';
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
    expect(progress).toContain('只修订边界或分类问题');
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
    expect(progress).toContain('复杂功能细化');
    expect(progress).toContain('处理状态、权限、依赖和例外');
  });
  it('旧任务持久化的来源包文案在界面统一显示为候选内容',()=>{
    const task={status:'running',progress:25,startedAt:1000,steps:[{id:'candidates',name:'功能候选识别',note:'已识别 17/17 个来源包',runs:19,status:'completed'}],project:{}} as AnalysisTask;
    const progress=renderToStaticMarkup(React.createElement(Progress,{task,now:3000}));
    expect(progress).toContain('已识别 17/17 个候选内容');expect(progress).toContain('累计业务调用 19 次');expect(progress).not.toContain('来源包');expect(progress).not.toContain('运行 19 轮');
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

  it('结果页使用一个任务级自然语言调整入口',()=>{
    const task={id:'T-1',resultVersion:3,status:'completed',progress:100,steps:[],adjustment:{feedback:'统一含税',results:[{operationId:'OP-1',status:'applied',featureIds:['F-1'],clarificationIds:[],detail:'退款金额已统一为含税口径。'},{operationId:'OP-2',status:'needs-confirmation',featureIds:[],clarificationIds:[],detail:'仍需确认支付超时范围。'}]},project:{name:'订单',features:[],requirements:[],clarifications:[],sourceUnits:[]}} as unknown as AnalysisTask;
    const html=renderToStaticMarkup(React.createElement(TaskFeedback,{task,onAdjust:async()=>undefined}));
    expect(html).toContain('描述你希望怎么调整');
    expect(html).toContain('可以一次写多条意见');
    expect(html).toContain('按说明调整');
    expect(html).toContain('已落实 1 项，1 项仍需处理');
    expect(html).toContain('退款金额已统一为含税口径。');
    expect(html).toContain('仍需确认支付超时范围。');
    expect(html).not.toContain('OP-1');
    expect(html).toContain('noValidate=""');
    expect(html).not.toContain('调整方式');
    expect(html).not.toContain('处理方式');
  });

  it('待处理事项首屏直接显示问题、已知事实和影响',()=>{
    const project={features:[],requirements:[],sourceUnits:[],clarifications:[{id:'Q-1',question:'退款金额是否含税？',reason:'原文未明确',level:'blocking',knownFacts:'退款金额来自原订单。',unresolvedPoint:'税额口径未确定。',impact:'会影响退款金额计算。',levelReason:'阻塞金额实现。',affectedIds:[],state:'open'}]} as any;
    const html=renderToStaticMarkup(React.createElement(ResultIssues,{project}));
    expect(html).toContain('退款金额是否含税？');
    expect(html).toContain('退款金额来自原订单。');
    expect(html).toContain('会影响退款金额计算。');
    expect(html).toContain('查看依据');
    expect(html).not.toContain('填写答案');
    expect(html).not.toContain('处理方式');
  });

  it('草稿存储不可用时不阻断页面',()=>{
    const unavailable={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')},removeItem(){throw new Error('blocked')}};
    expect(loadFeedbackDraft(unavailable,'draft')).toBe('');
    expect(()=>saveFeedbackDraft(unavailable,'draft','调整内容')).not.toThrow();
    expect(()=>clearFeedbackDraft(unavailable,'draft')).not.toThrow();
  });

  it('输入法组合态不会触发快捷提交',()=>{
    expect(shouldSubmitFeedback({ctrlKey:true,metaKey:false,key:'Enter',nativeEvent:{isComposing:true}})).toBe(false);
    expect(shouldSubmitFeedback({ctrlKey:true,metaKey:false,key:'Enter',nativeEvent:{isComposing:false}})).toBe(true);
    expect(shouldSubmitFeedback({ctrlKey:false,metaKey:true,key:'Enter',nativeEvent:{isComposing:false}})).toBe(true);
  });

  it('完成任务默认进入功能范围工作台并集中任务动作',()=>{
    const requirement={id:'R-1',title:'查询订单',behavior:'按条件返回订单。',conditions:[],constraints:[],explicitAcceptanceConditions:[],sourceUnitIds:[],ruleIds:[],state:'reviewed',deliveryScope:'current'};
    const task={id:'T-1',resultVersion:2,status:'completed',progress:100,attempt:1,createdAt:1,completedAt:2,steps:[],project:{id:'P-1',name:'订单中心',sourceName:'订单.prd',sourceHash:'x',revision:1,importedAt:'2026-09-13',rawText:'',stage:'review',sourceUnits:[],features:[{id:'F-1',name:'订单查询',sourceUnitIds:[],ruleIds:[],requirementIds:['R-1'],state:'reviewed'}],requirements:[requirement],clarifications:[]}} as AnalysisTask;
    const noop=()=>undefined,asyncNoop=async()=>undefined;
    const html=renderToStaticMarkup(React.createElement(TaskPage,{task,versions:[task],now:3,onBack:noop,onVersion:noop,onAdjust:asyncNoop,onScope:asyncNoop,onArchive:asyncNoop,onRestore:asyncNoop,onDelete:asyncNoop}));
    expect(html).toContain('功能与需求');
    expect(html).toContain('全部需求');
    expect(html).toContain('待处理事项');
    expect(html).toContain('执行记录');
    expect(html).toContain('生成交付包');
    expect(html).toContain('打开产物');
    expect(html).toContain('全选本页功能');
    expect(html).toContain('选择当前筛选全部（1）');
    expect(html).toContain('标记本期不做');
    expect(html).toContain('恢复本期');
    expect(html).toContain('取消选择');
    expect(html).toContain('描述你希望怎么调整');
    expect(html).not.toContain('概览');
  });

  it('功能范围状态与批量选择状态分离',()=>{
    const project={requirements:[{id:'R-1',deliveryScope:'current'},{id:'R-2',deliveryScope:'excluded'}]} as any;
    expect(featureScope(project,{id:'F-1',requirementIds:['R-1','R-2']} as any).label).toBe('部分纳入（1/2）');
    expect(featureScope(project,{id:'F-2',requirementIds:['R-2'],deliveryScope:'excluded'} as any).label).toBe('本期不做');
  });
});
