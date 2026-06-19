// tests/engine/listeners/cutin-summon-misfire — 【カットイン】が召喚時に誤発火しないこと
//
// rules: 09-cutin-disguise.md, 22-qa-action-contact.md
// bug: CPU 可視化で顕在化した「効果スタックが毎ターン増える / 登場時効果が毎ターン発動して見える」
//
// 根因: handUseCard はキャラ召喚時に effect:declared { kind:'character-use' } を emit する。
//   【カットイン】ability は trigger {hook:'effect:declared', optional:true, selfOnly:true} で
//   matcher を持たないため、自分の召喚 (character-use) emit にも一致して charModifyAP($contact.byUid)
//   を queue してしまう。コンタクト外なので noop だが resolved entry が pendingEffects に残留し続け、
//   効果スタック counter が毎ターン増加 + 古い resolved entry が UI の activeCard fallback を汚す。
//
// 正: 【カットイン】(optional effect:declared) は コンタクト中の cutin 起動
//     (flow.contact.cutIn, payload.abilityId==='cutin') 経由でのみ発火する。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import {
  registerTriggeredListener,
  _setHumanPlayerSide,
  _resetTriggeredRegistered,
} from '@/engine/listeners/triggered';
import { registerAll } from '@/cards/index';

describe('cutin must not mis-fire on character summon (effect:declared character-use)', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetTriggeredRegistered();
    registerAll();
    _setHumanPlayerSide('self');
    registerTriggeredListener();
  });

  it('character-use emit (summon) does NOT queue the cutin ability', () => {
    // D08017 円谷光彦 = 【カットイン】AP+2000 (cutin character)
    let s = createEmptyGameState();
    s = produce(s, (d) => {
      engine.mutate.hand.add(d, 'opp', ['D08017']);
    });
    const after = produce(s, (d) => {
      // handUseCard が召喚時に emit するのと同じ payload
      event.emit(
        d,
        'effect:declared',
        { kind: 'character-use', cardId: 'D08017', player: 'opp' },
        { player: 'opp', cardId: 'D08017' },
      );
    });
    expect(after.pendingEffects).toHaveLength(0);
  });

  it('event-use emit also does NOT queue a cutin ability', () => {
    let s = createEmptyGameState();
    s = produce(s, (d) => {
      engine.mutate.hand.add(d, 'opp', ['D08017']);
    });
    const after = produce(s, (d) => {
      event.emit(
        d,
        'effect:declared',
        { kind: 'event-use', cardId: 'D08017', player: 'opp' },
        { player: 'opp', cardId: 'D08017' },
      );
    });
    expect(after.pendingEffects).toHaveLength(0);
  });

  it('genuine cutin invocation (payload.abilityId === "cutin") STILL queues the cutin ability', () => {
    let s = createEmptyGameState();
    s = produce(s, (d) => {
      engine.mutate.hand.add(d, 'opp', ['D08017']);
    });
    const after = produce(s, (d) => {
      // flow.contact.cutIn が emit するのと同じ形 (abilityId:'cutin' + contact bindings)
      event.emit(
        d,
        'effect:declared',
        { cardId: 'D08017', abilityId: 'cutin' },
        { player: 'opp', cardId: 'D08017', bindings: { contact: [{ byUid: 'attacker#1', attackerSide: 'opp' }] } },
      );
    });
    const cutinEntries = after.pendingEffects.filter((e) => e.effect?.kind === 'atom' && e.effect.verb === 'charModifyAP');
    expect(cutinEntries.length).toBeGreaterThan(0);
  });
});
