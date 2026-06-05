// Engine 拡張 #1: leave/現場リムーブ時 hook (engine-extension-plan.md step 1)
//
// 検証対象: src/engine/mutate/scene.ts (removeToRemove emit) +
//           src/engine/listeners/triggered.ts (leave:to-remove 配線 + 離場カード virtual handler)
//
// rules: 17-icons.md §【現場リムーブ時】(リムーブ方法は問わない),
//        30-floor-rule-misplay.md §現場6枚超過処置はリムーブ発動能力 不発動,
//        25-qa-effects-resolution.md §同時リムーブ条件参照
//
// 焦点:
//   1. 離場したカード自身の【現場リムーブ時】が発火 (virtual handler — scene から消えた後も)
//   2. 他カードが「キャラがリムーブされたとき」に反応 (in-play scan)
//   3. selfOnly 反応は他カードのリムーブでは発火しない
//   4. cause='misplay-overflow' は発火しない (rules/30)
//   5. effect 起因以外の cause (switch/cost/contact-ap) でも発火する (rules/17)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import {
  registerTriggeredListener,
  _resetTriggeredRegistered,
} from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';

const DRAW = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };

function makeCharDef(id: string, abilities: CardDef['abilities']): CardDef {
  return {
    id,
    no: `0000/${id}`,
    kind: 'character',
    names: [id],
    colors: ['赤'],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    rarity: 'C',
    imageUrl: 'test.jpg',
    abilities,
    ruleRefs: [],
  };
}

/** scene に登場 → 指定 cause でリムーブ。produce 内で実行し after を返す。 */
function enterThenRemove(
  state: GameState,
  cardId: string,
  cause: 'contact-ap' | 'effect' | 'switch' | 'cost' | 'misplay-overflow',
): GameState {
  return produce(state, (draft) => {
    const ch = mutate.scene.enter(draft, 'self', cardId, {});
    mutate.scene.removeToRemove(draft, ch.uid, cause);
  });
}

describe('engine: leave:to-remove (現場リムーブ時) hook', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
  });

  it('離場したカード自身の【現場リムーブ時】が発火する (effect cause)', () => {
    const cardDef = makeCharDef('C1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'leave:to-remove', selfOnly: true },
      effect: DRAW,
      description: '現場リムーブ時: 1枚引く',
    }]);
    registerCardDef(cardDef);
    registerTriggeredListener();

    const after = enterThenRemove(createEmptyGameState(), 'C1', 'effect');

    expect(after.pendingEffects).toHaveLength(1);
    expect(after.pendingEffects[0]?.effect).toEqual(DRAW);
    expect(after.pendingEffects[0]?.triggeredBy.hook).toBe('leave:to-remove');
  });

  it('他カードが「キャラがリムーブされたとき」に反応する (selfOnly なし, in-play scan)', () => {
    // R1 = 反応するキャラ (scene に残る)、V1 = リムーブされるキャラ (leave 能力なし)
    const reactor = makeCharDef('R1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'leave:to-remove' }, // selfOnly なし = 任意のリムーブに反応
      effect: DRAW,
      description: 'キャラがリムーブされたとき: 1枚引く',
    }]);
    const victim = makeCharDef('V1', []);
    registerCardDef(reactor);
    registerCardDef(victim);
    registerTriggeredListener();

    const after = produce(createEmptyGameState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'R1', {});       // 反応キャラは残す
      const v = mutate.scene.enter(draft, 'self', 'V1', {});
      mutate.scene.removeToRemove(draft, v.uid, 'effect'); // V1 をリムーブ
    });

    expect(after.pendingEffects).toHaveLength(1);
    expect(after.pendingEffects[0]?.source?.cardId).toBe('R1');
  });

  it('selfOnly 反応は他カードのリムーブでは発火しない', () => {
    const reactor = makeCharDef('R2', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'leave:to-remove', selfOnly: true },
      effect: DRAW,
      description: '自分がリムーブされたとき: 1枚引く',
    }]);
    const victim = makeCharDef('V1', []);
    registerCardDef(reactor);
    registerCardDef(victim);
    registerTriggeredListener();

    const after = produce(createEmptyGameState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'R2', {});
      const v = mutate.scene.enter(draft, 'self', 'V1', {});
      mutate.scene.removeToRemove(draft, v.uid, 'effect');
    });

    expect(after.pendingEffects).toHaveLength(0);
  });

  it('cause=misplay-overflow は【現場リムーブ時】を発火しない (rules/30)', () => {
    const cardDef = makeCharDef('C1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'leave:to-remove', selfOnly: true },
      effect: DRAW,
      description: '現場リムーブ時: 1枚引く',
    }]);
    registerCardDef(cardDef);
    registerTriggeredListener();

    const after = enterThenRemove(createEmptyGameState(), 'C1', 'misplay-overflow');

    expect(after.pendingEffects).toHaveLength(0);
  });

  it('cause=switch / cost / contact-ap でも発火する (rules/17 リムーブ方法は問わない)', () => {
    for (const cause of ['switch', 'cost', 'contact-ap'] as const) {
      event._resetRegistry();
      _resetTriggeredRegistered();
      resetCardDefRegistry();
      const cardDef = makeCharDef('C1', [{
        id: 'a1',
        type: 'triggered',
        scope: 'on-scene',
        trigger: { hook: 'leave:to-remove', selfOnly: true },
        effect: DRAW,
        description: '現場リムーブ時: 1枚引く',
      }]);
      registerCardDef(cardDef);
      registerTriggeredListener();

      const after = enterThenRemove(createEmptyGameState(), 'C1', cause);
      expect(after.pendingEffects, `cause=${cause}`).toHaveLength(1);
    }
  });
});
