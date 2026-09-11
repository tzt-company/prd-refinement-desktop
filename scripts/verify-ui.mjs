import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const violations = [];
if (/alert\s*\(|confirm\s*\(|prompt\s*\(/.test(app)) violations.push('禁止使用原生 alert/confirm/prompt');
if (!css.includes(':focus-visible')) violations.push('缺少键盘焦点样式');
if (!css.includes('prefers-reduced-motion')) violations.push('缺少 reduced-motion 策略');
if (!app.includes('aria-label')) violations.push('关键结构缺少 aria-label');
if (violations.length) { console.error(violations.join('\n')); process.exit(1); }
console.log('UI contract smoke check passed');
