import { beforeEach, describe, expect, it } from 'vitest';
import { B04030 } from '@/cards/ct-p04/B04030';
import { B04030P } from '@/cards/ct-p04/B04030P';
import { advance, declare, passGuard, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { applyChoiceAndContinuation, applyDeckReorderAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { _clearPendingEffectChoiceSide, _clearPendingEffectPickQueue, _drainPendingEffectChoiceSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';

const KID: CardDef = {
  id: 'QA_B04030_KID', no: 'QA/B04030/KID', kind: 'character', names: ['怪盗キッド'], colors: ['白'],
  level: 8, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const DECOY: CardDef = { ...KID, id: 'QA_B04030_DECOY', no: 'QA/B04030/DECOY', names: ['decoy'], level: 9 };
const TARGET: CardDef = { ...KID, id: 'QA_B04030_TARGET', no: 'QA/B04030/TARGET', names: ['target'], ap: 1000 };
const SOURCE_COPY: CardDef = { ...B04030, id: 'QA_B04030_SOURCE_COPY', no: 'QA/B04030/SOURCE-COPY', abilities: [] };

function state(deck: string[] = [DECOY.id, KID.id]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = [...deck];
  s.players.self.scene.push(makeChar({ uid: 'kaito', cardId: 'B04030', state: 'active' }));
  s.players.opp.scene.push(makeChar({ uid: 'opponent', cardId: TARGET.id, state: 'sleep' }));
  return s;
}

function finishCharacterAction(s: GameState) {
  const ax = declare(s, 'kaito', { kind: 'char', uid: 'opponent' });
  runAllUntilEmpty(s);
  passGuard(s, ax);
  for (let step = 0; step < 5; step += 1) advance(s, ax);
  // The opposing contact character has left, but Kaito remains in the scene.
  s.players.opp.scene = [];
  advance(s, ax);
  runAllUntilEmpty(s);
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetRegistry(); _resetUidCounter(); _resetActionContexts();
  _clearPendingEffectPickQueue(); _clearPendingEffectChoiceSide();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  for (const def of [B04030, KID, DECOY, TARGET, SOURCE_COPY]) registerCardDef(def);
  registerTriggeredListener();
});

describe('B04030 official-QA action-end reveal', () => {
  it('after its real action removes the opposing character, the remaining source privately offers the revealed Kid', () => {
    const s = state();
    finishCharacterAction(s);

    expect(s.players.opp.scene).toHaveLength(0);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.source.cardId).toBe('B04030');
    expect(pick?.atomVerb).toBe('deckRevealUntil');
    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([KID.id]);
    expect(s.log.find(entry => entry.action === 'effect:deckRevealUntil')?.result).toContain('visibility=private viewer=self');
  });

  it('keeps the parallel printing on the same action-end descriptor', () => {
    expect(B04030P.abilities.find(ability => ability.id === 'a1')?.effect)
      .toEqual(B04030.abilities.find(ability => ability.id === 'a1')?.effect);
  });

  it('allows declining the eligible revealed card and resolves the remaining cards to deck bottom', () => {
    const s = state();
    finishCharacterAction(s);
    applyPickSkipAndContinuation(s, _drainPendingEffectPickSide()!, true);
    const reorder = _drainPendingDeckReorderSide();
    expect(reorder?.cardIds).toEqual([DECOY.id, KID.id]);
    applyDeckReorderAndContinuation(s, reorder!, reorder!.cardIds);

    expect(s.players.self.hand).not.toContain(KID.id);
    expect(s.players.self.deck).toEqual([DECOY.id, KID.id]);
  });

  it('allows a copy with the action source name to be revealed, entered, and to remove only the original source', () => {
    const s = state([SOURCE_COPY.id, KID.id]);
    expect(s.players.self.deck).toEqual([SOURCE_COPY.id, KID.id]);
    const a1 = B04030.abilities.find(ability => ability.id === 'a1')!;
    runEffect(s, a1.effect, {
      source: { player: 'self', area: 'scene', cardId: 'B04030', uid: 'kaito', abilityId: 'a1' },
      bindings: {},
    } as never);
    runAllUntilEmpty(s);

    expect(s.players.self.deck).toEqual([SOURCE_COPY.id, KID.id]);
    const reveal = _drainPendingEffectPickSide()!;
    expect(reveal.candidates.map(candidate => candidate.cardId)).toEqual([SOURCE_COPY.id, KID.id]);
    applyPickAndContinuation(s, reveal, reveal.candidates.find(candidate => candidate.cardId === SOURCE_COPY.id)!.uid);

    const choice = _drainPendingEffectChoiceSide()!;
    expect(choice.source.uid).toBe('kaito');
    applyChoiceAndContinuation(s, choice, 1);

    expect(s.players.self.scene.some(character => character.uid === 'kaito')).toBe(false);
    expect(s.players.self.scene.filter(character => character.cardId === SOURCE_COPY.id)).toHaveLength(1);
    expect(s.players.self.deck).toEqual([KID.id]);
  });

  it.each([
    ['source', 'kaito'],
    ['another character', 'self-fill-1'],
  ])('at a full scene, switching the %s enters the deck card once before removing the original source', (_label, switchRemoveUid) => {
    const s = state([SOURCE_COPY.id, KID.id]);
    for (let index = 1; index <= 4; index += 1) {
      s.players.self.scene.push(makeChar({ uid: `self-fill-${index}`, cardId: TARGET.id, state: 'active' }));
    }
    const a1 = B04030.abilities.find(ability => ability.id === 'a1')!;
    runEffect(s, a1.effect, {
      source: { player: 'self', area: 'scene', cardId: 'B04030', uid: 'kaito', abilityId: 'a1' },
      bindings: {},
    } as never);
    runAllUntilEmpty(s);
    const reveal = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(s, reveal, reveal.candidates.find(candidate => candidate.cardId === SOURCE_COPY.id)!.uid);

    applyChoiceAndContinuation(s, _drainPendingEffectChoiceSide()!, 1, switchRemoveUid);

    expect(s.players.self.scene).toHaveLength(switchRemoveUid === 'kaito' ? 5 : 4);
    expect(s.players.self.scene.filter(character => character.cardId === SOURCE_COPY.id)).toHaveLength(1);
    expect(s.players.self.deck).toEqual([KID.id]);
    expect(s.players.self.scene.some(character => character.uid === switchRemoveUid)).toBe(false);
    expect(s.players.self.scene.some(character => character.uid === 'kaito')).toBe(false);
  });

  it('at a full scene, cancelling the enter switch leaves the original source and deck entry intact', () => {
    const s = state([SOURCE_COPY.id, KID.id]);
    for (let index = 1; index <= 4; index += 1) {
      s.players.self.scene.push(makeChar({ uid: `self-fill-${index}`, cardId: TARGET.id, state: 'active' }));
    }
    const a1 = B04030.abilities.find(ability => ability.id === 'a1')!;
    runEffect(s, a1.effect, {
      source: { player: 'self', area: 'scene', cardId: 'B04030', uid: 'kaito', abilityId: 'a1' },
      bindings: {},
    } as never);
    runAllUntilEmpty(s);
    const reveal = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(s, reveal, reveal.candidates.find(candidate => candidate.cardId === SOURCE_COPY.id)!.uid);

    applyChoiceAndContinuation(s, _drainPendingEffectChoiceSide()!, 1);

    expect(s.players.self.scene.some(character => character.uid === 'kaito')).toBe(true);
    expect(s.players.self.scene.some(character => character.cardId === SOURCE_COPY.id)).toBe(false);
    expect(s.players.self.deck).toEqual([SOURCE_COPY.id, KID.id]);
  });

  it('with zero eligible cards, surfaces the standard optional-reveal confirmation before returning the look to deck bottom', () => {
    const s = state([DECOY.id]);
    event.emit(s, 'action:end', { byUid: 'kaito', result: 'completed' }, { player: 'self', uid: 'kaito' });
    runAllUntilEmpty(s);

    const reveal = _drainPendingEffectPickSide();
    expect(reveal?.atomVerb).toBe('deckRevealUntil');
    expect(reveal?.candidates).toEqual([]);
    applyPickSkipAndContinuation(s, reveal!);
    expect(_drainPendingEffectChoiceSide()).toBeNull();
    expect(_drainPendingDeckReorderSide()).toBeNull();
    expect(s.players.self.deck).toEqual([DECOY.id]);
  });
});
