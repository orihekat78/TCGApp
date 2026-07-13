import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { B06005 } from '@/cards/ct-p06/B06005';
import { B06005P } from '@/cards/ct-p06/B06005P';
import { runCardScenario } from '../helpers/card-probe-harness';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const BOY2: CardDef = { id: 'B06005_BOY2', no: 'test/BOY2', kind: 'character', names: ['少年A'], colors: ['青'], level: 2, ap: 0, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const BOY3: CardDef = { id: 'B06005_BOY3', no: 'test/BOY3', kind: 'character', names: ['少年B'], colors: ['青'], level: 3, ap: 0, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const LEVEL5: CardDef = { id: 'B06005_L5', no: 'test/L5', kind: 'character', names: ['対象5'], colors: ['赤'], level: 5, ap: 0, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const LEVEL6: CardDef = { id: 'B06005_L6', no: 'test/L6', kind: 'character', names: ['対象6'], colors: ['赤'], level: 6, ap: 0, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  [B06005, B06005P, BOY2, BOY3, LEVEL5, LEVEL6].forEach(registerCardDef);
  registerTriggeredListener();
});

describe('B06005 阿笠博士', () => {
  it('B06005/P have identical printed rules', () => {
    expect({ ...B06005, id: '', no: '', rarity: '', imageUrl: '' })
      .toEqual({ ...B06005P, id: '', no: '', rarity: '', imageUrl: '' });
  });

  it('a1 production enter dispatch stacks two remove cards then removes only a character at their level sum', () => {
    const state = runCardScenario(B06005, [BOY2, BOY3, LEVEL5, LEVEL6], {
      name: 'B06005 a1 remove -> stack -> levelSum sceneRemove',
      setup: { selfScene: [{ cardId: 'B06005', uid: 'agasa' }], oppScene: [{ cardId: 'B06005_L5', uid: 'l5' }, { cardId: 'B06005_L6', uid: 'l6' }], remove: ['B06005_BOY2', 'B06005_BOY3'] },
      drive: { kind: 'enter', cardId: 'B06005', uid: 'agasa' },
      script: [{ pickCardIds: ['B06005_BOY2', 'B06005_BOY3'] }, { pickUid: 'l5' }],
      expect: [
        { kind: 'zone', side: 'self', zone: 'remove', cardId: 'B06005_BOY2', present: false },
        { kind: 'zone', side: 'self', zone: 'remove', cardId: 'B06005_BOY3', present: false },
        { kind: 'zone', side: 'opp', zone: 'remove', cardId: 'B06005_L5', present: true },
        { kind: 'zone', side: 'opp', zone: 'scene', cardId: 'B06005_L6', present: true },
      ],
    });
    expect(state.players.self.scene.find(c => c.uid === 'agasa')?.stackedCards)
      .toEqual(expect.arrayContaining([expect.objectContaining({ cardId: 'B06005_BOY2' }), expect.objectContaining({ cardId: 'B06005_BOY3' })]));
  });

  it('a1 zero selection gates the conditional remove rider', () => {
    runCardScenario(B06005, [BOY2, LEVEL5], {
      name: 'B06005 a1 zero stack skips sceneRemove',
      setup: { selfScene: [{ cardId: 'B06005', uid: 'agasa' }], oppScene: [{ cardId: 'B06005_L5', uid: 'l5' }], remove: ['B06005_BOY2'] },
      drive: { kind: 'enter', cardId: 'B06005', uid: 'agasa' },
      script: ['pick:skip'],
      expect: [
        { kind: 'zone', side: 'self', zone: 'remove', cardId: 'B06005_BOY2', present: true },
        { kind: 'zone', side: 'opp', zone: 'scene', cardId: 'B06005_L5', present: true },
      ],
    });
  });

  it('a1 fails closed when its host leaves while the remove-area pick is pending', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene.push(sceneChar('B06005', 'agasa'));
    state.players.self.remove = ['B06005_BOY2'];
    event.emit(state, 'enter', { uid: 'agasa', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'agasa', cardId: 'B06005' });
    runAllUntilEmpty(state);
    mutate.scene.removeToRemove(state, 'agasa');
    applyPickAndContinuation(state, _drainPendingEffectPickSide()!, 'B06005_BOY2#0');
    expect(state.players.self.remove.filter(id => id === 'B06005_BOY2')).toHaveLength(1);
  });

  it('a1 fails closed when the selected remove-area occurrence becomes stale while pending', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene.push(sceneChar('B06005', 'agasa'));
    state.players.self.remove = ['B06005_BOY2'];
    event.emit(state, 'enter', { uid: 'agasa', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'agasa', cardId: 'B06005' });
    runAllUntilEmpty(state);
    state.players.self.remove = [];
    applyPickAndContinuation(state, _drainPendingEffectPickSide()!, 'B06005_BOY2#0');
    expect(state.players.self.scene.find(c => c.uid === 'agasa')?.stackedCards).toBe(0);
  });

  it('a2 production declared dispatch sleeps itself and transfers the exact selected stacked identity', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.scene.push(sceneChar('B06005', 'agasa'), sceneChar('B06005_L5', 'target'));
      d.players.self.scene[0]!.stackedCards = [
        { cardId: 'B06005_BOY2', instanceId: 'stack:agasa:a' },
        { cardId: 'B06005_BOY3', instanceId: 'stack:agasa:b' },
      ];
      activateDeclaredAbility(d, 'agasa', 'a2');
      runAllUntilEmpty(d);
      applyPickAndContinuation(d, _drainPendingEffectPickSide()!, 'target');
      applyPickAndContinuation(d, _drainPendingEffectPickSide()!, 'stack:agasa:b');
    });
    expect(state.players.self.scene.find(c => c.uid === 'agasa')?.state).toBe('sleep');
    expect(state.players.self.scene.find(c => c.uid === 'agasa')?.stackedCards).toEqual([{ cardId: 'B06005_BOY2', instanceId: 'stack:agasa:a' }]);
    expect(state.players.self.scene.find(c => c.uid === 'target')?.stackedCards).toEqual([{ cardId: 'B06005_BOY3', instanceId: 'stack:agasa:b' }]);
  });
});
