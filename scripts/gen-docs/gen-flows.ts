import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, Node } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { renderHeader } from './lib/header.js';
import { writeMarkdown, diffMarkdown } from './lib/markdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const ENGINE = resolve(PROJECT_ROOT, 'src/engine');
const OUTPUT_DIR = resolve(PROJECT_ROOT, '.claude/auto/flows');

export interface RunOptions {
  checkOnly: boolean;
}

export interface RunResult {
  changedFiles: string[];
  totalFiles: number;
}

// ActionPhase の列挙を types から抽出する。コードと一致しているかの担保。
function extractActionPhases(sf: SourceFile): string[] {
  const alias = sf.getTypeAliasOrThrow('ActionPhase');
  const tn = alias.getTypeNodeOrThrow();
  const phases: string[] = [];
  // Union of string literal types
  if (Node.isUnionTypeNode(tn)) {
    for (const t of tn.getTypeNodes()) {
      const txt = t.getText().trim();
      const m = txt.match(/^'([^']+)'$/) ?? txt.match(/^"([^"]+)"$/);
      if (m && m[1]) phases.push(m[1]);
    }
  }
  return phases;
}

interface FlowDoc {
  fileName: string;
  title: string;
  description: string;
  sourceFiles: string[];
  mermaid: string;
  notes: string;
}

function fenceMermaid(body: string): string {
  return '```mermaid\n' + body + '\n```';
}

// Hand-curated transition diagrams. Phase names verified against source via ts-morph.
function buildActionFsmFlow(actionPhases: string[]): FlowDoc {
  // 検証: ソースに記載された全フェーズが想定リストに含まれているか
  const expected = [
    'declared',
    'guard-window',
    'leave-resolution',
    'contact-pending',
    'action-1',
    'action-2',
    'action-1-redo',
    'judge',
    'contact-end',
    'action-end',
  ];
  const missing = expected.filter((p) => !actionPhases.includes(p));
  const extra = actionPhases.filter((p) => !expected.includes(p));
  const drift =
    missing.length > 0 || extra.length > 0
      ? `> ⚠ Phase ドリフト検知: missing=[${missing.join(', ')}] extra=[${extra.join(', ')}]`
      : '> ✅ ActionPhase は想定 10 フェーズと完全一致';

  const mermaid = fenceMermaid(
    [
      'stateDiagram-v2',
      '  [*] --> declared : flow.action.declare()',
      '  declared --> guard_window : 即時遷移',
      '  guard_window --> leave_resolution : tryGuard() / passGuard(char)',
      '  guard_window --> judge : passGuard(case)',
      '  leave_resolution --> contact_pending : advance()',
      '  contact_pending --> action_1 : contact:start emit',
      '  contact_pending --> judge : case target スキップ',
      '  action_1 --> action_2 : 1番目行動',
      '  action_2 --> action_1_redo : firstActed=false かつ secondActed=true',
      '  action_2 --> judge : それ以外',
      '  action_1_redo --> judge : 1番目再行動',
      '  judge --> contact_end : snapshotAP→AP判定→contact:end emit',
      '  contact_end --> action_end : action:end emit (completed)',
      '  declared --> action_end : abortIfMissing (aborted)',
      '  action_end --> [*] : _deleteContext()',
    ].join('\n'),
  );

  return {
    fileName: 'action-fsm.md',
    title: '🤖 Action FSM (10 phases)',
    description:
      '`flow.action.declare → advance` の 10 フェーズ状態機械（abort 経路含む）。'
      + ' `flow.action.tryGuard` / `passGuard` で初期分岐し、'
      + ' `snapshotAP` で AP スナップショットを取って `judge` 段階で勝敗を確定する。',
    sourceFiles: [
      resolve(ENGINE, 'types/results.ts'),
      resolve(ENGINE, 'flow/action/state-machine.ts'),
    ],
    mermaid,
    notes:
      drift +
      '\n\n各フェーズで emit される Hook:\n\n' +
      '- `declared` → `action:declare`\n' +
      '- `guard-window` → `action:guard-window`\n' +
      '- `leave-resolution` → 直接 emit なし（【現場リムーブ時】解決窓）\n' +
      '- `contact-pending` → `contact:start`, `contact:order-set`\n' +
      '- `action-1` / `action-2` / `action-1-redo` → 各プレイヤーの cutIn / disguise / pass\n' +
      '- `judge` → `contact:before-judge`\n' +
      '- `contact-end` → `contact:end`\n' +
      '- `action-end` → `action:end` (`result: completed` or `aborted`)',
  };
}

function buildAutoPhaseFlow(): FlowDoc {
  const mermaid = fenceMermaid(
    [
      'stateDiagram-v2',
      '  direction LR',
      '  [*] --> activatePartner',
      '  activatePartner --> activateScene : phase:auto:partner emit',
      '  activateScene --> draw : phase:auto:scene emit',
      '  draw --> placeFile : phase:auto:draw emit',
      '  placeFile --> [*] : phase:auto:file emit',
      '  note right of activateScene',
      '    スタン状態のキャラは',
      '    アクティブにならず スリープへ',
      '    (rules/03)',
      '  end note',
      '  note right of placeFile',
      '    通常 2 枚',
      '    先攻 1 ターン目のみ 1 枚',
      '    (rules/05)',
      '  end note',
    ].join('\n'),
  );
  return {
    fileName: 'auto-phase.md',
    title: '🤖 オートフェイズ (4-step)',
    description:
      '`flow.runAutoPhase()` が 1 ターンの開始時に走らせる 4 ステップ。各ステップは Hook を emit するのみで、'
      + ' 能力発火 (登場時等) は pendingEffects に積まれ、呼出元が `engine.resolve.runAllUntilEmpty` で解決する。',
    sourceFiles: [resolve(ENGINE, 'flow/auto-phase.ts'), resolve(ENGINE, 'flow/turn.ts')],
    mermaid,
    notes:
      '- ⚠ スキップ条件: できる状況でなければスキップ (rules/05)。例: 1 ターン目はパートナー active 済みなのでスキップ。\n'
      + '- 先攻 1 ターン目のみ FILE 配置は **1 枚**（`turn.isFirstPlayerFirstTurn`）。',
  };
}

