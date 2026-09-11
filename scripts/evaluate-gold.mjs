import fs from 'node:fs';
import { evaluateGold } from './gold-evaluation.mjs';
const [goldPath,sourcePath,resultPath,outputPath]=process.argv.slice(2);
if(!outputPath) throw new Error('用法: node scripts/evaluate-gold.mjs <gold.json> <原始PRD> <result.json> <输出.json>');
const input=JSON.parse(fs.readFileSync(resultPath,'utf8'));
const report=evaluateGold(JSON.parse(fs.readFileSync(goldPath,'utf8')),fs.readFileSync(sourcePath,'utf8'),input.project ?? input);
fs.writeFileSync(outputPath,JSON.stringify(report,null,2));console.log(JSON.stringify({total:report.total,matched:report.matched,reviewRequired:report.total-report.matched}));
