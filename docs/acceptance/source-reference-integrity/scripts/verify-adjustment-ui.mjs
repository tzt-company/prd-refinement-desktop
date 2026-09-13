import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('docs/acceptance/source-reference-integrity/round-19');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  const reviewableTask = page.locator('.task-row').filter({ hasText: /可交付|需要业务确认|平台整理未完成/ }).first();
  if (await reviewableTask.count()) await reviewableTask.click();
  else await page.getByRole('button', { name: /打开任务/ }).first().click();
  const feedback = page.getByLabel('调整说明');
  await feedback.fill('订单查询合并筛选条件；退款审核按流程展开。');
  await page.getByRole('button', { name: /^待处理事项/ }).click();
  await page.getByText('已知事实').first().waitFor();
  await page.getByRole('button', { name: '功能与需求', exact: true }).click();
  const restored = await feedback.inputValue();
  const feedbackInputs = await page.getByLabel('调整说明').count();
  const submitButtons = await page.getByRole('button', { name: '按说明调整', exact: true }).count();
  const legacyButtons = await page.getByRole('button', { name: /调整细化|处理方式|补充内容/ }).count();
  const deliveryChecks = await page.getByRole('checkbox').count();
  if (restored !== '订单查询合并筛选条件；退款审核按流程展开。' || feedbackInputs !== 1 || submitButtons !== 1 || legacyButtons !== 0 || deliveryChecks < 1) {
    throw new Error(JSON.stringify({ restored, feedbackInputs, submitButtons, legacyButtons, deliveryChecks }));
  }
  await page.screenshot({ path: path.join(output, 'task-feedback.png'), fullPage: true });
  console.log(JSON.stringify({ title: await page.title(), restored, feedbackInputs, submitButtons, legacyButtons, deliveryChecks }));
} finally {
  await browser.close();
}
