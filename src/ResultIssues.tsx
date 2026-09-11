import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, CircleHelp, X } from 'lucide-react';
import type { AuditIssue, Clarification, PrdProject, SourceUnit } from './types';
import { activeClarifications, activePlatformIssues, affectedLabels, clarificationCounts, clarificationLevel, clarificationLevelLabel, issueTitle, readableContext, sourceHeading, sourcePosition } from './result-presentation';

type Item = {kind:'clarification';value:Clarification}|{kind:'platform';value:AuditIssue};
type Filter = 'all'|'blocking'|'suggestion'|'ignorable'|'platform';

function evidenceSources(project:PrdProject,item:Item){
  const ids=item.kind==='platform'?item.value.sourceUnitIds:[...(item.value.sourceRefs??[]).map(ref=>ref.sourceUnitId),...item.value.affectedIds.flatMap(id=>project.requirements.find(requirement=>requirement.id===id)?.sourceUnitIds??(id.startsWith('S-')?[id]:[]))];
  return [...new Set(ids)].map(id=>project.sourceUnits.find(source=>source.id===id)).filter((source):source is SourceUnit=>!!source);
}

export function ResultIssues({project}:{project:PrdProject}){
  const counts=clarificationCounts(project),[filter,setFilter]=useState<Filter>('all'),[selectedKey,setSelectedKey]=useState<string>();
  const items=useMemo<Item[]>(()=>[
    ...activeClarifications(project).map(value=>({kind:'clarification' as const,value})),
    ...activePlatformIssues(project).map(value=>({kind:'platform' as const,value})),
  ].sort((a,b)=>{
    const rank=(item:Item)=>item.kind==='platform'?0:{blocking:0,suggestion:1,ignorable:2}[clarificationLevel(item.value)];return rank(a)-rank(b);
  }),[project]);
  const visible=items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'platform') return item.kind === 'platform';
    return item.kind === 'clarification' && clarificationLevel(item.value) === filter;
  });
  const selected=items.find(item=>`${item.kind}-${item.value.id}`===selectedKey);
  const filters:Array<[Filter,string,number]>=[['all','全部',items.length],['blocking','阻塞',counts.blocking],['suggestion','建议',counts.suggestion],['ignorable','可忽略',counts.ignorable],['platform','平台整理',counts.platform]];
  return <section className="issues-workspace">
    <header><div><h2>待处理事项</h2><p>业务澄清按交付影响分级；平台整理问题由平台处理。</p></div><div className="issue-filters" aria-label="筛选待处理事项">{filters.map(([id,label,count])=><button key={id} className={filter===id?'active':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}<b>{count}</b></button>)}</div></header>
    {visible.length===0?<div className="issue-empty"><CheckCircle2/><strong>当前没有这类待处理事项</strong><span>可以查看其他级别或返回概览。</span></div>:<div className="issue-list">{visible.map(item=>{
      const clarification=item.kind==='clarification'?item.value:undefined,legacy=clarification&&!clarification.knownFacts;
      const level=item.kind==='platform'?'blocking':clarificationLevel(clarification!);const title=item.kind==='platform'?issueTitle(item.value):legacy?'旧任务中的待确认内容需要重新分析':clarification!.question;
      return <button key={`${item.kind}-${item.value.id}`} onClick={()=>setSelectedKey(`${item.kind}-${item.value.id}`)}><span className={`issue-level ${level}`}>{item.kind==='platform'?'阻塞':clarificationLevelLabel[level]}</span><span><strong>{title}</strong><small>{item.kind==='platform'?'平台处理':level==='blocking'?'需要你澄清':level==='suggestion'?'建议确认':'无需决定'} · 影响 {affectedLabels(project,item.value.affectedIds).slice(0,2).join('、')}</small></span><ChevronRight/></button>
    })}</div>}
    <details className="check-history"><summary>查看自动检查记录（{project.audit?.issues.length??0}）</summary><p>检查记录用于说明平台发现、修复或排除过什么，不要求用户逐条审批。</p>{(project.audit?.issues??[]).map(issue=><div key={issue.id}><strong>{issueTitle(issue)}</strong><span>{issue.disposition==='repaired'?'已修复':issue.disposition==='dismissed'?'有证据排除':issue.disposition==='needs-confirmation'?'已转为业务澄清':'未解决'}</span></div>)}</details>
    {selected&&<IssueDrawer project={project} item={selected} onClose={()=>setSelectedKey(undefined)}/>} 
  </section>;
}

function IssueDrawer({project,item,onClose}:{project:PrdProject;item:Item;onClose:()=>void}){
  const clarification=item.kind==='clarification'?item.value:undefined,legacy=clarification&&!clarification.knownFacts;const level=item.kind==='platform'?'blocking':clarificationLevel(clarification!);
  return <aside className="drawer issue-drawer" aria-label="待处理事项详情"><header><div><span className={`issue-level ${level}`}>{item.kind==='platform'?'阻塞':clarificationLevelLabel[level]}</span><h2>{item.kind==='platform'?issueTitle(item.value):legacy?'旧任务中的待确认内容需要重新分析':clarification!.question}</h2><small>{item.kind==='platform'?'处理方：平台':'处理方：需求负责人'}</small></div><button onClick={onClose} aria-label="关闭"><X/></button></header><div>
    {item.kind==='platform'?<><h3>平台需要处理什么</h3><p>{item.value.detail}</p><h3>为什么阻塞</h3><p>当前整理结果存在已确认问题，修正并重新检查前不能作为正式 Agent 需求包。</p></>:legacy?<><h3>为什么需要重新分析</h3><p>这条记录来自旧版任务，缺少完整问题、影响和分级依据。重新分析后才能作为可回答的业务澄清。</p></>:<><h3>已知事实</h3><p>{clarification!.knownFacts}</p><h3>唯一未决点</h3><p>{clarification!.unresolvedPoint}</p><h3>不处理的影响</h3><p>{clarification!.impact}</p><h3>分级依据</h3><p>{clarification!.levelReason}</p>{clarification!.defaultResolution&&<><h3>暂不处理时采用的口径</h3><p>{clarification!.defaultResolution}</p></>}</>}
    <h3>影响内容</h3>{affectedLabels(project,item.value.affectedIds).map((label,index)=><p className="rule" key={`${label}-${index}`}>{label}</p>)}
    <h3>原文依据</h3>{evidenceSources(project,item).map(source=><section className="source-card" key={source.id}><strong>{sourceHeading(source)}</strong><small>{sourcePosition(source)}</small>{readableContext(source.context)&&<p>{readableContext(source.context)}</p>}<p className="source-excerpt">{source.asset?.extractedText??source.excerpt}</p></section>)}
    {item.kind==='clarification'&&!legacy&&<p className="issue-next"><CircleHelp/>回答入口将在“继续完善”中保存为新一轮输入；保存答案不直接改写本轮结果。</p>}
    {item.kind==='platform'&&<p className="issue-next"><AlertTriangle/>请从任务页重新分析或等待平台修正，不能由业务人员代替平台裁决。</p>}
  </div></aside>;
}
