import { _electron as electron } from 'playwright';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const source = path.join(process.env.APPDATA, 'prd-refinement-desktop', 'analysis-tasks');
const profile = path.join(tmpdir(), 'prd-task-center-real-data-profile');
const evidence = path.resolve('docs/acceptance/source-reference-integrity/round-22');
await rm(profile, { recursive: true, force: true });
await mkdir(profile, { recursive: true });
await mkdir(evidence, { recursive: true });
await cp(source, path.join(profile, 'analysis-tasks'), { recursive: true });

const app = await electron.launch({
  args: ['.', `--user-data-dir=${profile}`],
  env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' },
});
let result;
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.task-row-managed');
  const headers = await page.locator('.task-collection .thead > span').evaluateAll((items) =>
    items.map((item) => ({ label: item.textContent?.trim(), left: item.getBoundingClientRect().left })),
  );
  const firstRow = page.locator('.task-row-managed').first();
  const cells = await firstRow.locator(':scope > .task-identity, :scope > .task-status, :scope > .task-stage, :scope > .mini-progress, :scope > .task-time, :scope > .more-menu').evaluateAll((items) =>
    items.map((item) => ({ label: item.textContent?.trim(), left: item.getBoundingClientRect().left, right: item.getBoundingClientRect().right })),
  );
  const offsets = headers.map((header, index) => Math.abs(header.left - cells[index].left));
  const progress = cells[3], operation = cells[6];
  result = {
    taskCount: await page.locator('.task-row-managed').count(),
    headers,
    firstRowCells: cells,
    maximumColumnOffset: Math.max(...offsets),
    operationDoesNotOverlapProgress: operation.left >= progress.right,
    headerGrid: await page.locator('.task-collection .thead').evaluate((item) => getComputedStyle(item).gridTemplateColumns),
    rowGrid: await firstRow.evaluate((item) => getComputedStyle(item).gridTemplateColumns),
  };
  if (result.taskCount < 2 || result.maximumColumnOffset > 2 || !result.operationDoesNotOverlapProgress) {
    throw new Error(JSON.stringify(result));
  }
  await page.screenshot({ path: path.join(evidence, '01-current-tasks-columns.png'), fullPage: true });
  await firstRow.locator('.more-menu > summary').click();
  await firstRow.getByRole('button', { name: '归档任务', exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidence, '02-current-task-menu.png'), fullPage: true });
  await firstRow.locator('.more-menu > summary').click();
  await firstRow.locator('.task-row-open').click();
  await page.getByRole('button', { name: '返回任务中心', exact: true }).waitFor();
} finally {
  await app.close();
}
await writeFile(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
