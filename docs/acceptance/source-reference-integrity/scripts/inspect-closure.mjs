import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateDirectGraph } from '../../../../dist-electron/electron/domain.js';
import { planDetailRepairs } from '../../../../dist-electron/electron/audit-repair.js';

// 只读核对任务终态、遗留问题与当前图，不调用模型、不修改任务。
const taskId = process.argv[2] ?? 'T-C5E8F68D';
if (!/^T-[A-Z0-9]+$/.test(taskId)) throw new Error('任务编号无效');
const task = JSON.parse(await readFile(path.join(process.env.APPDATA, 'prd-refinement-desktop', 'analysis-tasks', `${taskId}.json`), 'utf8'));
const p = task.project;
const issues = p.audit?.issues ?? [];
const open = issues.filter(i => !['repaired', 'dismissed'].includes(i.disposition) && !(i.disposition === 'needs-confirmation' && i.clarificationId));
const graph = validateDirectGraph(p.sourceUnits, p.sourceDispositions, p.features, p.requirements, p.clarifications);
const missing = new Set(graph.uncovered.map(d => d.sourceUnitId));
const structural = issues.filter(i => i.type === '原文来源未落实');
const stale = structural.filter(i => i.disposition === 'open' && i.sourceUnitIds.every(id => !missing.has(id)));
const repairs = task.checkpoint.repairs ?? [];
const attempted = new Set(task.checkpoint.repairIssueIds ?? []);
const largest = [...repairs].sort((a, b) => b.originalIssues.length - a.originalIssues.length)[0];
const metadata = p.sourceUnits.find(u => u.id.endsWith('-0182'));
const matching = planDetailRepairs(open, p);
const skipped = planDetailRepairs(open.filter(i => !attempted.has(i.id)), p);
console.log(JSON.stringify({
  taskId, status: task.status, progress: task.progress, delivery: p.delivery.state,
  auditPassed: p.audit.passed, issues: issues.length, unresolvedPlatform: open.length,
  unresolvedDetail: open.filter(i => i.category === 'detail-mismatch').length,
  unresolvedBoundary: open.filter(i => i.category === 'feature-boundary').length,
  runtimeOwned: open.filter(i => i.owner === 'runtime-output').length,
  repaired: issues.filter(i => i.disposition === 'repaired').length,
  graphCheckThrows: false, currentUncovered: graph.uncovered.length,
  structuralIssues: structural.length, staleOpenStructuralIssues: stale.length,
  repairs: repairs.length, rejectedRepairs: repairs.filter(r => r.status === 'rejected').length,
  largestRepair: { issues: largest.originalIssues.length, beforeRequirements: largest.before.length, status: largest.status },
  openButMarkedAttempted: open.filter(i => attempted.has(i.id)).length,
  repairableScopesBeforeAttemptFilter: matching.length, repairableScopesAfterAttemptFilter: skipped.length,
  metadataConflict: { label: metadata.label, canonicalText: metadata.excerpt },
  clarificationAlreadyAttachedButOpen: issues.filter(i => i.clarificationId && i.disposition === 'open').map(i => ({id:i.id,clarificationId:i.clarificationId,owner:i.owner})),
}, null, 2));
