import { _electron as electron } from 'playwright';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const profile = path.join(tmpdir(), 'prd-task-workspace-real-profile');
const evidence = path.resolve('docs/acceptance/source-reference-integrity/round-21');
await rm(profile, { recursive: true, force: true });
await mkdir(path.join(profile, 'analysis-tasks'), { recursive: true });
await mkdir(evidence, { recursive: true });
const sourceUnits = [
  { id: 'S-1', label: '订单提交', kind: 'paragraph', excerpt: '用户填写收货地址后可以提交订单。', location: '第 1 节', status: 'processed' },
  { id: 'S-2', label: '订单查询', kind: 'paragraph', excerpt: '用户可以按订单编号查询订单。', location: '第 2 节', status: 'processed' },
];
const project = {
  id: 'P-REAL-E2E', name: '真实桌面验收任务', sourceName: '固定验收 PRD.md', sourceHash: 'REAL-E2E', revision: 1,
  importedAt: new Date().toISOString(), rawText: sourceUnits.map((item) => item.excerpt).join('\n'), stage: 'review', sourceUnits,
  rules: [],
  features: [
    { id: 'F-1', name: '订单提交', sourceUnitIds: ['S-1'], ruleIds: [], requirementIds: ['R-1'], state: 'reviewed' },
    { id: 'F-2', name: '订单查询', sourceUnitIds: ['S-2'], ruleIds: [], requirementIds: ['R-2'], state: 'reviewed' },
  ],
  requirements: [
    { id: 'R-1', title: '提交订单', behavior: '用户填写收货地址后可以提交订单。', conditions: [], constraints: [], explicitAcceptanceConditions: [], sourceUnitIds: ['S-1'], sourceRefs: [{ sourceUnitId: 'S-1' }], ruleIds: [], state: 'reviewed' },
    { id: 'R-2', title: '查询订单', behavior: '用户可以按订单编号查询订单。', conditions: [], constraints: [], explicitAcceptanceConditions: [], sourceUnitIds: ['S-2'], sourceRefs: [{ sourceUnitId: 'S-2' }], ruleIds: [], state: 'reviewed' },
  ],
  clarifications: [{ id: 'Q-1', question: '收货地址最大长度是多少？', reason: '原文没有说明长度。', knownFacts: '提交订单前需要填写收货地址。', unresolvedPoint: '地址长度上限', impact: '开发 Agent 无法确定输入限制。', level: 'blocking', levelReason: '会改变校验规则。', sourceRefs: [{ sourceUnitId: 'S-1' }], affectedIds: ['R-1'], state: 'open' }],
  audit: { passed: true, issues: [] },
  delivery: { state: 'ready', inputHash: 'REAL-E2E', resultHash: '', issueIds: ['Q-1'], unverifiedScopeIds: [], policyVersion: 2 },
};
const now = Date.now();
const task = { id: 'T-REALE2E', rootTaskId: 'T-REALE2E', resultVersion: 1, project, runtimeConfig: { adapter: 'codex-oauth', provider: 'openai-codex', model: 'test', reasoningEffort: 'low', maxParallel: 5, maxNodeParallel: 10 }, attempt: 1, status: 'completed', progress: 100, createdAt: now, startedAt: now - 5000, completedAt: now, steps: [] };
await writeFile(path.join(profile, 'analysis-tasks', `${task.id}.json`), JSON.stringify(task), 'utf8');
const packageRoots = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(child);
    else if (entry.name === 'manifest.json') packageRoots.push(path.dirname(child));
  }
}
let deliveredRequirementIds = [], pendingItems = [], featureRows = [];

const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' } });
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.task-center');
  const actualUserData = await app.evaluate(({ app }) => app.getPath('userData'));
  if (actualUserData !== profile) throw new Error(`Electron 用户目录错误：${actualUserData}`);
  await page.getByRole('button', { name: /打开任务 T-REALE2E/ }).click();
  if ((await page.getByText('待处理 1 项', { exact: true }).count()) !== 1) throw new Error('阻塞待处理项未显示');
  if ((await page.getByRole('checkbox', { name: /^选择 / }).count()) !== 2) throw new Error('功能列表未完整显示');
  featureRows = await page.locator('.feature-row').evaluateAll((rows) => rows.map((row) => ({
    text: row.textContent?.trim(),
    top: row.getBoundingClientRect().top,
    height: row.getBoundingClientRect().height,
  })));
  if (featureRows.length !== 2 || featureRows[1].top < featureRows[0].top + featureRows[0].height) throw new Error(`功能行发生重叠：${JSON.stringify(featureRows)}`);
  await page.getByRole('button', { name: '生成交付包', exact: true }).click();
  await page.getByText('已生成第 1 版交付包。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '打开产物', exact: true }).click();
  await page.getByText('已打开当前版本的产物目录。', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidence, '01-delivered-with-blocking-item.png'), fullPage: true });
  await walk(profile);
  const published = packageRoots[0];
  if (!published) throw new Error('未找到真实 Electron 生成的交付包');
  const pending = JSON.parse(await readFile(path.join(published, 'pending.json'), 'utf8'));
  const requirements = JSON.parse(await readFile(path.join(published, 'requirements.json'), 'utf8'));
  deliveredRequirementIds = requirements.requirements.map((item) => item.id);
  pendingItems = pending.items;

  await page.getByRole('checkbox', { name: '选择 订单提交' }).check();
  await page.getByRole('button', { name: '标记本期不做', exact: true }).click();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('option')).some((item) => item.selected && item.textContent?.includes('第 2 版')));
  await page.screenshot({ path: path.join(evidence, '02-scope-version-created.png'), fullPage: true });

  await page.getByLabel('更多任务操作').click();
  await page.getByRole('button', { name: '归档任务', exact: true }).click();
  await page.getByRole('button', { name: /已归档/ }).click();
  await page.getByRole('button', { name: /打开任务 T-/ }).first().waitFor();
  await page.screenshot({ path: path.join(evidence, '03-archived-family.png'), fullPage: true });

  await page.getByLabel(/更多操作/).first().click();
  await page.getByRole('button', { name: '恢复任务', exact: true }).click();
  await page.getByRole('button', { name: /当前任务/ }).click();
  await page.getByLabel(/更多操作/).first().click();
  await page.getByRole('button', { name: '删除任务', exact: true }).click();
  await page.getByRole('alertdialog').screenshot({ path: path.join(evidence, '04-delete-confirmation.png') });
  await page.getByRole('alertdialog').getByRole('button', { name: '删除任务', exact: true }).click();
  await page.getByText('还没有需求分析任务', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidence, '05-deleted.png'), fullPage: true });
} finally {
  await app.close();
}

const tombstone = path.join(profile, 'analysis-tasks', '.deleted-T-REALE2E.json');
const result = {
  deliveredRequirementIds,
  pendingIds: pendingItems.map((item) => item.id),
  blockingItemPreserved: pendingItems.some((item) => item.id === 'Q-1' && item.level === 'blocking'),
  tombstoneExists: (await stat(tombstone)).isFile(),
  remainingTaskFiles: (await readdir(path.join(profile, 'analysis-tasks'))).filter((name) => /^T-.*\.json$/.test(name)),
  featureRows,
};
if (result.deliveredRequirementIds.length !== 2 || !result.blockingItemPreserved || result.remainingTaskFiles.length) throw new Error(JSON.stringify(result));
await writeFile(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
