import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runGenApi } from './gen-api.js';
import { runGenState } from './gen-state.js';
import { runGenFlows } from './gen-flows.js';
import { runGenProgress } from './gen-progress.js';
import { runGenMapping } from './gen-mapping.js';
import { runGenStructure } from './gen-structure.js';
import { runGenChangelog } from './gen-changelog.js';
import { runGenQaTrace } from './gen-qa-trace.js';

const require = createRequire(import.meta.url);
type CardsDataSnapshot = { baseDir: string; lockToken: unknown; recovery: unknown };
type WithCardsDataSnapshot = <T>(options: { baseDir: string; read: (snapshot: CardsDataSnapshot) => T }) => T;
const { withCardsDataSnapshot } = require('../cards/official-api.cjs') as { withCardsDataSnapshot: WithCardsDataSnapshot };

type Command = 'api' | 'state' | 'flows' | 'progress' | 'mapping' | 'structure' | 'changelog' | 'qa-trace' | 'all' | 'check';

interface ParsedArgs {
  command: Command;
}

const COMMANDS: Command[] = ['api', 'state', 'flows', 'progress', 'mapping', 'structure', 'changelog', 'qa-trace', 'all', 'check'];

function parseArgs(argv: string[]): ParsedArgs {
  const arg = argv[2] ?? 'all';
  if (!COMMANDS.includes(arg as Command)) {
    console.error(`Unknown command: ${arg}. Expected one of: ${COMMANDS.join(' | ')}`);
    process.exit(2);
  }
  return { command: arg as Command };
}

interface GeneratorEntry {
  name: string;
  matches: (cmd: Command) => boolean;
  run: (opts: { checkOnly: boolean }, lockToken?: unknown) => { changedFiles: string[]; totalFiles: number };
}

const GENERATORS: GeneratorEntry[] = [
  { name: 'api', matches: (c) => c === 'api' || c === 'all' || c === 'check', run: runGenApi },
  { name: 'state', matches: (c) => c === 'state' || c === 'all' || c === 'check', run: runGenState },
  { name: 'flows', matches: (c) => c === 'flows' || c === 'all' || c === 'check', run: runGenFlows },
  { name: 'progress', matches: (c) => c === 'progress' || c === 'all' || c === 'check', run: runGenProgress },
  { name: 'mapping', matches: (c) => c === 'mapping' || c === 'all' || c === 'check', run: runGenMapping },
  { name: 'structure', matches: (c) => c === 'structure' || c === 'all' || c === 'check', run: runGenStructure },
  { name: 'changelog', matches: (c) => c === 'changelog' || c === 'all' || c === 'check', run: runGenChangelog },
  { name: 'qa-trace', matches: (c) => c === 'qa-trace' || c === 'all' || c === 'check', run: (options, lockToken) => runGenQaTrace(options, undefined, { lockToken }) },
];

function runGenerators(command: Command, lockToken: unknown): void {
  const checkOnly = command === 'check';

  console.log(`[gen-docs] command: ${command} (${checkOnly ? 'check-only' : 'write'})`);
  const startedAt = Date.now();

  let totalChanged = 0;
  let totalFiles = 0;

  const failures: string[] = [];
  for (const gen of GENERATORS) {
    if (!gen.matches(command)) continue;
    try {
      const result = gen.run({ checkOnly }, lockToken);
      totalChanged += result.changedFiles.length;
      totalFiles += result.totalFiles;
      console.log(
        `[gen-docs] ${gen.name}: ${result.changedFiles.length}/${result.totalFiles} ${
          checkOnly ? 'would change' : 'updated'
        }`,
      );
      for (const f of result.changedFiles) {
        const rel = f.replace(process.cwd(), '').replace(/^[\\/]/, '');
        console.log(`  - ${rel}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[gen-docs] ${gen.name}: FAILED — ${msg}`);
      failures.push(gen.name);
    }
  }

  const elapsed = Date.now() - startedAt;
  console.log(`[gen-docs] done in ${elapsed}ms (${totalChanged}/${totalFiles} files affected)`);

  if (failures.length > 0) {
    console.error(`[gen-docs] ${failures.length} generator(s) failed: ${failures.join(', ')}`);
    process.exitCode = 2;
    return;
  }

  if (checkOnly && totalChanged > 0) {
    console.error('[gen-docs] check failed: docs are out of sync. Run `npm run docs` to regenerate.');
    process.exitCode = 1;
  }
}

function main(): void {
  const { command } = parseArgs(process.argv);
  const baseDir = resolve(process.cwd(), '.claude/specs/cards-data');
  withCardsDataSnapshot({
    baseDir,
    read: ({ lockToken }) => runGenerators(command, lockToken),
  });
}

main();
