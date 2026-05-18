// Round 4b: triggered ability 汎用 listener テスト
//
// 検証対象: src/engine/listeners/triggered.ts
//
// 焦点: 各 hook で listener が登録されているか + scope / selfOnly / matcher の
//       基本動作。詳細な edge case は他の test に任せる。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import {
  registerTriggeredListener,
  _resetTriggeredRegistered,
} from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';
import { createEmptyGameState } from '@/engine/state-factory';

function makeChar(id: string, abilities: CardDef['abilities']): CardDef {
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

function makeStateWith(cardDef: CardDef): { state: GameState; uid: string } {
  const state = createEmptyGameState();
  // scene に 1 体配置
  const uid = 'self-c1';
  state.players.self.scene.push({
    uid,
    cardId: cardDef.id,
    state: 'active',
    named: false,
    enterOrder: 0,
    apOverride: undefined,
    lpOverride: undefined,
    sets: [],
    stacked: [],
  });
  state.players.self.partner = {
    cardId: 'partner-self',
    state: 'active',
    location: 'partner-area',
    sets: [],
    stacked: [],
  };
  state.players.opp.partner = {
    cardId: 'partner-opp',
    state: 'active',
    location: 'partner-area',
    sets: [],
    stacked: [],
  };
  state.players.self.case = { cardId: 'case-self', status: '事件編', colors: ['赤'], caseLevel: 7 };
  state.players.opp.case = { cardId: 'case-opp', status: '事件編', colors: ['赤'], caseLevel: 6 };
  return { state, uid };
}

describe('engine.listeners.triggered', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
  });

  it('enter hook で triggered ability の effect が pendingEffects に積まれる', () => {
    const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
    const cardDef = makeChar('C1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'enter', selfOnly: true },
      effect,
      description: '',
    }]);
    registerCardDef(cardDef);
    registerTriggeredListener();

    const { state, uid } = makeStateWith(cardDef);
    const after = produce(state, (draft) => {
      event.emit(draft, 'enter', { uid, viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'C1', uid });
    });

    expect(after.pendingEffects).toHaveLength(1);
    expect(after.pendingEffects[0]?.effect).toEqual(effect);
    expect(after.pendingEffects[0]?.triggeredBy.hook).toBe('enter');
  });

  it('selfOnly=true は他のキャラの enter では発火しない', () => {
    const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
    const cardDef = makeChar('C1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'enter', selfOnly: true },
      effect,
      description: '',
    }]);
    registerCardDef(cardDef);
    registerTriggeredListener();

    const { state } = makeStateWith(cardDef);
    const after = produce(state, (draft) => {
      // 別の uid で enter emit → selfOnly フィルタで弾かれる
      event.emit(draft, 'enter', { uid: 'other-uid', viaEffect: false, enterOrder: 1 }, { player: 'self', cardId: 'other', uid: 'other-uid' });
    });

    expect(after.pendingEffects).toHaveLength(0);
  });

  it('matcher で false を返す場合は発火しない', () => {
    const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
    const cardDef = makeChar('C1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: {
        hook: 'enter',
        matcher: (p: unknown) => (p as { tag?: string })?.tag === 'special',
      },
      effect,
      description: '',
    }]);
    registerCardDef(cardDef);
    registerTriggeredListener();

    const { state, uid } = makeStateWith(cardDef);
    const after = produce(state, (draft) => {
      event.emit(draft, 'enter', { uid, viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'C1', uid });
    });

    // matcher が false → 発火なし
    expect(after.pendingEffects).toHaveLength(0);
  });

  it('効果のないカード (effect undefined) は queue されない', () => {
    const cardDef = makeChar('C1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'enter', selfOnly: true },
      effect: undefined,
      description: '',
    }]);
    registerCardDef(cardDef);
    registerTriggeredListener();

    const { state, uid } = makeStateWith(cardDef);
    const after = produce(state, (draft) => {
      event.emit(draft, 'enter', { uid, viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'C1', uid });
    });

    expect(after.pendingEffects).toHaveLength(0);
  });

  it('listener 重複登録は no-op (_registered フラグで防止)', () => {
    registerTriggeredListener();
    registerTriggeredListener();
    registerTriggeredListener();
    // emit 1 回で fire 1 回 (重複登録なら 3 回 fire するはず)
    const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
    const cardDef = makeChar('C1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'enter', selfOnly: true },
      effect,
      description: '',
    }]);
    registerCardDef(cardDef);

    const { state, uid } = makeStateWith(cardDef);
    const after = produce(state, (draft) => {
      event.emit(draft, 'enter', { uid, viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'C1', uid });
    });

    expect(after.pendingEffects).toHaveLength(1);
  });
});
