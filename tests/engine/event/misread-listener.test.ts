// Phase 8 完全クローズ Commit 3b: misread listener tests
//
// rules: 13-keywords.md §ミスリード
// spec: 計画 — Commit 3b

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import {
  registerMisreadListener,
  _drainPendingMisread,
  _resetPendingMisread,
} from '@/engine/listeners/misread';
import { createEmptyGameState } from '@/engine/state-factory';
import { misreadX } from '@/cards/_shared/misreadX';
import type { CardDef } from '@/engine/types/card-def';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';

// テスト用のミスリード持ちカード def を engine registry に投入
const TEST_MISREAD_CARD: CardDef = {
  id: 'TEST_MISREAD',
  no: 'TEST/0001',
  kind: 'character',
  names: ['テストミスリード'],
  colors: ['blue'],
  level: 1,
  ap: 1000,
  lp: 1000,
  traits: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [misreadX({ x: 2000, abilityId: 'a_mis' })],
  ruleRefs: ['rules/13-keywords.md'],
};

const TEST_NO_ABILITY_CARD: CardDef = {
  ...TEST_MISREAD_CARD,
  id: 'TEST_NO_ABILITY',
  abilities: [],
};

const TEST_REASONING_CARD: CardDef = {
  ...TEST_MISREAD_CARD,
  id: 'TEST_REASONING',
  abilities: [],
  ap: 3000,
  lp: 1500, // x=2000 で reduce 可能 (Heuristic 「届かないなら発動しない」回避)
};

function makeChar(uid: string, cardId: string, state: 'active' | 'sleep' = 'active'): SceneCharacter {
  return {
    cardId,
    uid,
    state,
    isNamed: false,
    enterOrder: 0,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

describe('misread listener (Commit 3b)', () => {
  beforeEach(() => {
    _resetPendingMisread();
    registerMisreadListener();
    engine.cards.register(TEST_MISREAD_CARD);
    engine.cards.register(TEST_NO_ABILITY_CARD);
    engine.cards.register(TEST_REASONING_CARD);
  });

  function makeStateWithReasoningAndMisread(
    reasoningPlayer: 'self' | 'opp',
    misreadPlayer: 'self' | 'opp',
  ): GameState {
    const s = createEmptyGameState();
    s.players[reasoningPlayer].scene = [makeChar('r1', 'TEST_REASONING')];
    s.players[misreadPlayer].scene = [makeChar('m1', 'TEST_MISREAD')];
    return s;
  }

  it('AI defender (opp 側 misread, human=self が推理) → listener が同期的に sleep + LP-X 適用', () => {
    const s = makeStateWithReasoningAndMisread('self', 'opp');
    engine.event.emit(s, 'reasoning:before-add', { uid: 'r1', lpUsed: 1500 }, { player: 'self', uid: 'r1' });
    // opp.m1 がスリープ化されている
    expect(s.players.opp.scene.find((c) => c.uid === 'm1')?.state).toBe('sleep');
    // r1 の lpOverride に reduced 値が直接書かれている (base LP 1500 - 2000 = -500)
    const r1 = s.players.self.scene.find((c) => c.uid === 'r1')!;
    expect(r1.lpOverride).toBe(-500);
    // 同期解決なので側チャネルは null のまま
    expect(_drainPendingMisread()).toBeNull();
  });

  it('Human defender (self 側 misread, opp が推理) → 側チャネルに pending set (state mutation なし)', () => {
    const s = makeStateWithReasoningAndMisread('opp', 'self');
    engine.event.emit(s, 'reasoning:before-add', { uid: 'r1', lpUsed: 1500 }, { player: 'opp', uid: 'r1' });
    // self.m1 はまだ active (UI 経由待ち)
    expect(s.players.self.scene.find((c) => c.uid === 'm1')?.state).toBe('active');
    const pending = _drainPendingMisread();
    expect(pending).not.toBeNull();
    expect(pending?.reasoningUid).toBe('r1');
    expect(pending?.reasoningPlayer).toBe('opp');
    expect(pending?.candidates).toHaveLength(1);
    expect(pending?.candidates[0]).toEqual({ uid: 'm1', x: 2000 });
  });

  it('反対側に misread 持ちがいない → no-op', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar('r1', 'TEST_REASONING')];
    s.players.opp.scene = [makeChar('m1', 'TEST_NO_ABILITY')];
    engine.event.emit(s, 'reasoning:before-add', { uid: 'r1', lpUsed: 1500 }, { player: 'self', uid: 'r1' });
    expect(s.players.opp.scene.find((c) => c.uid === 'm1')?.state).toBe('active');
    expect(_drainPendingMisread()).toBeNull();
  });

  it('Sleep 状態の misread 持ちは対象外', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar('r1', 'TEST_REASONING')];
    s.players.opp.scene = [makeChar('m1', 'TEST_MISREAD', 'sleep')];
    engine.event.emit(s, 'reasoning:before-add', { uid: 'r1', lpUsed: 1500 }, { player: 'self', uid: 'r1' });
    // 既に sleep なので発動しない → lpOverride 未変更 (null)
    const r1 = s.players.self.scene.find((c) => c.uid === 'r1')!;
    expect(r1.lpOverride).toBeNull();
  });
});
