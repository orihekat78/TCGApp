import { beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canActivateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { event } from '@/engine/event';
import { produce } from '@/engine/produce';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { enumDeclaredAbilityIdsFor, enumDeclaredAbilitySources } from '@/ui/hooks/useActionsPanelFlow/enumerators';

const SOURCE = 'B10094-SOURCE';
const DECOY = 'B10094-DECOY';

const sourceCard = {
  id: SOURCE,
  no: SOURCE,
  kind: 'character',
  names: [SOURCE],
  colors: ['black'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [{
    id: 'a1',
    type: 'declared',
    scope: 'on-evidence-file',
    cost: { kind: 'selfToRemove' },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: '',
    ruleRefs: [],
  }],
  ruleRefs: [],
} as unknown as CardDef;

const decoyCard = {
  ...sourceCard,
  id: DECOY,
  no: DECOY,
  names: [DECOY],
  abilities: [],
} as CardDef;

function baseState(): GameState {
  return produce(createEmptyGameState(), (draft) => {
    draft.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  });
}

beforeEach(() => {
  resetDefRegistry();
  event._resetRegistry();
  registerCardDef(sourceCard);
  registerCardDef(decoyCard);
});

describe('B10094 source-area declared ability', () => {
  it('uses the exact face-up evidence occurrence, preserves its source area, and emits the evidence observer', () => {
    const state = produce(baseState(), (draft) => {
      draft.players.self.evidence = [
        { cardId: SOURCE, faceUp: true, origin: 'action' },
        { cardId: DECOY, faceUp: true, origin: 'action' },
        { cardId: SOURCE, faceUp: true, origin: 'action' },
      ];
    });
    const uid = 'evidence:self:2';
    const observed: string[] = [];
    event.on('evidence:removed', (_draft, payload) => { observed.push((payload as { player: string }).player); });

    expect(canActivateDeclaredAbility(state, uid, 'a1')).toBe(true);
    const after = produce(state, (draft) => activateDeclaredAbility(draft, uid, 'a1'));

    expect(after.players.self.evidence.map(entry => entry.cardId)).toEqual([SOURCE, DECOY]);
    expect(after.players.self.remove).toEqual([SOURCE]);
    expect(observed).toEqual(['self']);
    expect(after.log.some(entry => entry.action === 'declaredAbility' && entry.target === `${uid}:a1`)).toBe(true);
    expect(after.pendingEffects).toContainEqual(expect.objectContaining({ source: expect.objectContaining({ area: 'evidence', uid }) }));
  });

  it('pays from the exact face-up FILE occurrence without selecting an assisted partner or equal cardId', () => {
    const state = produce(baseState(), (draft) => {
      draft.players.self.file = [
        { type: 'card-back', cardId: SOURCE, faceUp: true },
        { type: 'assisted-partner', cardId: SOURCE },
        { type: 'card-back', cardId: DECOY, faceUp: true },
        { type: 'card-back', cardId: SOURCE, faceUp: true },
      ];
    });
    const after = produce(state, (draft) => activateDeclaredAbility(draft, 'file:self:3', 'a1'));

    expect(after.players.self.file).toEqual([
      { type: 'card-back', cardId: SOURCE, faceUp: true },
      { type: 'assisted-partner', cardId: SOURCE },
      { type: 'card-back', cardId: DECOY, faceUp: true },
    ]);
    expect(after.players.self.remove).toEqual([SOURCE]);
    expect(after.pendingEffects).toContainEqual(expect.objectContaining({ source: expect.objectContaining({ area: 'file', uid: 'file:self:3' }) }));
  });

  it('enumerates only face-up evidence and face-up card-back FILE occurrences, including duplicates', () => {
    const state = produce(baseState(), (draft) => {
      draft.players.self.evidence = [
        { cardId: SOURCE, faceUp: true, origin: 'action' },
        { cardId: SOURCE, faceUp: false, origin: 'action' },
        { cardId: SOURCE, faceUp: true, origin: 'action' },
      ];
      draft.players.self.file = [
        { type: 'card-back', cardId: SOURCE, faceUp: true },
        { type: 'assisted-partner', cardId: SOURCE },
        { type: 'card-back', cardId: SOURCE, faceUp: false },
        { type: 'card-back', cardId: SOURCE, faceUp: true },
      ];
    });
    const expected = ['evidence:self:0', 'evidence:self:2', 'file:self:0', 'file:self:3'];

    expect(enumDeclaredAbilitySources(state, 'self')).toEqual(expected);
    expect(enumDeclaredAbilityIdsFor(state, 'evidence:self:2')).toEqual(['a1']);
    expect(enumDeclaredAbilityIdsFor(state, 'file:self:3')).toEqual(['a1']);
    expect(enumerateMoves(state, 'self').filter(move => move.kind === 'declaredAbility')).toEqual(
      expected.map(uid => ({ kind: 'declaredAbility', uid, abilityId: 'a1' })),
    );
  });

  it('rejects stale or opponent source UIDs without falling back to an equal cardId', () => {
    const state = produce(baseState(), (draft) => {
      draft.players.self.evidence = [{ cardId: SOURCE, faceUp: true, origin: 'action' }];
      draft.players.opp.evidence = [{ cardId: SOURCE, faceUp: true, origin: 'action' }];
    });

    expect(canActivateDeclaredAbility(state, 'evidence:self:1', 'a1')).toBe(false);
    expect(canActivateDeclaredAbility(state, 'evidence:opp:0', 'a1')).toBe(false);
    expect(enumDeclaredAbilitySources(state, 'self')).toEqual(['evidence:self:0']);
  });
});
