import { chromium } from '@playwright/test';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('docs/acceptance/source-reference-integrity/round-20');
const taskRoot = path.join(process.env.APPDATA, 'prd-refinement-desktop', 'analysis-tasks');
await mkdir(output, { recursive: true });
const taskFiles = (await readdir(taskRoot)).filter((name) => /^T-[A-Z0-9]+\.json$/.test(name));
const tasks = [];
for (const name of taskFiles) {
  const task = JSON.parse(await readFile(path.join(taskRoot, name), 'utf8'));
  if (task.project?.features?.length && task.project?.requirements?.length) tasks.push(task);
}
tasks.sort((left, right) => right.project.requirements.length - left.project.requirements.length);
if (!tasks[0]) throw new Error('没有可用于 UI 验收的已形成结果');
const current = structuredClone(tasks[0]);
current.status = 'completed';
current.progress = 100;
current.resultVersion ??= 1;
current.archivedAt = undefined;
const archived = structuredClone(current);
archived.id = `${current.id}-ARCHIVED`;
archived.rootTaskId = archived.id;
archived.project = { ...archived.project, name: `${archived.project.name}（归档示例）` };
archived.archivedAt = Date.now() - 60_000;

const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(({ currentTask, archivedTask }) => {
    let active = structuredClone(currentTask);
    let archived = structuredClone(archivedTask);
    window.prdApp = {
      inspectRuntime: async () => ({ available: true, routeReady: true, adapter: 'codex-oauth', version: '0.153.4', model: 'gpt-5.6-terra' }),
      loadAnalysisTasks: async () => [structuredClone(active)],
      loadArchivedAnalysisTasks: async () => [structuredClone(archived)],
      onAnalysisTaskUpdate: () => () => {},
      queryAnalysisArtifacts: async () => [{ id: 'A-UI', kind: 'agent-package', path: 'C:\\验收\\交付包', resultVersion: active.resultVersion, createdAt: Date.now(), exists: true }],
      exportAgentPackage: async () => ({ id: 'A-UI', kind: 'agent-package', path: 'C:\\验收\\交付包', resultVersion: active.resultVersion, createdAt: Date.now() }),
      openResultDirectory: async () => ({ exists: true, path: 'C:\\验收\\交付包', artifactId: 'A-UI' }),
      updateDeliveryScope: async (request) => {
        const next = structuredClone(active);
        next.id = `${active.id}-SCOPE`;
        next.parentTaskId = active.id;
        next.rootTaskId = active.rootTaskId ?? active.id;
        next.resultVersion = (active.resultVersion ?? 1) + 1;
        for (const target of request.targets) {
          if (target.kind === 'feature') {
            const feature = next.project.features.find((item) => item.id === target.id);
            if (feature) feature.deliveryScope = request.scope;
            for (const requirement of next.project.requirements.filter((item) => feature?.requirementIds.includes(item.id))) requirement.deliveryScope = request.scope;
          } else {
            const requirement = next.project.requirements.find((item) => item.id === target.id);
            if (requirement) requirement.deliveryScope = request.scope;
          }
        }
        active = next;
        return structuredClone(next);
      },
      adjustAnalysis: async () => structuredClone(active),
      archiveAnalysisTask: async () => {},
      restoreAnalysisTask: async () => {},
      deleteAnalysisTask: async () => {},
    };
  }, { currentTask: current, archivedTask: archived });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  const shot = async (name, fullPage = true) => page.screenshot({ path: path.join(output, name), fullPage });

  await page.getByText('需求分析任务').waitFor();
  await shot('01-task-center-current.png');
  await page.getByRole('button', { name: /已归档/ }).click();
  await shot('02-task-center-archived.png');
  await page.getByRole('button', { name: /当前任务/ }).click();
  await page.getByRole('button', { name: /^打开任务/ }).first().click();
  await page.getByRole('button', { name: '功能与需求', exact: true }).waitFor();
  await shot('03-detail-features.png');

  const featureCheckbox = page.getByRole('checkbox', { name: /^选择 / }).first();
  await featureCheckbox.check();
  await shot('04-feature-bulk-toolbar.png');
  await page.getByRole('button', { name: '取消选择', exact: true }).click();
  await page.getByRole('button', { name: '全部需求', exact: true }).click();
  await page.getByRole('checkbox', { name: '全选本页需求' }).check();
  await shot('05-requirement-bulk-toolbar.png');
  await page.getByRole('button', { name: '取消选择', exact: true }).click();

  await page.getByRole('button', { name: /^待处理事项/ }).click();
  await page.getByText('待处理事项', { exact: true }).waitFor();
  await shot('06-pending-items.png');
  const evidence = page.getByRole('button', { name: /^查看详情：/ }).first();
  if (await evidence.count()) {
    await evidence.click();
    await shot('07-pending-detail-drawer.png');
    await page.getByRole('button', { name: '关闭' }).click();
  }

  await page.getByRole('button', { name: '执行记录', exact: true }).click();
  await shot('08-execution-record.png');
  await page.getByText('耗时/用量', { exact: true }).click();
  await shot('09-runtime-usage-expanded.png');
  await page.getByText('耗时/用量', { exact: true }).click();

  await page.getByRole('button', { name: '展开输入区' }).click();
  await shot('10-feedback-expanded.png');
  await page.getByLabel('更多任务操作').click();
  await shot('11-task-more-menu.png');
  await page.getByRole('button', { name: '删除任务', exact: true }).click();
  await page.getByRole('alertdialog').waitFor();
  await shot('12-delete-dialog.png');
  await page.getByRole('button', { name: '保留任务' }).click();

  await page.setViewportSize({ width: 1100, height: 780 });
  await page.getByRole('button', { name: '功能与需求', exact: true }).click();
  if (!(await page.getByRole('button', { name: '删除任务', exact: true }).isVisible())) await page.getByLabel('更多任务操作').click();
  await page.getByRole('button', { name: '删除任务', exact: true }).click();
  await shot('13-delete-dialog-1100.png');

  const result = {
    screenshots: (await readdir(output)).filter((name) => name.endsWith('.png')).sort(),
    horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    dialogName: await page.getByRole('alertdialog').getByRole('heading').textContent(),
    backgroundInert: await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert')),
  };
  if (result.horizontalOverflow || !result.backgroundInert) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
