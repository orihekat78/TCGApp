// tests/integration/misread-e2e.test.ts — Phase 5 advance Misread E2E 結合検証
//
// rules: 11-reasoning.md §LP≤0, 13-keywords.md §ミスリード
// spec: .claude/specs/2026-05-17-phase5-advance-guardrails.md
//
// 目的:
//   Phase 8 commit 3b で完成済の Misread infrastructure が、人間 defender 経路で
//   全経路結合動作することを実証する。AI defender 経路は既存 reasoning.misread.test.ts で確認済。
//
// 検証する経路 (Human defender):
//   doReasoning (opp が推理側)
//     → reasoning:before-add hook 発火
//     → listener (misread.ts) が self.scene の misread 持ちを抽出
//     → reasoningPlayer='opp' のため side-channel `_pendingMisreadSideChannel` set
//     → _drainPendingMisread() で回収
//     → setPendingMisread で Zustand へ
//     → dispatchEngineAction({type:'misreadResolve', picks})
//     → 各 pick について sleep + lpOverride(LP-Xtotal)

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import {
  registerMisreadListener,
  _drainPendingMisread,
  _resetPendingMisread,
  _resetMisreadRegistered,
} from '@/engine/listeners/misread';
import { misreadX } from '@/cards/_shared/misreadX';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import type { CardDef } from '@/engine/types/card-def';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import { makeChar as baseChar } from '../helpers/fixtures';

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

const TEST_MISREADER_2K: CardDef = {
  ...TEST_REASONER,
  id: 'TEST_M2K',
  names: ['ミスリード2000持ち'],
  abilities: [misreadX({ x: 2000, abilityId: 'a_mis' })],
};

const TEST_MISREADER_500: CardDef = {
  ...TEST_REASONER,
  id: 'TEST_M500',
  names: ['ミスリード500持ち'],
  abilities: [misreadX({ x: 500, abilityId: 'a_mis' })],
};

function makeChar(uid: string, cardId: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return baseChar({ cardId, uid, state, enterOrder: 0 });
}

function fullReset(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  _resetPendingMisread();
  _resetMisreadRegistered(); // event._resetRegistry() 後の再登録に必要
  registerAll();
  engine.cards.register(TEST_REASONER);
  engine.cards.register(TEST_MISREADER_2K);
  engine.cards.register(TEST_MISREADER_500);
  registerMisreadListener();
  useGameStateStore.setState({
    gameState: null,
    activeActionId: null,
    pendingHirameki: null,
    pendingMisread: null,
  });
}

describe('Misread E2E 結合検証 — Human defender (Phase 5 advance)', () => {
  beforeAll(() => {
    registerAll();
  });

  beforeEach(() => {
    fullReset();
  });

  it('Test 1: opp が推理、self.scene に misread → side-channel set → drain → store', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    s.players.opp.deck = ['e1', 'e2', 'e3', 'e4', 'e5'];

    engine.flow.doReasoning(s, 'r1');

    const pending = _drainPendingMisread();
    expect(pending).not.toBeNull();
    expect(pending!.reasoningUid).toBe('r1');
    expect(pending!.reasoningPlayer).toBe('opp');
    expect(pending!.candidates).toHaveLength(1);
    expect(pending!.candidates[0]).toEqual({ uid: 'm1', x: 2000 });
  });

  it('Test 2: misread 候補なし → side-channel null のまま', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    // self.scene 空
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    engine.flow.doReasoning(s, 'r1');

    expect(_drainPendingMisread()).toBeNull();
  });

  it('Test 3: 複数 misread → 全候補が listed', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [
      makeChar('m1', 'TEST_M2K'),
      makeChar('m2', 'TEST_M500'),
    ];
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    engine.flow.doReasoning(s, 'r1');

    const pending = _drainPendingMisread();
    expect(pending).not.toBeNull();
    expect(pending!.candidates).toHaveLength(2);
    const xs = pending!.candidates.map((c) => c.x).sort((a, b) => a - b);
    expect(xs).toEqual([500, 2000]);
  });

  it('Test 4: sleep / stun の misread は候補外', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [
      makeChar('m1', 'TEST_M2K', 'sleep'),
      makeChar('m2', 'TEST_M500', 'stun'),
    ];
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    engine.flow.doReasoning(s, 'r1');

    expect(_drainPendingMisread()).toBeNull();
  });

  it('Test 5: dispatch misreadResolve → 選択 pick が sleep + lpOverride', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [
      makeChar('m1', 'TEST_M2K'),
      makeChar('m2', 'TEST_M500'),
    ];
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    engine.flow.doReasoning(s, 'r1');
    const pending = _drainPendingMisread();
    expect(pending).not.toBeNull();

    // store に転送
    useGameStateStore.setState({ gameState: s, pendingMisread: pending });

    // 両方 pick で dispatch
    const r = dispatchEngineAction({
      type: 'misreadResolve',
      picks: [
        { uid: 'm1', x: 2000 },
        { uid: 'm2', x: 500 },
      ],
    });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    // m1, m2 がスリープ
    expect(after.players.self.scene.find((c) => c.uid === 'm1')?.state).toBe('sleep');
    expect(after.players.self.scene.find((c) => c.uid === 'm2')?.state).toBe('sleep');
    // r1 の lpOverride = 1000 - (2000+500) = -1500
    expect(after.players.opp.scene.find((c) => c.uid === 'r1')?.lpOverride).toBe(-1500);
    // pending クリア
    expect(useGameStateStore.getState().pendingMisread).toBeNull();
  });

  it('Test 6: misreadResolve with empty picks → no-op、ただし pending クリア', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    engine.flow.doReasoning(s, 'r1');
    const pending = _drainPendingMisread();
    useGameStateStore.setState({ gameState: s, pendingMisread: pending });

    const r = dispatchEngineAction({ type: 'misreadResolve', picks: [] });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    // pick 0 件で m1 はアクティブのまま、r1 LP もそのまま
    expect(after.players.self.scene.find((c) => c.uid === 'm1')?.state).toBe('active');
    expect(after.players.opp.scene.find((c) => c.uid === 'r1')?.lpOverride).toBeNull();
    // pending クリア
    expect(useGameStateStore.getState().pendingMisread).toBeNull();
  });
});
