// Phase 7 demo wiring: ブラウザ表示用サンプル GameState fixture
// 視覚状態を網羅したダミーデータ。engine 型に完全準拠。
//
// 実 cardId は CT-D11 (self 側、後攻) / CT-D08 (opp 側、先攻) から借用、
// cards.json と組み合わせて実キャラ名・色・AP/LP が表示される。
// engine.cards.get のキーは `cardNum` (D-prefix 形式) なので fixture も D-prefix を使う。

import type {
  GameState,
  SceneCharacter,
  PlayerState,
  EvidenceCard,
  FileCard,
  TurnScopedFlags,
  LogEntry,
} from '@/engine/types/game-state.js';
import type { EffectStackEntry } from '@/engine/types/effect-stack.js';

function makeScene(
  cardId: string,
  uid: string,
  overrides: Partial<SceneCharacter> = {},
): SceneCharacter {
  return {
    cardId,
    uid,
    state: 'active',
    isNamed: false,
    enterOrder: 0,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
    ...overrides,
  };
}

function makeEvidence(turn: number): EvidenceCard {
  return {
    cardId: 'card-back',
    faceUp: false,
    origin: { turn, via: 'reasoning' },
  };
}

function emptyTurnFlags(): TurnScopedFlags {
  return {
    handUseUsed: false,
    nextHintUsed: false,
    assistedThisTurn: false,
    declaredAbilityUseCount: {},
  };
}

const fileBack: FileCard = { type: 'card-back' };

function makeLog(ts: number, player: 'self' | 'opp', turn: number, action: string, target?: string): LogEntry {
  return { ts, player, turn, action, target };
}

// User's reference scenario: 後攻 4ターン目、self が CT-D11 黄 (後攻)、
// opp が CT-D08 青 (先攻)。self.evidence 4/6, self.file 3, opp.file 5/7。
// pendingEffects=0 (TopBar "効果スタック: 0")、scratchTrace self=発見済。
function selfPlayer(): PlayerState {
  return {
    partner: { cardId: 'D11001', state: 'sleep', location: 'partner-area' },
    case: { cardId: 'D11021', status: '事件編', requiredEvidence: 6, colors: ['黄'] },
    scene: [
      makeScene('D11004', 'self-1', { enterOrder: 0, isNamed: true }),
      makeScene('D11006', 'self-2', { enterOrder: 1 }),
      makeScene('D11008', 'self-3', { enterOrder: 2 }),
    ],
    hand: ['D11004', 'D11006', 'D11008', 'D11010', 'D11013'],
    deck: Array.from({ length: 25 }, (_, i) => `deck-${i}`),
    evidence: [makeEvidence(1), makeEvidence(2), makeEvidence(3), makeEvidence(4)],
    remove: ['D11014', 'D11015', 'D11017'],
    file: [fileBack, fileBack, fileBack],
    mulliganUsed: true,
  };
}

function oppPlayer(): PlayerState {
  return {
    partner: { cardId: 'D08001', state: 'sleep', location: 'partner-area' },
    case: { cardId: 'D08026', status: '解決編', requiredEvidence: 7, colors: ['青'] },
    scene: [
      makeScene('D08004', 'opp-1', { enterOrder: 0 }),
      makeScene('D08006', 'opp-2', { enterOrder: 1, state: 'sleep' }),
      makeScene('D08008', 'opp-3', { enterOrder: 2, state: 'stun' }),
    ],
    hand: ['D08004', 'D08006', 'D08008', 'D08010', 'D08012'],
    deck: Array.from({ length: 2 }, (_, i) => `opp-deck-${i}`),
    evidence: [makeEvidence(1), makeEvidence(2), makeEvidence(3), makeEvidence(4), makeEvidence(5)],
    remove: ['D08014'],
    file: [fileBack, fileBack, fileBack, fileBack, fileBack],
    mulliganUsed: true,
  };
}

function pendingEffects(): EffectStackEntry[] {
  // User reference: 効果スタック: 0
  return [];
}

function logEntries(): LogEntry[] {
  // User reference: 対戦ログ 24 — turn 1-4 で 24 件分のログ
  const entries: LogEntry[] = [];
  let ts = 1_000_000;
  const actions = ['reasoning', 'action', 'handUse', 'nextHint', 'endTurn', 'guard'];
  for (let turn = 1; turn <= 4; turn++) {
    for (let i = 0; i < 6; i++) {
      entries.push(makeLog(ts++, i % 2 === 0 ? 'self' : 'opp', turn, actions[i % actions.length] ?? 'action'));
    }
  }
  return entries;
}

/**
 * 視覚デモ用 GameState を 1 つ生成 (ユーザ参考画像のシナリオ準拠)。
 *
 * シナリオ: 後攻 4ターン目 (自分のターン)
 * - 自分 (後攻、CT-D11「千速と重悟の婚活パーティー」黄、partner=萩原千速 sleep)
 *   - 現場: 萩原千速 (名乗り) + 横溝重悟 + 第3キャラ
 *   - 手札 5 / デッキ 25 / 証拠 4/6 / リムーブ 3 / FILE 3
 * - 相手 (先攻、CT-D08「青の古城探索事件」青、partner=江戸川コナン sleep)
 *   - 現場: 0489 + 0490 (sleep) + 0491 (stun)
 *   - 手札 5 / デッキ 2 / 証拠 5/7 / リムーブ 1 / FILE 5/7
 * - 痕跡: 自=発見済 / 相=未発見
 * - 効果スタック: 0
 * - ログ: 24 件 (turn 1-4 × 6 件)
 */
export function createSampleGameState(): GameState {
  return {
    turn: { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false },
    players: { self: selfPlayer(), opp: oppPlayer() },
    pendingEffects: pendingEffects(),
    scratchTrace: { self: '発見済', opp: '未発見' },
    turnState: { self: emptyTurnFlags(), opp: emptyTurnFlags() },
    refreshCount: { self: 0, opp: 0 },
    log: logEntries(),
  };
}
