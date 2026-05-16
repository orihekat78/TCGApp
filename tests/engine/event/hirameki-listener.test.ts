// Phase 8 完全クローズ Commit 3a: Hirameki listener tests
//
// rules: 10-action-event.md §ヒラメキ
// spec: 計画 — Commit 3a

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
  _resetPendingHirameki,
} from '@/engine/listeners/hirameki';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types/game-state';

describe('hirameki listener (Commit 3a)', () => {
  beforeAll(() => {
    // 実カード def を登録 (D08013 = hiramekiDraw 持ち)
    registerAll();
  });

  beforeEach(() => {
    _resetPendingHirameki();
    // listener は engine import 時に自動登録される (重複ガード付き)。冪等のため再登録 OK。
    registerHiramekiListener();
  });

  function makeStateWithEvidence(player: 'self' | 'opp', cardId: string): GameState {
    const s = createEmptyGameState();
    s.players[player].evidence = [
      { cardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    return s;
  }

  it('ヒラメキ持ちカードの evidence:remove-by-action emit → 側チャネルに pending set', () => {
    // D08013 は hiramekiDraw を持つ実装済みカード (Commit 3a スコープで確認済)
    const s = makeStateWithEvidence('self', 'D08013');
    engine.event.emit(
      s,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08013' } },
      { player: 'opp', uid: 'opp-attacker' },
    );
    const pending = _drainPendingHirameki();
    expect(pending).not.toBeNull();
    expect(pending?.player).toBe('self');
    expect(pending?.cardId).toBe('D08013');
    expect(pending?.abilityId).toBe('a2'); // hiramekiDraw default abilityId
  });

  it('ヒラメキなしカードの evidence:remove-by-action emit → 側チャネル null のまま', () => {
    // Partner / event カードや一般キャラはヒラメキを持たない (例: D08001 は持たない想定)
    const s = makeStateWithEvidence('self', 'D08001');
    engine.event.emit(
      s,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08001' } },
      { player: 'opp', uid: 'opp-attacker' },
    );
    const pending = _drainPendingHirameki();
    expect(pending).toBeNull();
  });

  it('opp 側証拠のヒラメキ → player=opp で pending set', () => {
    const s = makeStateWithEvidence('opp', 'D08013');
    engine.event.emit(
      s,
      'evidence:remove-by-action',
      { player: 'opp', ev: { cardId: 'D08013' } },
      { player: 'self', uid: 'self-attacker' },
    );
    const pending = _drainPendingHirameki();
    expect(pending?.player).toBe('opp');
  });
});
