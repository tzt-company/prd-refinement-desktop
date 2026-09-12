import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('docs/acceptance/source-reference-integrity/round-18');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /打开任务/ }).first().click();
  await page.getByRole('button', { name: '功能与需求', exact: true }).click();
  await page.getByText('选择交付范围').waitFor();
  const checks = await page.getByRole('checkbox').count();
  const adjust = await page.getByRole('button', { name: /调整细化/ }).count();
  const exportButton = await page.getByRole('button', { name: /生成所选 Agent 包/ }).innerText();
  if (checks < 1 || adjust < 1) throw new Error(`入口缺失：checks=${checks}, adjust=${adjust}`);
  await page.screenshot({ path: path.join(output, 'feature-delivery-scope.png'), fullPage: true });
  console.log(JSON.stringify({ title: await page.title(), checks, adjust, exportButton }));
} finally {
  await browser.close();
}
