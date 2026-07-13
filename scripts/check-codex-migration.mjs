import { createHash } from 'node:crypto';
import { readFile, access, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requiredPaths = [
  'auto', 'bugs', 'research', 'rules', 'sessions', 'specs',
];
const skillNames = ['card-wave', 'engine-wave', 'refactor-phase'];
const routerPaths = [
  '.agents/skills/conan-session-router/SKILL.md',
  '.agents/skills/conan-session-router/references/routes.md',
  '.agents/skills/conan-session-router/agents/openai.yaml',
];
const failures = [];
const superpowersRoot = resolve(
  homedir(),
  '.codex/plugins/cache/claude-plugins-official/superpowers',
);

async function exists(relativePath) {
  try {
    await access(resolve(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

const agentsPath = resolve(root, 'AGENTS.md');
const agents = await readFile(agentsPath, 'utf8');
if (agents.includes('.Codex/')) failures.push('AGENTS.md contains stale .Codex/ paths');
for (const requiredPath of ['.claude/rules/INDEX.md', '.claude/memory.md', '.claude/worktrees']) {
  if (!await exists(requiredPath)) failures.push(`missing canonical path: ${requiredPath}`);
}
for (const requiredPath of requiredPaths) {
  if (!await exists(`.claude/${requiredPath}`)) failures.push(`missing canonical directory: .claude/${requiredPath}`);
}

for (const skillName of skillNames) {
  const source = resolve(root, `.claude/skills/${skillName}/SKILL.md`);
  const target = resolve(root, `.agents/skills/${skillName}/SKILL.md`);
  if (!await exists(`.agents/skills/${skillName}/SKILL.md`)) {
    failures.push(`missing Codex skill: ${skillName}`);
    continue;
  }
  const hash = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
  if (await hash(source) !== await hash(target)) failures.push(`skill drift: ${skillName}`);
}

for (const routerPath of routerPaths) {
  if (!await exists(routerPath)) failures.push(`missing Conan router file: ${routerPath}`);
}

try {
  const versions = (await readdir(superpowersRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const latestVersion = versions.at(-1);
  if (!latestVersion) throw new Error('no installed version');
  const policyPath = resolve(
    superpowersRoot,
    latestVersion,
    'skills/using-superpowers/agents/openai.yaml',
  );
  const policy = await readFile(policyPath, 'utf8');
  if (!policy.includes('allow_implicit_invocation: false')) {
    failures.push('using-superpowers remains implicitly enabled');
  }
} catch {
  failures.push('missing Codex policy disabling implicit using-superpowers');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('codex migration checks passed');
