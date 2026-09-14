import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';

const testRoot = path.resolve('docs/tmp/test-run/vitest');

export async function createTestWorkspace(prefix: string) {
  await mkdir(testRoot, { recursive: true });
  return mkdtemp(path.join(testRoot, `${prefix}-`));
}
