import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const skillNames = ['card-wave', 'engine-wave', 'refactor-phase'];

for (const skillName of skillNames) {
  const source = resolve(root, `.claude/skills/${skillName}/SKILL.md`);
  const targetDirectory = resolve(root, `.agents/skills/${skillName}`);
  const target = resolve(targetDirectory, 'SKILL.md');
  await mkdir(targetDirectory, { recursive: true });
  await copyFile(source, target);
  console.log(`synced: ${skillName}`);
}
