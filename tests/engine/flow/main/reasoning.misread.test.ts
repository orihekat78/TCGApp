// Phase 8 完全クローズ Commit 3b: reasoning + misread end-to-end 統合テスト
//
// rules: 11-reasoning.md §LP≤0, 13-keywords.md §ミスリード
// spec: 計画 — Commit 3b
//
// 検証: reasoning 内で listener が LP を下げると、emit 後の LP 再読みにより
// 証拠追加枚数が新値ベースで計算される (lpRaw → lpFinal 修正点)。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerMisreadListener, _drainPendingMisread, _resetMisreadRegistered, _resetPendingMisread, _resolveMisreadPicks } from '@/engine/listeners/misread';
import { _resumeDeferredReasoning } from '@/engine/flow/main/reasoning';
import { createEmptyGameState } from '@/engine/state-factory';
import { misreadX } from '@/cards/_shared/misreadX';
import type { CardDef } from '@/engine/types/card-def';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import { makeChar as baseChar } from '../../../helpers/fixtures';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';

const TEST_REASONER: CardDef = {
  id: 'TEST_R',
  no: 'TEST/R',
  kind: 'character',
  names: ['推理キャラ'],
  colors: ['blue'],
  level: 1,
  ap: 0,
  lp: 1000,
  traits: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

const TEST_MISREADER: CardDef = {
  ...TEST_REASONER,
  id: 'TEST_M',
  names: ['ミスリード持ち'],
  abilities: [misreadX({ x: 2000, abilityId: 'a_mis' })],
};

const TEST_REASONER_SMALL: CardDef = {
  ...TEST_REASONER,
  id: 'TEST_R3',
  lp: 3,
};

const TEST_MISREADER_ONE: CardDef = {
  ...TEST_REASONER,
  id: 'TEST_M1',
  abilities: [misreadX({ x: 1, abilityId: 'a_mis' })],
};

function makeChar(uid: string, cardId: string): SceneCharacter {
  return baseChar({ cardId, uid, enterOrder: 0 });
}

function resolveAllPendingMisread(state: GameState): void {
  const pending = _drainPendingMisread();
  expect(pending).not.toBeNull();
  _resolveMisreadPicks(state, pending!, pending!.candidates);
  _resumeDeferredReasoning(state, pending!.reasoningUid, pending!.reasoningPlayer);
}

describe('reasoning × misread integration (Commit 3b)', () => {
  beforeEach(() => {
    _resetPendingMisread();
    _resetMisreadRegistered();
    _setHumanPlayerSide(null);
    registerMisreadListener();
    engine.cards.register(TEST_REASONER);
    engine.cards.register(TEST_MISREADER);
    engine.cards.register(TEST_REASONER_SMALL);
    engine.cards.register(TEST_MISREADER_ONE);
  });

  it('反対側の misread が LP を下げる → reasoning が新 LP で証拠追加', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [makeChar('r1', 'TEST_R')];
    s.players.opp.scene = [makeChar('m1', 'TEST_M')];
    s.players.self.deck = ['e1', 'e2', 'e3', 'e4', 'e5'];

    engine.flow.doReasoning(s, 'r1');
    runAllUntilEmpty(s);
    runAllUntilEmpty(s);

    // r1 LP=1000, misread x=2000 → totalX(2000) >= targetLp(1000) → AI 1 枚発動
    // 結果: r1 turnEffects.lpMod_turn = -2000 → 実効 LP = -1000 → max(0, -1000) = 0
    // 証拠追加枚数 = 0
    expect(s.players.self.evidence.length).toBe(0);
    // misread キャラはスリープ済
    expect(s.players.opp.scene.find((c) => c.uid === 'm1')?.state).toBe('sleep');
    // 推理キャラもスリープ済 (reasoning による標準動作)
    expect(s.players.self.scene.find((c) => c.uid === 'r1')?.state).toBe('sleep');
  });

  it('反対側に misread なし → 通常通り LP 分の証拠追加', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [makeChar('r1', 'TEST_R')];
    // opp 側に misread なし
    s.players.self.deck = ['e1', 'e2', 'e3', 'e4', 'e5'];

    engine.flow.doReasoning(s, 'r1');
    // r1 LP=1000 → 1000 枚追加…ではなく実は deck 5 枚で頭打ちでもなく LP 1000 は1000枚追加。
    // 実際は LP は ap/lp/level の数値そのまま (LP1000 = 1000 LP)。証拠 5 枚しか deck になく add は addFromDeck で全部使う
    // ここでは「LP の数値」が「枚数」になるため、テスト用の TEST_REASONER.lp は 1000 にしてあるが実際の意図は「1 枚以上」確認
    runAllUntilEmpty(s);
    expect(s.players.self.evidence.length).toBeGreaterThan(0);
  });

  it('既存LP修正と重複計上せず、推理後にミスリード修正だけ消去する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [makeChar('r1', 'TEST_R3')];
    s.players.self.scene[0].turnEffects['lpMod_turn'] = 1;
    s.players.opp.scene = [makeChar('m1', 'TEST_M1')];
    s.players.self.deck = ['e1', 'e2', 'e3', 'e4', 'e5'];

    _setHumanPlayerSide('opp');
    engine.flow.doReasoning(s, 'r1');
    runAllUntilEmpty(s);
    resolveAllPendingMisread(s);

    expect(s.players.self.evidence).toHaveLength(3); // (printed 3 + turn 1) - misread 1
    expect(engine.read.char.lp(s, 'r1')).toBe(4);
    expect(s.players.self.scene[0].lpOverride).toBeNull();
    expect(s.players.self.scene[0].turnEffects['lpMod_turn']).toBe(1);
    expect(s.players.self.scene[0].turnEffects['lpMod_reasoning']).toBeUndefined();
  });

  it('同じキャラの複数回推理で前回のLP-Xが漏れない', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [makeChar('r1', 'TEST_R3')];
    s.players.opp.scene = [makeChar('m1', 'TEST_M1')];
    s.players.self.deck = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];

    _setHumanPlayerSide('opp');
    engine.flow.doReasoning(s, 'r1');
    runAllUntilEmpty(s);
    resolveAllPendingMisread(s);
    s.players.self.scene[0].state = 'active';
    s.players.opp.scene[0].state = 'active';
    engine.flow.doReasoning(s, 'r1');
    runAllUntilEmpty(s);
    resolveAllPendingMisread(s);

    expect(s.players.self.evidence).toHaveLength(4);
    expect(engine.read.char.lp(s, 'r1')).toBe(3);
    expect(s.players.self.scene[0].turnEffects['lpMod_reasoning']).toBeUndefined();
  });

  it('パートナー推理にもLP-Xを適用し、推理後に消去する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner = { cardId: 'TEST_R3', state: 'active', location: 'partner-area', turnEffects: {} };
    s.players.opp.scene = [makeChar('m1', 'TEST_M1')];
    s.players.self.deck = ['e1', 'e2', 'e3'];

    _setHumanPlayerSide('opp');
    engine.flow.doReasoning(s, 'partner:self');
    runAllUntilEmpty(s);
    resolveAllPendingMisread(s);

    expect(s.players.self.evidence).toHaveLength(2);
    expect(s.players.self.partner.turnEffects?.['lpMod_reasoning']).toBeUndefined();
  });
});
