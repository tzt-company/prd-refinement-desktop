import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.connectOverCDP('http://127.0.0.1:19347');
try {
  const page = browser.contexts()[0].pages()[0];
  const tasks = await page.evaluate(() => window.prdApp.loadAnalysisTasks());
  if (tasks.some(task => ['running', 'queued', 'cancelling'].includes(task.status))) throw new Error('当前仍有执行中的分析任务，不能重启桌面应用');
  const createTask = page.getByRole('button', { name: '新建任务', exact: true });
  if (await createTask.count()) await createTask.click();
  const select = page.getByLabel('已有资料包');
  await select.waitFor();
  if (await select.count()) {
    const options = await select.locator('option').allTextContents();
    const target = options.findIndex(text => text.includes('PRD-同名生产活动关联ID合并提醒'));
    const value = await select.locator('option').nth(target >= 0 ? target : 1).getAttribute('value');
    if (value) await select.selectOption(value);
  }
  await expect(page.getByRole('heading', { name: '准备分析资料', exact: true })).toBeVisible();
  await expect(page.getByText('需要处理 10 项', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/另有 \d+ 项需要处理/)).toHaveCount(0);
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    script: [...document.scripts].map(script => script.src).find(Boolean),
    heading: document.querySelector('.material-page-heading')?.textContent,
    primaryColumns: getComputedStyle(document.querySelector('.material-intake-selected')).gridTemplateColumns,
    issueSummary: document.querySelector('.material-reference-summary')?.textContent,
  }));
  if (layout.width > layout.viewport) throw new Error(`页面出现横向溢出：${layout.width} > ${layout.viewport}`);
  await mkdir('docs/acceptance/material-bundle-index/round-4', { recursive: true });
  await page.screenshot({ path: 'docs/acceptance/material-bundle-index/round-4/current-desktop.png', fullPage: true });
  await writeFile('docs/acceptance/material-bundle-index/round-4/current-desktop.json', JSON.stringify({ taskStatuses: tasks.map(task => ({ id: task.id, status: task.status })), ...layout }, null, 2));
  console.log(JSON.stringify({ taskStatuses: tasks.map(task => ({ id: task.id, status: task.status })), ...layout }));
} finally {
  await browser.close();
}
