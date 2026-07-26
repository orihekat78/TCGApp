import { runGenApi } from './gen-api.js';
import { runGenState } from './gen-state.js';
import { runGenFlows } from './gen-flows.js';
import { runGenProgress } from './gen-progress.js';
import { runGenMapping } from './gen-mapping.js';
import { runGenStructure } from './gen-structure.js';
import { runGenChangelog } from './gen-changelog.js';
import { runGenQaTrace } from './gen-qa-trace.js';

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
  run: (opts: { checkOnly: boolean }) => { changedFiles: string[]; totalFiles: number };
}

const GENERATORS: GeneratorEntry[] = [
  { name: 'api', matches: (c) => c === 'api' || c === 'all' || c === 'check', run: runGenApi },
  { name: 'state', matches: (c) => c === 'state' || c === 'all' || c === 'check', run: runGenState },
  { name: 'flows', matches: (c) => c === 'flows' || c === 'all' || c === 'check', run: runGenFlows },
  { name: 'progress', matches: (c) => c === 'progress' || c === 'all' || c === 'check', run: runGenProgress },
  { name: 'mapping', matches: (c) => c === 'mapping' || c === 'all' || c === 'check', run: runGenMapping },
  { name: 'structure', matches: (c) => c === 'structure' || c === 'all' || c === 'check', run: runGenStructure },
  { name: 'changelog', matches: (c) => c === 'changelog' || c === 'all' || c === 'check', run: runGenChangelog },
  { name: 'qa-trace', matches: (c) => c === 'qa-trace' || c === 'all' || c === 'check', run: runGenQaTrace },
];

function main(): void {
  const { command } = parseArgs(process.argv);
  const checkOnly = command === 'check';

  console.log(`[gen-docs] command: ${command} (${checkOnly ? 'check-only' : 'write'})`);
  const startedAt = Date.now();

  let totalChanged = 0;
  let totalFiles = 0;

  const failures: string[] = [];
  for (const gen of GENERATORS) {
    if (!gen.matches(command)) continue;
    try {
      const result = gen.run({ checkOnly });
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
    process.exit(2);
  }

  if (checkOnly && totalChanged > 0) {
    console.error('[gen-docs] check failed: docs are out of sync. Run `npm run docs` to regenerate.');
    process.exit(1);
  }
}

main();
