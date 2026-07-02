// BUG-163: B08079/B08079P ピンガ — henso 列 (col13)【変装】【事件黒】【FILE7】の grounding 漏れ追補 probe
//
// 検証 (disguise-hook-batch.test.ts 同型):
//   1. a4 が icon-disguise + and[caseColor:黒, fileAtLeast:7] で定義されている (両 printing)
//   2. canDisguise が gate を実評価する — 事件黒+FILE7 → 可 / 事件が黒を持たない → 不可 / FILE6 → 不可
//   3. 2色事件 {黒,他} は caseColor 黒 membership で可 (rules/17【事件(色)】)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { canDisguise } from '@/engine/flow/contact';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { B08079 } from '@/cards/ct-p08/B08079';
import { B08079P } from '@/cards/ct-p08/B08079P';
import type { ActionContext } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

function makeAx(): ActionContext {
  return {
    id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: 'atk', aAP: 4000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  };
}

describe('BUG-163: B08079 ピンガ 変装ゲート【事件黒】【FILE7】', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    _clearPendingEffectPickQueue();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('card defs: 両 printing に a4 icon-disguise + and[事件黒, FILE7]', () => {
    for (const def of [B08079, B08079P]) {
      const a4 = def.abilities.find((a) => a.id === 'a4');
      expect(a4, `${def.id} a4 存在`).toBeDefined();
      expect(a4).toMatchObject({ type: 'icon-disguise' });
      expect(a4?.condition).toMatchObject({
        kind: 'and',
        cs: [
          { kind: 'caseColor', color: '黒' },
          { kind: 'fileAtLeast', n: 7 },
        ],
      });
    }
  });

  it('canDisguise: 事件黒+FILE7 → 可 / 黒なし事件 → 不可 / FILE6 → 不可 / 2色{黒,青} → 可', () => {
    const base = createEmptyGameState();
    base.players.self.scene = [sceneChar('Atk0', 'atk')];
    base.players.opp.scene = [sceneChar('Def0', 'dft')];
    base.players.self.hand = ['B08079'];
    const ax = makeAx();

    const ok = produce(base, (d) => {
      d.players.self.case.colors = ['黒'];
      d.players.self.file = [FB, FB, FB, FB, FB, FB, FB];
    });
    expect(canDisguise(ok, ax, 'self', 'B08079'), '事件黒+FILE7 → 変装可').toBe(true);

    const wrongColor = produce(ok, (d) => { d.players.self.case.colors = ['青']; });
    expect(canDisguise(wrongColor, ax, 'self', 'B08079'), '事件が黒を持たない → 不可').toBe(false);

    const lowFile = produce(ok, (d) => { d.players.self.file = [FB, FB, FB, FB, FB, FB]; });
    expect(canDisguise(lowFile, ax, 'self', 'B08079'), 'FILE6 → 不可').toBe(false);

    const dual = produce(ok, (d) => { d.players.self.case.colors = ['黒', '青']; });
    expect(canDisguise(dual, ax, 'self', 'B08079'), '2色{黒,青} → 可 (membership)').toBe(true);
  });
});
