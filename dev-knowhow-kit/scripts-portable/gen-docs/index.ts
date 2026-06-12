// gen-docs dispatcher (portable 版) — conan プロジェクトから抽出
// 同梱は汎用 2 generator (structure / changelog) のみ。
// 自プロジェクト固有の generator を追加するときは:
//   1. gen-<name>.ts を作り run({checkOnly}): {changedFiles, totalFiles} を export
//   2. 下の import / Command union / COMMANDS / GENERATORS に 1 行ずつ追加
import { runGenStructure } from './gen-structure.js';
import { runGenChangelog } from './gen-changelog.js';

type Command = 'structure' | 'changelog' | 'all' | 'check';

interface ParsedArgs {
  command: Command;
}

const COMMANDS: Command[] = ['structure', 'changelog', 'all', 'check'];

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
  { name: 'structure', matches: (c) => c === 'structure' || c === 'all' || c === 'check', run: runGenStructure },
  { name: 'changelog', matches: (c) => c === 'changelog' || c === 'all' || c === 'check', run: runGenChangelog },
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
