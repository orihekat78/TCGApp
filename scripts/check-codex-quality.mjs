import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createResultTemplate, scoreResults } from './codex-quality-core.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const policy = JSON.parse(await readFile(resolve(root, '.codex/quality-policy.json'), 'utf8'));
const tasks = JSON.parse(await readFile(resolve(root, '.codex/evals/golden-tasks.json'), 'utf8'));
const failures = [];
const ids = new Set();
const allowedTiers = new Set(['T0', 'T1', 'T2', 'T3']);
const allowedModels = new Set(['gpt-5.6-terra', 'gpt-5.6-sol']);
const agentContracts = {
  'rules-adjudicator.toml': ['rules_adjudicator', 'gpt-5.6-sol', 'high'],
  'engine-reviewer.toml': ['engine_reviewer', 'gpt-5.6-sol', 'high'],
  'regression-hunter.toml': ['regression_hunter', 'gpt-5.6-terra', 'high'],
  'product-design-director.toml': ['product_design_director', 'gpt-5.6-sol', 'high'],
  'ux-reviewer.toml': ['ux_reviewer', 'gpt-5.6-terra', 'high'],
  'visual-qa.toml': ['visual_qa', 'gpt-5.6-terra', 'medium'],
};

if (policy.version !== 1) failures.push('quality policy version must be 1');
if (tasks.length < policy.thresholds.minimumTasks) {
  failures.push(`golden task count ${tasks.length} is below ${policy.thresholds.minimumTasks}`);
}
for (const category of policy.requiredCategories) {
  if (!tasks.some((task) => task.category === category)) {
    failures.push(`missing golden category: ${category}`);
  }
}
for (const task of tasks) {
  if (!task.id || ids.has(task.id)) failures.push(`missing or duplicate task id: ${task.id}`);
  ids.add(task.id);
  if (!allowedTiers.has(task.expected?.tier)) failures.push(`${task.id}: invalid tier`);
  if (!allowedModels.has(task.expected?.model)) failures.push(`${task.id}: invalid model`);
  for (const field of ['evidence', 'gates', 'forbidden']) {
    if (!Array.isArray(task.expected?.[field]) || task.expected[field].length === 0) {
      failures.push(`${task.id}: expected.${field} must be non-empty`);
    }
  }
  if (task.critical && task.expected.forbidden.length < 2) {
    failures.push(`${task.id}: critical task needs at least two forbidden behaviors`);
  }
}
for (const [file, [name, model, effort]] of Object.entries(agentContracts)) {
  const text = await readFile(resolve(root, `.codex/agents/${file}`), 'utf8');
  for (const [needle, label] of [
    [`name = "${name}"`, 'name'],
    [`model = "${model}"`, 'model'],
    [`model_reasoning_effort = "${effort}"`, 'effort'],
    ['sandbox_mode = "read-only"', 'sandbox'],
  ]) {
    if (!text.includes(needle)) failures.push(`${file}: invalid ${label}`);
  }
}
const designPrinciples = await readFile(resolve(root, '.codex/design-principles.md'), 'utf8');
for (const needle of ['restrained, modern product', 'desktop and landscape `851x393`', 'Detective clichés']) {
  if (!designPrinciples.includes(needle)) failures.push(`design principles missing: ${needle}`);
}
const router = await readFile(resolve(root, '.agents/skills/conan-router/SKILL.md'), 'utf8');
for (const needle of ['conan-accuracy', 'conan-design', 'rules_adjudicator', 'product_design_director']) {
  if (!router.includes(needle)) failures.push(`router missing quality route: ${needle}`);
}
const verifier = await readFile(resolve(root, '.agents/skills/conan-verify/SKILL.md'), 'utf8');
for (const needle of ['npm run check:codex-quality', 'engine_reviewer', 'visual_qa']) {
  if (!verifier.includes(needle)) failures.push(`verifier missing quality gate: ${needle}`);
}
for (const name of ['conan-accuracy', 'conan-design']) {
  const metadata = await readFile(resolve(root, `.agents/skills/${name}/agents/openai.yaml`), 'utf8');
  if (!metadata.includes('allow_implicit_invocation: false')) {
    failures.push(`${name}: must remain explicit to protect startup context`);
  }
}

const args = process.argv.slice(2);
let resultSummary = null;
if (args[0] === '--template') {
  console.log(JSON.stringify(
    createResultTemplate(tasks, policy.thresholds.minimumRepetitions),
    null,
    2,
  ));
  process.exit(0);
} else if (args[0] === '--results') {
  if (!args[1]) failures.push('--results requires a JSON path');
  else {
    const results = JSON.parse(await readFile(resolve(process.cwd(), args[1]), 'utf8'));
    const scored = scoreResults(tasks, policy.thresholds, results);
    failures.push(...scored.failures);
    resultSummary = scored.summary;
  }
}

console.log(JSON.stringify({
  tasks: tasks.length,
  critical: tasks.filter((task) => task.critical).length,
  categories: [...new Set(tasks.map((task) => task.category))].sort(),
  results: resultSummary,
  failures,
}, null, 2));
if (failures.length) process.exit(1);
