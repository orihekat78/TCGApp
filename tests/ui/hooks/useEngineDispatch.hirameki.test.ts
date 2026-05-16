// Phase 8 完全クローズ Commit 3a: hiramekiResolve dispatch tests
//
// rules: 10-action-event.md §ヒラメキ
// spec: 計画 — Commit 3a

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import {
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types/game-state';

describe('hiramekiResolve dispatch (Commit 3a)', () => {
  beforeAll(() => {
    registerAll();
    registerHiramekiListener();
  });

  beforeEach(() => {
    useGameStateStore.setState({ gameState: null, pendingHirameki: null });
    _resetPendingHirameki();
  });

  function makeStateWithDeckAndPending(): GameState {
    const s = createEmptyGameState();
    s.players.self.deck = ['x1', 'x2', 'x3'];
    s.players.self.hand = [];
    return s;
  }

  it('listener が pending を set した後 dispatchEngineAction 経由で Zustand へ転送される', () => {
    const s = makeStateWithDeckAndPending();
    s.players.self.evidence = [
      { cardId: 'D08013', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    useGameStateStore.setState({ gameState: s });

    // 直接 emit してから side channel が drain されることを確認するため、
    // 何らかの dispatch を経由する必要がある。ここでは reasoning dispatch を ((中身は無関係)) 利用。
    // 代わりに event.emit を直接呼んで side channel をセット → dispatch (no-op) で drain。
    engine.event.emit(
      useGameStateStore.getState().gameState!,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08013' } },
      { player: 'opp', uid: 'attacker' },
    );

    // 次の dispatch で drain が走る (endTurn は state.turn.player==='opp' なので not-allowed,
    // 代わりに直接側チャネル → setState を経由するため、ここでは endTurn を試して drain 発火を見る)
    s.turn.player = 'self';
    s.turn.phase = 'main';
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'endTurn', player: 'self' });

    const pending = useGameStateStore.getState().pendingHirameki;
    expect(pending).not.toBeNull();
    expect(pending?.cardId).toBe('D08013');
    expect(pending?.player).toBe('self');
  });

  it('hiramekiResolve fire → ability effect が pendingEffects に queue → 解決後 hand+1', () => {
    const s = makeStateWithDeckAndPending();
    useGameStateStore.setState({
      gameState: s,
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
    });

    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' });
    expect(r.ok).toBe(true);
    // pendingHirameki クリア
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
    // hiramekiDraw n=1 → hand に 1 枚追加 / deck -1
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand.length).toBe(1);
    expect(after.players.self.deck.length).toBe(2);
  });

  it('hiramekiResolve skip → 効果適用なし、pendingHirameki クリアのみ', () => {
    const s = makeStateWithDeckAndPending();
    useGameStateStore.setState({
      gameState: s,
      pendingHirameki: { player: 'self', cardId: 'D08013', abilityId: 'a2' },
    });

    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'skip' });
    expect(r.ok).toBe(true);
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand.length).toBe(0); // 不変
    expect(after.players.self.deck.length).toBe(3); // 不変
  });

  it('pendingHirameki なし状態で hiramekiResolve dispatch → not-allowed', () => {
    const s = makeStateWithDeckAndPending();
    useGameStateStore.setState({ gameState: s, pendingHirameki: null });
    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-allowed');
  });
});
