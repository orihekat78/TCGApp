import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const config = await readFile(resolve(root, '.codex/config.toml'), 'utf8');
const router = await readFile(resolve(root, '.agents/skills/conan-router/SKILL.md'), 'utf8');
const cases = JSON.parse(await readFile(resolve(root, '.codex/efficiency-cases.json'), 'utf8'));
const baseline = { skillCount: 98, metadataCharsEstimate: 14894, routerBytes: 7981, routeCases: 3 };
const disabledCatalogMetadata = 10149;
const catalogEntryCap = 144;
const oldRouterMetadata = [
  'conan-session-router',
  'Route work in the Conan TCG repository to the minimum required context, local instructions, skills, model tier, and verification gates. Use at the start of every Conan repository task, including questions, card work, engine changes, UI work, tests, documentation, and refactors.',
].join(': ').length;
const disabledPaths = [...config.matchAll(
  /\[\[skills\.config\]\]\s+path\s*=\s*'([^']+)'\s+enabled\s*=\s*false/g,
)].map((match) => match[1]);
const projectSkills = ['conan-router', 'conan-history', 'conan-verify'];

async function metadataChars(path) {
  const text = await readFile(path, 'utf8');
  const name = text.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const description = text.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  return `${name}: ${description}`.length;
}

const missingDisabled = [];
for (const path of disabledPaths) {
  try {
    await metadataChars(path);
  } catch {
    missingDisabled.push(path);
  }
}

let newMetadata = 0;
for (const name of projectSkills) {
  newMetadata += await metadataChars(resolve(root, `.agents/skills/${name}/SKILL.md`));
}

const routeFailures = cases
  .filter((testCase) => testCase.needles.some((needle) => !router.includes(needle)))
  .map((testCase) => testCase.name);
const current = {
  skillCount: baseline.skillCount - disabledPaths.length - 1 + projectSkills.length,
  metadataCharsEstimate:
    baseline.metadataCharsEstimate
    - disabledCatalogMetadata
    - Math.min(oldRouterMetadata, catalogEntryCap)
    + Math.min(newMetadata, catalogEntryCap * projectSkills.length),
  routerBytes:
    (await stat(resolve(root, '.agents/skills/conan-router/SKILL.md'))).size
    + (await stat(resolve(root, '.agents/skills/conan-router/agents/openai.yaml'))).size,
  routeCases: cases.length - routeFailures.length,
};
const reduction = {
  skillCountPercent: Math.round((1 - current.skillCount / baseline.skillCount) * 100),
  metadataPercent: Math.round(
    (1 - current.metadataCharsEstimate / baseline.metadataCharsEstimate) * 100,
  ),
  routerPercent: Math.round((1 - current.routerBytes / baseline.routerBytes) * 100),
};
const configFailures = [
  ['model_auto_compact_token_limit = 96000', 'compaction limit'],
  ['model_auto_compact_token_limit_scope = "body_after_prefix"', 'compaction scope'],
  ['tool_output_token_limit = 6000', 'tool-output limit'],
  ['/.codex/compact-prompt.md"', 'compact prompt'],
  ['memories = true', 'memories trial'],
  ['disable_on_external_context = true', 'memory external-context guard'],
].filter(([needle]) => !config.includes(needle)).map(([, label]) => label);
const failures = [
  ...missingDisabled.map((path) => `disabled skill path missing: ${path}`),
  ...routeFailures.map((name) => `route case failed: ${name}`),
  ...configFailures.map((name) => `config missing: ${name}`),
];
if (current.skillCount > 35) failures.push(`active skill estimate too high: ${current.skillCount}`);
if (current.metadataCharsEstimate > 6000) {
  failures.push(`skill metadata estimate too high: ${current.metadataCharsEstimate}`);
}
if (current.routerBytes > 3500) failures.push(`router too large: ${current.routerBytes}`);

console.log(JSON.stringify({ baseline, current, reduction, failures }, null, 2));
if (failures.length) process.exit(1);
