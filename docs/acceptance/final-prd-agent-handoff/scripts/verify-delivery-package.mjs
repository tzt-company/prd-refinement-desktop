import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ExcelJS from 'exceljs';

const usage = `用法：
  node docs/acceptance/final-prd-agent-handoff/scripts/verify-delivery-package.mjs <交付目录>

检查 requirements.json、manifest.json、features/*.md 与 requirements.xlsx 的文件哈希、
路径边界、功能/需求编号和非空业务字段是否一致。该脚本不判断 PRD 语义完整性。`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(usage);
  process.exit(0);
}

const inputRoot = process.argv[2];
if (!inputRoot) {
  console.error(`错误：缺少交付目录。\n\n${usage}`);
  process.exit(2);
}

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const root = path.resolve(inputRoot);
const requiredRootFiles = ['requirements.json', 'manifest.json', 'requirements.xlsx'];
const windowsAbsolutePath = /(?:^|[\s"'(])(?:[A-Za-z]:[\\/])/m;

const insideRoot = (candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const normalizeRelative = (value) => String(value).replaceAll('\\', '/').replace(/^\.\//, '');
const sha256 = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');
const values = (value) => {
  if (Array.isArray(value)) return value.flatMap(values);
  if (value && typeof value === 'object') return Object.values(value).flatMap(values);
  return value === null || value === undefined ? [] : [String(value)];
};

for (const name of requiredRootFiles) {
  try { assert((await stat(path.join(root, name))).isFile(), `${name} 不是文件`); }
  catch { failures.push(`缺少 ${name}`); }
}
try { assert((await stat(path.join(root, 'features'))).isDirectory(), '缺少 features/ 目录'); }
catch { failures.push('缺少 features/ 目录'); }

if (failures.length) {
  console.error(failures.map((item) => `FAIL: ${item}`).join('\n'));
  process.exit(1);
}

const requirementsText = await readFile(path.join(root, 'requirements.json'), 'utf8');
const manifestText = await readFile(path.join(root, 'manifest.json'), 'utf8');
let snapshot;
let manifest;
try { snapshot = JSON.parse(requirementsText); } catch (error) { failures.push(`requirements.json 不是合法 JSON：${error.message}`); }
try { manifest = JSON.parse(manifestText); } catch (error) { failures.push(`manifest.json 不是合法 JSON：${error.message}`); }

assert(!windowsAbsolutePath.test(requirementsText), 'requirements.json 含 Windows 绝对路径');
assert(!windowsAbsolutePath.test(manifestText), 'manifest.json 含 Windows 绝对路径');

const manifestFiles = manifest?.files;
assert(Array.isArray(manifestFiles), 'manifest.files 必须是数组');
const listed = new Map();
if (Array.isArray(manifestFiles)) {
  for (const entry of manifestFiles) {
    const relative = normalizeRelative(entry?.path ?? entry?.name ?? '');
    assert(relative.length > 0, 'manifest 文件项缺少 path');
    assert(relative !== 'manifest.json', 'manifest.files 不得包含 manifest.json 自身');
    assert(!listed.has(relative), `manifest.files 路径重复：${relative}`);
    listed.set(relative, entry);
    const absolute = path.resolve(root, relative);
    assert(insideRoot(absolute), `manifest 路径越过交付目录：${relative}`);
    if (!insideRoot(absolute)) continue;
    try {
      assert((await stat(absolute)).isFile(), `manifest 路径不是文件：${relative}`);
      const actualHash = await sha256(absolute);
      const expectedHash = String(entry?.sha256 ?? '').toLowerCase();
      assert(/^[a-f0-9]{64}$/.test(expectedHash), `manifest 缺少合法 SHA-256：${relative}`);
      assert(actualHash === expectedHash, `SHA-256 不一致：${relative}`);
    } catch { failures.push(`manifest 文件不存在：${relative}`); }
  }
}

for (const required of ['requirements.json', 'requirements.xlsx']) {
  assert(listed.has(required), `manifest.files 未列出 ${required}`);
}
if (await stat(path.join(root, 'README.md')).then((item) => item.isFile()).catch(() => false)) {
  assert(listed.has('README.md'), 'README.md 存在但 manifest.files 未列出');
}

const features = Array.isArray(snapshot?.features) ? snapshot.features : [];
const requirements = Array.isArray(snapshot?.requirements) ? snapshot.requirements : [];
assert(features.length > 0, 'requirements.json.features 必须是非空数组');
assert(requirements.length > 0, 'requirements.json.requirements 必须是非空数组');
const featureIds = features.map((item) => String(item?.id ?? ''));
const requirementIds = requirements.map((item) => String(item?.id ?? ''));
assert(featureIds.every(Boolean), '存在缺少 id 的功能');
assert(requirementIds.every(Boolean), '存在缺少 id 的需求');
assert(new Set(featureIds).size === featureIds.length, '功能 id 不唯一');
assert(new Set(requirementIds).size === requirementIds.length, '需求 id 不唯一');
const requirementById = new Map(requirements.map((item) => [String(item.id), item]));

const featureFiles = (await readdir(path.join(root, 'features'), { withFileTypes: true }))
  .filter((item) => item.isFile() && item.name.toLowerCase().endsWith('.md'))
  .map((item) => item.name);
for (const name of featureFiles) assert(listed.has(`features/${name}`), `manifest.files 未列出 features/${name}`);

const fieldsFor = (requirement) => [
  requirement.title,
  requirement.behavior,
  ...(requirement.conditions ?? []),
  ...(requirement.constraints ?? []),
  ...(requirement.explicitAcceptanceConditions ?? []),
].flatMap(values).map((item) => item.trim()).filter(Boolean);

for (const feature of features) {
  const id = String(feature.id);
  const markdownName = `${id}.md`;
  const relative = `features/${markdownName}`;
  assert(featureFiles.includes(markdownName), `缺少功能文件 ${relative}`);
  if (!featureFiles.includes(markdownName)) continue;
  const markdown = await readFile(path.join(root, relative), 'utf8');
  assert(!windowsAbsolutePath.test(markdown), `${relative} 含 Windows 绝对路径`);
  assert(markdown.includes(id), `${relative} 未包含功能编号 ${id}`);
  const ownedIds = values(feature.requirementIds ?? feature.requirements ?? []);
  for (const requirementId of ownedIds) {
    const requirement = requirementById.get(requirementId);
    assert(Boolean(requirement), `${id} 引用了不存在的需求 ${requirementId}`);
    if (!requirement) continue;
    assert(markdown.includes(requirementId), `${relative} 未包含需求编号 ${requirementId}`);
    for (const field of fieldsFor(requirement)) {
      assert(markdown.includes(field), `${relative} 未包含 ${requirementId} 的业务字段：${field}`);
    }
  }
}

const workbook = new ExcelJS.Workbook();
try {
  await workbook.xlsx.readFile(path.join(root, 'requirements.xlsx'));
  const excelText = workbook.worksheets.flatMap((sheet) => {
    const cells = [];
    sheet.eachRow((row) => row.eachCell({ includeEmpty: false }, (cell) => cells.push(String(cell.text ?? cell.value ?? ''))));
    return cells;
  }).join('\n');
  assert(!windowsAbsolutePath.test(excelText), 'requirements.xlsx 含 Windows 绝对路径');
  for (const id of featureIds) assert(excelText.includes(id), `requirements.xlsx 未包含功能编号 ${id}`);
  for (const requirement of requirements) {
    const id = String(requirement.id);
    assert(excelText.includes(id), `requirements.xlsx 未包含需求编号 ${id}`);
    for (const field of fieldsFor(requirement)) {
      assert(excelText.includes(field), `requirements.xlsx 未包含 ${id} 的业务字段：${field}`);
    }
  }
} catch (error) {
  failures.push(`requirements.xlsx 无法回读：${error.message}`);
}

if (failures.length) {
  console.error(failures.map((item) => `FAIL: ${item}`).join('\n'));
  process.exit(1);
}
console.log(`PASS: 交付包结构与跨格式一致（${features.length} 个功能，${requirements.length} 条需求，${listed.size} 个清单文件）`);
