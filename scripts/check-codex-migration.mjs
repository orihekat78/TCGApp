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
  '.agents/skills/conan-router/SKILL.md',
  '.agents/skills/conan-router/agents/openai.yaml',
];
const historyPaths = [
  '.agents/skills/conan-history/SKILL.md',
  '.agents/skills/conan-history/agents/openai.yaml',
];
const verifyPaths = [
  '.agents/skills/conan-verify/SKILL.md',
  '.agents/skills/conan-verify/agents/openai.yaml',
];
const accuracySkillPaths = [
  '.agents/skills/conan-accuracy/SKILL.md',
  '.agents/skills/conan-accuracy/agents/openai.yaml',
];
const designSkillPaths = [
  '.agents/skills/conan-design/SKILL.md',
  '.agents/skills/conan-design/agents/openai.yaml',
];
const qualityPaths = [
  '.codex/quality-policy.json',
  '.codex/evals/golden-tasks.json',
  '.codex/design-principles.md',
  'scripts/codex-quality-core.mjs',
  'scripts/check-codex-quality.mjs',
  'tests/scripts/check-codex-quality.test.ts',
];
const accuracyAgentPaths = [
  '.codex/agents/rules-adjudicator.toml',
  '.codex/agents/engine-reviewer.toml',
  '.codex/agents/regression-hunter.toml',
];
const designAgentPaths = [
  '.codex/agents/product-design-director.toml',
  '.codex/agents/ux-reviewer.toml',
  '.codex/agents/visual-qa.toml',
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
for (const [snippet, message] of [
  ['## Token Efficiency', 'missing token-efficiency policy'],
  ['fork_turns="none"', 'missing bounded subagent history policy'],
  ['total spawned threads at 4', 'missing total subagent budget'],
  ['Limit inspection output to 200 lines or 100 KB', 'missing tool-output budget'],
]) {
  if (!agents.includes(snippet)) failures.push(`AGENTS.md ${message}`);
}

const projectConfig = await readFile(resolve(root, '.codex/config.toml'), 'utf8');
for (const [pattern, message] of [
  [/^model\s*=\s*"gpt-5\.6-terra"\s*$/m, 'project model must default to gpt-5.6-terra'],
  [/^model_reasoning_effort\s*=\s*"medium"\s*$/m, 'project reasoning effort must default to medium'],
  [/^max_concurrent_threads_per_session\s*=\s*3\s*$/m, 'project subagent concurrency must be 3'],
  [/^default_subagent_model\s*=\s*"gpt-5\.6-terra"\s*$/m, 'project subagents must default to gpt-5.6-terra'],
  [/^default_subagent_reasoning_effort\s*=\s*"medium"\s*$/m, 'project subagent effort must default to medium'],
  [/^interrupt_message\s*=\s*false\s*$/m, 'subagent interrupts must not add model-visible context'],
  [/^model_auto_compact_token_limit\s*=\s*96000\s*$/m, 'missing automatic compaction limit'],
  [/^model_auto_compact_token_limit_scope\s*=\s*"body_after_prefix"\s*$/m, 'compaction must exclude cached prefix'],
  [/^tool_output_token_limit\s*=\s*6000\s*$/m, 'missing tool-output token limit'],
  [/^experimental_compact_prompt_file\s*=\s*".+\/\.codex\/compact-prompt\.md"\s*$/m, 'missing structured compaction prompt'],
  [/^memories\s*=\s*true\s*$/m, 'Codex memories trial is not enabled'],
  [/^disable_on_external_context\s*=\s*true\s*$/m, 'external-context sessions must be excluded from memory generation'],
]) {
  if (!pattern.test(projectConfig)) failures.push(message);
}
const disabledSkills = [...projectConfig.matchAll(
  /\[\[skills\.config\]\]\s+path\s*=\s*'([^']+)'\s+enabled\s*=\s*false/g,
)].map((match) => match[1]);
if (disabledSkills.length !== 66) {
  failures.push(`expected 66 project-disabled skills, found ${disabledSkills.length}`);
}
if (projectConfig.includes('${name}')) failures.push('unexpanded skill path in project config');
for (const path of disabledSkills) {
  try {
    await access(path);
  } catch {
    failures.push(`disabled skill path missing: ${path}`);
  }
}

const compactPrompt = await readFile(resolve(root, '.codex/compact-prompt.md'), 'utf8');
for (const heading of ['## Goal', '## Decisions', '## Changes', '## Verification', '## Open', '## Resume']) {
  if (!compactPrompt.includes(heading)) failures.push(`compact prompt missing ${heading}`);
}
const contextGenerator = await readFile(resolve(root, 'scripts/gen-codex-context.mjs'), 'utf8');
if (contextGenerator.includes('`conan-session-router`')) {
  failures.push('context generator still emits legacy conan-session-router');
}

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
if (await exists('.agents/skills/conan-session-router/SKILL.md')) {
  failures.push('legacy conan-session-router still installed in project');
}
for (const historyPath of historyPaths) {
  if (!await exists(historyPath)) failures.push(`missing Conan history file: ${historyPath}`);
}
for (const verifyPath of verifyPaths) {
  if (!await exists(verifyPath)) failures.push(`missing Conan verification file: ${verifyPath}`);
}
for (const skillPath of accuracySkillPaths) {
  if (!await exists(skillPath)) failures.push(`missing Conan accuracy skill: ${skillPath}`);
}
for (const skillPath of designSkillPaths) {
  if (!await exists(skillPath)) failures.push(`missing Conan design skill: ${skillPath}`);
}
for (const qualityPath of qualityPaths) {
  if (!await exists(qualityPath)) failures.push(`missing Conan quality file: ${qualityPath}`);
}
for (const agentPath of accuracyAgentPaths) {
  if (!await exists(agentPath)) failures.push(`missing accuracy agent: ${agentPath}`);
}
for (const agentPath of designAgentPaths) {
  if (!await exists(agentPath)) failures.push(`missing design agent: ${agentPath}`);
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