function buildSetupFlow(): FlowDoc {
  const mermaid = fenceMermaid(
    [
      'stateDiagram-v2',
      '  [*] --> init : flow.setup.init()',
      '  init --> decideFirstPlayer : 両者デッキ + パートナー裏向き配置',
      '  decideFirstPlayer --> dealOpeningHand : 先攻決定 (rules/04 §3)',
      '  dealOpeningHand --> mulligan : 各プレイヤー 5 枚ドロー',
      '  mulligan --> reveal : マリガン (1 回 / 任意)',
      '  reveal --> startGame : パートナー + 事件を表向き',
      '  startGame --> [*] : ゲーム開始',
    ].join('\n'),
  );
  return {
    fileName: 'setup.md',
    title: '🤖 ゲーム開始フロー (6-step)',
    description:
      '`flow.setup` の 6 ステップ。各ステップは GameState を Immer draft で変更し、'
      + ' 最終的に `gameStart` 状態（turn.number=1, phase=auto, isFirstPlayerFirstTurn=true）へ到達する。',
    sourceFiles: [resolve(ENGINE, 'flow/setup.ts')],
    mermaid,
    notes:
      '- マリガン: **先攻が先**に決定（rules/04 §5）。FILE は 0 枚スタート。\n'
      + '- 必要証拠数: 先攻=7, 後攻=6（`PlayerState.case.requiredEvidence`）。\n'
      + '- 先攻 1 ターン目のオートフェイズで FILE=1 配置（auto-phase.md 参照）。',
  };
}

function buildTurnFlow(): FlowDoc {
  const mermaid = fenceMermaid(
    [
      'stateDiagram-v2',
      '  [*] --> auto : flow.startTurn() / turn:start emit',
      '  auto --> main : phase:main:start emit',
      '  main --> end : flow.endTurn() / phase:main:end emit',
      '  end --> [*] : phase:end:cleanup emit',
      '  state main {',
      '    [*] --> idle',
      '    idle --> handUseCard : 手札の使用 (1 ターン 1 回)',
      '    idle --> nextHint : ネクストヒント (制限なし)',
      '    idle --> partnerAbility : パートナー能力',
      '    idle --> declaredAbility : 【宣言】能力',
      '    idle --> reasoning : 推理',
      '    idle --> actionFSM : アクション (action-fsm.md)',
      '    handUseCard --> idle',
      '    nextHint --> idle',
      '    partnerAbility --> idle',
      '    declaredAbility --> idle',
      '    reasoning --> idle',
      '    actionFSM --> idle',
      '  }',
    ].join('\n'),
  );
  return {
    fileName: 'turn.md',
    title: '🤖 ターンライフサイクル (auto → main → end)',
    description:
      '1 ターンは 3 フェイズ（auto / main / end）で構成され、6 種類のメイン行動が好きな順番で実行される。'
      + ' 詳細は `rules/05-turn-phases.md` を参照。',
    sourceFiles: [
      resolve(ENGINE, 'flow/turn.ts'),
      resolve(ENGINE, 'flow/main/index.ts'),
    ],
    mermaid,
    notes:
      '- イベント発火順 (1 ターン): `turn:start` → auto 4 emits → `phase:main:start` → ...(main 行動) → `phase:main:end` → `phase:end:start` → `phase:end:cleanup`\n'
      + '- 手札の使用は **1 ターン 1 回まで** （`turnState[p].handUseUsed`）。ネクストヒントを行ったターンは手札使用不可。',
  };
}

function renderFlow(doc: FlowDoc): string {
  const header = renderHeader({
    title: doc.title,
    generator: 'scripts/gen-docs/gen-flows.ts',
    regenerateCmd: 'npm run docs:flows',
    sourceFiles: doc.sourceFiles,
    description: doc.description,
  });
  const sources = doc.sourceFiles
    .map((s) => s.replace(PROJECT_ROOT, '').replace(/\\/g, '/').replace(/^\//, ''))
    .map((s) => `- [\`${s}\`](../../../${s})`)
    .join('\n');
  return (
    header +
    '## 状態遷移図\n\n' +
    doc.mermaid +
    '\n\n## 補足\n\n' +
    doc.notes +
    '\n\n---\n\n## ソース\n\n' +
    sources +
    '\n'
  );
}

export function runGenFlows(options: RunOptions): RunResult {
  const project = new Project({
    tsConfigFilePath: resolve(PROJECT_ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFileAtPath(resolve(ENGINE, 'types/results.ts'));
  const resultsSf = project.getSourceFileOrThrow(resolve(ENGINE, 'types/results.ts'));
  const actionPhases = extractActionPhases(resultsSf);

  const flows: FlowDoc[] = [
    buildSetupFlow(),
    buildAutoPhaseFlow(),
    buildTurnFlow(),
    buildActionFsmFlow(actionPhases),
  ];

  const changed: string[] = [];
  for (const f of flows) {
    const outPath = resolve(OUTPUT_DIR, f.fileName);
    const md = renderFlow(f);
    const diff = diffMarkdown(outPath, md);
    if (diff.changed) {
      if (!options.checkOnly) writeMarkdown(outPath, md);
      changed.push(outPath);
    }
  }

  return { changedFiles: changed, totalFiles: flows.length };
}
