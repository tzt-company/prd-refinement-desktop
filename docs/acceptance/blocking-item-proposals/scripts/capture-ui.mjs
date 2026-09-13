import { _electron as electron } from '@playwright/test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const [sourceTask, outputRoot] = process.argv.slice(2);
if (!sourceTask || !outputRoot) throw new Error('需要任务 JSON 和输出目录');
const userData = path.join(os.tmpdir(), `prd-proposal-ui-${process.pid}`), tasks = path.join(userData, 'analysis-tasks');
await mkdir(tasks, { recursive: true });
const task = JSON.parse(await readFile(sourceTask, 'utf8'));
task.id = 'T-PROPOSAL'; task.rootTaskId = task.id; task.parentTaskId = undefined; task.resultVersion = 1;
const blocking = task.project.clarifications.filter(item => item.state === 'open' && (item.level ?? 'blocking') === 'blocking');
for (const [index, item] of blocking.entries()) item.resolutionProposal = {
  recommendation: index % 2 === 0 ? '空字符串和纯空格先去除首尾空白；处理后为空时统一按 NULL 参与安全合并判定。' : '确认合并后直接生成一个新版本，并保留合并前版本用于回溯；不再增加第二次发布确认。',
  rationale: `依据当前事项的已知事实“${item.knownFacts ?? item.reason}”，该口径能让开发 Agent 得到唯一处理路径。`,
  impact: index % 2 === 0 ? '三类无有效内容的输入得到同一判定，可能增加可合并候选。' : '用户操作步骤更短，但确认合并即会产生可追溯的新版本。',
  confirmation: index % 2 === 0 ? '确认空字符串和纯空格均按 NULL 处理。' : '确认合并成功后立即生成新版本。',
  alternatives: index % 2 === 0 ? ['仅原始 NULL 按空值处理，空字符串和纯空格保留原值。'] : [],
  sourceRefs: item.sourceRefs ?? [],
};
await writeFile(path.join(tasks, `${task.id}.json`), JSON.stringify(task));
const app = await electron.launch({ args: [`--user-data-dir=${userData}`,'--no-sandbox','.'], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' } });
try {
  await app.firstWindow(); await new Promise(resolve=>setTimeout(resolve,1500));
  const windows=app.windows(),page=windows.find(value=>value.url().includes('127.0.0.1:5173'))??windows.at(-1);
  if(!page)throw new Error('未找到应用窗口');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(outputRoot, 'debug-home.png'), fullPage: true });
  await page.getByRole('button', { name: /打开任务 T-PROPOSAL/ }).click();
  await page.getByRole('button', { name: /待处理事项/ }).click();
  await page.screenshot({ path: path.join(outputRoot, 'issues-1440.png'), fullPage: true });
  await page.getByRole('button',{name:'修改'}).first().click();
  await page.screenshot({ path: path.join(outputRoot, 'editing-1440.png'), fullPage: true });
  const editor=page.getByLabel(/修改建议方案/).first();await editor.fill('空字符串按 NULL 处理；纯空格保留原值参与安全合并判定。');
  await page.getByRole('button',{name:'保存并加入本次调整'}).click();
  await page.screenshot({ path: path.join(outputRoot, 'selected-1440.png'), fullPage: true });
  await page.getByRole('button', { name: /查看详情/ }).first().click();
  await page.screenshot({ path: path.join(outputRoot, 'drawer-1440.png'), fullPage: true });
  await page.getByRole('button', { name: '关闭' }).click();
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.screenshot({ path: path.join(outputRoot, 'selected-1100.png'), fullPage: true });
  console.log(JSON.stringify({ passed: true, blockers: blocking.length }));
} finally { await app.close(); await rm(userData,{recursive:true,force:true}); }
