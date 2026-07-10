// tests/cards/s2-deck/B01093.gen — HAND-AUTHORED (S2 deck cluster, 非所有者 chooser deck-place)。
//
// production dispatch (enter emit + runAllUntilEmpty) で novel 部を pin:
//   (a) 【登場時】相手デッキ top 1 を公開 → deckPlaceSplitBound{player:'opp'} が発火する。
//   (b) 選択者 = ability owner: human=self が B01093 を登場 → __pendingDeckPlaceSide が立つ
//       (player='opp' / ownerPlayer='self')。engine probe (s2-deckplace-chooser) の card 経由再確認。
//   (c) CPU 側 owner (human 無関係) → 恒等で side-channel 無し + デッキ不変。
//   (d) 相手デッキ 0 枚 → 不発 (クラッシュ/リフレッシュ無し)。
//
// MANUAL-NOTE: ミスリード1 (misreadX 共通クラス) と ヒラメキ draw は shipped 機構の
//   決定表 clone (D01010 / D08013) — 個別 probe は共通クラス側 test でカバー済のため省略。

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import {
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import { _drainPendingDeckPlaceSide } from '@/engine/effect/atom-handlers/_shared';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { ProbeScenario } from '../../helpers/card-probe-harness';
import { B01093 } from '@/cards/ct-p01/B01093';
import type { CardDef } from '@/engine/types';

const FIXTURES: CardDef[] = [];

function scenario(partial: Partial<ProbeScenario> & Pick<ProbeScenario, 'name' | 'setup'>): ProbeScenario {
  return {
    drive: { kind: 'enter', cardId: 'B01093', uid: 'um', side: 'self' },
    script: [],
    expect: [],
    ...partial,
  };
}

describe('B01093 — hand-authored probe (非所有者 chooser deck-place)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetDefRegistry();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    _clearPendingEffectOptionalSide();
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
  });

  it('(a)(b) human=self が登場 → 相手デッキ top 1 公開 + place await (player=opp / ownerPlayer=self)', () => {
    const sc = scenario({
      name: 'await',
      setup: { selfScene: [{ cardId: 'B01093', uid: 'um' }], oppDeckSize: 3, deckSize: 3, fileCount: 2 },
    });
    // harness は human を setup 後に固定しないため drive 前に設定 → runCardScenario 内 resetAll 対策で
    // ここでは harness を経由しつつ、human 設定は runCardScenario 直前に行えないので直接 assert 用に
    // globalThis を確認する (resetAll は __humanPlayerSide を触らない前提を expect で裏取り)。
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const s = runCardScenario(B01093, FIXTURES, sc);
    const pend = _drainPendingDeckPlaceSide();
    expect(pend, 'owner=human → 上/下選択 modal await').not.toBeNull();
    expect(pend!.player).toBe('opp');
    expect(pend!.ownerPlayer).toBe('self');
    expect(s.players.opp.deck.length, 'await 中は未移動 (rules/26)').toBe(3);
  });

  it('(c) CPU owner (opp) が human デッキを対象 → human に modal を出さず恒等 (逆方向誤 modal 防止)', () => {
    // harness は human='self' 固定 → opp 側 B01093 の owner=opp ≠ humanSide = 恒等分岐。
    const sc = scenario({
      name: 'identity',
      setup: { oppScene: [{ cardId: 'B01093', uid: 'um' }], oppDeckSize: 3, deckSize: 3, fileCount: 2 },
      drive: { kind: 'enter', cardId: 'B01093', uid: 'um', side: 'opp' },
      expect: [{ kind: 'deckDelta', side: 'self', n: 0 }],
    });
    runCardScenario(B01093, FIXTURES, sc);
    expect(_drainPendingDeckPlaceSide(), 'CPU の判断を human に押し付けない').toBeNull();
  });

  it('(d) 相手デッキ 0 枚 → 不発 (side-channel 無し、リフレッシュ非誘発)', () => {
    const sc = scenario({
      name: 'deck0',
      setup: { selfScene: [{ cardId: 'B01093', uid: 'um' }], oppDeckSize: 0, deckSize: 3, fileCount: 2 },
      expect: [{ kind: 'deckDelta', side: 'opp', n: 0 }],
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runCardScenario(B01093, FIXTURES, sc);
    expect(_drainPendingDeckPlaceSide()).toBeNull();
  });
});
