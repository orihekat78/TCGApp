// rules: 04-game-setup.md, 01-victory-conditions.md, 03-field-areas.md
// 空の GameState を生成するファクトリ関数

import type { GameState, PlayerState, TurnScopedFlags } from './types/index.js';

function createEmptyTurnFlags(): TurnScopedFlags {
  return {
    handUseUsed: false,
    nextHintUsed: false,
    assistedThisTurn: false,
    declaredAbilityUseCount: {},
  };
}

function createEmptyPlayerState(requiredEvidence: number): PlayerState {
  return {
    partner: {
      cardId: '',
      state: 'active',
      location: 'partner-area',
    },
    case: {
      cardId: '',
      status: '事件編',
      requiredEvidence,
      colors: [],
      declaredUseCount: {}, // BUG-067: 事件カード declared ability の ターン① enforcement 用
    },
    scene: [],
    hand: [],
    deck: [],
    evidence: [],
    remove: [],
    file: [],
    mulliganUsed: false,
  };
}

export function createEmptyGameState(): GameState {
  return {
    turn: {
      number: 0,
      player: 'self',
      phase: 'auto',
      isFirstPlayerFirstTurn: true,
    },
    players: {
      // rules: 01-victory-conditions.md — 先攻 7枚, 後攻 6枚
      self: createEmptyPlayerState(7),
      opp: createEmptyPlayerState(6),
    },
    pendingEffects: [],
    // rules: 13-keywords.md — 痕跡は初期状態 '未発見'
    scratchTrace: { self: '未発見', opp: '未発見' },
    turnState: {
      self: createEmptyTurnFlags(),
      opp: createEmptyTurnFlags(),
    },
    refreshCount: { self: 0, opp: 0 },
    log: [],
    gameResult: undefined,
  };
}
