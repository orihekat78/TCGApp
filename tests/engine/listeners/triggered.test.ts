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
import { makeChar as makeSceneChar } from '../../helpers/fixtures';

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
  // refactor 1c (2026-06-12): 旧スキーマ literal (named/sets/stacked/caseLevel) を
  // 現行 SceneCharacter / PartnerOnBoard / case スキーマへ是正 (旧 field は読み手ゼロ)
  state.players.self.scene.push(makeSceneChar({ uid, cardId: cardDef.id, enterOrder: 0 }));
  state.players.self.partner = {
    cardId: 'partner-self',
    state: 'active',
    location: 'partner-area',
  };
  state.players.opp.partner = {
    cardId: 'partner-opp',
    state: 'active',
    location: 'partner-area',
  };
  state.players.self.case = { cardId: 'case-self', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  state.players.opp.case = { cardId: 'case-opp', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
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

  // Round 4i-fix: BUG-032 — on-hand triggered ability + selfOnly:true で opp 手札の同 cardId が誤発動しない
  it('on-hand + selfOnly:true: opp.hand に同 cardId があっても self の event-use では self 側のみ発動 (BUG-032)', () => {
    const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
    const cardDef = {
      id: 'EV1', no: '0000/EV1', kind: 'event' as const, names: ['EV1'], colors: ['赤'], level: 1, traits: [], rarity: 'C' as const, imageUrl: 'test.jpg', ruleRefs: [],
      abilities: [{
        id: 'a1',
        type: 'triggered' as const,
        scope: 'on-hand' as const,
        trigger: {
          hook: 'effect:declared' as const,
          selfOnly: true,
          matcher: (p: unknown) => (p as { kind?: string })?.kind === 'event-use',
        },
        effect,
        description: '',
      }],
    };
    registerCardDef(cardDef);
    registerTriggeredListener();

    const { state } = makeStateWith(cardDef);
    // self.hand と opp.hand 双方に EV1 を仕込む (BUG-032 検出経路)
    state.players.self.hand = ['EV1'];
    state.players.opp.hand = ['EV1'];

    const after = produce(state, (draft) => {
      // self が EV1 を使用したことを emit
      event.emit(draft, 'effect:declared', { kind: 'event-use', cardId: 'EV1' }, { player: 'self', cardId: 'EV1' });
    });

    // self.source の entry が 1 個、opp.source の entry は 0 個 (BUG-032 修正後)
    expect(after.pendingEffects).toHaveLength(1);
    expect(after.pendingEffects[0]?.source?.player).toBe('self');
  });

  // Round 4i-fix: BUG-033 — ability.condition が false なら queue されない
  it('ability.condition が unmet なら queue されない (BUG-033 partnerColor false)', () => {
    const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
    const cardDef = makeChar('C1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'enter', selfOnly: true },
      condition: { kind: 'partnerColor' as const, color: '青' },
      effect,
      description: '',
    }]);
    // partner-self は colors:['赤'] (青ではない)
    registerCardDef(cardDef);
    registerCardDef({
      id: 'partner-self', no: '0000/partner-self', kind: 'partner', names: ['P'], colors: ['赤'], level: 1, traits: [], rarity: 'C', imageUrl: 'test.jpg', ruleRefs: [], abilities: [], lp: 1,
    } as unknown as CardDef);
    registerTriggeredListener();

    const { state, uid } = makeStateWith(cardDef);
    const after = produce(state, (draft) => {
      event.emit(draft, 'enter', { uid, viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'C1', uid });
    });

    // condition unmet → queue されない
    expect(after.pendingEffects).toHaveLength(0);
  });

  // Round 4i-fix: BUG-033 — ability.condition が true なら通常 queue
  it('ability.condition が met なら通常 queue される (BUG-033 partnerColor true)', () => {
    const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
    const cardDef = makeChar('C1', [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'enter', selfOnly: true },
      condition: { kind: 'partnerColor' as const, color: '赤' },
      effect,
      description: '',
    }]);
    // partner-self は colors:['赤'] (一致)
    registerCardDef(cardDef);
    registerCardDef({
      id: 'partner-self', no: '0000/partner-self', kind: 'partner', names: ['P'], colors: ['赤'], level: 1, traits: [], rarity: 'C', imageUrl: 'test.jpg', ruleRefs: [], abilities: [], lp: 1,
    } as unknown as CardDef);
    registerTriggeredListener();

    const { state, uid } = makeStateWith(cardDef);
    const after = produce(state, (draft) => {
      event.emit(draft, 'enter', { uid, viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'C1', uid });
    });

    // condition met → queue 1
    expect(after.pendingEffects).toHaveLength(1);
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
