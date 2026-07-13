import { beforeEach, describe, expect, it } from 'vitest';
import { B08008 } from '@/cards/ct-p08/B08008';
import { runCardScenario } from '../helpers/card-probe-harness';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const BLUE_HOST: CardDef = { id: 'B08008_BLUE', no: 'test/BLUE', kind: 'character', names: ['青ホスト'], colors: ['青'], level: 1, ap: 0, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const BOY: CardDef = { id: 'B08008_BOY', no: 'test/BOY', kind: 'character', names: ['少年'], colors: ['青'], level: 1, ap: 0, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); resetDefRegistry(); _clearPendingEffectPickQueue();
  [B08008, BLUE_HOST, BOY].forEach(registerCardDef); registerTriggeredListener();
});

describe('B08008 吉田歩美', () => {
  it('production enter dispatch picks a blue host, stacks the chosen remove card, and grants the turn action token', () => {
    const state = runCardScenario(B08008, [BLUE_HOST, BOY], {
      name: 'B08008 a1 picked host stack + actionTargetsActive',
      setup: { selfScene: [{ cardId: 'B08008', uid: 'ayumi' }, { cardId: 'B08008_BLUE', uid: 'blue' }], remove: ['B08008_BOY'] },
      drive: { kind: 'enter', cardId: 'B08008', uid: 'ayumi' },
      script: [{ pickUid: 'blue' }, { pickCardId: 'B08008_BOY' }],
      expect: [{ kind: 'zone', side: 'self', zone: 'remove', cardId: 'B08008_BOY', present: false }],
    });
    const host = state.players.self.scene.find(c => c.uid === 'blue')!;
    expect(host.stackedCards).toEqual([expect.objectContaining({ cardId: 'B08008_BOY' })]);
    expect(host.turnEffects['actionTargetsActive']).toBe(true);
  });

  it('zero remove choice gates the action grant', () => {
    const state = runCardScenario(B08008, [BLUE_HOST, BOY], {
      name: 'B08008 a1 zero stack skips action grant',
      setup: { selfScene: [{ cardId: 'B08008', uid: 'ayumi' }, { cardId: 'B08008_BLUE', uid: 'blue' }], remove: ['B08008_BOY'] },
      drive: { kind: 'enter', cardId: 'B08008', uid: 'ayumi' },
      script: [{ pickUid: 'blue' }, 'pick:skip'],
      expect: [{ kind: 'zone', side: 'self', zone: 'remove', cardId: 'B08008_BOY', present: true }],
    });
    expect(state.players.self.scene.find(c => c.uid === 'blue')?.turnEffects['actionTargetsActive']).toBeUndefined();
  });

  it('a1 leaves the picked remove card untouched when the selected host leaves before stack resolution', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene.push(sceneChar('B08008', 'ayumi'), sceneChar('B08008_BLUE', 'blue'));
    state.players.self.remove = ['B08008_BOY'];
    event.emit(state, 'enter', { uid: 'ayumi', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'ayumi', cardId: 'B08008' });
    runAllUntilEmpty(state);
    applyPickAndContinuation(state, _drainPendingEffectPickSide()!, 'blue');
    mutate.scene.removeToRemove(state, 'blue');
    applyPickAndContinuation(state, _drainPendingEffectPickSide()!, 'B08008_BOY#0');
    expect(state.players.self.remove.filter(id => id === 'B08008_BOY')).toHaveLength(1);
  });
});
