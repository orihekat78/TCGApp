// tests/integration/bug-140-hirameki-batch — BUG-140 補修 (2026-06-13) の挙動検証
//
// rules: 10-action-event.md §ヒラメキ
// bug: .claude/bugs/BUG-140.md
//
// TSV hirameki 列の取りこぼし補修 4 テンプレを、代表カード 1 枚ずつ
// 実 fire 経路 (evidence:remove-by-action → side-channel → hiramekiResolve dispatch) で検証する:
//   h-draw                : D01013 (カードを1枚引く)
//   h-sleep               : B08042 (キャラを1枚まで選び、スリープさせる)
//   h-evid                : B04015 (自分は証拠を1つ得る)
//   h-removeYellowToHand  : B01094 (リムーブの【黄】キャラを1枚まで手札へ — decoy で filter 検証)
// ハーネスは tests/integration/hirameki-e2e.test.ts と同一。

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import { produce } from '@/engine/produce';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
} from '@/engine/listeners/hirameki';
import {
  registerTriggeredListener,
  _resetTriggeredRegistered,
} from '@/engine/listeners/triggered';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import type { GameState } from '@/engine/types/game-state';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';

function fullReset(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  _resetPendingHirameki();
  _resetHiramekiRegistered();
  _resetTriggeredRegistered();
  registerAll();
  registerHiramekiListener();
  registerTriggeredListener();
  useGameStateStore.setState({
    gameState: null,
    activeActionId: null,
    pendingHirameki: null,
    pendingMisread: null,
  });
}

function makeStateWithEvidence(cardId: string): GameState {
  const s = createEmptyGameState();
  s.players.self.evidence = [{ cardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
  s.players.self.deck = Array(10).fill('D08005');
  return s;
}

function emitAndFire(s: GameState, cardId: string): GameState {
  const emitted = produce(s, (d) => {
    engine.event.emit(
      d,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId } },
      { player: 'opp', uid: 'opp-attacker' },
    );
  });
  const pending = _drainPendingHirameki();
  expect(pending).not.toBeNull();
  expect(pending!.cardId).toBe(cardId);
  useGameStateStore.setState({ gameState: emitted, pendingHirameki: pending });
  const r = dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' });
  expect(r.ok).toBe(true);
  expect(useGameStateStore.getState().pendingHirameki).toBeNull();
  return useGameStateStore.getState().gameState!;
}

describe('BUG-140 補修 hirameki 挙動 (テンプレ代表 4 枚)', () => {
  beforeAll(() => {
    registerAll();
  });

  beforeEach(() => {
    fullReset();
  });

  it('h-draw D01013: fire → hand +1 (deck から)', () => {
    const s = makeStateWithEvidence('D01013');
    const startHand = s.players.self.hand.length;
    const startDeck = s.players.self.deck.length;
    const after = emitAndFire(s, 'D01013');
    expect(after.players.self.hand.length).toBe(startHand + 1);
    expect(after.players.self.deck.length).toBe(startDeck - 1);
  });

  it('h-sleep B08042: fire → 現場のキャラ 1 枚がスリープ', () => {
    let s = makeStateWithEvidence('B08042');
    let uid = '';
    s = produce(s, (d) => {
      const c = engine.mutate.scene.enter(d, 'self', 'D08015', {});
      uid = c.uid;
    });
    expect(s.players.self.scene.find((c) => c.uid === uid)!.state).not.toBe('sleep');
    const after = emitAndFire(s, 'B08042');
    expect(after.players.self.scene.find((c) => c.uid === uid)!.state).toBe('sleep');
  });

  it('h-evid B04015: fire → 自分の証拠 +1 (deck -1)', () => {
    const s = makeStateWithEvidence('B04015');
    const startEv = s.players.self.evidence.length;
    const startDeck = s.players.self.deck.length;
    const after = emitAndFire(s, 'B04015');
    expect(after.players.self.evidence.length).toBe(startEv + 1);
    expect(after.players.self.deck.length).toBe(startDeck - 1);
  });

  it('h-removeYellowToHand B01094: fire → リムーブの【黄】キャラのみ手札へ (decoy: 青キャラ/黄イベントは対象外)', () => {
    const s = makeStateWithEvidence('B01094');
    // D11003 = 黄 character (対象) / D08015 = 青 character (色 decoy) / B01094P = 黄 event (種別 decoy)
    s.players.self.remove = ['D11003', 'D08015', 'B01094P'];
    const startHand = s.players.self.hand.length;
    const after = emitAndFire(s, 'B01094');
    expect(after.players.self.hand.length).toBe(startHand + 1);
    expect(after.players.self.hand).toContain('D11003');
    expect(after.players.self.hand).not.toContain('D08015');
    expect(after.players.self.hand).not.toContain('B01094P');
    expect(after.players.self.remove).toEqual(['D08015', 'B01094P']);
  });
});
