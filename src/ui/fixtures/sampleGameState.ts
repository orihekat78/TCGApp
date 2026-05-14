// Phase 7 demo wiring: ブラウザ表示用サンプル GameState fixture
// 視覚状態を網羅したダミーデータ。engine 型に完全準拠。
//
// 実 cardId は CT-D08 (self 側) / CT-D11 (opp 側) から借用、
// cards.json と組み合わせて実キャラ名・色・AP/LP が表示される。

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

function selfPlayer(): PlayerState {
  return {
    partner: { cardId: 'P001', state: 'active', location: 'partner-area' },
    case: { cardId: '0499', status: '事件編', requiredEvidence: 7, colors: ['青'] },
    scene: [
      makeScene('0489', 'self-1', { enterOrder: 0 }),
      makeScene('0490', 'self-2', { enterOrder: 1, state: 'sleep' }),
      makeScene('0491', 'self-3', { enterOrder: 2, isNamed: true, setCards: [{ cardId: 'X', faceUp: true }] }),
    ],
    hand: ['0489', '0490', '0491', '0492', '0493'],
    deck: Array.from({ length: 28 }, (_, i) => `deck-${i}`),
    evidence: [makeEvidence(1), makeEvidence(2), makeEvidence(3)],
    remove: ['0492', '0493'],
    file: [fileBack, fileBack, fileBack, fileBack],
    mulliganUsed: true,
  };
}

function oppPlayer(): PlayerState {
  return {
    partner: { cardId: 'P076', state: 'sleep', location: 'partner-area' },
    case: { cardId: '0946', status: '事件編', requiredEvidence: 6, colors: ['黄'] },
    scene: [
      makeScene('0936', 'opp-1', { enterOrder: 0, state: 'sleep' }),
      makeScene('0937', 'opp-2', { enterOrder: 1, state: 'stun', stackedCards: 1 }),
    ],
    hand: ['0936', '0937', '0938', '0939', '0940'],
    deck: Array.from({ length: 30 }, (_, i) => `opp-deck-${i}`),
    evidence: [makeEvidence(1), makeEvidence(2)],
    remove: ['0940'],
    file: [fileBack, fileBack, fileBack],
    mulliganUsed: true,
  };
}

function pendingEffects(): EffectStackEntry[] {
  return [
    {
      id: 'fx-001',
      source: { player: 'self', cardId: '0491' },
      triggeredBy: { hook: 'OnReasoning' },
      triggeredAt: { turn: 4, phase: 'main', nano: 1 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      effect: { kind: 'demo-placeholder' } as any,
      state: 'pending',
      ownerChosenOrder: 0,
    },
  ];
}

function logEntries(): LogEntry[] {
  return [
    makeLog(1_000_001, 'self', 1, 'reasoning'),
    makeLog(1_000_002, 'opp',  2, 'action', 'self.scene[0]'),
    makeLog(1_000_003, 'self', 3, 'handUse', 'cardId:0492'),
    makeLog(1_000_004, 'opp',  3, 'nextHint'),
    makeLog(1_000_005, 'self', 4, 'reasoning'),
  ];
}

/**
 * 視覚デモ用 GameState を 1 つ生成。
 *
 * シナリオ:
 * - 自分 (先攻、CT-D08「青の古城探索事件」、partner=江戸川コナン active)
 *   - 現場: 灰原哀 (sleep) + 江戸川コナン (active) + 吉田歩美 (active, 名乗り中, setCards 1 枚)
 *   - 手札 5 / デッキ 28 / 証拠 3/7 / リムーブ 2 / FILE 4
 * - 相手 (後攻、CT-D11「千速と重悟の婚活パーティー」、partner=萩原千速 sleep)
 *   - 現場: 萩原千速 (sleep) + 横溝重悟 (stun, 重ね 1 枚)
 *   - 手札 5 / デッキ 30 / 証拠 2/6 / リムーブ 1 / FILE 3
 * - 痕跡: 自=発見済 / 相=未発見
 * - 効果スタック: 1 件 (pending)
 * - ログ: 5 件
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
